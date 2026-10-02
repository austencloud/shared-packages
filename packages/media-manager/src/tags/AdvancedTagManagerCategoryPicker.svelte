<script lang="ts">
	import { getCategoryLabel, type TagCategory } from './advanced-tag-helpers.js';

	interface Props {
		current: TagCategory;
		categories: string[];
		categoryLabels?: Record<string, string>;
		appearance?: 'default' | 'rows';
		onSelect: (category: TagCategory) => void;
	}

	const { current, categories, categoryLabels = {}, appearance = 'default', onSelect }: Props = $props();
</script>

<div class="category-picker" class:rows={appearance === 'rows'} role="radiogroup" aria-label="Tag category">
	{#each categories as category (category)}
		<button
			class="category-pill"
			class:selected={current === category}
			onclick={() => onSelect(category)}
			role="radio"
			aria-checked={current === category}
		>
			{getCategoryLabel(category, categoryLabels)}
		</button>
	{/each}
</div>

<style>
	.category-picker {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 8px 0 4px;
	}

	.category-pill {
		padding: 6px 14px;
		min-height: var(--min-touch-target);
		background: var(--surface-dim);
		border: 1px solid var(--theme-stroke);
		border-radius: var(--radius-full);
		color: var(--theme-text-dim);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background var(--duration-crisp) var(--ease-crisp), border-color var(--duration-crisp) var(--ease-crisp), color var(--duration-crisp) var(--ease-crisp);
		white-space: nowrap;
	}

	.category-pill:hover {
		border-color: var(--theme-stroke-strong);
		color: var(--theme-text-dim);
	}

	.category-pill:active {
		transform: scale(0.95);
	}

	.category-pill.selected {
		background: var(--royal-bg-strong);
		border-color: var(--royal-border);
		color: var(--royal-text);
		animation: pill-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes pill-pop {
		0% { transform: scale(0.9); }
		60% { transform: scale(1.05); }
		100% { transform: scale(1); }
	}

	.category-pill:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.category-picker.rows { display: grid; grid-template-columns: 1fr; gap: 0; padding: 0; border: 1px solid var(--theme-stroke); border-radius: var(--radius-sm); overflow: hidden; }
	.category-picker.rows .category-pill { min-height: 36px; border: 0; border-radius: 0; background: transparent; color: var(--theme-text); text-align: left; padding: 7px 10px; }
	.category-picker.rows .category-pill + .category-pill { border-top: 1px solid var(--theme-stroke); }
	.category-picker.rows .category-pill:active { transform: none; }
	.category-picker.rows .category-pill.selected { background: var(--theme-accent-bg); color: var(--theme-text); box-shadow: inset 2px 0 var(--theme-accent); animation: none; }
	@media (prefers-reduced-motion: reduce) {
		.category-pill {
			transition: none;
		}
		.category-pill.selected {
			animation: none;
		}
	}
</style>
