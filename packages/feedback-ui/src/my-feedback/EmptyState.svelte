<script lang="ts">
	const {
		isAuthenticated,
		loading,
		emptyMessage = 'No feedback submitted yet.',
		signInMessage = 'Sign in to submit and track your feedback.',
	}: {
		isAuthenticated: boolean;
		loading: boolean;
		emptyMessage?: string;
		signInMessage?: string;
	} = $props();
</script>

<div class="empty-state">
	{#if loading}
		<div class="loading-indicator">
			<div class="pulse-dot"></div>
			<span>Loading your feedback...</span>
		</div>
	{:else if !isAuthenticated}
		<p class="message">{signInMessage}</p>
	{:else}
		<p class="message">{emptyMessage}</p>
	{/if}
</div>

<style>
	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--fb-space-lg, 32px);
		text-align: center;
		min-height: 200px;
		background: radial-gradient(
			ellipse at center,
			color-mix(in srgb, var(--theme-stroke, rgba(255, 255, 255, 0.08)) 10%, transparent),
			transparent 70%
		);
	}

	.message {
		font-size: var(--fb-text-sm, 0.875rem);
		color: var(--theme-text-dim, rgba(148, 163, 184, 0.9));
		margin: 0;
	}

	.loading-indicator {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--theme-text-dim, rgba(148, 163, 184, 0.9));
		font-size: var(--fb-text-sm, 0.875rem);
	}

	.pulse-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--theme-text-dim, rgba(148, 163, 184, 0.9));
		animation: pulse 1.2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.3;
		}
		50% {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pulse-dot {
			animation: none;
			opacity: 0.6;
		}
	}
</style>
