<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import Icon from './AdvancedTagIcon.svelte';
	import TagChip from './AdvancedTagChip.svelte';
	import type { MediaTag } from './advanced-tag-helpers.js';
	type MergeMode = 'single' | 'batch';

	interface Props {
		mode: MergeMode;
		/** The tag(s) being merged away (source) */
		sourceTags: MediaTag[];
		/** All tags available to merge into */
		allTags: MediaTag[];
		/** Item counts per tag ID */
		itemCountMap: Map<string, number>;
		appearance?: 'default' | 'rows';
		onConfirm: (targetId: string) => void;
		onCancel: () => void;
	}

	const { mode, sourceTags, allTags, itemCountMap, appearance = 'default', onConfirm, onCancel }: Props = $props();

	let selectedTargetId = $state('');
	let searchQuery = $state('');
	let searchInputEl: HTMLInputElement | undefined = $state();

	// Filter out source tags from target options
	let sourceIds = $derived(new Set(sourceTags.map((t) => t.id)));
	let targetOptions = $derived(allTags.filter((t) => !sourceIds.has(t.id)));

	// Search-filtered options
	let filteredOptions = $derived.by(() => {
		if (!searchQuery.trim()) return targetOptions;
		const q = searchQuery.trim().toLowerCase();
		return targetOptions.filter((t) => t.name.toLowerCase().includes(q));
	});

	// Calculate total items affected
	let totalItemsAffected = $derived(
		sourceTags.reduce((sum, t) => sum + (itemCountMap.get(t.id) ?? 0), 0)
	);

	let selectedTarget = $derived(
		selectedTargetId ? allTags.find((t) => t.id === selectedTargetId) : null
	);

	function selectTarget(tagId: string) {
		selectedTargetId = tagId;
		searchQuery = '';
	}

	// On touch screens, focusing the search opens the keyboard over half the
	// sheet and hides the tag list. Only autofocus with a mouse/trackpad.
	const finePointer = new MediaQuery('(pointer: fine)');

	function clearTarget() {
		selectedTargetId = '';
		searchQuery = '';
		// Refocus search after clearing
		if (finePointer.current) requestAnimationFrame(() => searchInputEl?.focus());
	}

	function handleSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			// Without this, TagManager's own Escape handler (an ancestor
			// listener) sees the same bubbling keydown and closes the whole
			// panel behind this one on top of whatever happens here.
			e.stopPropagation();
			if (searchQuery) {
				searchQuery = '';
			} else {
				onCancel();
			}
		}
	}

	$effect(() => {
		if (searchInputEl && !selectedTargetId && finePointer.current) {
			searchInputEl.focus();
		}
	});
</script>

