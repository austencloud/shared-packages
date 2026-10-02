<script lang="ts">
	import { tick, setContext, type Component } from 'svelte';
	import { advancedTagContext } from './advanced-tag-context.js';
	import { fade } from 'svelte/transition';
	import { MediaQuery } from 'svelte/reactivity';
	import Icon from './AdvancedTagIcon.svelte';
	import TagManagerToolbar from './AdvancedTagManagerToolbar.svelte';
	import TagManagerTagTable from './AdvancedTagManagerTagTable.svelte';
	import TagManagerBatchBar from './AdvancedTagManagerBatchBar.svelte';
	import TagManagerColorPicker from './AdvancedTagManagerColorPicker.svelte';
	import TagManagerCategoryPicker from './AdvancedTagManagerCategoryPicker.svelte';
	import {
		getAllCategories,
		type MediaItem,
		type MediaTag,
		type TagColor,
		type TagCategory
	} from './advanced-tag-helpers.js';

	export interface TagManagerActions {
		onCreate: (
			name: string,
			color: TagColor,
			category: TagCategory,
			prereqTagIds?: string[]
		) => Promise<void>;
		onDelete: (tagId: string) => Promise<void>;
		onMerge: (sourceId: string, targetId: string) => Promise<void>;
		onRename: (tagId: string, newName: string) => Promise<void>;
		onChangeCategory: (tagId: string, newCategory: TagCategory) => Promise<void>;
		onChangeColor: (tagId: string, newColor: TagColor) => Promise<void>;
		onChangePrereqs?: ((tagId: string, prereqTagIds: string[]) => Promise<void>) | undefined;
		onRenameCategory?: ((categoryKey: string, newLabel: string) => void) | undefined;
	}

	interface Props {
		tags: MediaTag[];
		items: MediaItem[];
		categoryOrder?: string[];
		Icon?: Component<any>;
		entityHref?: (tag: MediaTag) => string | null | undefined;
		categoryLabels?: Record<string, string>;
		categoryPrereqs?: Record<string, string[]>;
		onChangeCategoryPrereqs?: ((categoryKey: string, prereqTagIds: string[]) => Promise<void>) | undefined;
		actions: TagManagerActions;
		onClose: () => void;
		presentation?: 'dialog' | 'inline';
		compact?: boolean;
		appearance?: 'default' | 'rows';
		categoryVisual?: (category: string) => { icon: string; accent: string };
		initialCategory?: string | null;
	}

	const {
		tags,
		items,
		categoryOrder: configuredCategoryOrder = ['content'],
		Icon: hostIcon,
		entityHref,
		categoryLabels = {},
		categoryPrereqs = {},
		onChangeCategoryPrereqs,
		actions,
		onClose,
		presentation = 'dialog',
		compact = false,
		appearance = 'default',
		categoryVisual,
		initialCategory = null
	}: Props = $props();
	setContext(advancedTagContext, { Icon: hostIcon, entityHref });

	const uid = $props.id();

	// ── UI State ──────────────────────────────────────────

	type SortOption = 'name' | 'usage' | 'date';

	let searchQuery = $state('');
	let sortBy = $state<SortOption>('name');
	let categoryFilter = $state<string | null>(initialCategory);
	let showInlineCreate = $state(false);

	// Selection state
	let selectedTagIds = $state<Set<string>>(new Set());
	let selectionMode = $state(false);

	// Merge state
	let mergeSourceIds = $state<string[]>([]);
	let showMergeFlow = $state(false);

	// Batch pickers
	let showBatchColorPicker = $state(false);
	let showBatchCategoryPicker = $state(false);
	let showBatchDeleteConfirm = $state(false);
	let batchDeleteCancelBtn: HTMLButtonElement | undefined = $state();

	// Focus the confirm's Cancel button whenever it opens, so keyboard and
	// screen-reader users land somewhere inside the dialog immediately.
	$effect(() => {
		if (showBatchDeleteConfirm) {
			tick().then(() => batchDeleteCancelBtn?.focus());
		}
	});

	// Fine pointer still enables the row's desktop rename shortcut.
	const finePointer = new MediaQuery('(pointer: fine)');
	const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');
	let canDrag = $derived(finePointer.current);

	// Phone sheet follows the visual viewport so the on-screen keyboard
	// doesn't cover the header, the Create button, or the field being typed in.
	let sheetEl: HTMLDivElement | undefined = $state();

	// Focus moves into the sheet as soon as it opens (and back to whatever
	// opened it on close). That matters for Escape: a keydown's bubble path
	// only passes through this overlay's own handleKeydown (below) when the
	// event target is inside it. If focus were still on the opener button or
	// on body instead, that button/body is an ancestor of (or unrelated to)
	// this overlay, not a descendant, so the bubble path would skip this
	// handler entirely and Escape would reach the spotlight's window
	// listener straight through. Escape is the only key this sheet
	// intercepts itself; every other key relies on the spotlight's own
	// isTagManagerOpen() check (MediaSpotlightCurator.svelte) to stop it
	// from reaching MediaSpotlight's navigation and shortcut handling behind
	// this panel.
	$effect(() => {
		if (!sheetEl || presentation !== 'dialog') return;
		const opener = document.activeElement as HTMLElement | null;
		sheetEl.focus({ preventScroll: true });
		return () => {
			if (opener?.isConnected) opener.focus({ preventScroll: true });
		};
	});

	// Most actions inside the sheet (rename save/cancel, a color or category
	// pick, single-tag delete, any row-menu item) close a picker or panel
	// without moving focus anywhere else, which drops it to body. Once
	// it's there, Escape stops reaching this overlay's handleKeydown for the
	// same reason described above. Whenever focus leaves an element with
	// nothing else claiming it, send it back to the sheet itself.
	function handleSheetFocusOut(e: FocusEvent) {
		if (e.relatedTarget) return;
		queueMicrotask(() => {
			// Guards against stealing focus while the sheet is closing
			// (unmounted, so this becomes a no-op) and against a legitimate
			// move outside the sheet. Manage Tags renders nothing via a
			// portal, so "outside" only ever means the sheet is gone or
			// focus already landed back inside it by the time this runs.
			if (!sheetEl?.isConnected) return;
			if (!sheetEl.contains(document.activeElement)) {
				sheetEl.focus({ preventScroll: true });
			}
		});
	}

	$effect(() => {
		const vv = window.visualViewport;
		if (!vv || !sheetEl || presentation !== 'dialog') return;
		const el = sheetEl;
		let frame = 0;
		const sync = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				el.style.setProperty('--tm-vv-height', `${vv.height}px`);
				el.style.setProperty('--tm-vv-top', `${vv.offsetTop}px`);
			});
		};
		sync();
		vv.addEventListener('resize', sync);
		vv.addEventListener('scroll', sync);
		return () => {
			cancelAnimationFrame(frame);
			vv.removeEventListener('resize', sync);
			vv.removeEventListener('scroll', sync);
		};
	});

	// Highlight state for newly created tags (scroll + glow)
	let highlightTagId = $state<string | null>(null);

	// ── Derived Data ──────────────────────────────────────

	let categoryOrder = $derived(getAllCategories(tags, configuredCategoryOrder));

	// Item counts per tag
	let itemCountMap = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const tag of tags) {
			counts.set(tag.id, 0);
		}
		for (const item of items) {
			for (const tagId of item.tags) {
				const current = counts.get(tagId);
				if (current !== undefined) {
					counts.set(tagId, current + 1);
				}
			}
		}
		return counts;
	});

	// Apply search filter
	let searchFilteredTags = $derived.by(() => {
		if (!searchQuery.trim()) return tags;
		const q = searchQuery.trim().toLowerCase();
		return tags.filter((t) => t.name.toLowerCase().includes(q));
	});

	// Search always spans every category. Otherwise show the chosen category.
	let filteredTags = $derived.by(() => {
		if (searchQuery.trim() || !categoryFilter) return searchFilteredTags;
		return searchFilteredTags.filter((t) => (t.category ?? 'content') === categoryFilter);
	});

	// Sort tags
	let sortedTags = $derived.by(() => {
		const sorted = [...filteredTags];
		switch (sortBy) {
			case 'name':
				sorted.sort((a, b) => a.name.localeCompare(b.name));
				break;
			case 'usage':
				sorted.sort((a, b) => (itemCountMap.get(b.id) ?? 0) - (itemCountMap.get(a.id) ?? 0));
				break;
			case 'date':
				sorted.sort((a, b) => {
					const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
					const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
					return dateB - dateA;
				});
				break;
		}
		return sorted;
	});

	// Group sorted tags by category
	let tagsByCategory = $derived.by(() => {
		const grouped = new Map<string, Array<{ tag: MediaTag; itemCount: number }>>();
		for (const cat of categoryOrder) {
			const catTags = sortedTags
				.filter((t) => (t.category ?? 'content') === cat)
				.map((tag) => ({
					tag,
					itemCount: itemCountMap.get(tag.id) ?? 0
				}));
			if (catTags.length > 0) {
				grouped.set(cat, catTags);
			}
		}
		return grouped;
	});

	// Visible categories
	let visibleCategories = $derived(categoryOrder.filter((cat) => tagsByCategory.has(cat)));

	// Items that carry at least one selected tag (for the batch delete warning)
	let selectedItemCount = $derived.by(() => {
		if (selectedTagIds.size === 0) return 0;
		let n = 0;
		for (const item of items) {
			if (item.tags.some((id) => selectedTagIds.has(id))) n++;
		}
		return n;
	});

	// Check if all visible tags are selected
	let allVisibleSelected = $derived.by(() => {
		if (sortedTags.length === 0) return false;
		return sortedTags.every((t) => selectedTagIds.has(t.id));
	});

	// ── Selection Handlers ────────────────────────────────

	// Closes every batch panel (color/category pickers, delete confirm) so a
	// panel from before a selection change never lingers over a different
	// selection than the one it was opened for.
	function closeBatchPickers() {
		showBatchColorPicker = false;
		showBatchCategoryPicker = false;
		showBatchDeleteConfirm = false;
	}

	// Whenever the selection empties out (by deselecting the last tag, a
	// batch action completing, or anything else), any open batch panel is
	// stale and must close with it.
	$effect(() => {
		if (selectedTagIds.size === 0) closeBatchPickers();
	});

	function toggleSelect(tagId: string) {
		const next = new Set(selectedTagIds);
		if (next.has(tagId)) {
			next.delete(tagId);
		} else {
			next.add(tagId);
		}
		selectedTagIds = next;
	}

	function selectAll() {
		closeBatchPickers();
		if (allVisibleSelected) {
			selectedTagIds = new Set();
		} else {
			selectedTagIds = new Set(sortedTags.map((t) => t.id));
		}
	}

	function clearSelection() {
		selectedTagIds = new Set();
		closeBatchPickers();
	}

	function toggleSelectionMode() {
		if (selectionMode) clearSelection();
		selectionMode = !selectionMode;
	}

	function openCreateWizard() {
		closeBatchPickers();
		showInlineCreate = true;
	}

	async function navigateCategory(category: string | null) {
		if (selectionMode) {
			clearSelection();
			selectionMode = false;
		}
		// In the split view the category list stays visible during a search;
		// choosing a category there means "show me this one", so drop the search.
		if (category) searchQuery = '';
		categoryFilter = category;
		await tick();
		// In the split view there is no back button, so this querySelector
		// finds nothing for a category pick and focus deliberately stays on
		// the split row that was tapped.
		sheetEl
			?.querySelector<HTMLButtonElement>(category ? '.category-back' : '.category-index-row')
			?.focus();
	}

	// ── Merge Handlers ────────────────────────────────────

	function startSingleMerge(tagId: string) {
		mergeSourceIds = [tagId];
		showMergeFlow = true;
	}

	function startBatchMerge() {
		closeBatchPickers();
		mergeSourceIds = [...selectedTagIds];
		showMergeFlow = true;
	}

	async function confirmMerge(targetId: string) {
		try {
			for (const sourceId of mergeSourceIds) {
				await actions.onMerge(sourceId, targetId);
			}
		} catch {
			// The caller reports the failure. Keep the merge choice visible.
			return;
		}
		showMergeFlow = false;
		mergeSourceIds = [];
		clearSelection();
	}

	function cancelMerge() {
		showMergeFlow = false;
		mergeSourceIds = [];
	}

	// ── Batch Operation Handlers ──────────────────────────

	function handleBatchColorClick() {
		showBatchColorPicker = true;
		showBatchCategoryPicker = false;
		showBatchDeleteConfirm = false;
	}

	function handleBatchCategoryClick() {
		showBatchCategoryPicker = true;
		showBatchColorPicker = false;
		showBatchDeleteConfirm = false;
	}

	function handleBatchDeleteClick() {
		showBatchDeleteConfirm = true;
		showBatchColorPicker = false;
		showBatchCategoryPicker = false;
	}

	// Returns focus to the Delete button in the selection bar that opened
	// the confirm, so dismissing it doesn't strand keyboard focus.
	function focusBatchDeleteTrigger() {
		sheetEl?.querySelector<HTMLButtonElement>('.batch-btn.danger')?.focus();
	}

	function cancelBatchDeleteConfirm() {
		showBatchDeleteConfirm = false;
		focusBatchDeleteTrigger();
	}

	async function handleBatchColorSelect(color: TagColor) {
		for (const tagId of selectedTagIds) {
			await actions.onChangeColor(tagId, color);
		}
		showBatchColorPicker = false;
		clearSelection();
	}

	async function handleBatchCategorySelect(category: TagCategory) {
		for (const tagId of selectedTagIds) {
			await actions.onChangeCategory(tagId, category);
		}
		showBatchCategoryPicker = false;
		clearSelection();
	}

	async function handleBatchDelete() {
		for (const tagId of selectedTagIds) {
			await actions.onDelete(tagId);
		}
		showBatchDeleteConfirm = false;
		clearSelection();
		// The confirm panel and the batch bar's Delete button both vanish
		// with the selection, leaving nothing to hold focus. The sheet's
		// onfocusout guard (handleSheetFocusOut) relies on a focusout event
		// firing when the focused node is removed, which Chromium does but
		// Firefox and likely WebKit don't, so it's a backstop here, not the
		// only path back. Refocus the sheet explicitly too.
		sheetEl?.focus({ preventScroll: true });
	}

	// ── Create Tag (shared scroll-to-highlight logic) ───

	async function scrollToNewTag(name: string) {
		const normalized = name.trim().replace(/(^|\s)\w/g, (c) => c.toUpperCase());
		const newTag = tags.find((t) => t.name === normalized);
		if (newTag) {
			highlightTagId = newTag.id;
			await tick();
			const el = document.querySelector(`[data-tag-id="${newTag.id}"]`);
			el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			setTimeout(() => {
				highlightTagId = null;
			}, 2200);
		}
	}

	async function handleQuickCreate(name: string, color: TagColor, category: TagCategory) {
		await actions.onCreate(name, color, category);
		categoryFilter = category;
		searchQuery = '';
		await scrollToNewTag(name);
	}

	async function handleCreateTag(
		name: string,
		color: TagColor,
		category: TagCategory,
		prereqTagIds?: string[]
	) {
		await actions.onCreate(name, color, category, prereqTagIds);
		showInlineCreate = false;
		categoryFilter = category;
		searchQuery = '';
		await scrollToNewTag(name);
	}

	// ── Keyboard Handler ──────────────────────────────────

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Tab' && sheetEl && presentation === 'dialog') {
			const controls = [
				...sheetEl.querySelectorAll<HTMLElement>(
					'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]'
				)
			].filter((el) => el.getClientRects().length > 0);
			if (controls.length) {
				const first = controls[0];
				const last = controls[controls.length - 1];
				if (
					e.shiftKey &&
					(document.activeElement === first || document.activeElement === sheetEl)
				) {
					e.preventDefault();
					last?.focus();
				} else if (
					!e.shiftKey &&
					(document.activeElement === last || document.activeElement === sheetEl)
				) {
					e.preventDefault();
					first?.focus();
				}
			}
			return;
		}
		if (e.key === 'Escape') {
			if (showMergeFlow) {
				cancelMerge();
				e.stopPropagation();
			} else if (showInlineCreate) {
				showInlineCreate = false;
				e.stopPropagation();
			} else if (showBatchDeleteConfirm) {
				cancelBatchDeleteConfirm();
				e.stopPropagation();
			} else if (showBatchColorPicker || showBatchCategoryPicker) {
				showBatchColorPicker = false;
				showBatchCategoryPicker = false;
				e.stopPropagation();
			} else if (searchQuery) {
				searchQuery = '';
				e.stopPropagation();
			} else if (categoryFilter) {
				categoryFilter = null;
				e.stopPropagation();
			} else if (selectedTagIds.size > 0) {
				clearSelection();
				e.stopPropagation();
			} else {
				// Without this, the Escape keydown keeps bubbling to the
				// spotlight's own window listener and closes it too.
				e.stopPropagation();
				onClose();
			}
		}
	}

	// Merge source tags for the merge flow
	let mergeSourceTags = $derived(
		mergeSourceIds
			.map((id) => tags.find((t) => t.id === id))
			.filter((t): t is MediaTag => t !== undefined)
	);
