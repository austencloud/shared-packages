<script lang="ts">
	import { getCategoryLabel, getTagHex, type MediaTag } from './advanced-tag-helpers.js';
	import Icon from './AdvancedTagIcon.svelte';

	interface Props {
		currentPrereqs: string[];
		allTags: MediaTag[];
		excludeTagId?: string;
		excludeCategory?: string;
		categoryLabels?: Record<string, string>;
		/** What the rule does, in plain words; differs for tags, categories and the create form */
		hint?: string;
		onSelect: (ids: string[]) => void;
		/** Closes the panel. Without it the only way out was re-opening the
		    row menu, since picks save on each tap. */
		onDone?: () => void;
	}

	const {
		currentPrereqs,
		allTags,
		excludeTagId,
		excludeCategory,
		categoryLabels = {},
		hint = 'Only offer this tag on items that already have one of these. Changes save as you tap.',
		onSelect,
		onDone
	}: Props = $props();

	function initialSelected() { return new Set<string>(currentPrereqs); }
	let selected = $state<Set<string>>(initialSelected());

	// Group eligible tags by category (exclude same-category and self)
	let tagsByCategory = $derived.by(() => {
		const map = new Map<string, MediaTag[]>();
		for (const tag of allTags) {
			if (tag.id === excludeTagId) continue;
			const cat = tag.category ?? 'content';
			if (cat === excludeCategory) continue;
			if (!map.has(cat)) map.set(cat, []);
			map.get(cat)!.push(tag);
		}
		// Sort tags within each category alphabetically
		for (const [, tags] of map) {
			tags.sort((a, b) => a.name.localeCompare(b.name));
		}
		return map;
	});

	let categories = $derived([...tagsByCategory.keys()].sort());

	function toggle(tagId: string) {
		const next = new Set(selected);
		if (next.has(tagId)) {
			next.delete(tagId);
		} else {
			next.add(tagId);
		}
		selected = next;
		onSelect([...next]);
	}

	// Detect orphaned prereq IDs (tags that no longer exist)
	let orphanedIds = $derived.by(() => {
		const validIds = new Set(allTags.map(t => t.id));
		return currentPrereqs.filter(id => !validIds.has(id));
	});
</script>

<div class="prereq-picker">
	<p class="picker-label">
		<Icon name="link" size={12} />
		Prerequisites
	</p>
	<p class="picker-hint">{hint}</p>

	{#if categories.length === 0}
		<p class="empty-hint">No other categories available</p>
	{:else}
		{#each categories as cat (cat)}
			{@const catTags = tagsByCategory.get(cat) ?? []}
			<div class="prereq-category">
				<span class="prereq-category-label">{getCategoryLabel(cat, categoryLabels)}</span>
				<div class="prereq-tags">
					{#each catTags as tag (tag.id)}
						<button
							class="prereq-tag"
							class:active={selected.has(tag.id)}
							style="--tag-color: {getTagHex(tag)}"
							onclick={() => toggle(tag.id)}
						>
							<span class="prereq-dot"></span>
							{tag.name}
							{#if selected.has(tag.id)}
								<Icon name="check" size={10} />
							{/if}
						</button>
					{/each}
				</div>
			</div>
		{/each}
	{/if}

	{#if orphanedIds.length > 0}
		<div class="orphaned-section">
			<span class="orphaned-label">Deleted tags still listed as prerequisites</span>
			<div class="orphaned-ids">
				{#each orphanedIds as id (id)}
					<span class="orphaned-id">{id.slice(0, 8)}...</span>
				{/each}
			</div>
		</div>
	{/if}

	{#if selected.size > 0 || onDone}
		<div class="picker-actions">
			{#if selected.size > 0}
				<button class="clear-btn" onclick={() => { selected = new Set(); onSelect([]); }}>
					Clear all prerequisites
				</button>
			{/if}
			{#if onDone}
				<button class="done-btn" onclick={onDone}>Done</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.prereq-picker {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 8px 0 4px;
	}

	.picker-label {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		font-size: 13px;
		font-weight: 500;
		color: var(--theme-text-dim);
	}

	.picker-hint {
		margin: 0;
		font-size: 12px;
		color: var(--text-faint);
	}

	.empty-hint {
		margin: 0;
		font-size: 13px;
		color: var(--text-faint);
	}

	.prereq-category {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.prereq-category-label {
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-faint);
	}

	.prereq-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.prereq-tag {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 5px 10px;
		min-height: var(--min-touch-target);
		background: var(--surface-dim);
		border: 1px solid var(--theme-stroke);
		border-radius: var(--radius-full);
		color: var(--theme-text-dim);
		font-size: 13px;
		cursor: pointer;
		transition: background var(--duration-crisp) var(--ease-crisp), border-color var(--duration-crisp) var(--ease-crisp);
		white-space: nowrap;
	}

	.prereq-tag:hover {
		background: var(--interactive-selected);
		border-color: var(--theme-stroke-strong);
	}

	.prereq-tag.active {
		background: var(--royal-bg);
		border-color: var(--royal-border);
		color: var(--royal-text);
	}

	.prereq-tag:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.prereq-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--tag-color);
		flex-shrink: 0;
	}

	.orphaned-section {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px;
		background: var(--amber-bg);
		border: 1px solid var(--amber-border);
		border-radius: var(--radius-md);
	}

	.orphaned-label {
		font-size: 12px;
		color: var(--amber-text);
	}

	.orphaned-ids {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.orphaned-id {
		padding: 2px 6px;
		background: var(--surface-dim);
		border-radius: var(--radius-sm);
		font-size: 12px;
		font-family: monospace;
		color: var(--text-faint);
	}

	.clear-btn {
		padding: 6px 12px;
		min-height: var(--min-touch-target);
		background: none;
		border: 1px solid var(--theme-stroke);
		border-radius: var(--radius-md);
		color: var(--text-muted);
		font-size: 13px;
		cursor: pointer;
		transition: background var(--duration-crisp) var(--ease-crisp), color var(--duration-crisp) var(--ease-crisp);
		width: fit-content;
	}

	.clear-btn:hover {
		background: var(--surface-dim);
		color: var(--theme-text-dim);
	}

	.picker-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.done-btn {
		margin-left: auto;
		padding: 6px 18px;
		min-height: var(--min-touch-target);
		background: var(--interactive-active);
		border: 1px solid var(--theme-stroke);
		border-radius: var(--radius-md);
		color: var(--theme-text);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
	}

	.done-btn:active {
		transform: scale(0.95);
	}

	.done-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.clear-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.prereq-tag,
		.clear-btn {
			transition: none;
		}
	}
</style>
