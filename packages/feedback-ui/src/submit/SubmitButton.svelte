<script lang="ts">
	const {
		isSubmitting,
		disabled,
	}: {
		isSubmitting: boolean;
		disabled: boolean;
	} = $props();
</script>

<div class="submit-wrapper">
	<button class="submit-btn" type="submit" disabled={disabled || isSubmitting}>
		{#if isSubmitting}
			<span class="spinner" aria-hidden="true"></span>
			Submitting...
		{:else}
			Submit Feedback
		{/if}
	</button>
</div>

<style>
	.submit-wrapper {
		padding: var(--fb-space-sm, 12px);
		background: linear-gradient(
			to top,
			var(--theme-card-bg, rgba(30, 30, 40, 0.95)) 60%,
			transparent
		);
	}

	.submit-btn {
		width: 100%;
		padding: var(--fb-space-sm, 12px) var(--fb-space-md, 16px);
		border-radius: var(--fb-radius-md, 12px);
		border: none;
		background: linear-gradient(135deg, #3b82f6, #2563eb);
		color: #fff;
		font-size: var(--fb-text-base, 1rem);
		font-weight: 700;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		transition: all var(--fb-duration-fast, 0.15s);
	}

	.submit-btn:hover:not(:disabled) {
		filter: brightness(1.1);
		transform: translateY(-1px);
		box-shadow: 0 4px 16px color-mix(in srgb, #3b82f6 30%, transparent);
	}

	.submit-btn:active:not(:disabled) {
		transform: translateY(0);
	}

	.submit-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.spinner {
		width: 18px;
		height: 18px;
		border: 2.5px solid rgba(255, 255, 255, 0.3);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.submit-btn {
			transition: none;
		}
		.spinner {
			animation: none;
		}
	}
</style>
