<script lang="ts">
	interface Props {
		selectedCount: number;
		onbatchcolor: () => void;
		onbatchcategory: () => void;
		onbatchdelete: () => void;
	}

	const {
		selectedCount,
		onbatchcolor,
		onbatchcategory,
		onbatchdelete
	}: Props = $props();
</script>

{#if selectedCount > 0}
	<div class="batch-bar">
		<span class="selection-count">
			<span class="count-num">{selectedCount}</span> selected
		</span>
		<div class="batch-actions">
			<button class="batch-btn" onclick={onbatchcolor}>Color</button>
			<button class="batch-btn" onclick={onbatchcategory}>Category</button>
			<button class="batch-btn danger" onclick={onbatchdelete}>Delete</button>
		</div>
	</div>
{/if}

<style>
	.batch-bar {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 16px;
		background: color-mix(in srgb, var(--mm-accent, #6366f1) 10%, var(--mm-surface, #1a1a2e));
		border-top: 1px solid color-mix(in srgb, var(--mm-accent, #6366f1) 25%, transparent);
		animation: slide-up 0.2s ease-out;
	}

	@keyframes slide-up {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.selection-count {
		font-size: 13px;
		font-weight: 500;
		color: var(--mm-text-muted, #9999b0);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.count-num {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 22px;
		height: 20px;
		padding: 0 6px;
		background: var(--mm-accent, #6366f1);
		border-radius: 9999px;
		font-weight: 700;
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		color: white;
	}

	.batch-actions {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1;
	}

	.batch-btn {
		padding: 5px 14px;
		background: var(--mm-surface-overlay, #2a2a4a);
		border: 1px solid var(--mm-border, #333355);
		border-radius: 6px;
		color: var(--mm-text, #e8e8f0);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
		white-space: nowrap;
	}

	.batch-btn:hover {
		background: var(--mm-surface-hover, #2e2e50);
		border-color: var(--mm-text-muted, #9999b0);
	}

	.batch-btn:active {
		transform: scale(0.95);
	}

	.batch-btn.danger {
		color: var(--mm-danger, #ef4444);
		border-color: color-mix(in srgb, var(--mm-danger, #ef4444) 30%, transparent);
	}

	.batch-btn.danger:hover {
		background: color-mix(in srgb, var(--mm-danger, #ef4444) 15%, var(--mm-surface, #1a1a2e));
		border-color: var(--mm-danger, #ef4444);
	}

	.batch-btn:focus-visible {
		outline: 2px solid var(--mm-accent, #6366f1);
		outline-offset: 2px;
	}
</style>
