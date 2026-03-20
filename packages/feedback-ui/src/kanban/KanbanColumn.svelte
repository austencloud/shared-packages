<script lang="ts">
	import type { FeedbackItem, FeedbackStatus } from '@austencloud/feedback-types';
	import { STATUS_DISPLAY } from '@austencloud/feedback-types';
	import type { Snippet } from 'svelte';
	import ColumnHeader from './ColumnHeader.svelte';
	import KanbanCard from './KanbanCard.svelte';

	const {
		status,
		items,
		showWipWarnings = true,
		showClaimIndicators = false,
		enableDrag = true,
		cardSnippet,
		onDragStart,
		onDragEnd,
		onDrop,
		onTouchDrop,
		onItemClick,
	}: {
		status: FeedbackStatus;
		items: FeedbackItem[];
		showWipWarnings?: boolean;
		showClaimIndicators?: boolean;
		enableDrag?: boolean;
		cardSnippet?: Snippet<[FeedbackItem]>;
		onDragStart?: (item: FeedbackItem) => void;
		onDragEnd?: () => void;
		onDrop?: (itemId: string, toStatus: FeedbackStatus) => void;
		onTouchDrop?: (itemId: string, status: string) => void;
		onItemClick?: (item: FeedbackItem) => void;
	} = $props();

	let isDragOver = $state(false);

	const colColor = $derived(STATUS_DISPLAY[status].color);

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		e.dataTransfer!.dropEffect = 'move';
		isDragOver = true;
	}

	function handleDragLeave() {
		isDragOver = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
		const itemId = e.dataTransfer?.getData('text/plain');
		if (itemId) onDrop?.(itemId, status);
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="kanban-column"
	class:drag-over={isDragOver}
	style:--col-color={colColor}
	data-kanban-status={status}
	role="region"
	aria-label="{status} column"
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
>
	<ColumnHeader {status} count={items.length} {showWipWarnings} />

	<div class="card-list">
		{#if items.length === 0}
			<div class="empty-column">
				<span class="empty-text">No items</span>
			</div>
		{:else}
			{#each items as item (item.id)}
				<KanbanCard
					{item}
					{showClaimIndicators}
					enableDrag={enableDrag}
					{cardSnippet}
					{onDragStart}
					{onDragEnd}
					{onTouchDrop}
					onClick={onItemClick}
				/>
			{/each}
		{/if}
	</div>
</div>

<style>
	.kanban-column {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
		border-radius: var(--fb-radius-md, 12px);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--col-color) 8%, var(--theme-card-bg, rgba(30, 30, 40, 0.95))),
			var(--theme-card-bg, rgba(30, 30, 40, 0.95))
		);
		border: 1px solid color-mix(in srgb, var(--col-color) 15%, var(--theme-stroke, rgba(255, 255, 255, 0.08)));
		border-top: 3px solid var(--col-color);
		box-shadow: 0 2px 12px color-mix(in srgb, var(--col-color) 10%, transparent);
		overflow: hidden;
		container-type: inline-size;
		transition:
			box-shadow var(--fb-duration-emphasis, 0.28s) var(--fb-spring, ease),
			transform var(--fb-duration-emphasis, 0.28s) var(--fb-spring, ease);
	}

	.kanban-column.drag-over {
		box-shadow:
			0 0 20px color-mix(in srgb, var(--col-color) 25%, transparent),
			0 2px 12px color-mix(in srgb, var(--col-color) 15%, transparent);
		transform: scale(1.01);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--col-color) 14%, var(--theme-card-bg, rgba(30, 30, 40, 0.95))),
			var(--theme-card-bg, rgba(30, 30, 40, 0.95))
		);
	}

	.card-list {
		display: flex;
		flex-direction: column;
		gap: var(--fb-space-xs, 8px);
		padding: var(--fb-space-xs, 8px);
		overflow-y: auto;
		flex: 1;
		min-height: 100px;
	}

	.card-list::-webkit-scrollbar {
		width: 4px;
	}

	.card-list::-webkit-scrollbar-thumb {
		background: var(--theme-stroke, rgba(255, 255, 255, 0.08));
		border-radius: 4px;
	}

	.empty-column {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1;
		min-height: 80px;
		border-radius: var(--fb-radius-sm, 8px);
		border: 1px dashed color-mix(in srgb, var(--col-color) 20%, transparent);
		background: radial-gradient(
			ellipse at center,
			color-mix(in srgb, var(--col-color) 5%, transparent),
			transparent 70%
		);
	}

	.empty-text {
		font-size: var(--fb-text-xs, 0.8125rem);
		color: var(--theme-text-dim, rgba(148, 163, 184, 0.9));
	}

	@media (prefers-reduced-motion: reduce) {
		.kanban-column {
			transition: none;
		}
	}
</style>
