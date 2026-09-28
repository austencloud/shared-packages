<script lang="ts">
	import Icon from './AdvancedTagIcon.svelte';
	import type { TagColor } from './advanced-tag-helpers.js';

	interface Props {
		label: string;
		color?: TagColor;
		size?: 'sm' | 'md' | 'lg';
		variant?: 'solid' | 'dashed';
		removable?: boolean;
		selected?: boolean;
		interactive?: boolean;
		strikethrough?: boolean;
		title?: string;
		onclick?: () => void;
		onremove?: () => void;
	}

	const {
		label,
		color = 'gray',
		size = 'md',
		variant = 'solid',
		removable = false,
		selected = false,
		interactive = false,
		strikethrough = false,
		title,
		onclick,
		onremove
	}: Props = $props();

	function handleRemove(e: MouseEvent) {
		e.stopPropagation();
		onremove?.();
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<span
	class="tag-chip {size} {variant}"
	class:removable
	class:selected
	class:interactive
	class:strikethrough
	data-color={color}
	role={interactive || onclick ? 'button' : undefined}
	tabindex={interactive || onclick ? 0 : undefined}
	{title}
	onclick={onclick}
	onkeydown={(e) => e.key === 'Enter' && onclick?.()}
>
	<span class="tag-label">{label}</span>
	{#if removable}
		<button
			type="button"
			class="remove-btn"
			onclick={handleRemove}
			aria-label="Remove {label}"
		>
			<Icon name="xmark" size={size === 'sm' ? 10 : size === 'lg' ? 14 : 12} />
		</button>
	{/if}
</span>

<style>
	.tag-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		border-radius: var(--radius-full);
		font-weight: 500;
		transition: all var(--transition-fast) ease;
		white-space: nowrap;
		user-select: none;
	}

	/* Sizes */
	.tag-chip.sm {
		padding: 3px 10px;
		font-size: 12px;
		gap: 3px;
	}

	.tag-chip.md {
		padding: 8px 16px;
		font-size: 14px;
		min-height: 48px;
	}

	.tag-chip.lg {
		padding: 6px 14px;
		font-size: 14px;
		gap: 6px;
	}

	/* Interactive state */
	.tag-chip.interactive {
		cursor: pointer;
	}

	.tag-chip.interactive:hover {
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}

	.tag-chip.interactive:active {
		transform: translateY(0);
	}

	/* Dashed variant */
	.tag-chip.dashed {
		border-style: dashed;
		opacity: 0.75;
	}

	/* Strikethrough state (excluded tags) */
	.tag-chip.strikethrough {
		opacity: 0.6;
	}

	.tag-chip.strikethrough .tag-label {
		text-decoration: line-through;
	}

	/* Selected state */
	.tag-chip.selected {
		box-shadow: 0 0 0 2px currentColor;
	}

	/* Color variants: using theme tokens from cirque-theme-config.ts */
	.tag-chip[data-color="flame"] {
		background: var(--flame-bg-chip);
		color: var(--flame-text);
		border: 1px solid var(--flame-border);
	}
	.tag-chip[data-color="flame"].interactive:hover {
		background: var(--flame-bg-chip-hover);
	}

	.tag-chip[data-color="gold"] {
		background: var(--gold-bg-chip);
		color: var(--gold-text);
		border: 1px solid var(--gold-border);
	}
	.tag-chip[data-color="gold"].interactive:hover {
		background: var(--gold-bg-chip-hover);
	}

	/* Royal tags always render violet, via the fixed --tag-royal-* tokens,
	   not --royal-*, which is the dynamic brand accent other UI reuses and
	   which can drift to any background-driven color. */
	.tag-chip[data-color="royal"] {
		background: var(--tag-royal-bg-chip);
		color: var(--tag-royal-text);
		border: 1px solid var(--tag-royal-border);
	}
	.tag-chip[data-color="royal"].interactive:hover {
		background: var(--tag-royal-bg-chip-hover);
	}

	.tag-chip[data-color="cyan"] {
		background: var(--cyan-bg-chip);
		color: var(--cyan-text);
		border: 1px solid var(--cyan-border);
	}
	.tag-chip[data-color="cyan"].interactive:hover {
		background: var(--cyan-bg-chip-hover);
	}

	.tag-chip[data-color="green"] {
		background: var(--green-bg-chip);
		color: var(--green-text);
		border: 1px solid var(--green-border);
	}
	.tag-chip[data-color="green"].interactive:hover {
		background: var(--green-bg-chip-hover);
	}

	.tag-chip[data-color="red"] {
		background: var(--red-bg-chip);
		color: var(--red-text);
		border: 1px solid var(--red-border);
	}
	.tag-chip[data-color="red"].interactive:hover {
		background: var(--red-bg-chip-hover);
	}

	.tag-chip[data-color="purple"] {
		background: var(--purple-bg-chip);
		color: var(--purple-text);
		border: 1px solid var(--purple-border);
	}
	.tag-chip[data-color="purple"].interactive:hover {
		background: var(--purple-bg-chip-hover);
	}

	.tag-chip[data-color="gray"] {
		background: var(--gray-bg-chip);
		color: var(--gray-text);
		border: 1px solid var(--gray-border);
	}
	.tag-chip[data-color="gray"].interactive:hover {
		background: var(--gray-bg-chip-hover);
	}

	.tag-chip[data-color="navy"] {
		background: var(--navy-bg-chip);
		color: var(--navy-text);
		border: 1px solid var(--navy-border);
	}
	.tag-chip[data-color="navy"].interactive:hover {
		background: var(--navy-bg-chip-hover);
	}

	.tag-chip[data-color="teal"] {
		background: var(--teal-bg-chip);
		color: var(--teal-text);
		border: 1px solid var(--teal-border);
	}
	.tag-chip[data-color="teal"].interactive:hover {
		background: var(--teal-bg-chip-hover);
	}

	.tag-chip[data-color="pink"] {
		background: var(--pink-bg-chip);
		color: var(--pink-text);
		border: 1px solid var(--pink-border);
	}
	.tag-chip[data-color="pink"].interactive:hover {
		background: var(--pink-bg-chip-hover);
	}

	.tag-chip[data-color="lime"] {
		background: var(--lime-bg-chip);
		color: var(--lime-text);
		border: 1px solid var(--lime-border);
	}
	.tag-chip[data-color="lime"].interactive:hover {
		background: var(--lime-bg-chip-hover);
	}

	/* Remove button */
	.remove-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		padding: 0;
		margin-left: 2px;
		cursor: pointer;
		opacity: 0.6;
		color: inherit;
		transition: opacity var(--transition-fast) ease;
		border-radius: 50%;
	}

	/* Touch sizes get a real target for the remove button instead of a
	   bare 12px icon, tucked into the chip's right padding. */
	.tag-chip.md.removable,
	.tag-chip.lg.removable {
		padding-right: 6px;
	}

	.tag-chip.md .remove-btn,
	.tag-chip.lg .remove-btn {
		width: 32px;
		height: 32px;
		margin: -6px 0;
	}

	.remove-btn:hover {
		opacity: 1;
		background: var(--interactive-hover);
	}

	.remove-btn:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 1px;
	}
</style>
