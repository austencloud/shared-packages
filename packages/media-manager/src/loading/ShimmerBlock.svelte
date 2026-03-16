<script lang="ts">
	interface Props {
		width?: string;
		height?: string;
		borderRadius?: string;
		delay?: number;
		circle?: boolean;
	}

	let { width = '100%', height = '16px', borderRadius = '4px', delay = 0, circle = false }: Props = $props();

	const resolvedWidth = $derived(circle ? height : width);
	const resolvedRadius = $derived(circle ? '50%' : borderRadius);
</script>

<div
	class="shimmer-block"
	style:width={resolvedWidth}
	style:height={height}
	style:border-radius={resolvedRadius}
	style:animation-delay="{delay}ms"
	aria-hidden="true"
></div>

<style>
	.shimmer-block {
		background: linear-gradient(
			90deg,
			var(--mm-surface-raised, #222240) 25%,
			var(--mm-surface-hover, #2e2e50) 50%,
			var(--mm-surface-raised, #222240) 75%
		);
		background-size: 200% 100%;
		animation: shimmer-sweep 1.5s infinite;
		flex-shrink: 0;
	}

	@keyframes shimmer-sweep {
		0% { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}

	@media (prefers-reduced-motion: reduce) {
		.shimmer-block {
			animation: none;
			background: var(--mm-surface-raised, #222240);
			border: 1px solid var(--mm-border, #333355);
		}
	}
</style>