</script>

<div
	class="tag-manager-overlay"
	class:inline={presentation === 'inline'}
	class:compact
	class:rows={appearance === 'rows'}
	onclick={(e) => {
		if (presentation === 'dialog' && e.target === e.currentTarget) onClose();
	}}
	onkeydown={handleKeydown}
	role="presentation"
>
	<div
		class="tag-manager"
		class:inline={presentation === 'inline'}
		class:compact
		class:rows={appearance === 'rows'}
		role={presentation === 'dialog' ? 'dialog' : undefined}
		aria-modal={presentation === 'dialog' ? 'true' : undefined}
		aria-label="Manage tags"
		tabindex={presentation === 'dialog' ? -1 : undefined}
		bind:this={sheetEl}
		onfocusout={(e) => {
			if (presentation === 'dialog') handleSheetFocusOut(e);
		}}
	>
		<!-- Header -->
		<div class="header">
			<div class="header-nav">
				{#if showInlineCreate}
					<div
						class="header-state"
						in:fade={{ duration: reducedMotion.current ? 0 : 200, delay: reducedMotion.current ? 0 : 80 }}
						out:fade={{ duration: reducedMotion.current ? 0 : 150 }}
					>
						<button
							class="back-btn"
							onclick={() => (showInlineCreate = false)}
							aria-label="Back to tag list"
						>
							<Icon name="arrow-left" size={16} />
						</button>
						<h2 class="title title-centered">New Tag</h2>
					</div>
				{:else if showMergeFlow}
					<div
						class="header-state"
						in:fade={{ duration: reducedMotion.current ? 0 : 200, delay: reducedMotion.current ? 0 : 80 }}
						out:fade={{ duration: reducedMotion.current ? 0 : 150 }}
					>
						<button class="back-btn" onclick={cancelMerge} aria-label="Back to tag list">
							<Icon name="arrow-left" size={16} />
						</button>
						<h2 class="title title-centered">Merge Tags</h2>
					</div>
				{:else}
					<div
						class="header-state"
						in:fade={{ duration: reducedMotion.current ? 0 : 200, delay: reducedMotion.current ? 0 : 80 }}
						out:fade={{ duration: reducedMotion.current ? 0 : 150 }}
					>
						<div class="header-left">
							<h2 class="title">Manage Tags</h2>
							{#if presentation !== 'inline'}
								<span class="tag-count">{tags.length}</span>
							{/if}
						</div>
						<div class="header-actions">
							<button class="new-tag-btn" onclick={openCreateWizard}>
								<Icon name="plus" size={14} />
								New Tag
							</button>
						</div>
					</div>
				{/if}
			</div>
			<button
				class="close-btn"
				onclick={onClose}
				aria-label={presentation === 'inline' ? 'Done managing tags' : 'Close'}
			>
				{#if presentation === 'inline'}Done{:else}<Icon name="xmark" size={18} />{/if}
			</button>
		</div>

		<!-- Batch Pickers -->
		{#if showBatchColorPicker}
			<div class="batch-picker-panel">
				<p class="batch-picker-label">
					Change color for {selectedTagIds.size} tag{selectedTagIds.size !== 1 ? 's' : ''}
				</p>
				<TagManagerColorPicker current={null} onSelect={handleBatchColorSelect} />
				<button class="batch-picker-cancel" onclick={() => (showBatchColorPicker = false)}
					>Cancel</button
				>
			</div>
		{/if}

		{#if showBatchCategoryPicker}
			<div class="batch-picker-panel">
				<p class="batch-picker-label">
					Move {selectedTagIds.size} tag{selectedTagIds.size !== 1 ? 's' : ''} to
				</p>
				<TagManagerCategoryPicker
					{appearance}
					current=""
					categories={categoryOrder}
					{categoryLabels}
					onSelect={handleBatchCategorySelect}
				/>
				<button class="batch-picker-cancel" onclick={() => (showBatchCategoryPicker = false)}
					>Cancel</button
				>
			</div>
		{/if}

		{#if showBatchDeleteConfirm && selectedTagIds.size > 0}
			<div
				class="batch-picker-panel batch-delete-panel"
				role="alertdialog"
				aria-label="Delete tags"
				aria-describedby="{uid}-batch-delete-desc"
			>
				<p class="batch-picker-label" id="{uid}-batch-delete-desc">
					Delete {selectedTagIds.size} tag{selectedTagIds.size !== 1 ? 's' : ''}?
					{#if selectedItemCount > 0}
						They come off {selectedItemCount} item{selectedItemCount !== 1 ? 's' : ''}.
					{/if}
					This can't be undone.
				</p>
				<div class="batch-delete-actions">
					<button
						class="batch-picker-cancel"
						bind:this={batchDeleteCancelBtn}
						onclick={cancelBatchDeleteConfirm}>Cancel</button
					>
					<button class="batch-delete-btn" onclick={handleBatchDelete}>
						Delete {selectedTagIds.size} tag{selectedTagIds.size !== 1 ? 's' : ''}
					</button>
				</div>
			</div>
		{/if}

		<!-- Tag Table -->
		<TagManagerTagTable
			{compact}
			{appearance}
			{categoryVisual}
			{selectionMode}
			{tagsByCategory}
			{visibleCategories}
			allCategories={categoryOrder}
			{categoryLabels}
			allTags={tags}
			{categoryPrereqs}
			{selectedTagIds}
			{highlightTagId}
			dragSourceId={null}
			dragOverTagId={null}
			{canDrag}
			isSearching={!!searchQuery.trim()}
			searchQuery={searchQuery.trim()}
			{categoryFilter}
			onOpenCategory={navigateCategory}
			showCreateWizard={showInlineCreate}
			onQuickCreate={handleQuickCreate}
			onCreateTag={handleCreateTag}
			onCloseCreateWizard={() => (showInlineCreate = false)}
			onToggleSelect={toggleSelect}
			onRename={actions.onRename}
			onChangeColor={actions.onChangeColor}
			onChangeCategory={actions.onChangeCategory}
			onChangePrereqs={actions.onChangePrereqs}
			{onChangeCategoryPrereqs}
			onDelete={actions.onDelete}
			onStartMerge={startSingleMerge}
			onRenameCategory={actions.onRenameCategory}
			onDragStart={() => {}}
			onDragOver={() => {}}
			onDragLeave={() => {}}
			onDrop={() => {}}
			onDragEnd={() => {}}
			showMergeWizard={showMergeFlow && mergeSourceTags.length > 0}
			mergeMode={mergeSourceTags.length === 1 ? 'single' : 'batch'}
			{mergeSourceTags}
			mergeItemCountMap={itemCountMap}
			onMergeConfirm={confirmMerge}
			onMergeCancel={cancelMerge}
		>
			{#snippet toolbar()}
				<TagManagerToolbar
					{compact}
					{appearance}
					{selectionMode}
					{searchQuery}
					{sortBy}
					{categoryFilter}
					allCategories={categoryOrder}
					{categoryLabels}
					totalTagCount={tags.length}
					visibleTagCount={sortedTags.length}
					selectedCount={selectedTagIds.size}
					{allVisibleSelected}
					showBrowseSummary={presentation !== 'inline'}
					onSearchChange={(q) => (searchQuery = q)}
					onSortChange={(s) => (sortBy = s)}
					onCategoryFilterChange={(c) => (categoryFilter = c)}
					onSelectAll={selectAll}
					onToggleSelectionMode={toggleSelectionMode}
				/>
			{/snippet}
		</TagManagerTagTable>

		{#if !showInlineCreate && !showMergeFlow}
			<!-- Batch Bar -->
			<TagManagerBatchBar
				selectedCount={selectedTagIds.size}
				onChangeColor={handleBatchColorClick}
				onChangeCategory={handleBatchCategoryClick}
				onMerge={startBatchMerge}
				onDelete={handleBatchDeleteClick}
				onClearSelection={clearSelection}
			/>
		{/if}
	</div>
</div>

<style>
	.tag-manager-overlay {
		position: fixed;
		inset: 0;
		background: var(--overlay-medium);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1050;
		backdrop-filter: blur(4px);
		animation: overlay-fade 0.2s ease-out;
	}

	.tag-manager-overlay.inline {
		position: relative;
		inset: auto;
		z-index: auto;
		width: 100%;
		height: 100%;
		min-height: 0;
		background: none;
		backdrop-filter: none;
		animation: none;
	}

	@keyframes overlay-fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.tag-manager {
		container-type: inline-size;
		display: flex;
		flex-direction: column;
		width: min(960px, 90vw);
		height: min(720px, 85vh);
		background: var(--theme-panel-bg);
		border: 1px solid var(--theme-stroke);
		border-radius: var(--radius-xl);
		backdrop-filter: none;
		box-shadow:
			0 32px 64px var(--overlay-medium),
			0 16px 32px var(--overlay-light),
			0 0 0 1px var(--interactive-hover),
			0 0 80px var(--shadow-royal-glow);
		overflow: hidden;
		animation: dialog-enter 0.25s cubic-bezier(0.16, 1, 0.3, 1);
		transform-origin: center center;
	}

	.tag-manager.inline {
		width: 100%;
		height: 100%;
		min-height: 0;
		border: 0;
		border-radius: 0;
		box-shadow: none;
		animation: none;
	}

	.tag-manager.inline.compact .header {
		min-height: 48px;
		padding: 4px 10px;
	}

	.tag-manager.inline.compact .title {
		font-size: 14px;
	}

	.tag-manager.inline.compact .new-tag-btn {
		min-height: var(--min-touch-target);
		padding: 5px 9px;
		font-size: 12px;
	}

	.tag-manager.inline.compact .close-btn {
		min-height: var(--min-touch-target);
	}

	.tag-manager.inline .header {
		padding: 8px 12px;
		min-height: 56px;
	}

	.tag-manager.inline .new-tag-btn {
		padding: 8px 10px;
		white-space: nowrap;
	}

	.tag-manager.inline .close-btn {
		width: auto;
		min-width: var(--min-touch-target);
		padding: 0 8px;
		font-size: 13px;
		font-weight: 600;
	}

	.tag-manager.inline .header-left {
		min-width: 0;
		gap: 6px;
	}

	.tag-manager.inline .title {
		white-space: nowrap;
	}

	@container (max-width: 360px) {
		.tag-manager.inline .tag-count {
			display: none;
		}

		.tag-manager.inline .new-tag-btn {
			font-size: 12px;
			padding: 8px;
		}
	}

	@container (max-width: 500px) {
		.tag-manager.inline :global(.batch-bar) {
			flex-wrap: wrap;
			row-gap: 8px;
			padding: 8px 12px;
		}

		.tag-manager.inline :global(.batch-bar .clear-btn) {
			margin-left: auto;
		}

		.tag-manager.inline :global(.batch-actions) {
			order: 3;
			flex: 1 1 100%;
			min-width: 0;
		}

		.tag-manager.inline :global(.batch-btn) {
			flex: 1;
			padding: 6px 8px;
		}
	}

	@supports (color: rgb(from red r g b)) {
		.tag-manager {
			background: rgb(from var(--theme-panel-bg) r g b / 1);
		}
	}

	/* The sheet takes programmatic focus on open so Escape reaches it
	   immediately; that isn't a keyboard-navigation focus, so it shouldn't
	   draw an outline around the whole panel. Focus rings on the controls
	   inside are untouched. */
	.tag-manager:focus {
		outline: none;
	}

	/* Scale up for large screens (1440p+, 4K) */
	@media (min-width: 1600px) and (min-height: 900px) {
		.tag-manager {
			width: min(1200px, 85vw);
			height: min(840px, 85vh);
		}
	}

	@media (min-width: 2400px) and (min-height: 1200px) {
		.tag-manager {
			width: min(1440px, 80vw);
			height: min(960px, 82vh);
		}
	}

	@keyframes dialog-enter {
		from {
			opacity: 0;
			transform: scale(0.96) translateY(8px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	/* Header */
	.header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 16px 20px;
		min-height: 60px;
		border-bottom: 1px solid var(--theme-stroke);
		background: linear-gradient(180deg, var(--surface-subtle) 0%, transparent 100%);
	}

	.header-nav {
		flex: 1;
		min-width: 0;
		display: grid;
		grid-template: 1fr / 1fr;
	}

	.header-state {
		grid-area: 1 / 1;
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.header-actions {
		margin-left: auto;
	}

	.title {
		font-size: 16px;
		font-weight: 600;
		color: var(--theme-text);
		margin: 0;
	}

	.title-centered {
		flex: 1;
		text-align: center;
	}

	.back-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--min-touch-target);
		height: var(--min-touch-target);
		background: none;
		border: none;
		border-radius: var(--radius-md);
		color: var(--text-muted);
		cursor: pointer;
		flex-shrink: 0;
		transition:
			background var(--duration-crisp) var(--ease-crisp),
			color var(--duration-crisp) var(--ease-crisp);
	}

	.back-btn:hover {
		background: var(--interactive-selected);
		color: var(--theme-text-dim);
	}

	.back-btn:active {
		transform: scale(0.9);
	}

	.back-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
	}

	.tag-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 24px;
		height: 22px;
		padding: 0 7px;
		background: var(--royal-bg-strong);
		border: 1px solid var(--royal-border);
		border-radius: var(--radius-full);
		font-size: 12px;
		font-weight: 600;
		color: var(--royal-text);
	}

	.new-tag-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		min-height: var(--min-touch-target);
		background: var(--royal-bg-strong);
		border: 1px solid var(--royal-border);
		border-radius: var(--radius-md);
		color: var(--royal-text);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition:
			background var(--duration-crisp) var(--ease-crisp),
			border-color var(--duration-crisp) var(--ease-crisp);
	}

	.new-tag-btn:hover {
		background: var(--royal-border);
		border-color: var(--royal-border);
	}

	.new-tag-btn:active {
		transform: scale(0.95);
	}

	.new-tag-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--min-touch-target);
		height: var(--min-touch-target);
		background: none;
		border: none;
		border-radius: var(--radius-md);
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background var(--duration-crisp) var(--ease-crisp),
			color var(--duration-crisp) var(--ease-crisp);
	}

	.close-btn:hover {
		background: var(--interactive-selected);
		color: var(--theme-text-dim);
	}

	.close-btn:active {
		transform: scale(0.9);
	}

	.close-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
	}

	/* Batch picker panel */
	.batch-picker-panel {
		padding: 12px 20px;
		background: var(--royal-bg);
		border-bottom: 1px solid var(--royal-bg);
	}

	.batch-picker-label {
		font-size: 14px;
		color: var(--theme-text-dim);
		margin: 0 0 8px;
	}

	.batch-picker-cancel {
		margin-top: 8px;
		padding: 4px 12px;
		min-height: var(--min-touch-target);
		background: none;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-faint);
		font-size: 14px;
		cursor: pointer;
		transition:
			background var(--duration-crisp) var(--ease-crisp),
			color var(--duration-crisp) var(--ease-crisp);
	}

	.batch-picker-cancel:hover {
		background: var(--interactive-active);
		color: var(--theme-text-dim);
	}

	.batch-picker-cancel:active {
		transform: scale(0.95);
	}

	.batch-delete-panel {
		background: var(--red-bg);
		border-bottom-color: var(--red-border);
	}

	.batch-delete-panel .batch-picker-label {
		color: var(--theme-text);
	}

	.batch-delete-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	.batch-delete-actions .batch-picker-cancel {
		margin-top: 0;
		padding: 6px 16px;
		background: var(--interactive-active);
		color: var(--theme-text-dim);
	}

	.batch-delete-btn {
		padding: 6px 16px;
		min-height: var(--min-touch-target);
		background: var(--red-bg-strong);
		border: 1px solid var(--red-border);
		border-radius: var(--radius-sm);
		color: var(--red-text);
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
	}

	.batch-delete-btn:active {
		transform: scale(0.95);
	}

	/* ── Phones: full-screen sheet ─────────────────────────
	   A floating 90vw card left 35px dead bands on every side and gave the
	   tag list under half the screen. On phones the manager takes the whole
	   visible viewport and tracks it while the keyboard is open. */
	@media (max-width: 767px), (pointer: coarse) and (max-width: 900px) {
		/* The sheet's panel color is 88% opaque, so over the usual 50% dim
		   the Tags screen showed through every row on an OLED screen. The
		   overlay takes the same color at full opacity, or the token as is
		   where relative colors aren't supported. */
		.tag-manager-overlay:not(.inline) {
			align-items: stretch;
			justify-content: stretch;
			background: var(--theme-panel-bg);
			backdrop-filter: none;
		}

		@supports (color: rgb(from red r g b)) {
			.tag-manager-overlay:not(.inline) {
				background: rgb(from var(--theme-panel-bg) r g b / 1);
			}
		}

		.tag-manager:not(.inline) {
			position: fixed;
			left: 0;
			right: 0;
			top: var(--tm-vv-top, 0px);
			width: 100%;
			height: var(--tm-vv-height, 100dvh);
			border: none;
			border-radius: 0;
			background: var(--theme-panel-bg);
			box-shadow: none;
			padding-top: env(safe-area-inset-top, 0px);
			padding-bottom: env(safe-area-inset-bottom, 0px);
			backdrop-filter: none;
			animation: sheet-enter 0.22s cubic-bezier(0.16, 1, 0.3, 1);
		}

		@supports (color: rgb(from red r g b)) {
			.tag-manager:not(.inline) {
				background: rgb(from var(--theme-panel-bg) r g b / 1);
			}
		}

		.tag-manager:not(.inline) .header {
			padding: 6px 4px 6px 16px;
			min-height: 56px;
			background: none;
		}

		.new-tag-btn {
			padding: 8px 14px;
		}

		.batch-picker-panel {
			padding: 12px 16px;
		}
	}

	@keyframes sheet-enter {
		from {
			opacity: 0;
			transform: translateY(24px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.tag-manager.rows { box-shadow: 0 16px 40px var(--overlay-medium); animation: rows-enter 170ms ease-out both; }
	.tag-manager.rows.inline { box-shadow: none; animation: none; }
	.tag-manager.rows .header { background: var(--theme-panel-bg); }
	.tag-manager.rows .title { font-size: 15px; font-weight: 600; }
	.tag-manager.rows .new-tag-btn,
	.tag-manager.rows .back-btn,
	.tag-manager.rows .close-btn { border-radius: var(--radius-sm); transform: none; }
	.tag-manager.rows .new-tag-btn:active,
	.tag-manager.rows .back-btn:active,
	.tag-manager.rows .close-btn:active { transform: none; }
	@keyframes rows-enter { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
	@media (prefers-reduced-motion: reduce) {
		.tag-manager-overlay,
		.tag-manager,
		.tag-manager.rows {
			animation: none;
		}
		.new-tag-btn,
		.back-btn,
		.close-btn,
		.batch-picker-cancel {
			transition: none;
		}
	}
</style>
