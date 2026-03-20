<script lang="ts">
	import type { FeedbackStatus, StatusHistoryEntry } from '@austencloud/feedback-types';
	import { STATUS_DISPLAY } from '@austencloud/feedback-types';

	const {
		history,
		currentStatus,
		createdAt,
	}: {
		history?: StatusHistoryEntry[];
		currentStatus: FeedbackStatus;
		createdAt: Date;
	} = $props();

	interface TimelineStep {
		status: FeedbackStatus;
		date: Date;
		actor?: string;
		notes?: string;
	}

	const steps = $derived.by((): TimelineStep[] => {
		if (history && history.length > 0) {
			const entries: TimelineStep[] = [
				{ status: 'new', date: createdAt, actor: 'You' },
			];
			for (const h of history) {
				entries.push({
					status: h.toStatus,
					date: h.changedAt,
					actor: h.changedBy,
					notes: h.notes,
				});
			}
			return entries;
		}
		return [{ status: currentStatus, date: createdAt }];
	});

	function formatDate(d: Date): string {
		return d.toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	}
</script>

<div class="timeline">
	{#each steps as step, i (i)}
		{@const config = STATUS_DISPLAY[step.status]}
		<div class="timeline-step" class:current={i === steps.length - 1}>
			<div class="dot-line">
				<div class="dot" style:--dot-color={config.color}></div>
				{#if i < steps.length - 1}
					<div class="line" style:--dot-color={config.color}></div>
				{/if}
			</div>
			<div class="step-content">
				<div class="step-header">
					<span class="step-status" style:color={config.color}>{config.label}</span>
					<span class="step-date">{formatDate(step.date)}</span>
				</div>
				{#if step.actor}
					<span class="step-actor">by {step.actor}</span>
				{/if}
				{#if step.notes}
					<p class="step-notes">{step.notes}</p>
				{/if}
			</div>
		</div>
	{/each}
</div>

<style>
	.timeline {
		display: flex;
		flex-direction: column;
	}

	.timeline-step {
		display: flex;
		gap: var(--fb-space-sm, 12px);
		padding-bottom: var(--fb-space-sm, 12px);
	}

	.dot-line {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex-shrink: 0;
		width: 16px;
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--dot-color);
		flex-shrink: 0;
		margin-top: 4px;
	}

	.line {
		width: 2px;
		flex: 1;
		background: linear-gradient(
			180deg,
			var(--dot-color),
			color-mix(in srgb, var(--dot-color) 20%, transparent)
		);
		margin-top: 4px;
	}

	.step-content {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.step-header {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.step-status {
		font-size: var(--fb-text-sm, 0.875rem);
		font-weight: 600;
	}

	.step-date {
		font-size: var(--fb-text-xs, 0.8125rem);
		color: var(--theme-text-dim, rgba(148, 163, 184, 0.9));
	}

	.step-actor {
		font-size: var(--fb-text-xs, 0.8125rem);
		color: var(--theme-text-dim, rgba(148, 163, 184, 0.9));
	}

	.step-notes {
		font-size: var(--fb-text-xs, 0.8125rem);
		color: var(--theme-text-dim, rgba(148, 163, 184, 0.9));
		margin: 2px 0 0;
		line-height: 1.4;
	}

	.current .dot {
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--dot-color) 25%, transparent);
	}
</style>
