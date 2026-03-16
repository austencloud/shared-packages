<!--
	TagPickerPanel.svelte — Side panel for bulk tagging selected items.
	Tags grouped by category with tri-state checkboxes (all/some/none).
-->
<script lang="ts">
	import type { MediaItem, MediaTag } from '../types.js';
	import { getTagHex, getCategoryLabel } from '../types.js';

	interface Props {
		tags: MediaTag[];
		selectedItems: MediaItem[];
		/** App-specific category order. */
		categories: string[];
		/** App-specific category labels. */
		categoryLabels?: Record<string, string> | undefined;
		onapply: (tag: MediaTag) => void;
		onremove: (tag: MediaTag) => void;
	}

	const { tags, selectedItems, categories, categoryLabels, onapply, onremove }: Props = $props();

	let searchQuery = $state('');
	let collapsedCategories = $state(new Set<string>());

	// Filter tags by search
	const filteredTags = $derived(
		searchQuery.trim()
			? tags.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
			: tags
	);

	// Group filtered tags by category in display order
	const tagsByCategory = $derived.by(() => {
		const grouped = new Map<string, MediaTag[]>();
		for (const tag of filteredTags) {
			const cat = tag.category;
			if (!grouped.has(cat)) grouped.set(cat, []);
			grouped.get(cat)!.push(tag);
		}
		const ordered = new Map<string, MediaTag[]>();
		for (const cat of categories) {
			if (grouped.has(cat)) {
				ordered.set(cat, grouped.get(cat)!);
				grouped.delete(cat);
			}
		}
		for (const [cat, catTags] of grouped) {
			ordered.set(cat, catTags);
		}
		return ordered;
	});

	// Compute tag application state across selected items
	type TagState = 'all' | 'some' | 'none';

	function getTagState(tag: MediaTag): TagState {
		if (selectedItems.length === 0) return 'none';
		const count = selectedItems.filter((item) => item.tags.includes(tag.id)).length;
		if (count === selectedItems.length) return 'all';
		if (count > 0) return 'some';
		return 'none';
	}

	function handleTagClick(tag: MediaTag) {
		const state = getTagState(tag);
		if (state === 'all') {
			onremove(tag);
		} else {
			onapply(tag);
		}
	}

	function toggleCategory(category: string) {
		const next = new Set(collapsedCategories);
		if (next.has(category)) {
			next.delete(category);
		} else {
			next.add(category);
		}
		collapsedCategories = next;
	}
</script>

