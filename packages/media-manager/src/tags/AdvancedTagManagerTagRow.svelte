<script lang="ts">
	import TagEntityLink from './AdvancedTagEntityLink.svelte';
	import TagChip from './AdvancedTagChip.svelte';
	import Icon from './AdvancedTagIcon.svelte';
	import TagManagerColorPicker from './AdvancedTagManagerColorPicker.svelte';
	import TagManagerCategoryPicker from './AdvancedTagManagerCategoryPicker.svelte';
	import TagManagerPrereqPicker from './AdvancedTagManagerPrereqPicker.svelte';
	import TagManagerDeleteConfirm from './AdvancedTagManagerDeleteConfirm.svelte';
	import {
		getCategoryLabel,
		getTagHex,
		type MediaTag,
		type TagColor,
		type TagCategory
	} from './advanced-tag-helpers.js';

	interface Props {
		tag: MediaTag;
		itemCount: number;
		categories: string[];
		categoryLabels?: Record<string, string>;
		allTags?: MediaTag[];
		selected: boolean;
		selectionMode?: boolean;
		showCategory?: boolean;
		isHighlighted?: boolean;
		isDragSource: boolean;
		isDragTarget: boolean;
		/** False on touch screens, where HTML5 drag-and-drop doesn't work.
		    Also gates chip-tap rename, which needs the same fine pointer. */
		canDrag?: boolean;
		enableDrag?: boolean;
		compact?: boolean;
		appearance?: 'default' | 'rows';
		onToggleSelect: (tagId: string) => void;
		onRename: (tagId: string, newName: string) => Promise<void>;
		onChangeColor: (tagId: string, newColor: TagColor) => Promise<void>;
		onChangeCategory: (tagId: string, newCategory: TagCategory) => Promise<void>;
		onChangePrereqs?: ((tagId: string, prereqTagIds: string[]) => Promise<void>) | undefined;
		onDelete: (tagId: string) => Promise<void>;
		onStartMerge: (tagId: string) => void;
		onDragStart: (e: DragEvent, tagId: string) => void;
		onDragOver: (e: DragEvent, tagId: string) => void;
		onDragLeave: () => void;
		onDrop: (e: DragEvent, tagId: string) => void;
		onDragEnd: () => void;
	}

	const {
		tag,
		itemCount,
		categories,
		categoryLabels = {},
		allTags = [],
		selected,
		selectionMode = false,
		showCategory = false,
		isHighlighted = false,
		isDragSource,
		isDragTarget,
		canDrag = true,
		enableDrag = true,
		compact = false,
		appearance = 'default',
		onToggleSelect,
		onRename,
		onChangeColor,
		onChangeCategory,
		onChangePrereqs,
		onDelete,
		onStartMerge,
		onDragStart,
		onDragOver,
		onDragLeave,
		onDrop,
		onDragEnd
	}: Props = $props();

	// Inline editing states
	let isEditing = $state(false);
	let editName = $state('');
	let showColorPicker = $state(false);
	let showCategoryPicker = $state(false);
	let showPrereqPicker = $state(false);
	let showDeleteConfirm = $state(false);
	let showActionMenu = $state(false);
	let inputEl: HTMLInputElement | undefined = $state();

	// Bumped every time an edit session starts, so a save that is still
	// in flight when the row moves on to a newer edit (cancel, then
	// rename again) knows not to close that newer session out from under
	// the user.
	let editSession = 0;

	function startRename() {
		editSession++;
		// If a save from an earlier edit session (this one, cancelled and
		// reopened) is still in flight, tag.name won't reflect it until the
		// write round-trips. Seed from the name that save is writing
		// instead of tag.name, so the reopened editor can't start from
		// (and a later save can't revert to) a name that's about to
		// change out from under it.
		editName = pendingRename?.name ?? tag.name;
		skipBlurSave = false;
		isEditing = true;
		closeAllPickers();
	}

	// Set on pointerdown of the rename Cancel button, which runs before the
	// input's blur, so the blur doesn't save what the user is cancelling.
	let skipBlurSave = false;

	// Guards against a double write: clicking Save blurs the input first
	// (starting a save), then the click's own handler runs saveRename again
	// while the first call is still awaiting. Tied to the edit session
	// (not a plain flag) so an older session's still-in-flight save can't
	// block a newer session's Save/Enter. With a shared flag, cancelling
	// and reopening while the first save was still in flight silently
	// dropped the next Enter.
	let savingSession: number | null = null;

	// The name a still-in-flight save is writing, keyed by the session that
	// started it. Read by startRename above when the editor reopens before
	// that save has resolved.
	let pendingRename: { session: number; name: string } | null = null;

	// Attached to the whole edit row (not just the input) so it also
	// catches focus leaving after a Tab from the input to Save/Cancel and
	// then out of the row, which a plain input blur never saw.
	function handleEditRowFocusOut(e: FocusEvent) {
		if (skipBlurSave) return;
		// Moving focus between the input and the Save/Cancel buttons is
		// still inside the row; only a move outside it commits a save.
		const related = e.relatedTarget as Element | null;
		if (related?.closest('.edit-row')) return;
		saveRename();
	}

	async function saveRename() {
		if (!isEditing || savingSession === editSession) return;
		const session = editSession;
		const trimmed = editName.trim();
		if (trimmed && trimmed !== (pendingRename?.name ?? tag.name)) {
			savingSession = session;
			pendingRename = { session, name: trimmed };
			try {
				await onRename(tag.id, trimmed);
			} catch {
				// Already reported via the error toast. Leave the editor
				// open with what the user typed instead of closing it as
				// if the save went through.
				if (savingSession === session) savingSession = null;
				if (pendingRename?.session === session) pendingRename = null;
				return;
			}
			if (savingSession === session) savingSession = null;
			if (pendingRename?.session === session) pendingRename = null;
		}
		// A slower save that resolves after the row moved on to a newer
		// edit (or closed) must not reach back and close that newer state.
		if (editSession === session) {
			isEditing = false;
		}
	}

	function cancelRename() {
		skipBlurSave = false;
		isEditing = false;
	}

	function handleRenameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveRename();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			cancelRename();
		}
	}

	function closeAllPickers() {
		showColorPicker = false;
		showCategoryPicker = false;
		showPrereqPicker = false;
		showDeleteConfirm = false;
		showActionMenu = false;
	}

	let menuOpensUp = $state(false);
	// Six actions plus divider and padding.
	const MENU_HEIGHT = 300;

	function toggleActionMenu(e: MouseEvent) {
		e.stopPropagation();
		const wasOpen = showActionMenu;
		closeAllPickers();
		isEditing = false;
		if (!wasOpen) {
			// The list scrolls and clips; a menu opened on a low row used to
			// hang off the bottom with Delete hidden under the footer.
			const trigger = e.currentTarget as HTMLElement;
			const scroller = trigger.closest('.list-scroll') ?? document.documentElement;
			const below =
				scroller.getBoundingClientRect().bottom - trigger.getBoundingClientRect().bottom;
			const above = trigger.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
			menuOpensUp = below < MENU_HEIGHT && above > below;
		}
		showActionMenu = !wasOpen;
	}

	// Close action menu on click-outside or Escape
	$effect(() => {
		if (!showActionMenu) return;
		function onClickOutside() {
			showActionMenu = false;
		}
		function onKeydown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				e.stopPropagation();
				showActionMenu = false;
			}
		}
		// Defer so the opening click doesn't immediately close it
		const id = setTimeout(() => {
			window.addEventListener('click', onClickOutside, { once: true });
		}, 0);
		// Capture phase: this must win the race against the tag manager's own
		// Escape handling, which lives on an ancestor element and would
		// otherwise see the same bubbling keydown first and close the whole
		// panel instead of just this menu.
		window.addEventListener('keydown', onKeydown, { capture: true });
		return () => {
			clearTimeout(id);
			window.removeEventListener('click', onClickOutside);
			window.removeEventListener('keydown', onKeydown, { capture: true });
		};
	});

	function toggleColorPicker() {
		const wasOpen = showColorPicker;
		closeAllPickers();
		isEditing = false;
		showColorPicker = !wasOpen;
	}

	function toggleCategoryPicker() {
		const wasOpen = showCategoryPicker;
		closeAllPickers();
		isEditing = false;
		showCategoryPicker = !wasOpen;
	}

	function togglePrereqPicker() {
		const wasOpen = showPrereqPicker;
		closeAllPickers();
		isEditing = false;
		showPrereqPicker = !wasOpen;
	}

	async function handlePrereqSelect(ids: string[]) {
		if (onChangePrereqs) {
			await onChangePrereqs(tag.id, ids);
		}
	}

	let hasPrereqs = $derived((tag.prereqTagIds?.length ?? 0) > 0);

	async function handleColorSelect(color: TagColor) {
		await onChangeColor(tag.id, color);
		showColorPicker = false;
	}

	async function handleCategorySelect(category: TagCategory) {
		await onChangeCategory(tag.id, category);
		showCategoryPicker = false;
	}

	function handleDeleteClick() {
		closeAllPickers();
		isEditing = false;
		showDeleteConfirm = true;
	}

	async function handleDeleteConfirm() {
		await onDelete(tag.id);
		showDeleteConfirm = false;
	}

	function handleDeleteCancel() {
		showDeleteConfirm = false;
	}

	$effect(() => {
		if (isEditing && inputEl) {
			inputEl.focus();
			inputEl.select();
		}
	});
