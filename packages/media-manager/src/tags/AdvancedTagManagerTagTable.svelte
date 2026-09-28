<script lang="ts">
	import Icon from './AdvancedTagIcon.svelte';
	import TagChip from './AdvancedTagChip.svelte';
	import CategoryRenameInput from './AdvancedCategoryRenameInput.svelte';
	import TagManagerTagRow from './AdvancedTagManagerTagRow.svelte';
	import TagManagerMergeFlow from './AdvancedTagManagerMergeFlow.svelte';
	import TagManagerPrereqPicker from './AdvancedTagManagerPrereqPicker.svelte';
	import TagManagerColorPicker from './AdvancedTagManagerColorPicker.svelte';
	import {
		createCategoryKey,
		getCategoryLabel,
		type MediaTag,
		type TagColor,
		type TagCategory
	} from './advanced-tag-helpers.js';
	import type { Snippet } from 'svelte';
	import { fade, fly, slide } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { cubicOut, cubicIn } from 'svelte/easing';
	import { MediaQuery } from 'svelte/reactivity';

	const finePointer = new MediaQuery('(pointer: fine)');
	const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');

	// Premium navigation push transition: combines translate + scale + opacity
	function viewPush(
		_node: Element,
		{
			x = 60,
			duration = 280,
			delay = 0,
			easing = cubicOut
		}: {
			x?: number;
			duration?: number;
			delay?: number;
			easing?: (t: number) => number;
		} = {}
	) {
		return {
			delay,
			duration,
			easing,
			css: (t: number) => {
				const u = 1 - t;
				return `opacity: ${t}; transform: translateX(${u * x}px) scale(${0.97 + 0.03 * t})`;
			}
		};
	}

	interface TagWithCount {
		tag: MediaTag;
		itemCount: number;
	}

	interface Props {
		tagsByCategory: Map<string, TagWithCount[]>;
		visibleCategories: string[];
		allCategories: string[];
		categoryLabels?: Record<string, string>;
		allTags?: MediaTag[];
		categoryPrereqs?: Record<string, string[]>;
		selectedTagIds: Set<string>;
		selectionMode: boolean;
		highlightTagId?: string | null;
		dragSourceId: string | null;
		dragOverTagId: string | null;
		/** False on touch screens, where HTML5 drag-and-drop doesn't work */
		canDrag?: boolean;
		isSearching: boolean;
		searchQuery: string;
		categoryFilter: string | null;
		compact?: boolean;
		onOpenCategory: (category: string | null) => void;
		onQuickCreate?: (name: string, color: TagColor, category: TagCategory) => Promise<void>;
		onToggleSelect: (tagId: string) => void;
		onRename: (tagId: string, newName: string) => Promise<void>;
		onChangeColor: (tagId: string, newColor: TagColor) => Promise<void>;
		onChangeCategory: (tagId: string, newCategory: TagCategory) => Promise<void>;
		onChangePrereqs?: ((tagId: string, prereqTagIds: string[]) => Promise<void>) | undefined;
		onChangeCategoryPrereqs?: ((categoryKey: string, prereqTagIds: string[]) => Promise<void>) | undefined;
		onDelete: (tagId: string) => Promise<void>;
		onStartMerge: (tagId: string) => void;
		onRenameCategory?: ((categoryKey: string, newLabel: string) => void) | undefined;
		onDragStart: (e: DragEvent, tagId: string) => void;
		onDragOver: (e: DragEvent, tagId: string) => void;
		onDragLeave: () => void;
		onDrop: (e: DragEvent, tagId: string) => void;
		onDragEnd: () => void;
		showCreateWizard?: boolean;
		showMergeWizard?: boolean;
		mergeMode?: 'single' | 'batch';
		mergeSourceTags?: MediaTag[];
		mergeItemCountMap?: Map<string, number>;
		onMergeConfirm?: (targetId: string) => void;
		onMergeCancel?: () => void;
		onCreateTag?: (
			name: string,
			color: TagColor,
			category: TagCategory,
			prereqTagIds?: string[]
		) => Promise<void>;
		onCloseCreateWizard?: () => void;
		toolbar?: Snippet;
	}

	const {
		tagsByCategory,
		visibleCategories,
		allCategories,
		categoryLabels = {},
		allTags = [],
		categoryPrereqs = {},
		selectedTagIds,
		selectionMode,
		highlightTagId = null,
		dragSourceId,
		dragOverTagId,
		canDrag = true,
		isSearching,
		searchQuery,
		categoryFilter,
		compact = false,
		onOpenCategory,
		onQuickCreate,
		onToggleSelect,
		onRename,
		onChangeColor,
		onChangeCategory,
		onChangePrereqs,
		onChangeCategoryPrereqs,
		onDelete,
		onStartMerge,
		onRenameCategory,
		onDragStart,
		onDragOver,
		onDragLeave,
		onDrop,
		onDragEnd,
		showCreateWizard = false,
		showMergeWizard = false,
		mergeMode = 'single',
		mergeSourceTags = [],
		mergeItemCountMap = new Map(),
		onMergeConfirm,
		onMergeCancel,
		onCreateTag,
		onCloseCreateWizard,
		toolbar
	}: Props = $props();

	// The split follows the table's own width, not the viewport, so any
	// presentation with room gets it (the medium-width pane, a wide dialog).
	// The desktop sidebar's inline manager (340-440px) stays one column.
	const SPLIT_MIN_WIDTH = 560;
	let tableWidth = $state(0);
	let split = $derived(!compact && tableWidth >= SPLIT_MIN_WIDTH && allTags.length > 0);
	// With no category chosen the right column shows the first one that has
	// tags. Display only: it doesn't set categoryFilter, so a narrow layout
	// still opens on the index.
	let splitCategory = $derived(categoryFilter ?? visibleCategories[0] ?? allCategories[0] ?? null);
	// Scrolls back to the top whenever the swapped-in category mounts, so
	// switching categories doesn't leave the pane at the old scroll depth.
	let splitDetailEl: HTMLDivElement | undefined = $state();

	// Create wizard state (full-area wizard triggered by + New Tag)
	let wizardName = $state('');
	let wizardColor = $state<TagColor>('royal');
	let wizardCategory = $state<string>('content');
	let wizardCreating = $state(false);
	let wizardSuccess = $state(false);
	let wizardCreatingCategory = $state(false);
	let wizardNewCategoryName = $state('');
	let wizardPrereqTagIds = $state<string[]>([]);
	let wizardShowPrereqs = $state(false);
	let wizardNameInputEl: HTMLInputElement | undefined = $state();
	let wizardWasOpen = showCreateWizard;

	$effect(() => {
		if (showCreateWizard && !wizardWasOpen) {
			wizardCategory = (split ? splitCategory : categoryFilter) ?? 'content';
		}
		wizardWasOpen = showCreateWizard;
	});

	async function handleWizardCreate() {
		const trimmed = wizardName.trim();
		if (!trimmed || wizardCreating || !onCreateTag) return;
		wizardCreating = true;
		try {
			await onCreateTag(
				trimmed,
				wizardColor,
				wizardCategory,
				wizardPrereqTagIds.length > 0 ? wizardPrereqTagIds : undefined
			);
		} catch {
			// Already reported via the error toast. Leave the form open
			// with what was typed instead of clearing it as if the create
			// went through.
			return;
		} finally {
			wizardCreating = false;
		}
		wizardSuccess = true;
		setTimeout(() => {
			wizardSuccess = false;
			wizardName = '';
			wizardColor = 'royal';
			wizardCategory = (split ? splitCategory : categoryFilter) ?? 'content';
			wizardPrereqTagIds = [];
			wizardShowPrereqs = false;
		}, 600);
	}

	function handleWizardKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			if (finePointer.current) {
				// Desktop: Enter creates immediately, as before.
				handleWizardCreate();
			} else {
				// Touch: the on-screen keyboard was covering the color and
				// category pickers and the Create button, so Enter created the
				// tag with whatever defaults happened to be selected. Enter now
				// just closes the keyboard so the rest of the form is visible;
				// creating needs the Create button.
				wizardNameInputEl?.blur();
			}
		} else if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			onCloseCreateWizard?.();
		}
	}

	function handleWizardNewCategoryKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && wizardNewCategoryName.trim()) {
			e.preventDefault();
			e.stopPropagation();
			wizardCategory = createCategoryKey(wizardNewCategoryName);
			wizardCreatingCategory = false;
			wizardNewCategoryName = '';
		} else if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			wizardCreatingCategory = false;
			wizardNewCategoryName = '';
		}
	}

	// Auto-focus wizard name input when wizard opens
	$effect(() => {
		if (showCreateWizard && wizardNameInputEl) {
			wizardNameInputEl.focus();
		}
	});

	// Quick-create state (lives in the empty state)
	let quickColor = $state<TagColor>('royal');
	let quickCategory = $state<string>('content');
	let quickCreating = $state(false);
	let quickSuccess = $state(false);

	async function handleQuickCreate() {
		if (!onQuickCreate || !searchQuery.trim() || quickCreating) return;
		quickCreating = true;
		try {
			await onQuickCreate(searchQuery.trim(), quickColor, quickCategory);
		} catch {
			// Already reported via the error toast. Leave the search query
			// in place instead of clearing it as if the create went through.
			return;
		} finally {
			quickCreating = false;
		}
		// Brief success flash before the view transitions
		quickSuccess = true;
		setTimeout(() => {
			quickSuccess = false;
			// Reset for next time
			quickColor = 'royal';
			quickCategory = 'content';
		}, 600);
	}

	// Category-level prereq picker state
	let categoryPrereqPickerOpen = $state<string | null>(null);

	function toggleCategoryPrereqPicker(cat: string) {
		categoryPrereqPickerOpen = categoryPrereqPickerOpen === cat ? null : cat;
	}

	function hasCategoryPrereqs(cat: string): boolean {
		return (categoryPrereqs[cat]?.length ?? 0) > 0;
	}

	// The unfiltered landing view is a category index. Search shows matches
	// across categories; choosing a category opens its one-column tag list.
	let activeCategory = $derived(isSearching ? null : categoryFilter);

	// Tag counts per category, computed once instead of filtering allTags
	// again for every row of the category index or split list.
	let tagCountByCategory = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const tag of allTags) {
			const key = tag.category ?? 'content';
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
		return counts;
	});
