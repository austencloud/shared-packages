<script lang="ts">
	import type { FeedbackItem } from '@austencloud/feedback-types';
	import { TYPE_DISPLAY } from '@austencloud/feedback-types';
	import StatusBadge from '../shared/StatusBadge.svelte';
	import DateDisplay from '../shared/DateDisplay.svelte';

	const {
		item,
		isSelected = false,
		onClick,
	}: {
		item: FeedbackItem;
		isSelected?: boolean;
		onClick?: () => void;
	} = $props();

	const typeConfig = $derived(TYPE_DISPLAY[item.type]);
</script>

<button
	class="feedback-card"
	class:selected={isSelected}
	style:--type-color={typeConfig.color}
	onclick={onClick}
>
	<div class="card-header">
		<span class="type-indicator">{typeConfig.label}</span>
		<StatusBadge status={item.status} />
	</div>
	<h3 class="card-title">{item.title}</h3>
	<p class="card-desc">{item.description}</p>
	<div class="card-footer">
		<DateDisplay date={item.createdAt} />
		{#if item.imageUrls?.length}
			<span class="image-count">{item.imageUrls.length} img</span>
		{/if}
	</div>
</button>

<style>
	.feedback-card {
		display: flex;
		flex-direction: column;
		gap: var(--fb-space-xs, 8px);
		padding: var(--fb-space-sm, 12px);
		border-radius: var(--fb-radius-md, 12px);
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--type-color) 6%, var(--theme-card-bg, rgba(30, 30, 40, 0.95))),
			var(--theme-card-bg, rgba(30, 30, 40, 0.95))
		);
		cursor: pointer;
		text-align: left;
		width: 100%;
		position: relative;
		transition: all var(--fb-duration-fast, 0.15s);
	}

	/* Left accent gradient pseudo-element */
	.feedback-card::before {
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

	.feedback-card:hover {
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--type-color) 10%, var(--theme-card-bg, rgba(30, 30, 40, 0.95))),
			var(--theme-card-bg, rgba(30, 30, 40, 0.95))
		);
		transform: translateY(-2px);
		box-shadow: 0 4px 16px color-mix(in srgb, var(--type-color) 15%, transparent);
	}

	.feedback-card.selected {
		border-color: var(--type-color);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--type-color) 20%, transparent);
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.type-indicator {
		font-size: var(--fb-text-xs, 0.8125rem);
		font-weight: 600;
		color: var(--type-color);
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
		gap: 8px;
	}

	.image-count {
		font-size: var(--fb-text-xs, 0.8125rem);
		color: var(--theme-text-dim, rgba(148, 163, 184, 0.9));
	}

	@media (prefers-reduced-motion: reduce) {
		.feedback-card {
			transition: none;
		}
	}
</style>
