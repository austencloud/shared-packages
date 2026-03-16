<!--
	TagSidebar.svelte — Left sidebar for filtering media by tags.
	Tags grouped by category with item counts, collapsible sections, active highlighting.
-->
<script lang="ts">
	import type { MediaItem, MediaTag } from '../types.js';
	import { getTagHex, getCategoryLabel } from '../types.js';

	interface Props {
		tags: MediaTag[];
		items: MediaItem[];
		activeTags: string[];
		/** App-specific category order. */
		categories: string[];
		/** App-specific category labels. */
		categoryLabels?: Record<string, string>;
		ontoggle: (tagId: string) => void;
	}

	const { tags, items, activeTags, categories, categoryLabels, ontoggle }: Props = $props();

	let collapsedCategories = $state(new Set<string>());

	const activeTagSet = $derived(new Set(activeTags));

	// Count items per tag
	const tagCounts = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const item of items) {
			for (const tagId of item.tags) {
				counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
			}
		}
		return counts;
	});

	// Group tags by category in display order
	const tagsByCategory = $derived.by(() => {
		const grouped = new Map<string, MediaTag[]>();
		for (const tag of tags) {
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

	function toggleCategory(category: string) {
		const next = new Set(collapsedCategories);
		if (next.has(category)) {
			next.delete(category);
		} else {
			next.add(category);
		}
		collapsedCategories = next;
	}

	function clearAll() {
		for (const tagId of activeTags) {
			ontoggle(tagId);
		}
	}
</script>

<aside class="sidebar" aria-label="Tag filters">
	<!-- Header -->
	<div class="sidebar-header">
		<h2 class="sidebar-title">Tags</h2>
		{#if activeTags.length > 0}
			<button class="sidebar-clear" onclick={clearAll}>Clear all</button>
		{/if}
	</div>

	<!-- Active tags summary -->
	{#if activeTags.length > 0}
		<div class="active-tags">
			{#each activeTags as tagId (tagId)}
				{@const tag = tags.find((t) => t.id === tagId)}
				{#if tag}
					<span
						class="active-tag"
						style="background: {getTagHex(tag)}"
					>
						{tag.name}
						<button
							class="active-tag-remove"
							onclick={() => ontoggle(tagId)}
							aria-label="Remove {tag.name} filter"
						>
							<svg class="active-tag-x" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M1.5 1.5l5 5M6.5 1.5l-5 5" />
							</svg>
						</button>
					</span>
				{/if}
			{/each}
		</div>
	{/if}

	<!-- Category sections -->
	<div class="sidebar-body">
		{#each [...tagsByCategory.entries()] as [category, categoryTags] (category)}
			<div class="sidebar-category">
				<button
					class="sidebar-category-header"
					onclick={() => toggleCategory(category)}
				>
					<svg
						class="sidebar-chevron"
						class:collapsed={collapsedCategories.has(category)}
						viewBox="0 0 12 12"
						fill="currentColor"
					>
						<path d="M4 2l4 4-4 4z" />
					</svg>
					<span class="sidebar-category-label">
						{getCategoryLabel(category, categoryLabels)}
					</span>
					<span class="sidebar-category-count">{categoryTags.length}</span>
				</button>

				{#if !collapsedCategories.has(category)}
					<div class="sidebar-tag-list">
						{#each categoryTags as tag (tag.id)}
							{@const isActive = activeTagSet.has(tag.id)}
							{@const count = tagCounts.get(tag.id) ?? 0}
							<button
								class="sidebar-tag-btn"
								class:active={isActive}
								onclick={() => ontoggle(tag.id)}
							>
								<span
									class="sidebar-tag-dot"
									class:active-dot={isActive}
									style="background: {getTagHex(tag)}"
								></span>
								<span class="sidebar-tag-name">{tag.name}</span>
								<span class="sidebar-tag-count">{count}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</aside>

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		width: 256px;
		height: 100%;
		overflow: hidden;
		border-right: 1px solid var(--mm-border, #333355);
		background: var(--mm-surface-raised, #222240);
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px;
		border-bottom: 1px solid var(--mm-border, #333355);
	}

	.sidebar-title {
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--mm-text-muted, #9999b0);
		margin: 0;
	}

	.sidebar-clear {
		padding: 2px 6px;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--mm-accent, #6366f1);
		font-size: 10px;
		cursor: pointer;
	}

	.sidebar-clear:hover {
		background: color-mix(in srgb, var(--mm-accent, #6366f1) 10%, transparent);
	}

	.active-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		padding: 8px 12px;
		border-bottom: 1px solid var(--mm-border, #333355);
	}

	.active-tag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		border-radius: 9999px;
		font-size: 10px;
		font-weight: 500;
		color: white;
	}

	.active-tag-remove {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 12px;
		height: 12px;
		border: none;
		border-radius: 50%;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.active-tag-remove:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.active-tag-x {
		width: 8px;
		height: 8px;
	}

	.sidebar-body {
		flex: 1;
		overflow-y: auto;
	}

	.sidebar-category {
		border-bottom: 1px solid var(--mm-border-subtle, #2a2a48);
	}

	.sidebar-category:last-child {
		border-bottom: none;
	}

	.sidebar-category-header {
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

	.sidebar-category-header:hover {
		background: var(--mm-surface-hover, #2e2e50);
	}

	.sidebar-chevron {
		width: 12px;
		height: 12px;
		flex-shrink: 0;
		color: var(--mm-text-dim, #66668a);
		transform: rotate(90deg);
		transition: transform 0.15s;
	}

	.sidebar-chevron.collapsed {
		transform: rotate(0deg);
	}

	.sidebar-category-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--mm-text-muted, #9999b0);
	}

	.sidebar-category-count {
		margin-left: auto;
		font-size: 10px;
		color: var(--mm-text-dim, #66668a);
	}

	.sidebar-tag-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0 8px 8px;
	}

	.sidebar-tag-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 8px;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--mm-text, #e8e8f0);
		text-align: left;
		cursor: pointer;
		transition: background 0.15s;
	}

	.sidebar-tag-btn:hover {
		background: var(--mm-surface-hover, #2e2e50);
	}

	.sidebar-tag-btn.active {
		background: color-mix(in srgb, var(--mm-accent, #6366f1) 15%, transparent);
		color: var(--mm-accent, #6366f1);
	}

	.sidebar-tag-dot {
		width: 10px;
		height: 10px;
		flex-shrink: 0;
		border-radius: 50%;
	}

	.active-dot {
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--mm-accent, #6366f1) 40%, transparent);
	}

	.sidebar-tag-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 12px;
	}

	.sidebar-tag-count {
		flex-shrink: 0;
		font-size: 10px;
		color: var(--mm-text-dim, #66668a);
	}
</style>
