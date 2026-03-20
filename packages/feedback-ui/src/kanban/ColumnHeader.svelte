<script lang="ts">
	import type { FeedbackStatus } from '@austencloud/feedback-types';
	import { STATUS_DISPLAY, WIP_LIMITS } from '@austencloud/feedback-types';

	const {
		status,
		count,
		showWipWarnings = true,
	}: {
		status: FeedbackStatus;
		count: number;
		showWipWarnings?: boolean;
	} = $props();

	const config = $derived(STATUS_DISPLAY[status]);
	const wipLimit = $derived(WIP_LIMITS[status] ?? 0);
	const isAtLimit = $derived(showWipWarnings && wipLimit > 0 && count >= wipLimit);
	const isOverLimit = $derived(showWipWarnings && wipLimit > 0 && count > wipLimit);
</script>

<div class="column-header" style:--col-color={config.color}>
	<div class="header-left">
		<span class="status-label">{config.label}</span>
		<span
			class="item-count"
			class:at-limit={isAtLimit && !isOverLimit}
			class:over-limit={isOverLimit}
		>
			{count}{#if wipLimit > 0}/{wipLimit}{/if}
		</span>
	</div>
</div>

<style>
	.column-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--fb-space-xs, 8px) var(--fb-space-sm, 12px);
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--col-color) 10%, transparent),
			transparent
		);
		border-bottom: 1px solid color-mix(in srgb, var(--col-color) 15%, transparent);
		flex-shrink: 0;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.status-label {
		font-size: var(--fb-text-sm, 0.875rem);
		font-weight: 700;
		color: var(--col-color);
	}

	.item-count {
		font-size: var(--fb-text-xs, 0.8125rem);
		font-weight: 600;
		color: var(--theme-text-dim, rgba(148, 163, 184, 0.9));
		padding: 1px 6px;
		border-radius: 100px;
		background: color-mix(in srgb, var(--col-color) 10%, transparent);
	}

	.item-count.at-limit {
		color: var(--semantic-warning, #f59e0b);
		background: color-mix(in srgb, var(--semantic-warning, #f59e0b) 12%, transparent);
	}

	.item-count.over-limit {
		color: var(--semantic-error, #ef4444);
		background: color-mix(in srgb, var(--semantic-error, #ef4444) 12%, transparent);
		animation: warning-pulse 2s ease-in-out infinite;
	}

	@keyframes warning-pulse {
		0%, 100% { box-shadow: 0 0 0 0 transparent; }
		50% { box-shadow: 0 0 8px color-mix(in srgb, var(--semantic-error, #ef4444) 30%, transparent); }
	}

	@media (prefers-reduced-motion: reduce) {
		.item-count.over-limit {
			animation: none;
		}
	}
</style>
