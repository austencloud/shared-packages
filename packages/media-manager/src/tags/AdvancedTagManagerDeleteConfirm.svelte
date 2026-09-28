<script lang="ts">
	interface Props {
		tagName: string;
		itemCount: number;
		onConfirm: () => void;
		onCancel: () => void;
	}

	const { tagName, itemCount, onConfirm, onCancel }: Props = $props();
</script>

<div class="delete-confirm" role="alert">
	<!-- Says "Delete" to match the button; it used to ask "Remove from N
	     items?" and then offer a Delete button -->
	{#if itemCount > 0}
		<p class="warning-text">
			Delete <strong>"{tagName}"</strong>? It comes off {itemCount} item{itemCount !== 1 ? 's' : ''}. This can't be undone.
		</p>
	{:else}
		<p class="warning-text">
			Delete <strong>"{tagName}"</strong>? This can't be undone.
		</p>
	{/if}
	<div class="confirm-actions">
		<button class="action-btn cancel" onclick={onCancel}>Cancel</button>
		<button class="action-btn delete" onclick={onConfirm}>Delete</button>
	</div>
</div>

<style>
	/* Wraps so the buttons drop under the text on narrow screens instead
	   of squeezing it into a tall column */
	.delete-confirm {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		padding: 8px 0;
		animation: confirm-enter 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes confirm-enter {
		from {
			opacity: 0;
			transform: translateX(-6px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	.warning-text {
		flex: 1 1 220px;
		font-size: 13px;
		color: var(--theme-text-dim);
		margin: 0;
	}

	.warning-text strong {
		color: var(--theme-text);
		font-weight: 600;
	}

	.confirm-actions {
		display: flex;
		gap: 6px;
		flex-shrink: 0;
		margin-left: auto;
	}

	.action-btn {
		padding: 5px 14px;
		min-height: var(--min-touch-target);
		border: none;
		border-radius: var(--radius-sm);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background var(--duration-crisp) var(--ease-crisp), color var(--duration-crisp) var(--ease-crisp);
	}

	.action-btn.cancel {
		background: var(--interactive-active);
		color: var(--theme-text-dim);
	}

	.action-btn.cancel:hover {
		background: var(--interactive-selected);
		color: var(--theme-text-dim);
	}

	.action-btn:active {
		transform: scale(0.95);
	}

	.action-btn.delete {
		background: var(--red-bg);
		border: 1px solid var(--red-border);
		color: var(--red-text);
	}

	.action-btn.delete:hover {
		background: var(--red-bg-strong);
	}

	.action-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.delete-confirm {
			animation: none;
		}
		.action-btn {
			transition: none;
		}
	}
</style>
