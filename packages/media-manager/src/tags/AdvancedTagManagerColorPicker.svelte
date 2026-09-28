<script lang="ts">
	import { TAG_COLORS, type TagColor } from './advanced-tag-helpers.js';

	interface Props {
		/** Null when nothing should read as picked yet (batch recolor). */
		current: TagColor | null;
		onSelect: (color: TagColor) => void;
	}

	const { current, onSelect }: Props = $props();

	// TAG_COLORS is the source of truth for these swatches. Chips and the
	// sidebar tag tree render the same colors through their own CSS custom
	// properties (see TagChip.svelte, TagTreeNode.svelte); those hex values
	// are kept in sync with TAG_COLORS by hand, not shared from this array.
	const colors = TAG_COLORS;
</script>

<div class="color-picker" role="radiogroup" aria-label="Tag color">
	{#each colors as color (color.value)}
		<button
			class="color-dot"
			class:selected={current === color.value}
			style="--dot-color: {color.hex}"
			onclick={() => onSelect(color.value)}
			role="radio"
			aria-checked={current === color.value}
			aria-label={color.value}
			title={color.value}
		></button>
	{/each}
</div>

<style>
	.color-picker {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 8px 0 4px;
	}

	.color-dot {
		position: relative;
		width: var(--min-touch-target);
		height: var(--min-touch-target);
		border-radius: 50%;
		border: 2px solid transparent;
		background: var(--dot-color);
		cursor: pointer;
		transition: transform var(--duration-crisp) var(--ease-crisp), border-color var(--duration-crisp) var(--ease-crisp);
	}

	.color-dot::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		min-width: var(--min-touch-target);
		min-height: var(--min-touch-target);
	}

	/* Hover grow only with a real pointer; on touch it stuck on the last
	   swatch tapped and looked selected */
	@media (hover: hover) {
		.color-dot:hover {
			transform: scale(1.2);
		}
	}

	.color-dot:active {
		transform: scale(0.85);
	}

	.color-dot.selected {
		border-color: var(--theme-text);
		transform: scale(1.2);
		box-shadow: 0 0 8px var(--interactive-selected);
		animation: dot-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes dot-pop {
		0% { transform: scale(0.7); }
		60% { transform: scale(1.3); }
		100% { transform: scale(1.2); }
	}

	.color-dot:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.color-dot {
			transition: none;
		}
		.color-dot.selected {
			animation: none;
		}
	}
</style>
