<script lang="ts">
	import type { FeedbackType } from '@austencloud/feedback-types';
	import { TYPE_DISPLAY } from '@austencloud/feedback-types';

	const {
		selectedType,
		onTypeChange,
	}: {
		selectedType: FeedbackType;
		onTypeChange: (type: FeedbackType) => void;
	} = $props();

	const types: FeedbackType[] = ['bug', 'feature', 'general'];
</script>

<div class="type-selector" role="radiogroup" aria-label="Feedback type">
	{#each types as type (type)}
		{@const config = TYPE_DISPLAY[type]}
		<button
			class="type-option"
			class:selected={selectedType === type}
			style:--type-color={config.color}
			role="radio"
			aria-checked={selectedType === type}
			onclick={() => onTypeChange(type)}
		>
			<span class="type-label">{config.label}</span>
		</button>
	{/each}
</div>

<style>
	.type-selector {
		display: flex;
		gap: var(--fb-space-xs, 8px);
	}

	.type-option {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: var(--fb-space-xs, 8px) var(--fb-space-sm, 12px);
		border-radius: var(--fb-radius-md, 12px);
		border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		background: var(--theme-card-bg, rgba(30, 30, 40, 0.95));
		color: var(--theme-text-dim, rgba(148, 163, 184, 0.9));
		font-size: var(--fb-text-sm, 0.875rem);
		font-weight: 600;
		cursor: pointer;
		transition:
			all var(--fb-duration-normal, 0.3s) var(--fb-spring, ease),
			border-color var(--fb-duration-fast, 0.15s);
	}

	.type-option:hover {
		border-color: color-mix(in srgb, var(--type-color) 50%, transparent);
		background: color-mix(in srgb, var(--type-color) 5%, var(--theme-card-bg, rgba(30, 30, 40, 0.95)));
	}

	.type-option.selected {
		border-color: var(--type-color);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--type-color) 12%, var(--theme-card-bg, rgba(30, 30, 40, 0.95))),
			color-mix(in srgb, var(--type-color) 6%, var(--theme-card-bg, rgba(30, 30, 40, 0.95)))
		);
		color: var(--type-color);
		box-shadow: 0 0 12px color-mix(in srgb, var(--type-color) 15%, transparent);
	}

	.type-label {
		white-space: nowrap;
	}

	@media (prefers-reduced-motion: reduce) {
		.type-option {
			transition: none;
		}
	}
</style>
