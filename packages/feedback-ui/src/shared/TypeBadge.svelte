<script lang="ts">
	import type { FeedbackType } from '@austencloud/feedback-types';
	import { TYPE_DISPLAY } from '@austencloud/feedback-types';

	const { type }: { type: FeedbackType } = $props();

	const config = $derived(TYPE_DISPLAY[type]);
</script>

<span class="type-badge" style:--badge-color={config.color}>
	{config.label}
</span>

<style>
	.type-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		border-radius: 100px;
		font-size: var(--fb-text-xs, 0.8125rem);
		font-weight: 600;
		line-height: 1.4;
		color: var(--badge-color);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--badge-color) 15%, transparent),
			color-mix(in srgb, var(--badge-color) 8%, transparent)
		);
		border: 1px solid color-mix(in srgb, var(--badge-color) 30%, transparent);
		white-space: nowrap;
	}
</style>
