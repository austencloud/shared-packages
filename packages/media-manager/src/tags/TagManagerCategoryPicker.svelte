<script lang="ts">
	import { getCategoryLabel } from '../types.js';

	interface Props {
		selected: string;
		onselect: (category: string) => void;
		/** App-specific category order. */
		categories: string[];
		/** App-specific category labels. */
		categoryLabels?: Record<string, string> | undefined;
	}

	const { selected, onselect, categories, categoryLabels }: Props = $props();
</script>

<div class="category-picker" role="radiogroup" aria-label="Tag category">
	{#each categories as category}
		<button
			class="category-pill"
			class:selected={selected === category}
			onclick={() => onselect(category)}
			role="radio"
			aria-checked={selected === category}
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
		padding: 4px 0;
	}

	.category-pill {
		padding: 4px 12px;
		background: var(--mm-surface-raised, #222240);
		border: 1px solid var(--mm-border, #333355);
		border-radius: 9999px;
		color: var(--mm-text-muted, #9999b0);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s, color 0.15s;
		white-space: nowrap;
	}

	.category-pill:hover {
		border-color: var(--mm-text-muted, #9999b0);
		color: var(--mm-text, #e8e8f0);
	}

	.category-pill:active {
		transform: scale(0.95);
	}

	.category-pill.selected {
		background: var(--mm-accent, #6366f1);
		border-color: var(--mm-accent, #6366f1);
		color: white;
	}

	.category-pill:focus-visible {
		outline: 2px solid var(--mm-accent, #6366f1);
		outline-offset: 2px;
	}
</style>
