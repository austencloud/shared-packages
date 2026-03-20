<script lang="ts">
	import type { FeedbackItem, FeedbackStatus } from '@austencloud/feedback-types';
	import { FEEDBACK_STATUSES, STATUS_DISPLAY } from '@austencloud/feedback-types';
	import type { MyFeedbackProps } from './types.js';
	import FeedbackCard from './my-feedback/FeedbackCard.svelte';
	import EmptyState from './my-feedback/EmptyState.svelte';

	const {
		items,
		loading,
		isAuthenticated,
		onItemClick,
		emptyMessage,
		signInMessage,
	}: MyFeedbackProps = $props();

	const filterStatuses: FeedbackStatus[] = ['new', 'in-progress', 'in-review', 'completed', 'archived'];
	let activeFilter = $state<FeedbackStatus | 'all'>('all');
	let selectedItemId = $state<string | null>(null);

	const filteredItems = $derived(
		activeFilter === 'all'
			? items
			: items.filter((i) => i.status === activeFilter)
	);

	const countByStatus = $derived.by(() => {
		const counts: Record<string, number> = { all: items.length };
		for (const s of filterStatuses) {
			counts[s] = items.filter((i) => i.status === s).length;
		}
		return counts;
	});

	function handleSelect(item: FeedbackItem) {
		selectedItemId = item.id;
		onItemClick?.(item);
	}
</script>

<div class="my-feedback" style:container-type="inline-size" style:container-name="my-feedback">
	{#if !isAuthenticated || (items.length === 0)}
		<EmptyState {isAuthenticated} {loading} {emptyMessage} {signInMessage} />
	{:else}
		<div class="filter-tabs" role="tablist">
			<button
				class="filter-tab"
				class:active={activeFilter === 'all'}
				role="tab"
				aria-selected={activeFilter === 'all'}
				onclick={() => (activeFilter = 'all')}
			>
				All
				<span class="count">{countByStatus['all']}</span>
			</button>
			{#each filterStatuses as s (s)}
				{@const config = STATUS_DISPLAY[s]}
				{@const count = countByStatus[s] ?? 0}
				{#if count > 0}
					<button
						class="filter-tab"
						class:active={activeFilter === s}
						style:--tab-color={config.color}
						role="tab"
						aria-selected={activeFilter === s}
						onclick={() => (activeFilter = s)}
					>
						{config.label}
						<span class="count">{count}</span>
					</button>
				{/if}
			{/each}
		</div>

		{#if loading}
			<EmptyState isAuthenticated={true} loading={true} />
		{:else if filteredItems.length === 0}
			<div class="no-results">No items with this status.</div>
		{:else}
			<div class="card-list">
				{#each filteredItems as item (item.id)}
					<FeedbackCard
						{item}
						isSelected={selectedItemId === item.id}
						onClick={() => handleSelect(item)}
					/>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.my-feedback {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.filter-tabs {
		display: flex;
		gap: var(--fb-space-2xs, 4px);
		padding: var(--fb-space-sm, 12px);
		overflow-x: auto;
		scrollbar-width: none;
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		flex-shrink: 0;
	}

	.filter-tabs::-webkit-scrollbar {
		display: none;
	}

	.filter-tab {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 10px;
		border-radius: 100px;
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		background: transparent;
		color: var(--theme-text-dim, rgba(148, 163, 184, 0.9));
		font-size: var(--fb-text-xs, 0.8125rem);
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
		transition: all var(--fb-duration-fast, 0.15s);
	}

	.filter-tab:hover {
		background: var(--theme-card-hover-bg, rgba(40, 40, 52, 0.95));
	}

	.filter-tab.active {
		border-color: var(--tab-color, var(--theme-accent, #3b82f6));
		color: var(--tab-color, var(--theme-accent, #3b82f6));
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--tab-color, var(--theme-accent, #3b82f6)) 12%, transparent),
			color-mix(in srgb, var(--tab-color, var(--theme-accent, #3b82f6)) 6%, transparent)
		);
		box-shadow: 0 0 8px color-mix(in srgb, var(--tab-color, var(--theme-accent, #3b82f6)) 15%, transparent);
	}

	.count {
		font-size: 0.7rem;
		opacity: 0.7;
	}

	.card-list {
		display: flex;
		flex-direction: column;
		gap: var(--fb-space-xs, 8px);
		padding: var(--fb-space-sm, 12px);
		overflow-y: auto;
		flex: 1;
	}

	.no-results {
		padding: var(--fb-space-lg, 32px);
		text-align: center;
		color: var(--theme-text-dim, rgba(148, 163, 184, 0.9));
		font-size: var(--fb-text-sm, 0.875rem);
	}

	@media (prefers-reduced-motion: reduce) {
		.filter-tab {
			transition: none;
		}
	}
</style>
