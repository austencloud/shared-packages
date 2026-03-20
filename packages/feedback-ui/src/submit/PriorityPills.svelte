<script lang="ts">
	import type { FeedbackPriority } from '@austencloud/feedback-types';
	import { PRIORITY_DISPLAY } from '@austencloud/feedback-types';

	const {
		selectedPriority,
		onPriorityChange,
	}: {
		selectedPriority: FeedbackPriority | undefined;
		onPriorityChange: (priority: FeedbackPriority) => void;
	} = $props();

	const priorities: FeedbackPriority[] = ['low', 'medium', 'high', 'critical'];
</script>

<div class="priority-pills" role="radiogroup" aria-label="Priority">
	{#each priorities as p (p)}
		{@const config = PRIORITY_DISPLAY[p]}
		<button
			class="pill"
			class:selected={selectedPriority === p}
			style:--pill-color={config.color}
			role="radio"
			aria-checked={selectedPriority === p}
			onclick={() => onPriorityChange(p)}
		>
			{config.label}
		</button>
	{/each}
</div>

<style>
	.priority-pills {
		display: flex;
		gap: var(--fb-space-2xs, 6px);
		flex-wrap: wrap;
	}

	.pill {
		padding: 4px 12px;
		border-radius: 100px;
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		background: transparent;
		color: var(--theme-text-dim, rgba(148, 163, 184, 0.9));
		font-size: var(--fb-text-xs, 0.8125rem);
		font-weight: 600;
		cursor: pointer;
		transition: all var(--fb-duration-fast, 0.15s);
	}

	.pill:hover {
		border-color: color-mix(in srgb, var(--pill-color) 50%, transparent);
		color: var(--pill-color);
	}

	.pill.selected {
		border-color: var(--pill-color);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--pill-color) 15%, transparent),
			color-mix(in srgb, var(--pill-color) 8%, transparent)
		);
		color: var(--pill-color);
	}

	@media (prefers-reduced-motion: reduce) {
		.pill {
			transition: none;
		}
	}
</style>