</script>

{#snippet emptyState()}
	<div class="empty-state">
		{#if isSearching}
			<p class="empty-subtitle">No tags match "{searchQuery}"</p>

			{#if onQuickCreate && !compact}
				<div class="quick-create">
					<TagManagerColorPicker current={quickColor} onSelect={(c) => (quickColor = c)} />

					<div class="quick-category-chips" role="radiogroup" aria-label="Tag category">
						{#each allCategories as cat (cat)}
							<button
								class="qc-chip"
								class:active={quickCategory === cat}
								role="radio"
								aria-checked={quickCategory === cat}
								onclick={() => (quickCategory = cat)}
							>
								{getCategoryLabel(cat, categoryLabels)}
							</button>
						{/each}
					</div>

					<button
						class="quick-create-btn"
						class:success={quickSuccess}
						onclick={handleQuickCreate}
						disabled={quickCreating || quickSuccess}
					>
						{#if quickSuccess}
							<Icon name="check" size={14} />
							Created!
						{:else if quickCreating}
							<span class="spinner"></span>
							Creating...
						{:else}
							<Icon name="plus" size={14} />
							Create "{searchQuery}"
						{/if}
					</button>
				</div>
			{:else}
				<p class="empty-hint">
					{compact ? 'Use New Tag to create it.' : 'Try a different search term'}
				</p>
			{/if}
		{:else}
			<div class="empty-icon">
				<Icon name="tags" size={28} />
			</div>
			<p class="empty-title">No tags yet</p>
			<p class="empty-hint">Create tags to organize your media</p>
		{/if}
	</div>
{/snippet}

{#snippet categoryBody(category: string, catTags: TagWithCount[], slideList = true)}
	<div class="category-header-row">
		{#if !isSearching && !split}
			<button
				class="category-back"
				onclick={() => onOpenCategory(null)}
				aria-label="Back to categories"
			>
				<Icon name="arrow-left" size={16} />
			</button>
		{/if}
		<div class="category-header">
			{#if onRenameCategory}
				<span class="category-label-wrap">
					<CategoryRenameInput
						label={getCategoryLabel(category, categoryLabels)}
						categoryKey={category}
						headingLevel="h4"
						onRename={onRenameCategory}
					/>
				</span>
			{:else}
				<h4 class="category-label">
					{getCategoryLabel(category, categoryLabels)}
				</h4>
			{/if}
			<span class="category-count">{catTags.length}</span>
		</div>
		{#if onChangeCategoryPrereqs}
			<button
				class="category-prereq-btn"
				class:has-prereqs={hasCategoryPrereqs(category)}
				onclick={() => toggleCategoryPrereqPicker(category)}
				title="Configure category prerequisites"
				aria-label="Configure prerequisites for {getCategoryLabel(category, categoryLabels)}"
			>
				<Icon name="link" size={14} />
			</button>
		{/if}
	</div>

	{#if categoryPrereqPickerOpen === category && onChangeCategoryPrereqs}
		<div class="category-prereq-panel">
			<TagManagerPrereqPicker
				currentPrereqs={categoryPrereqs[category] ?? []}
				{allTags}
				excludeCategory={category}
				{categoryLabels}
				hint="Only offer this category's tags on items that already have one of these. Changes save as you tap."
				onSelect={(ids) => onChangeCategoryPrereqs(category, ids)}
				onDone={() => (categoryPrereqPickerOpen = null)}
			/>
		</div>
	{/if}

	<div class="category-tags" role="list" transition:slide={{ duration: slideList ? 200 : 0 }}>
		{#each catTags as { tag, itemCount }, i (tag.id)}
			<div
				class="tag-row-wrapper"
				in:fly={{
					y: 12,
					duration: 200,
					delay: Math.min(i * 30, 300)
				}}
				out:fly={{ y: -8, duration: 150 }}
				animate:flip={{ duration: 200 }}
			>
				<TagManagerTagRow
					{compact}
					{selectionMode}
					showCategory={isSearching}
					{tag}
					{itemCount}
					categories={allCategories}
					{categoryLabels}
					{allTags}
					selected={selectedTagIds.has(tag.id)}
					isHighlighted={highlightTagId === tag.id}
					isDragSource={dragSourceId === tag.id}
					isDragTarget={dragOverTagId === tag.id}
					{canDrag}
					enableDrag={false}
					{onToggleSelect}
					{onRename}
					{onChangeColor}
					{onChangeCategory}
					{onChangePrereqs}
					{onDelete}
					{onStartMerge}
					{onDragStart}
					{onDragOver}
					{onDragLeave}
					{onDrop}
					{onDragEnd}
				/>
			</div>
		{/each}
	</div>

	{#if catTags.length === 0}
		<p class="category-empty">No tags in this category yet.</p>
	{/if}
{/snippet}

<div class="tag-table" class:compact bind:clientWidth={tableWidth}>
	{#if showCreateWizard}
		<div
			class="view-panel create-view"
			in:viewPush={{ x: 60, delay: 60 }}
			out:viewPush={{ x: 60, duration: 220, easing: cubicIn }}
		>
			<!-- Live Preview -->
			<div class="wizard-section wizard-stagger-1">
				<div class="wizard-preview" class:has-name={!!wizardName.trim()}>
					{#if wizardName.trim()}
						<div class="preview-tag">
							<TagChip label={wizardName.trim()} color={wizardColor} size="lg" />
						</div>
						<span class="preview-category">{getCategoryLabel(wizardCategory, categoryLabels)}</span>
					{:else}
						<div class="preview-placeholder">
							<Icon name="tag" size={24} />
							<span>Your tag preview</span>
						</div>
					{/if}
				</div>
			</div>

			<!-- Name Input -->
			<div class="wizard-section wizard-stagger-2">
				<label class="wizard-label" for="wizard-name">Name</label>
				<input
					id="wizard-name"
					bind:this={wizardNameInputEl}
					type="text"
					class="wizard-name-input"
					placeholder="Enter tag name..."
					bind:value={wizardName}
					enterkeyhint={finePointer.current ? undefined : 'done'}
					onkeydown={handleWizardKeydown}
				/>
			</div>

			<!-- Color -->
			<div class="wizard-section wizard-stagger-3">
				<span class="wizard-label">Color</span>
				<TagManagerColorPicker current={wizardColor} onSelect={(c) => (wizardColor = c)} />
			</div>

			<!-- Category -->
			<div class="wizard-section wizard-stagger-4">
				<span class="wizard-label">Category</span>
				<div class="wizard-category-chips" role="radiogroup" aria-label="Tag category">
					{#each allCategories as cat (cat)}
						<button
							class="qc-chip"
							class:active={wizardCategory === cat}
							role="radio"
							aria-checked={wizardCategory === cat}
							onclick={() => (wizardCategory = cat)}
						>
							{getCategoryLabel(cat, categoryLabels)}
						</button>
					{/each}

					{#if wizardCreatingCategory}
						<!-- svelte-ignore a11y_autofocus -->
						<input
							type="text"
							class="wizard-new-category-input"
							bind:value={wizardNewCategoryName}
							placeholder="Category name..."
							autofocus
							onkeydown={handleWizardNewCategoryKeydown}
							onblur={() => {
								if (wizardNewCategoryName.trim()) {
									wizardCategory = createCategoryKey(wizardNewCategoryName);
								}
								wizardCreatingCategory = false;
								wizardNewCategoryName = '';
							}}
						/>
					{:else}
						<button
							class="qc-chip new-category-chip"
							onclick={() => (wizardCreatingCategory = true)}
						>
							<Icon name="plus" size={10} />
							New
						</button>
					{/if}
				</div>
			</div>

			<!-- Prerequisites (optional, toggle to reveal) -->
			{#if allTags.length > 0}
				<div class="wizard-section wizard-stagger-5">
					{#if wizardShowPrereqs}
						<div transition:slide={{ duration: 200 }}>
							<TagManagerPrereqPicker
								currentPrereqs={wizardPrereqTagIds}
								{allTags}
								excludeCategory={wizardCategory}
								{categoryLabels}
								hint="Only offer this tag on items that already have one of these."
								onSelect={(ids) => (wizardPrereqTagIds = ids)}
							/>
						</div>
					{:else}
						<button class="wizard-prereq-toggle" onclick={() => (wizardShowPrereqs = true)}>
							<Icon name="link" size={12} />
							Add prerequisites
							{#if wizardPrereqTagIds.length > 0}
								<span class="wizard-prereq-count">{wizardPrereqTagIds.length}</span>
							{/if}
						</button>
					{/if}
				</div>
			{/if}

			<!-- Actions -->
			<div class="wizard-section wizard-actions wizard-stagger-6">
				<button
					class="wizard-create-btn"
					class:success={wizardSuccess}
					onclick={handleWizardCreate}
					disabled={!wizardName.trim() || wizardCreating || wizardSuccess}
				>
					{#if wizardSuccess}
						<Icon name="check" size={16} />
						Created!
					{:else if wizardCreating}
						<span class="spinner"></span>
						Creating...
					{:else}
						<Icon name="plus" size={16} />
						Create Tag
					{/if}
				</button>
			</div>

			{#if canDrag}
				<p class="wizard-hint">
					<kbd>Enter</kbd> to create &middot; <kbd>Esc</kbd> to go back
				</p>
			{/if}
		</div>
	{/if}
	{#if showMergeWizard}
		<div
			class="view-panel merge-view"
			in:viewPush={{ x: 60, delay: 60 }}
			out:viewPush={{ x: 60, duration: 220, easing: cubicIn }}
		>
			<TagManagerMergeFlow
				mode={mergeMode}
				sourceTags={mergeSourceTags}
				{allTags}
				itemCountMap={mergeItemCountMap}
				onConfirm={onMergeConfirm ?? (() => {})}
				onCancel={onMergeCancel ?? (() => {})}
			/>
		</div>
	{/if}
	{#if !showCreateWizard && !showMergeWizard}
		<div
			class="view-panel list-view"
			in:viewPush={{ x: -60, delay: 60 }}
			out:viewPush={{ x: -60, duration: 220, easing: cubicIn }}
		>
			{#if toolbar}{@render toolbar()}{/if}
			<div class="list-scroll" class:split>
				{#if split}
					<nav class="split-index" aria-label="Tag categories">
						{#each allCategories as category (category)}
							{@const current = !isSearching && category === splitCategory}
							<button
								class="split-index-row"
								class:active={current}
								aria-current={current ? 'true' : undefined}
								onclick={() => onOpenCategory(category)}
							>
								<span class="index-name">{getCategoryLabel(category, categoryLabels)}</span>
								<span class="index-count"
									>{tagCountByCategory.get(category) ?? 0}<span class="sr-only"> tags</span></span
								>
							</button>
						{/each}
					</nav>
					<div class="split-detail" bind:this={splitDetailEl}>
						{#if isSearching}
							{#if visibleCategories.length === 0}
								{@render emptyState()}
							{:else}
								{#each visibleCategories as category (category)}
									<div
										class="category-section"
										in:fly={{ y: 16, duration: 250 }}
										out:fade={{ duration: 150 }}
										animate:flip={{ duration: 250 }}
									>
										{@render categoryBody(category, tagsByCategory.get(category) ?? [])}
									</div>
								{/each}
							{/if}
						{:else if splitCategory}
							{#key splitCategory}
								<div
									class="category-section"
									in:fade={{ duration: reducedMotion.current ? 0 : 150 }}
									{@attach () => splitDetailEl?.scrollTo({ top: 0 })}
								>
									{@render categoryBody(
										splitCategory,
										tagsByCategory.get(splitCategory) ?? [],
										false
									)}
								</div>
							{/key}
						{/if}
					</div>
				{:else if visibleCategories.length === 0}
					{@render emptyState()}
				{:else if !activeCategory && !isSearching}
					<div class="category-index" aria-label="Tag categories">
						{#if !compact}
							<p class="index-heading">
								Categories <span>{allCategories.length}</span>
							</p>
						{/if}
						{#each allCategories as category (category)}
							<button class="category-index-row" onclick={() => onOpenCategory(category)}>
								<span class="index-name">{getCategoryLabel(category, categoryLabels)}</span>
								<span class="index-count">{tagCountByCategory.get(category) ?? 0} tags</span>
								<Icon name="chevron-right" size={15} />
							</button>
						{/each}
					</div>
				{:else}
					{#each visibleCategories as category (category)}
						<div
							class="category-section"
							in:fly={{ y: 16, duration: 250 }}
							out:fade={{ duration: 150 }}
							animate:flip={{ duration: 250 }}
						>
							{@render categoryBody(category, tagsByCategory.get(category) ?? [])}
						</div>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.tag-table {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template: 1fr / 1fr;
		overflow: hidden;
	}

	.view-panel {
		grid-area: 1 / 1;
		overflow: hidden;
	}

	.list-scroll,
	.create-view,
	.merge-view {
		scrollbar-width: thin;
		scrollbar-color: var(--stroke-subtle) transparent;
	}

	.list-scroll::-webkit-scrollbar,
	.create-view::-webkit-scrollbar,
	.merge-view::-webkit-scrollbar {
		width: 6px;
	}

	.list-scroll::-webkit-scrollbar-track,
	.create-view::-webkit-scrollbar-track,
	.merge-view::-webkit-scrollbar-track {
		background: transparent;
	}

	.list-scroll::-webkit-scrollbar-thumb,
	.create-view::-webkit-scrollbar-thumb,
	.merge-view::-webkit-scrollbar-thumb {
		background: var(--stroke-subtle);
		border-radius: 3px;
	}

	.list-scroll::-webkit-scrollbar-thumb:hover,
	.create-view::-webkit-scrollbar-thumb:hover,
	.merge-view::-webkit-scrollbar-thumb:hover {
		background: var(--theme-stroke);
	}

	.list-view {
		display: flex;
		flex-direction: column;
	}

	.list-scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 4px 0;
		box-shadow: inset 0 6px 8px -6px var(--overlay-light);
	}

	.tag-table.compact .list-scroll {
		padding: 0;
	}

	.tag-table.compact .category-index {
		padding: 4px 8px 10px;
	}

	.tag-table.compact .category-index-row {
		min-height: 40px;
		margin-bottom: 3px;
		padding: 5px 10px;
		gap: 8px;
	}

	.tag-table.compact .index-name {
		font-size: 13px;
	}
	.tag-table.compact .index-count {
		font-size: 11px;
	}

	.tag-table.compact .category-section {
		padding: 0 8px;
	}

	.tag-table.compact .category-header-row {
		min-height: 40px;
		padding: 2px 0;
	}

	.create-view {
		display: flex;
		flex-direction: column;
		align-items: center;
		/* safe: when the form is taller than the panel (phones, keyboard open)
		   plain center pushed the preview above the scroll origin where it
		   could never be scrolled back into view */
		justify-content: safe center;
		gap: 20px;
		padding: 32px 20px;
		overflow-y: auto;
	}

	@container (max-width: 500px) {
		.create-view {
			justify-content: flex-start;
			gap: 14px;
			padding: 16px 12px 24px;
		}

		.wizard-section {
			max-width: none;
		}

		.category-index {
			padding: 16px 12px;
		}
	}

	.merge-view {
		display: flex;
		flex-direction: column;
		overflow-y: auto;
	}

	/* Constrain wizard content width and center */
	@media (min-width: 1600px) {
		.create-view {
			gap: 24px;
			padding: 40px 20px;
		}
	}

	/* Empty state */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 48px 24px;
		text-align: center;
	}

	.empty-icon {
		color: var(--text-faint);
		margin-bottom: 12px;
		animation: float 3s ease-in-out infinite;
	}

	@keyframes float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-6px);
		}
	}

	.empty-title {
		font-size: 14px;
		font-weight: 500;
		color: var(--theme-text-dim);
		margin: 0 0 4px;
	}

	.empty-subtitle {
		font-size: 14px;
		font-weight: 500;
		color: var(--text-muted);
		margin: 0 0 20px;
	}

	.empty-hint {
		font-size: 13px;
		color: var(--text-muted);
		margin: 0;
	}

	/* Quick create - embedded in empty state */
	.quick-create {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		width: 100%;
		max-width: 480px;
	}

	.quick-category-chips {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 6px;
	}

	.qc-chip {
		padding: 5px 12px;
		min-height: var(--min-touch-target);
		background: var(--surface-dim);
		border: 1px solid var(--theme-stroke);
		border-radius: var(--radius-full);
		color: var(--text-muted);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition:
			background var(--duration-crisp) var(--ease-crisp),
			border-color var(--duration-crisp) var(--ease-crisp),
			color var(--duration-crisp) var(--ease-crisp),
			transform var(--duration-snap) var(--ease-crisp);
		white-space: nowrap;
	}

	.qc-chip:hover {
		border-color: var(--theme-stroke-strong);
		color: var(--theme-text-dim);
	}

	.qc-chip:active {
		transform: scale(0.95);
	}

	.qc-chip.active {
		background: var(--royal-bg-strong);
		border-color: var(--royal-border);
		color: var(--royal-text);
	}

	.qc-chip:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.quick-create-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px 28px;
		min-height: var(--min-touch-target);
		min-width: 180px;
		background: var(--royal-bg-strong);
		border: 1px solid var(--royal-border);
		border-radius: var(--radius-lg);
		color: var(--royal-text);
		font-size: 15px;
		font-weight: 600;
		cursor: pointer;
		transition:
			background var(--duration-crisp) var(--ease-crisp),
			border-color var(--duration-crisp) var(--ease-crisp),
			transform var(--duration-snap) var(--ease-crisp),
			color var(--duration-motion) var(--ease-crisp);
	}

	.quick-create-btn:hover:not(:disabled) {
		background: var(--royal-border);
		transform: translateY(-1px);
	}

	.quick-create-btn:active:not(:disabled) {
		transform: scale(0.97);
	}

	.quick-create-btn:disabled {
		cursor: not-allowed;
	}

	.quick-create-btn.success {
		background: var(--green-bg-strong);
		border-color: var(--green-border);
		color: var(--green-text);
		animation: success-pop 0.3s ease-out;
	}

	@keyframes success-pop {
		0% {
			transform: scale(1);
		}
		40% {
			transform: scale(1.05);
		}
		100% {
			transform: scale(1);
		}
	}

	.quick-create-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	/* Spinner for creating state */
	.spinner {
		width: 14px;
		height: 14px;
		border: 2px solid var(--royal-border);
		border-top-color: var(--royal-text);
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Category section */
	.category-index {
		max-width: 720px;
		margin: 0 auto;
		padding: 20px 16px 36px;
	}

	.index-heading {
		margin: 0 0 4px;
		font-size: 17px;
		font-weight: 700;
		color: var(--theme-text);
	}

	.index-heading span {
		font-size: 13px;
		color: var(--text-muted);
	}

	.category-index-row {
		display: flex;
		align-items: center;
		gap: 16px;
		width: 100%;
		min-height: 58px;
		margin: 0 0 8px;
		padding: 12px 16px;
		border: 1px solid var(--theme-stroke);
		border-radius: var(--radius-md);
		background: var(--surface-dim);
		color: var(--theme-text);
		text-align: left;
		cursor: pointer;
	}

	.category-index-row:hover {
		background: var(--surface-subtle);
		border-color: var(--theme-stroke-strong);
	}

	.category-index-row:focus-visible,
	.category-back:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.index-name {
		flex: 1;
		font-size: 15px;
		font-weight: 600;
	}
	.index-count {
		color: var(--theme-text-dim);
		font-size: 13px;
	}

	.category-section {
		max-width: 760px;
		margin: 0 auto 6px;
		padding: 0 12px;
		width: 100%;
	}

	/* Split view: category list on the left, the chosen category's tags on the right.
	   Each column scrolls on its own so the list never scrolls away. */
	.list-scroll.split {
		display: grid;
		grid-template-columns: 220px minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr);
		overflow: hidden;
		padding: 0;
	}

	.split-index,
	.split-detail {
		min-height: 0;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--stroke-subtle) transparent;
	}

	.split-index {
		padding: 12px 8px;
		border-right: 1px solid var(--stroke-subtle);
	}

	.split-detail {
		padding: 8px 0 24px;
		/* The row's @container (max-width: 500px) rule needs the right-hand
		   column's own width, not the whole split view (.split-index + .split-detail). */
		container-type: inline-size;
	}

	.split-index-row {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-height: var(--min-touch-target);
		margin: 0 0 2px;
		padding: 8px 12px;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--theme-text-dim);
		text-align: left;
		cursor: pointer;
	}

	.split-index-row:hover {
		background: var(--interactive-hover);
		color: var(--theme-text);
	}

	.split-index-row.active {
		background: var(--royal-bg);
		border-color: var(--royal-border);
		color: var(--royal-text);
	}

	.split-index-row:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
	}

	.split-index-row .index-name {
		font-size: 14px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.category-empty {
		margin: 16px 4px;
		font-size: 14px;
		color: var(--theme-text-dim);
	}

	.category-header-row {
		display: flex;
		align-items: center;
		gap: 4px;
		background: var(--surface-subtle);
		border-radius: var(--radius-sm);
		margin-bottom: 2px;
		border-bottom: 1px solid var(--interactive-hover);
	}

	.category-header {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-height: var(--min-touch-target);
		padding: 8px 4px;
		background: none;
	}

	.category-back {
		width: var(--min-touch-target);
		height: var(--min-touch-target);
		flex: none;
		border: 0;
		background: transparent;
		color: var(--theme-text);
		cursor: pointer;
	}

	.category-label-wrap {
		flex: 1;
		min-width: 0;
	}

	.category-label {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--theme-text-dim);
		flex: 1;
		text-align: left;
	}

	.category-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 20px;
		height: 18px;
		padding: 0 6px;
		background: var(--interactive-hover);
		border-radius: var(--radius-full);
		font-size: 12px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--text-faint);
		flex-shrink: 0;
	}

	.category-prereq-btn {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--min-touch-target);
		height: var(--min-touch-target);
		background: none;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-faint);
		cursor: pointer;
		flex-shrink: 0;
		transition:
			background var(--duration-crisp) var(--ease-crisp),
			color var(--duration-crisp) var(--ease-crisp);
	}

	.category-prereq-btn::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		min-width: var(--min-touch-target);
		min-height: var(--min-touch-target);
	}

	.category-prereq-btn:hover {
		background: var(--interactive-active);
		color: var(--theme-text-dim);
	}

	.category-prereq-btn:active {
		transform: scale(0.9);
	}

	.category-prereq-btn.has-prereqs {
		color: var(--cirque-royal);
	}

	.category-prereq-btn.has-prereqs:hover {
		color: var(--royal-text);
		background: var(--royal-bg);
	}

	.category-prereq-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.category-prereq-panel {
		padding: 8px 12px 12px;
		margin: 4px 0 8px;
		background: var(--surface-subtle);
		border: 1px solid var(--stroke-subtle);
		border-radius: var(--radius-md);
	}

	.category-tags {
		padding: 2px 0 4px;
		overflow: visible;
		/* overflow: visible needed so action menu dropdowns aren't clipped by grid cells */
	}

	.category-tags {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	/* Phones: the list itself shouldn't hand a scroll gesture at either end
	   off to the page behind the full-screen sheet */
	@media (max-width: 767px), (pointer: coarse) and (max-width: 900px) {
		.list-scroll,
		.split-index,
		.split-detail {
			overscroll-behavior: contain;
		}
	}

	/* ── Create Wizard ─────────────────────────────────── */

	/* Staggered section entrance */
	.wizard-section {
		width: 100%;
		max-width: 420px;
		animation: wizard-section-enter 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.wizard-stagger-1 {
		animation-delay: 0.06s;
	}
	.wizard-stagger-2 {
		animation-delay: 0.12s;
	}
	.wizard-stagger-3 {
		animation-delay: 0.18s;
	}
	.wizard-stagger-4 {
		animation-delay: 0.24s;
	}
	.wizard-stagger-5 {
		animation-delay: 0.3s;
	}
	.wizard-stagger-6 {
		animation-delay: 0.36s;
	}

	@keyframes wizard-section-enter {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Live preview */
	.wizard-preview {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		min-height: 56px;
		padding: 12px 16px;
		background: var(--overlay-light);
		border: 1px solid var(--surface-subtle);
		border-radius: var(--radius-lg);
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.wizard-preview.has-name {
		border-color: var(--royal-border);
		box-shadow: 0 0 20px var(--royal-bg);
	}

	.preview-tag {
		animation: preview-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes preview-pop {
		from {
			transform: scale(0.8);
			opacity: 0;
		}
		60% {
			transform: scale(1.05);
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}

	.preview-category {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-faint);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.preview-placeholder {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--text-faint);
		font-size: 14px;
	}

	/* Labels */
	.wizard-label {
		display: block;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-faint);
		margin-bottom: 8px;
		text-align: center;
	}

	/* Name input */
	.wizard-name-input {
		width: 100%;
		padding: 12px 16px;
		min-height: var(--min-touch-target);
		background: var(--surface-dim);
		border: 1px solid var(--theme-stroke);
		border-radius: var(--radius-lg);
		color: var(--theme-text);
		font-size: 16px;
		font-family: inherit;
		outline: none;
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease;
	}

	.wizard-name-input:focus {
		border-color: var(--cirque-royal);
		box-shadow:
			0 0 0 3px var(--royal-bg),
			0 0 16px var(--royal-bg);
	}

	.wizard-name-input::placeholder {
		color: var(--text-faint);
	}

	/* Category chips */
	.wizard-category-chips {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 6px;
	}

	.new-category-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		border-style: dashed;
		color: var(--text-faint);
	}

	.new-category-chip:hover {
		color: var(--theme-text-dim);
		border-color: var(--theme-stroke-strong);
	}

	.wizard-new-category-input {
		padding: 6px 14px;
		min-height: var(--min-touch-target);
		background: var(--interactive-active);
		border: 1px solid var(--royal-border);
		border-radius: var(--radius-full);
		color: var(--theme-text);
		font-size: 14px;
		font-family: inherit;
		outline: none;
		width: 160px;
	}

	.wizard-new-category-input:focus {
		border-color: var(--cirque-royal);
		box-shadow: 0 0 0 2px var(--royal-bg-strong);
	}

	/* Prereq toggle */
	.wizard-prereq-toggle {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		min-height: var(--min-touch-target);
		background: var(--surface-subtle);
		border: 1px dashed var(--theme-stroke);
		border-radius: var(--radius-lg);
		color: var(--text-muted);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition:
			background var(--duration-crisp) var(--ease-crisp),
			border-color var(--duration-crisp) var(--ease-crisp),
			color var(--duration-crisp) var(--ease-crisp);
		width: fit-content;
		align-self: center;
	}

	.wizard-prereq-toggle:hover {
		background: var(--interactive-hover);
		border-color: var(--theme-stroke-strong);
		color: var(--theme-text-dim);
	}

	.wizard-prereq-toggle:active {
		transform: scale(0.97);
	}

	.wizard-prereq-toggle:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.wizard-prereq-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		background: var(--royal-bg-strong);
		border-radius: var(--radius-full);
		font-size: 12px;
		font-weight: 700;
		color: var(--royal-text);
	}

	/* Actions row */
	.wizard-actions {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding-top: 4px;
	}

	.wizard-create-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px 32px;
		min-height: var(--min-touch-target);
		background: var(--royal-bg-strong);
		border: 1px solid var(--royal-border);
		border-radius: var(--radius-lg);
		color: var(--royal-text);
		font-size: 15px;
		font-weight: 600;
		cursor: pointer;
		transition:
			background 0.15s ease,
			border-color 0.15s ease,
			transform 0.1s ease,
			box-shadow 0.15s ease;
	}

	.wizard-create-btn:hover:not(:disabled) {
		background: var(--royal-border);
		box-shadow: 0 4px 16px var(--royal-bg-strong);
		transform: translateY(-1px);
	}

	.wizard-create-btn:active:not(:disabled) {
		transform: scale(0.97);
		box-shadow: none;
	}

	.wizard-create-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.wizard-create-btn.success {
		background: var(--green-bg-strong);
		border-color: var(--green-border);
		color: var(--green-text);
		animation: success-pop 0.3s ease-out;
	}

	.wizard-create-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	/* Keyboard hint */
	.wizard-hint {
		text-align: center;
		font-size: 12px;
		color: var(--text-faint);
		margin: 0;
		animation: wizard-section-enter 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both;
	}

	.wizard-hint kbd {
		display: inline-block;
		padding: 1px 6px;
		background: var(--surface-dim);
		border: 1px solid var(--theme-stroke);
		border-radius: var(--radius-sm);
		font-family: inherit;
		font-size: 12px;
		color: var(--text-faint);
	}

	@media (prefers-reduced-motion: reduce) {
		.category-index-row,
		.category-back,
		.qc-chip,
		.quick-create-btn,
		.wizard-create-btn,
		.wizard-name-input,
		.wizard-preview,
		.spinner,
		.category-prereq-btn,
		.wizard-prereq-toggle {
			transition: none;
		}
		.wizard-section,
		.wizard-hint,
		.preview-tag,
		.empty-icon,
		.quick-create-btn.success,
		.wizard-create-btn.success {
			animation: none;
		}
	}
</style>