<div class="merge-flow" class:rows={appearance === 'rows'}>
	<!-- Source display -->
	<div class="merge-header merge-section">
		{#if mode === 'single' && sourceTags.length === 1}
			<p class="merge-text">
				Merge <TagChip label={sourceTags[0]!.name} color={sourceTags[0]!.color} size="sm" /> into:
			</p>
		{:else}
			<p class="merge-text">
				Merge <span class="source-count">{sourceTags.length}</span> tags into:
			</p>
		{/if}
	</div>

	<!-- Target picker -->
	<div class="target-picker merge-section">
		{#if selectedTarget}
			<!-- Selected target display -->
			<div class="selected-target">
				<TagChip label={selectedTarget.name} color={selectedTarget.color} size="md" />
				<span class="target-count">{itemCountMap.get(selectedTarget.id) ?? 0} items</span>
				<button class="target-clear" onclick={clearTarget} aria-label="Change target">
					<Icon name="xmark" size={12} />
				</button>
			</div>
		{:else}
			<!-- Search input -->
			<div class="search-container">
				<Icon name="magnifying-glass" size={14} />
				<input
					bind:this={searchInputEl}
					type="text"
					class="search-input"
					placeholder="Search target tag..."
					bind:value={searchQuery}
					onkeydown={handleSearchKeydown}
					aria-label="Search for target tag"
				/>
				{#if searchQuery}
					<button class="search-clear" onclick={() => { searchQuery = ''; searchInputEl?.focus(); }} aria-label="Clear search">
						<Icon name="xmark" size={10} />
					</button>
				{/if}
			</div>

			<!-- Tag options grid -->
			<div class="tag-options" role="listbox" aria-label="Select target tag">
				{#each filteredOptions as tag (tag.id)}
					<button
						class="tag-option"
						role="option"
						aria-selected={false}
						onclick={() => selectTarget(tag.id)}
					>
						{#if appearance === 'rows'}<span class="plain-option-name">{tag.name}</span>{:else}<TagChip label={tag.name} color={tag.color} size="sm" />{/if}
						<span class="option-count">{itemCountMap.get(tag.id) ?? 0}</span>
					</button>
				{:else}
					<p class="no-results">No matching tags</p>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Merge detail -->
	{#if selectedTarget}
		<!-- Two lines: the trailing period after the chip used to wrap onto a
		     line of its own -->
		<div class="merge-detail merge-section">
			<p class="detail-line">
				{totalItemsAffected} item{totalItemsAffected !== 1 ? 's' : ''} will move to
				<TagChip label={selectedTarget.name} color={selectedTarget.color} size="sm" />
			</p>
			<p class="detail-line">
				{#if mode === 'batch' || sourceTags.length !== 1}
					{sourceTags.length} tag{sourceTags.length !== 1 ? 's' : ''} will be deleted.
				{:else}
					"{sourceTags[0]!.name}" will be deleted.
				{/if}
			</p>
		</div>
	{/if}

	<!-- Actions -->
	<div class="merge-actions merge-section">
		<button class="action-btn cancel" onclick={onCancel}>Cancel</button>
		<button
			class="action-btn confirm"
			onclick={() => onConfirm(selectedTargetId)}
			disabled={!selectedTargetId}
		>
			<Icon name="code-merge" size={14} />
			Merge
		</button>
	</div>
</div>

<style>
	.merge-flow {
		display: flex;
		flex-direction: column;
		align-items: center;
		/* safe: when the content is taller than the sheet (keyboard open,
		   short screen) plain centering pushed the heading above the top
		   edge where it couldn't be scrolled to */
		justify-content: safe center;
		gap: 24px;
		padding: 32px 20px;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	.merge-section {
		width: 100%;
		max-width: 420px;
	}

	.merge-header {
		/* no extra margin needed, gap handles spacing */
	}

	.merge-text {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		font-size: 14px;
		font-weight: 500;
		color: var(--theme-text);
		margin: 0;
	}

	.source-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 22px;
		height: 20px;
		padding: 0 6px;
		background: var(--royal-bg-strong);
		border-radius: var(--radius-full);
		font-weight: 700;
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		color: var(--royal-text);
	}

	/* Target picker */
	.target-picker {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	/* Selected target display */
	.selected-target {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		background: var(--royal-bg);
		border: 1px solid var(--royal-border);
		border-radius: var(--radius-lg);
		animation: target-selected 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes target-selected {
		from { transform: scale(0.97); opacity: 0; }
		to { transform: scale(1); opacity: 1; }
	}

	.target-count {
		font-size: 12px;
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
		flex: 1;
	}

	.target-clear {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--min-touch-target);
		height: var(--min-touch-target);
		background: var(--interactive-active);
		border: none;
		border-radius: 50%;
		color: var(--text-muted);
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.15s ease, color 0.15s ease;
	}

	.target-clear:hover {
		background: var(--interactive-selected);
		color: var(--theme-text-dim);
	}

	.target-clear:active {
		transform: scale(0.9);
	}

	/* Search */
	.search-container {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 12px;
		min-height: var(--min-touch-target);
		background: var(--surface-dim);
		border: 1px solid var(--theme-stroke);
		border-radius: var(--radius-lg);
		color: var(--text-faint);
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.search-container:focus-within {
		border-color: var(--royal-border);
		box-shadow: 0 0 0 2px var(--royal-bg);
	}

	.search-input {
		flex: 1;
		background: none;
		border: none;
		outline: none;
		color: var(--theme-text);
		/* 16px keeps mobile browsers from zooming into the field */
		font-size: 16px;
		font-family: inherit;
		min-width: 0;
	}

	.search-input::placeholder {
		color: var(--text-faint);
	}

	.search-clear {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		background: var(--interactive-selected);
		border: none;
		border-radius: 50%;
		color: var(--text-muted);
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.15s ease;
	}

	.search-clear::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		min-width: var(--min-touch-target);
		min-height: var(--min-touch-target);
	}

	.search-clear:hover {
		background: var(--theme-stroke-strong);
	}

	/* Tag options grid */
	.tag-options {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		max-height: 40vh;
		overflow-y: auto;
		padding: 2px;
		scrollbar-width: thin;
		scrollbar-color: var(--stroke-subtle) transparent;
	}

	.tag-option {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px 6px 6px;
		min-height: var(--min-touch-target);
		background: var(--surface-subtle);
		border: 1px solid var(--stroke-subtle);
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: background 0.12s ease, border-color 0.12s ease, transform 0.1s ease;
	}

	.tag-option:hover {
		background: var(--interactive-active);
		border-color: var(--theme-stroke);
	}

	.tag-option:active {
		transform: scale(0.96);
	}

	.tag-option:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
	}

	.option-count {
		font-size: 12px;
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
	}

	.no-results {
		font-size: 13px;
		color: var(--text-faint);
		margin: 8px 0;
		width: 100%;
		text-align: center;
	}

	/* Merge detail */
	.merge-detail {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 12px;
		color: var(--text-muted);
		margin: 0;
		animation: detail-fade 0.2s ease 0.1s both;
	}

	.detail-line {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
		margin: 0;
	}

	@keyframes detail-fade {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	/* Actions */
	.merge-actions {
		display: flex;
		justify-content: center;
		gap: 8px;
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 6px 16px;
		min-height: var(--min-touch-target);
		border: none;
		border-radius: var(--radius-md);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background var(--duration-crisp) var(--ease-crisp), color var(--duration-crisp) var(--ease-crisp), opacity var(--duration-crisp) var(--ease-crisp), transform var(--duration-snap) var(--ease-crisp);
	}

	.action-btn.cancel {
		background: var(--interactive-active);
		border: 1px solid var(--interactive-active);
		color: var(--theme-text-dim);
	}

	.action-btn.cancel:hover {
		background: var(--interactive-selected);
		border-color: var(--interactive-selected);
		color: var(--theme-text-dim);
	}

	.action-btn:active:not(:disabled) {
		transform: scale(0.95);
	}

	.action-btn.confirm {
		background: var(--royal-bg-strong);
		border: 1px solid var(--royal-border);
		color: var(--royal-text);
	}

	.action-btn.confirm:hover:not(:disabled) {
		background: var(--royal-border);
		box-shadow: 0 4px 12px var(--royal-bg);
	}

	.action-btn.confirm:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.action-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	/* Phones: top-aligned, so picking a target (which collapses the tag
	   list) doesn't re-center and jump everything down the screen */
	@media (max-width: 767px), (pointer: coarse) and (max-width: 900px) {
		.merge-flow {
			justify-content: flex-start;
			gap: 16px;
			padding: 16px 12px;
		}

		.merge-actions .action-btn {
			flex: 1;
		}
	}

	.merge-flow.rows .tag-options { display: grid; grid-template-columns: 1fr; gap: 0; border: 1px solid var(--theme-stroke); border-radius: var(--radius-sm); overflow: hidden; }
	.merge-flow.rows .tag-option { display: flex; align-items: center; width: 100%; min-height: 36px; padding: 7px 10px; border: 0; border-radius: 0; background: transparent; color: var(--theme-text); text-align: left; transform: none; }
	.merge-flow.rows .tag-option + .tag-option { border-top: 1px solid var(--theme-stroke); }
	.merge-flow.rows .tag-option:hover { box-shadow: none; transform: none; }
	.merge-flow.rows .plain-option-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
	.merge-flow.rows .option-count { color: var(--theme-text-dim); font-size: 11px; font-variant-numeric: tabular-nums; }
	@media (prefers-reduced-motion: reduce) {
		.selected-target,
		.merge-detail {
			animation: none;
		}
		.action-btn,
		.tag-option,
		.target-clear,
		.search-clear,
		.search-container {
			transition: none;
		}
	}
</style>
