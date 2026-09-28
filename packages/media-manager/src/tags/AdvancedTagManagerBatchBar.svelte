<script lang="ts">
	interface Props {
		selectedCount: number;
		onChangeColor: () => void;
		onChangeCategory: () => void;
		onMerge: () => void;
		onDelete: () => void;
		onClearSelection: () => void;
	}

	const {
		selectedCount,
		onChangeColor,
		onChangeCategory,
		onMerge,
		onDelete,
		onClearSelection
	}: Props = $props();
</script>

{#if selectedCount > 0}
	<div class="batch-bar">
		<span class="selection-count">
			<span class="count-num">{selectedCount}</span> selected
		</span>
		<div class="batch-actions">
			<button class="batch-btn" onclick={onChangeColor}>
				Color
			</button>
			<button class="batch-btn" onclick={onChangeCategory}>
				Category
			</button>
			{#if selectedCount >= 2}
				<button class="batch-btn" onclick={onMerge}>
					Merge
				</button>
			{/if}
			<button class="batch-btn danger" onclick={onDelete}>
				Delete
			</button>
		</div>
		<button class="clear-btn" onclick={onClearSelection} aria-label="Clear selection">
			Clear
		</button>
	</div>
{/if}

<style>
	.batch-bar {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 20px;
		background: var(--royal-bg);
		border-top: 1px solid var(--royal-bg-strong);
		animation: bar-slide-up 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes bar-slide-up {
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
		color: var(--royal-text);
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
		background: var(--royal-bg-strong);
		border-radius: var(--radius-full);
		font-weight: 700;
		font-size: 12px;
		font-variant-numeric: tabular-nums;
	}

	.batch-actions {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1;
	}

	.batch-btn {
		padding: 6px 14px;
		min-height: var(--min-touch-target);
		background: var(--interactive-active);
		border: 1px solid var(--theme-stroke);
		border-radius: var(--radius-md);
		color: var(--theme-text-dim);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background var(--duration-crisp) var(--ease-crisp), border-color var(--duration-crisp) var(--ease-crisp), color var(--duration-crisp) var(--ease-crisp);
		white-space: nowrap;
	}

	.batch-btn:hover {
		background: var(--interactive-selected);
		border-color: var(--theme-stroke-strong);
		color: var(--theme-text);
	}

	.batch-btn:active {
		transform: scale(0.95);
	}

	.batch-btn.danger {
		color: var(--red-text);
		border-color: var(--red-border);
	}

	.batch-btn.danger:hover {
		background: var(--red-bg);
		border-color: var(--red-border);
		color: var(--red-text);
	}

	.batch-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.clear-btn {
		padding: 6px 12px;
		min-height: var(--min-touch-target);
		background: none;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-faint);
		font-size: 14px;
		cursor: pointer;
		transition: background var(--duration-crisp) var(--ease-crisp), color var(--duration-crisp) var(--ease-crisp);
		flex-shrink: 0;
	}

	.clear-btn:hover {
		background: var(--interactive-active);
		color: var(--theme-text-dim);
	}

	.clear-btn:active {
		transform: scale(0.95);
	}

	.clear-btn:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	/* Narrow screens: count and Clear on top, the four actions share a
	   full-width row below. In one row it needed about 500px and ran off
	   the side of the cover screen. */
	@media (max-width: 560px) {
		.batch-bar {
			flex-wrap: wrap;
			row-gap: 8px;
			padding: 8px 12px;
		}

		.clear-btn {
			margin-left: auto;
		}

		.batch-actions {
			order: 3;
			flex: 1 1 100%;
		}

		.batch-btn {
			flex: 1;
			padding: 6px 8px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.batch-bar {
			animation: none;
		}
		.batch-btn,
		.clear-btn {
			transition: none;
		}
	}
</style>