</script>

<div
	class="tag-row"
	class:selected
	class:highlight={isHighlighted}
	class:drag-over={isDragTarget}
	class:dragging={isDragSource}
	class:can-drag={canDrag && enableDrag}
	class:compact
	class:rows={appearance === 'rows'}
	class:selection-mode={selectionMode}
	data-tag-id={tag.id}
	draggable={canDrag && enableDrag}
	ondragstart={(e) => onDragStart(e, tag.id)}
	ondragover={(e) => onDragOver(e, tag.id)}
	ondragleave={onDragLeave}
	ondrop={(e) => onDrop(e, tag.id)}
	ondragend={onDragEnd}
	role="listitem"
>
	<div class="row-main" class:menu-open={showActionMenu}>
		{#if selectionMode && appearance !== 'rows'}
			<button
				class="select-indicator"
				class:selected
				onclick={() => onToggleSelect(tag.id)}
				aria-label={selected ? `Deselect ${tag.name}` : `Select ${tag.name}`}
				aria-pressed={selected}
			>
				<span class="select-circle"
					>{#if selected}<Icon name="check" size={10} />{/if}</span
				>
			</button>
		{/if}

		{#if isEditing}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="edit-row" onfocusout={handleEditRowFocusOut}>
				<input
					bind:this={inputEl}
					type="text"
					class="edit-input"
					bind:value={editName}
					enterkeyhint="done"
					aria-label="Tag name"
					onkeydown={handleRenameKeydown}
				/>
				<button class="icon-btn" onclick={saveRename} title="Save" aria-label="Save name">
					<Icon name="check" size={16} />
				</button>
				<button
					class="icon-btn"
					onpointerdown={() => (skipBlurSave = true)}
					onpointercancel={() => (skipBlurSave = false)}
					onpointerleave={(e) => {
						// On touch, pointerleave fires right after pointerup and
						// before click, so a mouse-only reset here is needed --
						// otherwise skipBlurSave was already back to false by
						// the time Cancel's click handler ran.
						if (e.pointerType === 'mouse') skipBlurSave = false;
					}}
					onmousedown={(e) => e.preventDefault()}
					onclick={cancelRename}
					title="Cancel"
					aria-label="Cancel rename"
				>
					<Icon name="xmark" size={16} />
				</button>
			</div>
		{:else}
			{#if appearance === 'rows'}
				<button
					class="row-select"
					aria-pressed={selectionMode ? selected : undefined}
					aria-label={selectionMode ? `${selected ? 'Deselect' : 'Select'} ${tag.name}` : `Rename ${tag.name}`}
					onclick={() => selectionMode ? onToggleSelect(tag.id) : startRename()}
				>
					<span class="row-name">{tag.name}</span>
					<span class="row-count">{itemCount}<span class="sr-only"> item{itemCount === 1 ? '' : 's'}</span></span>
					{#if selectionMode}<span class="row-status" aria-hidden="true">{selected ? 'Selected' : 'Select'}</span>{/if}
				</button>
			{:else if canDrag}
				<!-- Tag name (clickable to rename with a fine pointer; on touch,
				     rename lives only in the row menu, so this is just a label) -->
				<button
					class="tag-name-btn"
					onclick={startRename}
					title="Rename"
					aria-label="Rename {tag.name}"
				>
					{#if compact}<span class="compact-name" style={`--tag-color: ${getTagHex(tag)}`}
							>{tag.name}</span
						>{:else}<TagChip label={tag.name} color={tag.color} size="lg" />{/if}
				</button>
			{:else}
				<!-- Touch has no fine pointer for chip-tap rename; rename lives
				     only in the row menu, so this is just a label, not a control. -->
				<span class="tag-name-btn">
					{#if compact}<span class="compact-name" style={`--tag-color: ${getTagHex(tag)}`}
							>{tag.name}</span
						>{:else}<TagChip label={tag.name} color={tag.color} size="lg" />{/if}
				</span>
			{/if}

			<!-- Search results span categories; within a category this is redundant. -->
			{#if showCategory}<button
					class="category-badge"
					class:active={showCategoryPicker}
					onclick={toggleCategoryPicker}
					title="Change category"
				>
					{getCategoryLabel(tag.category ?? 'content', categoryLabels)}
				</button>{/if}

			<!-- Prereq indicator -->
			{#if hasPrereqs}
				<span class="prereq-indicator" title="Has prerequisite tags configured">
					<Icon name="link" size={10} />
				</span>
			{/if}

			<!-- Item count -->
			{#if appearance !== 'rows'}<span class="item-count"
				>{itemCount}<span class="count-unit">&nbsp;item{itemCount !== 1 ? 's' : ''}</span></span
			>{/if}

			<!-- Three-dot action menu -->
			<TagEntityLink {tag} />
			<div class="action-menu-anchor">
				<button
					class="action-menu-trigger"
					class:open={showActionMenu}
					onclick={toggleActionMenu}
					title="More actions"
					aria-label="Actions for {tag.name}"
					aria-expanded={showActionMenu}
					aria-haspopup="menu"
				>
					<Icon name="ellipsis-vertical" size={14} />
				</button>

				{#if showActionMenu}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="action-menu"
						class:up={menuOpensUp}
						role="menu"
						onclick={(e) => e.stopPropagation()}
					>
						<button
							class="action-menu-item"
							role="menuitem"
							onclick={() => {
								showActionMenu = false;
								toggleColorPicker();
							}}
						>
							<Icon name="palette" size={13} />
							Change color
						</button>
						<button
							class="action-menu-item"
							role="menuitem"
							onclick={() => {
								showActionMenu = false;
								startRename();
							}}
						>
							<Icon name="pen" size={13} />
							Rename
						</button>
						<!-- The category pill is hidden on phones (rows are already grouped
						     by category), so moving a tag lives here too -->
						<button
							class="action-menu-item"
							role="menuitem"
							onclick={() => {
								showActionMenu = false;
								toggleCategoryPicker();
							}}
						>
							<Icon name="layer-group" size={13} />
							Move to category
						</button>
						{#if onChangePrereqs}
							<button
								class="action-menu-item"
								class:active-indicator={hasPrereqs}
								role="menuitem"
								onclick={() => {
									showActionMenu = false;
									togglePrereqPicker();
								}}
							>
								<Icon name="link" size={13} />
								Prerequisites
							</button>
						{/if}
						<button
							class="action-menu-item"
							role="menuitem"
							onclick={() => {
								showActionMenu = false;
								onStartMerge(tag.id);
							}}
						>
							<Icon name="code-merge" size={13} />
							Merge
						</button>
						<hr class="action-menu-divider" />
						<button
							class="action-menu-item danger"
							role="menuitem"
							onclick={() => {
								showActionMenu = false;
								handleDeleteClick();
							}}
						>
							<Icon name="trash" size={13} />
							Delete
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	{#if showColorPicker}
		<div class="inline-panel">
			<TagManagerColorPicker current={tag.color} onSelect={handleColorSelect} />
		</div>
	{/if}

	{#if showCategoryPicker}
		<div class="inline-panel">
			<TagManagerCategoryPicker
				{appearance}
				current={tag.category}
				{categories}
				{categoryLabels}
				onSelect={handleCategorySelect}
			/>
		</div>
	{/if}

	{#if showPrereqPicker}
		<div class="inline-panel">
			<TagManagerPrereqPicker
				{appearance}
				currentPrereqs={tag.prereqTagIds ?? []}
				{allTags}
				excludeTagId={tag.id}
				excludeCategory={tag.category ?? 'content'}
				{categoryLabels}
				onSelect={handlePrereqSelect}
				onDone={() => (showPrereqPicker = false)}
			/>
		</div>
	{/if}

	{#if showDeleteConfirm}
		<div class="inline-panel">
			<TagManagerDeleteConfirm
				tagName={tag.name}
				{itemCount}
				onConfirm={handleDeleteConfirm}
				onCancel={handleDeleteCancel}
			/>
		</div>
	{/if}
</div>

<style>
	.tag-row {
		position: relative;
		border-radius: var(--radius-md);
		transition:
			background var(--duration-crisp) var(--ease-crisp),
			border-color var(--duration-crisp) var(--ease-crisp),
			box-shadow var(--duration-crisp) var(--ease-crisp);
		border: 1px solid transparent;
		margin: 0 2px;
	}

	.tag-row.can-drag {
		cursor: grab;
	}

	/* Hover lift only where there is a real hover; on touch it stuck on the
	   last row tapped */
	@media (hover: hover) {
		.tag-row:hover {
			background: var(--surface-subtle);
			transform: translateY(-1px);
			box-shadow: 0 2px 8px var(--overlay-light);
		}

		.tag-row:active {
			transform: translateY(0);
		}
	}

	.tag-row.selected {
		border-color: var(--royal-border);
		background: var(--royal-bg);
	}

	.tag-row.drag-over {
		background: var(--royal-bg);
		border: 1px dashed var(--royal-border);
	}

	.tag-row.dragging {
		opacity: 0.4;
	}

	/* Highlight glow for newly created tags */
	.tag-row.highlight {
		animation: highlight-glow 2.2s ease-out;
	}

	@keyframes highlight-glow {
		0% {
			background: var(--royal-bg-strong);
			border-color: var(--royal-border);
			box-shadow:
				0 0 16px var(--shadow-royal-glow),
				inset 0 0 8px var(--royal-bg);
		}
		40% {
			background: var(--royal-bg);
			border-color: var(--royal-border);
			box-shadow: 0 0 8px var(--shadow-royal-glow);
		}
		100% {
			background: transparent;
			border-color: transparent;
			box-shadow: none;
		}
	}

	.row-main {
		position: relative;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 2px 4px 2px 0;
		min-height: var(--min-touch-target);
	}

	/* Selection toggle: 44px button, 20px circle drawn inside */
	.select-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--min-touch-target);
		height: var(--min-touch-target);
		margin-right: -8px;
		padding: 0;
		background: none;
		border: none;
		border-radius: var(--radius-md);
		color: transparent;
		cursor: pointer;
		flex-shrink: 0;
	}

	.select-circle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 1.5px solid var(--theme-stroke-strong);
		background: transparent;
		transition:
			background var(--duration-crisp) var(--ease-crisp),
			border-color var(--duration-crisp) var(--ease-crisp),
			box-shadow var(--duration-crisp) var(--ease-crisp);
	}

	@media (hover: hover) {
		.select-indicator:hover .select-circle {
			border-color: var(--royal-border);
			background: var(--royal-bg);
			box-shadow: 0 0 0 3px var(--royal-bg);
		}
	}

	.select-indicator.selected .select-circle {
		border-color: var(--cirque-royal);
		background: var(--cirque-royal);
		color: var(--theme-text);
		animation: select-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes select-pop {
		0% {
			transform: scale(0.8);
		}
		60% {
			transform: scale(1.15);
		}
		100% {
			transform: scale(1);
		}
	}

	.select-indicator:active .select-circle {
		transform: scale(0.9);
	}

	.select-indicator:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -4px;
	}

	/* Tag name button. Rendered as a real <button> only when canDrag (a fine
	   pointer) is true; on touch it's a plain <span> with no click handler,
	   so it needs no pointer cursor and no separate hover:none override. */
	.tag-name-btn {
		position: relative;
		background: none;
		border: none;
		padding: 0;
		flex-shrink: 1;
		min-width: 0;
		max-width: 100%;
		display: flex;
	}

	button.tag-name-btn {
		cursor: pointer;
	}

	/* Long names truncate instead of pushing the count and menu off the row */
	.tag-name-btn :global(.tag-chip) {
		max-width: 100%;
		min-width: 0;
	}

	.tag-name-btn :global(.tag-label) {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tag-name-btn::before {
		content: '';
		position: absolute;
		inset: 50% 0;
		transform: translateY(-50%);
		min-height: var(--min-touch-target);
	}

	.tag-name-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
		border-radius: var(--radius-full);
	}

	/* Category badge */
	.category-badge {
		position: relative;
		padding: 3px 10px;
		min-height: var(--min-touch-target);
		display: inline-flex;
		align-items: center;
		background: var(--surface-subtle);
		border: 1px solid var(--stroke-subtle);
		border-radius: var(--radius-full);
		color: var(--text-faint);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition:
			background var(--duration-crisp) var(--ease-crisp),
			border-color var(--duration-crisp) var(--ease-crisp),
			color var(--duration-crisp) var(--ease-crisp);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.category-badge:hover {
		border-color: var(--theme-stroke-strong);
		color: var(--theme-text-dim);
	}

	.category-badge:active {
		transform: scale(0.95);
	}

	.category-badge.active {
		background: var(--royal-bg);
		border-color: var(--royal-border);
		color: var(--royal-text);
	}

	.category-badge:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	/* Item count pill */
	.item-count {
		display: inline-flex;
		align-items: center;
		padding: 2px 8px;
		background: var(--surface-subtle);
		border-radius: var(--radius-full);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		color: var(--text-muted);
		white-space: nowrap;
		flex-shrink: 0;
	}

	/* Action menu (three-dot trigger + dropdown) */
	.action-menu-anchor {
		position: relative;
		margin-left: auto;
		flex-shrink: 0;
	}

	.action-menu-trigger {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--min-touch-target);
		height: var(--min-touch-target);
		background: none;
		border: none;
		border-radius: var(--radius-md);
		color: var(--text-faint);
		cursor: pointer;
		opacity: 0;
		transition:
			opacity var(--duration-crisp) var(--ease-crisp),
			background var(--duration-crisp) var(--ease-crisp),
			color var(--duration-crisp) var(--ease-crisp);
	}

	/* 48px invisible touch target */
	.action-menu-trigger::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		min-width: var(--min-touch-target);
		min-height: var(--min-touch-target);
	}

	.tag-row:hover .action-menu-trigger,
	.tag-row:focus-within .action-menu-trigger,
	.action-menu-trigger.open {
		opacity: 1;
	}

	/* No hover on touch screens, so the menu was invisible (but still
	   tappable) on every row except the last one touched */
	@media (hover: none) {
		.action-menu-trigger {
			opacity: 1;
			color: var(--text-muted);
		}
	}

	.action-menu-trigger:hover {
		background: var(--interactive-hover);
		color: var(--theme-text-dim);
	}

	.action-menu-trigger.open {
		background: var(--interactive-selected);
		color: var(--theme-text-dim);
	}

	.action-menu-trigger:active {
		transform: scale(0.92);
	}

	.action-menu-trigger:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
		opacity: 1;
	}

	.action-menu {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		min-width: 196px;
		padding: 4px;
		background: var(--theme-panel-bg);
		backdrop-filter: blur(16px);
		border: 1px solid var(--theme-stroke);
		border-radius: var(--radius-md);
		box-shadow:
			0 8px 24px var(--overlay-heavy),
			0 2px 8px var(--overlay-light);
		z-index: 50;
		animation: menu-enter 0.12s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.action-menu.up {
		top: auto;
		bottom: calc(100% + 4px);
		transform-origin: bottom right;
	}

	@keyframes menu-enter {
		from {
			opacity: 0;
			transform: translateY(-4px) scale(0.96);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.action-menu-item {
		position: relative;
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 8px 12px;
		min-height: var(--min-touch-target);
		background: none;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--theme-text-dim);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition:
			background var(--duration-crisp) var(--ease-crisp),
			color var(--duration-crisp) var(--ease-crisp);
		white-space: nowrap;
	}

	.action-menu-item:hover {
		background: var(--interactive-hover);
		color: var(--theme-text);
	}

	.action-menu-item:active {
		background: var(--interactive-active);
	}

	.action-menu-item.active-indicator {
		color: var(--cirque-royal);
	}

	.action-menu-item.active-indicator:hover {
		color: var(--royal-text);
		background: var(--royal-bg);
	}

	.action-menu-item.danger {
		color: var(--red-text);
	}

	.action-menu-item.danger:hover {
		background: var(--red-bg);
		color: var(--red-text);
	}

	.action-menu-item:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
	}

	.action-menu-divider {
		border: none;
		border-top: 1px solid var(--stroke-subtle);
		margin: 4px 0;
	}

	/* Icon buttons (used in edit mode) */
	.icon-btn {
		position: relative;
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

	.icon-btn::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		min-width: var(--min-touch-target);
		min-height: var(--min-touch-target);
	}

	.icon-btn:hover {
		background: var(--interactive-selected);
		color: var(--theme-text-dim);
	}

	.icon-btn:active {
		transform: scale(0.92);
	}

	.icon-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	/* Edit row */
	.edit-row {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1;
		min-width: 0;
	}

	.edit-input {
		flex: 1;
		min-width: 0;
		padding: 4px 10px;
		min-height: var(--min-touch-target);
		background: var(--interactive-selected);
		border: 1px solid var(--royal-border);
		border-radius: var(--radius-sm);
		color: var(--theme-text);
		/* 16px keeps mobile browsers from zooming into the field */
		font-size: 16px;
		font-family: inherit;
		outline: none;
	}

	.edit-input:focus {
		border-color: var(--royal-border);
		box-shadow: 0 0 0 2px var(--royal-bg);
	}

	/* Prereq indicator */
	.prereq-indicator {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--royal-bg);
		color: var(--cirque-royal);
		flex-shrink: 0;
	}

	/* Inline panel */
	.inline-panel {
		padding: 4px 12px 8px;
		margin-left: 40px;
		animation: panel-enter 0.15s cubic-bezier(0.16, 1, 0.3, 1);
	}

	/* Phones: rows are grouped under category headers already, so the
	   per-row category pill is dropped (Move to category is in the menu)
	   and panels use the full row width */
	@media (max-width: 767px), (pointer: coarse) and (max-width: 900px) {
		.category-badge {
			display: none;
		}

		.inline-panel {
			margin-left: 0;
			padding: 4px 8px 10px;
		}
	}

	/* Cover-screen width: tighter gaps and a bare number in the count pill
	   ("items" stays for screen readers) so tag names get the room */
	@media (max-width: 480px) {
		.row-main {
			gap: 4px;
		}

		.select-indicator {
			margin-right: -4px;
		}

		.count-unit {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
			white-space: nowrap;
		}
	}

	/* A sidebar can be narrow even on a desktop with a fine pointer. Let
	   the menu expand its row so every action remains inside the scroller. */
	@container (max-width: 500px) {
		.row-main {
			display: grid;
			grid-template-columns: minmax(0, 1fr) var(--min-touch-target);
			gap: 2px 4px;
		}
		.tag-row.selection-mode .row-main {
			grid-template-columns: var(--min-touch-target) minmax(0, 1fr) var(--min-touch-target);
		}

		.select-indicator,
		.action-menu-trigger {
			grid-row: 1 / 3;
		}

		.select-indicator {
			grid-column: 1;
		}

		.tag-name-btn {
			grid-column: 1;
			grid-row: 1;
		}
		.tag-row.selection-mode .tag-name-btn {
			grid-column: 2;
		}

		.edit-row {
			grid-column: 1;
			grid-row: 1;
		}
		.tag-row.selection-mode .edit-row {
			grid-column: 2;
		}

		.tag-name-btn :global(.tag-chip),
		.tag-name-btn :global(.tag-label) {
			white-space: normal;
		}

		.tag-name-btn :global(.tag-label) {
			overflow: visible;
			text-overflow: clip;
			overflow-wrap: break-word;
			line-height: 1.2;
		}

		.item-count {
			grid-column: 1;
			grid-row: 2;
			justify-self: start;
		}
		.tag-row.selection-mode .item-count {
			grid-column: 2;
		}

		.prereq-indicator {
			grid-column: 1;
			grid-row: 2;
			justify-self: end;
		}
		.tag-row.selection-mode .prereq-indicator {
			grid-column: 2;
		}

		.category-badge {
			display: none;
		}

		.count-unit {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
			white-space: nowrap;
		}

		.action-menu-anchor {
			display: contents;
		}

		.action-menu-trigger {
			grid-column: 2;
			margin-left: 0;
			opacity: 1;
		}
		.tag-row.selection-mode .action-menu-trigger {
			grid-column: 3;
		}

		.action-menu {
			position: static;
			grid-column: 1 / -1;
			grid-row: 3;
			min-width: 0;
			width: 100%;
			max-height: none;
			transform: none;
		}

		.inline-panel {
			margin-left: 0;
			padding: 4px 8px 10px;
		}
	}

	.tag-row.compact {
		margin: 0;
		border-radius: var(--radius-sm);
	}

	.tag-row.compact .row-main {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto 44px;
		gap: 0 2px;
		min-height: 44px;
		padding: 0;
	}
	.tag-row.compact.selection-mode .row-main {
		grid-template-columns: 44px minmax(0, 1fr) auto 44px;
	}

	.tag-row.compact .select-indicator,
	.tag-row.compact .tag-name-btn,
	.tag-row.compact .item-count,
	.tag-row.compact .action-menu-trigger {
		grid-row: 1;
		margin: 0;
	}

	.tag-row.compact .select-indicator {
		grid-column: 1;
	}
	.tag-row.compact .tag-name-btn {
		grid-column: 1;
		align-items: center;
	}
	.tag-row.compact.selection-mode .tag-name-btn {
		grid-column: 2;
	}
	.tag-row.compact .item-count {
		grid-column: 2;
		padding: 2px 5px;
	}
	.tag-row.compact.selection-mode .item-count {
		grid-column: 3;
	}
	.tag-row.compact .action-menu-trigger {
		grid-column: 3;
		opacity: 1;
	}
	.tag-row.compact.selection-mode .action-menu-trigger {
		grid-column: 4;
	}
	.tag-row.compact .action-menu-anchor {
		display: contents;
	}
	.tag-row.compact .action-menu {
		position: static;
		grid-column: 1 / -1;
		grid-row: 2;
		width: 100%;
		min-width: 0;
		max-height: none;
		transform: none;
	}
	.tag-row.compact .category-badge,
	.tag-row.compact .prereq-indicator {
		display: none;
	}
	.tag-row.compact .compact-name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--tag-color);
		background: color-mix(in srgb, var(--tag-color) 15%, transparent);
		border: 1px solid color-mix(in srgb, var(--tag-color) 44%, transparent);
		border-radius: var(--radius-full);
		padding: 4px 8px;
		font-size: 13px;
		font-weight: 500;
		text-align: left;
	}
	.tag-row.compact .edit-row {
		grid-column: 1 / 3;
		grid-row: 1;
		min-width: 0;
	}
	.tag-row.compact.selection-mode .edit-row {
		grid-column: 2 / 4;
	}
	.tag-row.compact .inline-panel {
		margin-left: 0;
		padding: 4px 8px 10px;
	}

	.tag-row.rows,
	.tag-row.rows.compact {
		margin: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		box-shadow: none;
		transform: none;
		transition: background 140ms ease-out, border-color 140ms ease-out;
	}
	.tag-row.rows:hover,
	.tag-row.rows:active {
		transform: none;
		box-shadow: none;
	}
	.tag-row.rows:hover { background: var(--interactive-hover); }
	.tag-row.rows.selected:hover { background: var(--theme-accent-bg); box-shadow: inset 2px 0 var(--theme-accent); }
	.tag-row.rows.selected {
		background: var(--theme-accent-bg);
		box-shadow: inset 2px 0 var(--theme-accent);
	}
	.tag-row.rows .row-main,
	.tag-row.rows.compact .row-main,
	.tag-row.rows.compact.selection-mode .row-main {
		display: flex;
		gap: 4px;
		min-height: 40px;
		padding: 0 4px;
	}
	.row-select {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 0;
		min-height: 40px;
		padding: 0 8px;
		background: transparent;
		border: 0;
		color: var(--theme-text);
		text-align: left;
		cursor: pointer;
	}
	.row-select:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -2px; }
	.row-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 500; }
	.row-count { color: var(--theme-text-dim); font-size: 11px; font-variant-numeric: tabular-nums; }
	.row-status { min-width: 3.5rem; color: var(--theme-text-dim); font-size: 11px; text-align: right; }
	.tag-row.rows.selected .row-status { color: var(--theme-accent); }
	.tag-row.rows .action-menu-anchor,
	.tag-row.rows.compact .action-menu-anchor { display: block; flex: none; }
	.tag-row.rows .action-menu-trigger,
	.tag-row.rows.compact .action-menu-trigger { opacity: 1; margin: 0; }
	.tag-row.rows .category-badge { border-radius: var(--radius-sm); background: transparent; }
	.tag-row.rows .inline-panel { margin-left: 0; }
	.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

	@keyframes panel-enter {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.tag-row.rows,
		.tag-row.rows.compact { transition: none; }
		.tag-row,
		.icon-btn,
		.select-indicator,
		.category-badge,
		.action-menu-trigger,
		.action-menu-item {
			transition: none;
		}
		.tag-row.highlight,
		.select-indicator.selected,
		.inline-panel,
		.action-menu {
			animation: none;
		}
	}
</style>