<div class="picker-panel">
	<!-- Search header -->
	<div class="picker-header">
		<div class="picker-search">
			<svg class="picker-search-icon" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.45 4.39l4.26 4.26a.75.75 0 11-1.06 1.06l-4.26-4.26A7 7 0 012 9z" clip-rule="evenodd" />
			</svg>
			<input
				type="text"
				class="picker-search-input"
				placeholder="Filter tags..."
				bind:value={searchQuery}
			/>
			{#if searchQuery}
				<button
					class="picker-clear-btn"
					onclick={() => (searchQuery = '')}
				>
					<svg class="picker-clear-icon" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M2 2l6 6M8 2l-6 6" />
					</svg>
				</button>
			{/if}
		</div>
		<p class="picker-selection-count">
			{selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
		</p>
	</div>

	<!-- Tag categories -->
	<div class="picker-body">
		{#each [...tagsByCategory.entries()] as [category, categoryTags] (category)}
			<div class="picker-category">
				<button
					class="picker-category-header"
					onclick={() => toggleCategory(category)}
				>
					<svg
						class="picker-chevron"
						class:collapsed={collapsedCategories.has(category)}
						viewBox="0 0 12 12"
						fill="currentColor"
					>
						<path d="M4 2l4 4-4 4z" />
					</svg>
					<span class="picker-category-label">
						{getCategoryLabel(category, categoryLabels)}
					</span>
					<span class="picker-category-count">{categoryTags.length}</span>
				</button>

				{#if !collapsedCategories.has(category)}
					<div class="picker-tag-list">
						{#each categoryTags as tag (tag.id)}
							{@const state = getTagState(tag)}
							<button
								class="picker-tag-btn"
								onclick={() => handleTagClick(tag)}
								title={state === 'all'
									? 'On all selected. Click to remove.'
									: state === 'some'
										? 'On some selected. Click to apply to all.'
										: 'Click to apply to all selected.'}
							>
								<div
									class="picker-checkbox"
									class:all={state === 'all'}
									class:some={state === 'some'}
								>
									{#if state === 'all'}
										<svg class="picker-check-icon" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2">
											<path d="M2 5l2.5 2.5L8 3" />
										</svg>
									{:else if state === 'some'}
										<svg class="picker-check-icon" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2.5">
											<path d="M2 5h6" />
										</svg>
									{/if}
								</div>
								<span
									class="picker-tag-dot"
									style="background: {getTagHex(tag)}"
								></span>
								<span class="picker-tag-name">{tag.name}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{:else}
			<div class="picker-empty">
				<p>No tags found</p>
			</div>
		{/each}
	</div>
</div>

<style>
	.picker-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		border-radius: 8px;
		border: 1px solid var(--mm-border, #333355);
		background: var(--mm-surface-raised, #222240);
	}

	.picker-header {
		padding: 12px;
		border-bottom: 1px solid var(--mm-border, #333355);
	}

	.picker-search {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 10px;
		height: 32px;
		border: 1px solid var(--mm-border, #333355);
		border-radius: 6px;
		background: var(--mm-surface, #1a1a2e);
		transition: border-color 0.15s;
	}

	.picker-search:focus-within {
		border-color: var(--mm-accent, #6366f1);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--mm-accent, #6366f1) 20%, transparent);
	}

	.picker-search-icon {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		color: var(--mm-text-muted, #9999b0);
	}

	.picker-search-input {
		flex: 1;
		min-width: 0;
		border: none;
		background: transparent;
		color: var(--mm-text, #e8e8f0);
		font-size: 12px;
		font-family: inherit;
		outline: none;
	}

	.picker-search-input::placeholder {
		color: var(--mm-text-dim, #66668a);
	}

	.picker-clear-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--mm-surface-overlay, #2a2a4a);
		border: none;
		color: var(--mm-text-muted, #9999b0);
		cursor: pointer;
	}

	.picker-clear-btn:hover {
		color: var(--mm-text, #e8e8f0);
	}

	.picker-clear-icon {
		width: 10px;
		height: 10px;
	}

	.picker-selection-count {
		margin: 6px 0 0;
		font-size: 10px;
		color: var(--mm-text-dim, #66668a);
	}

	.picker-body {
		flex: 1;
		overflow-y: auto;
	}

	.picker-category {
		border-bottom: 1px solid var(--mm-border-subtle, #2a2a48);
	}

	.picker-category:last-child {
		border-bottom: none;
	}

	.picker-category-header {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 12px;
		border: none;
		background: transparent;
		text-align: left;
		cursor: pointer;
		transition: background 0.15s;
	}

	.picker-category-header:hover {
		background: var(--mm-surface-hover, #2e2e50);
	}

	.picker-chevron {
		width: 12px;
		height: 12px;
		flex-shrink: 0;
		color: var(--mm-text-dim, #66668a);
		transform: rotate(90deg);
		transition: transform 0.15s;
	}

	.picker-chevron.collapsed {
		transform: rotate(0deg);
	}

	.picker-category-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--mm-text-muted, #9999b0);
	}

	.picker-category-count {
		margin-left: auto;
		font-size: 10px;
		color: var(--mm-text-dim, #66668a);
	}

	.picker-tag-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0 8px 8px;
	}

	.picker-tag-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 8px;
		border: none;
		border-radius: 4px;
		background: transparent;
		text-align: left;
		cursor: pointer;
		transition: background 0.15s;
	}

	.picker-tag-btn:hover {
		background: var(--mm-surface-hover, #2e2e50);
	}

	.picker-checkbox {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		flex-shrink: 0;
		border-radius: 3px;
		border: 1px solid var(--mm-text-dim, #66668a);
		background: transparent;
		transition: all 0.15s;
	}

	.picker-checkbox.all {
		border-color: var(--mm-accent, #6366f1);
		background: var(--mm-accent, #6366f1);
		color: white;
	}

	.picker-checkbox.some {
		border-color: var(--mm-accent, #6366f1);
		background: color-mix(in srgb, var(--mm-accent, #6366f1) 30%, transparent);
		color: var(--mm-accent, #6366f1);
	}

	.picker-check-icon {
		width: 10px;
		height: 10px;
	}

	.picker-tag-dot {
		width: 10px;
		height: 10px;
		flex-shrink: 0;
		border-radius: 50%;
	}

	.picker-tag-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 12px;
		color: var(--mm-text, #e8e8f0);
	}

	.picker-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 32px;
		color: var(--mm-text-dim, #66668a);
		font-size: 12px;
	}
</style>
