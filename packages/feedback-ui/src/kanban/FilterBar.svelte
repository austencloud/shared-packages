<script lang="ts">
	import type { FeedbackType, FeedbackPriority } from '@austencloud/feedback-types';
	import { TYPE_DISPLAY, PRIORITY_DISPLAY } from '@austencloud/feedback-types';

	const {
		searchQuery,
		typeFilter,
		priorityFilter,
		onSearchChange,
		onTypeFilterChange,
		onPriorityFilterChange,
	}: {
		searchQuery: string;
		typeFilter: FeedbackType | null;
		priorityFilter: FeedbackPriority | null;
		onSearchChange: (query: string) => void;
		onTypeFilterChange: (type: FeedbackType | null) => void;
		onPriorityFilterChange: (priority: FeedbackPriority | null) => void;
	} = $props();

	const types: FeedbackType[] = ['bug', 'feature', 'general'];
	const priorities: FeedbackPriority[] = ['critical', 'high', 'medium', 'low'];
</script>

<div class="filter-bar" style:container-type="inline-size" style:container-name="filterbar">
	<div class="search-wrapper">
		<input
			class="search-input"
			type="text"
			placeholder="Search feedback..."
			value={searchQuery}
			oninput={(e) => onSearchChange(e.currentTarget.value)}
		/>
		{#if searchQuery}
			<button class="clear-btn" onclick={() => onSearchChange('')} aria-label="Clear search">
				&#x2715;
			</button>
		{/if}
	</div>

	<div class="filter-chips">
		{#each types as t (t)}
			{@const config = TYPE_DISPLAY[t]}
			<button
				class="chip"
				class:active={typeFilter === t}
				style:--chip-color={config.color}
				onclick={() => onTypeFilterChange(typeFilter === t ? null : t)}
			>
				{config.label}
			</button>
		{/each}

		<span class="divider"></span>

		{#each priorities as p (p)}
			{@const config = PRIORITY_DISPLAY[p]}
			<button
				class="chip"
				class:active={priorityFilter === p}
				style:--chip-color={config.color}
				onclick={() => onPriorityFilterChange(priorityFilter === p ? null : p)}
			>
				{config.label}
			</button>
		{/each}
	</div>
</div>

<style>
	.filter-bar {
		display: flex;
		gap: var(--fb-space-sm, 12px);
		padding: var(--fb-space-xs, 8px) var(--fb-space-sm, 12px);
		align-items: center;
		flex-wrap: wrap;
		border-bottom: 1px solid transparent;
		border-image: linear-gradient(
			90deg,
			transparent,
			var(--theme-stroke, rgba(255, 255, 255, 0.08)),
			transparent
		) 1;
		flex-shrink: 0;
	}

	.search-wrapper {
		position: relative;
		flex: 1;
		min-width: 150px;
	}

	.search-input {
		width: 100%;
		padding: 6px 30px 6px 10px;
		border-radius: var(--fb-radius-sm, 8px);
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		background: var(--theme-card-bg, rgba(30, 30, 40, 0.95));
		color: var(--theme-text, rgba(226, 232, 240, 0.95));
		font-size: var(--fb-text-sm, 0.875rem);
		transition: border-color var(--fb-duration-fast, 0.15s), box-shadow var(--fb-duration-fast, 0.15s);
	}

	.search-input:focus {
		outline: none;
		border-color: var(--fb-status-new, #3b82f6);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--fb-status-new, #3b82f6) 15%, transparent);
	}

	.clear-btn {
		position: absolute;
		right: 6px;
		top: 50%;
		transform: translateY(-50%);
		border: none;
		background: none;
		color: var(--theme-text-dim, rgba(148, 163, 184, 0.9));
		cursor: pointer;
		font-size: 12px;
		padding: 4px;
	}

	.filter-chips {
		display: flex;
		gap: 4px;
		align-items: center;
		flex-wrap: wrap;
	}

	.divider {
		width: 1px;
		height: 16px;
		background: var(--theme-stroke, rgba(255, 255, 255, 0.08));
		margin: 0 4px;
	}

	.chip {
		padding: 3px 8px;
		border-radius: 100px;
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		background: transparent;
		color: var(--theme-text-dim, rgba(148, 163, 184, 0.9));
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
		transition: all var(--fb-duration-fast, 0.15s);
	}

	.chip:hover {
		border-color: color-mix(in srgb, var(--chip-color) 50%, transparent);
	}

	.chip.active {
		border-color: var(--chip-color);
		color: var(--chip-color);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--chip-color) 15%, transparent),
			color-mix(in srgb, var(--chip-color) 8%, transparent)
		);
	}

	@container filterbar (max-width: 500px) {
		.filter-bar {
			flex-direction: column;
			align-items: stretch;
		}
		.filter-chips {
			overflow-x: auto;
			flex-wrap: nowrap;
			scrollbar-width: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.chip {
			transition: none;
		}
		.search-input {
			transition: none;
		}
	}
</style>
