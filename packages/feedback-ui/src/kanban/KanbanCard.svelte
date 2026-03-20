<script lang="ts">
	import type { FeedbackItem, ClaimHealth } from '@austencloud/feedback-types';
	import { TYPE_DISPLAY, PRIORITY_DISPLAY } from '@austencloud/feedback-types';
	import { getClaimHealth } from '@austencloud/feedback-types';
	import DateDisplay from '../shared/DateDisplay.svelte';
	import type { Snippet } from 'svelte';

	const {
		item,
		showClaimIndicators = false,
		enableDrag = true,
		cardSnippet,
		onDragStart,
		onDragEnd,
		onTouchDrop,
		onClick,
	}: {
		item: FeedbackItem;
		showClaimIndicators?: boolean;
		enableDrag?: boolean;
		cardSnippet?: Snippet<[FeedbackItem]>;
		onDragStart?: (item: FeedbackItem) => void;
		onDragEnd?: () => void;
		onTouchDrop?: (itemId: string, status: string) => void;
		onClick?: (item: FeedbackItem) => void;
	} = $props();

	let isDragging = $state(false);

	const typeConfig = $derived(TYPE_DISPLAY[item.type]);
	const priorityConfig = $derived(item.priority ? PRIORITY_DISPLAY[item.priority] : null);
	const claimHealth = $derived<ClaimHealth>(showClaimIndicators ? getClaimHealth(item) : 'none');

	function handleDragStart(e: DragEvent) {
		if (!enableDrag) return;
		isDragging = true;
		e.dataTransfer?.setData('text/plain', item.id);
		e.dataTransfer!.effectAllowed = 'move';
		onDragStart?.(item);
	}

	function handleDragEnd() {
		isDragging = false;
		onDragEnd?.();
	}

	// ── Touch drag (mobile) ──────────────────────────────────
	let touchTimer: ReturnType<typeof setTimeout> | null = null;
	let isTouchDragging = $state(false);
	let ghostEl: HTMLElement | null = null;
	let cardEl: HTMLElement | undefined = $state();

	function handleTouchStart(e: TouchEvent) {
		if (!enableDrag) return;
		touchTimer = setTimeout(() => {
			isTouchDragging = true;
			isDragging = true;
			onDragStart?.(item);
			if (navigator.vibrate) navigator.vibrate(50);
			createGhost(e.touches[0].clientX, e.touches[0].clientY);
		}, 200);
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isTouchDragging) {
			if (touchTimer) clearTimeout(touchTimer);
			return;
		}
		e.preventDefault();
		moveGhost(e.touches[0].clientX, e.touches[0].clientY);
	}

	function handleTouchEnd(e: TouchEvent) {
		if (touchTimer) clearTimeout(touchTimer);
		if (isTouchDragging) {
			const touch = e.changedTouches[0];
			const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
			const column = dropTarget?.closest('[data-kanban-status]');
			if (column) {
				const status = column.getAttribute('data-kanban-status');
				if (status) {
					onTouchDrop?.(item.id, status);
				}
			}
			removeGhost();
			isTouchDragging = false;
			isDragging = false;
			onDragEnd?.();
		}
	}

	function createGhost(x: number, y: number) {
		if (!cardEl) return;
		ghostEl = cardEl.cloneNode(true) as HTMLElement;
		ghostEl.style.position = 'fixed';
		ghostEl.style.zIndex = '10000';
		ghostEl.style.pointerEvents = 'none';
		ghostEl.style.opacity = '0.9';
		ghostEl.style.transform = 'scale(1.05) rotate(2deg)';
		ghostEl.style.width = `${cardEl.offsetWidth}px`;
		ghostEl.style.boxShadow = `0 12px 32px rgba(0,0,0,0.15), 0 0 0 2px ${typeConfig.color}40`;
		document.body.appendChild(ghostEl);
		moveGhost(x, y);
	}

	function moveGhost(x: number, y: number) {
		if (!ghostEl || !cardEl) return;
		ghostEl.style.left = `${x - cardEl.offsetWidth / 2}px`;
		ghostEl.style.top = `${y - 30}px`;
	}

	function removeGhost() {
		ghostEl?.remove();
		ghostEl = null;
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={cardEl}
	class="kanban-card"
	class:dragging={isDragging}
	class:priority-high={item.priority === 'high'}
	class:priority-critical={item.priority === 'critical'}
	style:--type-color={typeConfig.color}
	style:--priority-color={priorityConfig?.color ?? 'transparent'}
	draggable={enableDrag}
	role="button"
	tabindex="0"
	ondragstart={handleDragStart}
	ondragend={handleDragEnd}
	ontouchstart={handleTouchStart}
	ontouchmove={handleTouchMove}
	ontouchend={handleTouchEnd}
	onclick={() => onClick?.(item)}
	onkeydown={(e) => { if (e.key === 'Enter') onClick?.(item); }}
>
	{#if cardSnippet}
		{@render cardSnippet(item)}
	{:else}
		<div class="card-top">
			<span class="type-label">{typeConfig.label}</span>
			{#if showClaimIndicators && claimHealth !== 'none'}
				<span
					class="claim-indicator"
					class:active={claimHealth === 'active'}
					class:stale={claimHealth === 'stale'}
					class:orphaned={claimHealth === 'orphaned'}
					title={claimHealth === 'active' ? 'Active claim' : claimHealth === 'stale' ? 'Stale claim' : 'Orphaned'}
				>
					{claimHealth === 'active' ? '●' : claimHealth === 'stale' ? '◐' : '○'}
				</span>
			{/if}
		</div>

		<h4 class="card-title">{item.title}</h4>

		{#if item.description}
			<p class="card-desc">{item.description}</p>
		{/if}

		<div class="card-footer">
			{#if priorityConfig}
				<span class="priority-pill" style:--pill-color={priorityConfig.color}>
					{priorityConfig.label}
				</span>
			{/if}
			<DateDisplay date={item.createdAt} />
		</div>
	{/if}
</div>

<style>
	.kanban-card {
		display: flex;
		flex-direction: column;
		gap: var(--fb-space-2xs, 4px);
		padding: var(--fb-space-xs, 8px) var(--fb-space-sm, 12px);
		border-radius: var(--fb-radius-sm, 8px);
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--type-color) 6%, var(--theme-card-bg, rgba(30, 30, 40, 0.95))),
			var(--theme-card-bg, rgba(30, 30, 40, 0.95))
		);
		cursor: grab;
		position: relative;
		transition:
			transform var(--fb-duration-fast, 0.15s) var(--fb-spring, ease),
			box-shadow var(--fb-duration-fast, 0.15s) var(--fb-spring, ease),
			opacity var(--fb-duration-fast, 0.15s);
		user-select: none;
		-webkit-user-select: none;
	}

	/* Left accent gradient pseudo-element */
	.kanban-card::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3px;
		border-radius: 3px 0 0 3px;
		background: linear-gradient(
			180deg,
			var(--type-color),
			color-mix(in srgb, var(--type-color) 30%, transparent)
		);
	}

	.kanban-card:hover {
		box-shadow: 0 4px 16px color-mix(in srgb, var(--type-color) 15%, transparent);
		transform: translateY(-2px);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--type-color) 10%, var(--theme-card-bg, rgba(30, 30, 40, 0.95))),
			var(--theme-card-bg, rgba(30, 30, 40, 0.95))
		);
	}

	.kanban-card:active {
		cursor: grabbing;
		transform: scale(0.98);
	}

	.kanban-card.dragging {
		opacity: 0.4;
		transform: scale(0.97);
	}

	.kanban-card.priority-critical {
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--priority-color) 15%, transparent);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--priority-color) 8%, var(--theme-card-bg, rgba(30, 30, 40, 0.95))),
			var(--theme-card-bg, rgba(30, 30, 40, 0.95))
		);
		animation: critical-pulse 3s ease-in-out infinite;
	}

	.kanban-card.priority-critical::before {
		width: 4px;
	}

	.card-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 4px;
	}

	.type-label {
		font-size: var(--fb-text-xs, 0.8125rem);
		font-weight: 600;
		color: var(--type-color);
	}

	.claim-indicator {
		font-size: 10px;
	}

	.claim-indicator.active {
		color: var(--semantic-success, #10b981);
		text-shadow: 0 0 6px color-mix(in srgb, var(--semantic-success, #10b981) 40%, transparent);
	}

	.claim-indicator.stale {
		color: var(--semantic-warning, #f59e0b);
		animation: pulse-stale 2s ease-in-out infinite;
	}

	.claim-indicator.orphaned {
		color: var(--semantic-error, #ef4444);
	}

	.card-title {
		font-size: var(--fb-text-sm, 0.875rem);
		font-weight: 600;
		color: var(--theme-text, rgba(226, 232, 240, 0.95));
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.card-desc {
		font-size: var(--fb-text-xs, 0.8125rem);
		color: var(--theme-text-dim, rgba(148, 163, 184, 0.9));
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		line-height: 1.4;
	}

	.card-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 4px;
		margin-top: 2px;
		padding-top: 4px;
		border-top: 1px solid color-mix(in srgb, var(--type-color) 10%, transparent);
	}

	.priority-pill {
		font-size: 0.7rem;
		font-weight: 600;
		padding: 1px 6px;
		border-radius: 100px;
		color: var(--pill-color);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--pill-color) 15%, transparent),
			color-mix(in srgb, var(--pill-color) 8%, transparent)
		);
		border: 1px solid color-mix(in srgb, var(--pill-color) 20%, transparent);
	}

	@keyframes pulse-stale {
		0%, 100% { opacity: 0.4; }
		50% { opacity: 1; }
	}

	@keyframes critical-pulse {
		0%, 100% { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--priority-color) 15%, transparent); }
		50% { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--priority-color) 15%, transparent), 0 0 12px color-mix(in srgb, var(--priority-color) 20%, transparent); }
	}

	@media (prefers-reduced-motion: reduce) {
		.kanban-card { transition: none; }
		.claim-indicator.stale { animation: none; }
		.kanban-card.priority-critical { animation: none; }
	}
</style>
