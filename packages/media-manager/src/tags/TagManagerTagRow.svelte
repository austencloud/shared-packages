<script lang="ts">
	import TagChip from './TagChip.svelte';
	import TagManagerColorPicker from './TagManagerColorPicker.svelte';
	import TagManagerCategoryPicker from './TagManagerCategoryPicker.svelte';
	import { getTagHex, getCategoryLabel, type MediaTag, type TagColor } from '../types.js';

	interface Props {
		tag: MediaTag;
		itemCount: number;
		selected?: boolean;
		/** App-specific category order. */
		categories: string[];
		/** App-specific category labels. */
		categoryLabels?: Record<string, string> | undefined;
		onselect?: (tagId: string) => void;
		onupdate?: (tagId: string, updates: { name?: string; color?: TagColor; category?: string }) => void;
		ondelete?: (tagId: string) => void;
	}

	const {
		tag,
		itemCount,
		selected = false,
		categories,
		categoryLabels,
		onselect,
		onupdate,
		ondelete
	}: Props = $props();

	let isEditing = $state(false);
	let editName = $state('');
	let showColorPicker = $state(false);
	let showCategoryPicker = $state(false);
	let inputEl: HTMLInputElement | undefined = $state();

	let hex = $derived(getTagHex(tag));

	function startRename() {
		editName = tag.name;
		isEditing = true;
		showColorPicker = false;
		showCategoryPicker = false;
	}

	function saveRename() {
		const trimmed = editName.trim();
		if (trimmed && trimmed !== tag.name) {
			onupdate?.(tag.id, { name: trimmed });
		}
		isEditing = false;
	}

	function cancelRename() {
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

	function handleColorSelect(color: TagColor) {
		onupdate?.(tag.id, { color });
		showColorPicker = false;
	}

	function handleCategorySelect(category: string) {
		onupdate?.(tag.id, { category });
		showCategoryPicker = false;
	}

	function toggleColorPicker() {
		showCategoryPicker = false;
		isEditing = false;
		showColorPicker = !showColorPicker;
	}

	function toggleCategoryPicker() {
		showColorPicker = false;
		isEditing = false;
		showCategoryPicker = !showCategoryPicker;
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
	data-tag-id={tag.id}
	role="listitem"
>
	<div class="row-main">
		<!-- Checkbox area -->
		{#if onselect}
			<button
				class="select-btn"
				class:selected
				onclick={() => onselect(tag.id)}
				aria-label={selected ? `Deselect ${tag.name}` : `Select ${tag.name}`}
				aria-pressed={selected}
			>
				{#if selected}
					<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
						<path d="M2 5l2.5 2.5L8 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				{/if}
			</button>
		{/if}

		<!-- Color dot -->
		<button
			class="color-dot"
			style="background: {hex}"
			onclick={toggleColorPicker}
			title="Change color"
			aria-label="Change color for {tag.name}"
		></button>

		{#if isEditing}
			<!-- Edit mode -->
			<div class="edit-row">
				<input
					bind:this={inputEl}
					type="text"
					class="edit-input"
					bind:value={editName}
					onkeydown={handleRenameKeydown}
					onblur={saveRename}
				/>
			</div>
		{:else}
			<!-- Display mode -->
			<button class="tag-name-btn" ondblclick={startRename} title="Double-click to rename">
				<TagChip {tag} />
			</button>

			<button
				class="category-badge"
				class:active={showCategoryPicker}
				onclick={toggleCategoryPicker}
				title="Change category"
			>
				{getCategoryLabel(tag.category, categoryLabels)}
			</button>

			<span class="item-count">{itemCount}</span>

			{#if ondelete}
				<button
					class="delete-btn"
					onclick={() => ondelete(tag.id)}
					title="Delete tag"
					aria-label="Delete {tag.name}"
				>
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
						<path d="M3 3.5h8M5.5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1M9.5 5.5v5a1 1 0 01-1 1h-3a1 1 0 01-1-1v-5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>
			{/if}
		{/if}
	</div>

	{#if showColorPicker}
		<div class="inline-panel">
			<TagManagerColorPicker selected={tag.color} onselect={handleColorSelect} />
		</div>
	{/if}

	{#if showCategoryPicker}
		<div class="inline-panel">
			<TagManagerCategoryPicker
				selected={tag.category}
				onselect={handleCategorySelect}
				{categories}
				{categoryLabels}
			/>
		</div>
	{/if}
</div>

<style>
	.tag-row {
		border-radius: 6px;
		border: 1px solid transparent;
		transition: background 0.15s, border-color 0.15s;
	}

	.tag-row:hover {
		background: var(--mm-surface-hover, #2e2e50);
	}

	.tag-row.selected {
		border-color: var(--mm-accent, #6366f1);
		background: color-mix(in srgb, var(--mm-accent, #6366f1) 8%, transparent);
	}

	.row-main {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		min-height: 40px;
	}

	.select-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 1.5px solid var(--mm-border, #333355);
		background: transparent;
		color: transparent;
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.15s, border-color 0.15s;
	}

	.select-btn:hover {
		border-color: var(--mm-accent, #6366f1);
		background: color-mix(in srgb, var(--mm-accent, #6366f1) 15%, transparent);
	}

	.select-btn.selected {
		border-color: var(--mm-accent, #6366f1);
		background: var(--mm-accent, #6366f1);
		color: white;
	}

	.select-btn:focus-visible {
		outline: 2px solid var(--mm-accent, #6366f1);
		outline-offset: 2px;
	}

	.color-dot {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		flex-shrink: 0;
		transition: transform 0.15s, box-shadow 0.15s;
	}

	.color-dot:hover {
		transform: scale(1.3);
		box-shadow: 0 0 6px currentColor;
	}

	.color-dot:active {
		transform: scale(0.9);
	}

	.color-dot:focus-visible {
		outline: 2px solid var(--mm-accent, #6366f1);
		outline-offset: 2px;
	}

	.tag-name-btn {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		flex-shrink: 0;
	}

	.tag-name-btn:focus-visible {
		outline: 2px solid var(--mm-accent, #6366f1);
		outline-offset: 2px;
		border-radius: 9999px;
	}

	.category-badge {
		padding: 2px 10px;
		background: var(--mm-surface-raised, #222240);
		border: 1px solid var(--mm-border-subtle, #2a2a48);
		border-radius: 9999px;
		color: var(--mm-text-dim, #66668a);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s, color 0.15s;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.category-badge:hover {
		border-color: var(--mm-text-muted, #9999b0);
		color: var(--mm-text-muted, #9999b0);
	}

	.category-badge.active {
		background: var(--mm-accent, #6366f1);
		border-color: var(--mm-accent, #6366f1);
		color: white;
	}

	.category-badge:focus-visible {
		outline: 2px solid var(--mm-accent, #6366f1);
		outline-offset: 2px;
	}

	.item-count {
		margin-left: auto;
		padding: 1px 8px;
		background: var(--mm-surface-raised, #222240);
		border-radius: 9999px;
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		color: var(--mm-text-dim, #66668a);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.delete-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: none;
		border: none;
		border-radius: 6px;
		color: var(--mm-text-dim, #66668a);
		cursor: pointer;
		flex-shrink: 0;
		opacity: 0;
		transition: opacity 0.15s, background 0.15s, color 0.15s;
	}

	.tag-row:hover .delete-btn {
		opacity: 1;
	}

	.delete-btn:hover {
		background: color-mix(in srgb, var(--mm-danger, #ef4444) 15%, transparent);
		color: var(--mm-danger, #ef4444);
	}

	.delete-btn:active {
		transform: scale(0.9);
	}

	.delete-btn:focus-visible {
		outline: 2px solid var(--mm-danger, #ef4444);
		outline-offset: 2px;
		opacity: 1;
	}

	.edit-row {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1;
		min-width: 0;
	}

	.edit-input {
		flex: 1;
		padding: 4px 10px;
		background: var(--mm-surface, #1a1a2e);
		border: 1px solid var(--mm-accent, #6366f1);
		border-radius: 4px;
		color: var(--mm-text, #e8e8f0);
		font-size: 14px;
		font-family: inherit;
		outline: none;
	}

	.edit-input:focus {
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--mm-accent, #6366f1) 25%, transparent);
	}

	.inline-panel {
		padding: 4px 12px 8px;
		margin-left: 44px;
	}
</style>
