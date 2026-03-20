<!--
	ChipToggle — Toggleable chip with color presets and size variants.
	Reads --chip-* CSS custom properties so each consuming app can map
	its own design tokens via an imported CSS file (css/cirque-tokens.css
	or css/tka-tokens.css).
-->
<script lang="ts">
	import type { ChipToggleProps } from './types.js';

	let {
		label,
		icon,
		active = false,
		color = 'default',
		size = 'md',
		layout = 'horizontal',
		disabled = false,
		onclick
	}: ChipToggleProps = $props();

	const iconOnly = $derived(!label && !!icon);
</script>

<button
	class="chip-toggle {size}"
	class:icon-only={iconOnly}
	class:vertical={layout === 'vertical'}
	data-color={color}
	data-active={active}
	aria-pressed={active}
	aria-label={iconOnly ? icon : undefined}
	{disabled}
	{onclick}
>
	{#if icon}
		<i class="fas {icon}" aria-hidden="true"></i>
	{/if}
	{#if label}
		<span>{label}</span>
	{/if}
</button>

<style>
	/* ================================================================
	   BASE
	   ================================================================ */

	.chip-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 10px 18px;
		min-height: 48px;
		background: var(--chip-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--chip-border, rgba(255, 255, 255, 0.1));
		border-radius: var(--chip-radius, 9999px);
		color: var(--chip-text, rgba(255, 255, 255, 0.6));
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--chip-transition, 0.15s) ease;
		box-shadow: none;
		-webkit-tap-highlight-color: transparent;
		user-select: none;
	}

	.chip-toggle i {
		font-size: 0.8rem;
	}

	.chip-toggle span {
		white-space: nowrap;
	}

	/* ================================================================
	   LAYOUT: VERTICAL
	   ================================================================ */

	.chip-toggle.vertical {
		flex-direction: column;
		gap: 4px;
		padding: 10px 14px;
	}

	/* ================================================================
	   SIZE VARIANTS
	   ================================================================ */

	.chip-toggle.sm {
		padding: 6px 12px;
		min-height: 40px;
		font-size: 0.8rem;
	}

	.chip-toggle.lg {
		padding: 12px 24px;
		min-height: 56px;
		font-size: 1rem;
		gap: 10px;
	}

	.chip-toggle.lg i {
		font-size: 1rem;
	}

	/* ================================================================
	   ICON-ONLY
	   ================================================================ */

	.chip-toggle.icon-only {
		padding: 10px;
		min-width: 48px;
	}

	.chip-toggle.icon-only i {
		font-size: 1rem;
	}

	/* ================================================================
	   DISABLED
	   ================================================================ */

	.chip-toggle:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* ================================================================
	   HOVER (pointer devices only)
	   ================================================================ */

	@media (hover: hover) {
		.chip-toggle:hover:not(:disabled):not([data-active='true']) {
			background: var(--chip-hover-bg, rgba(255, 255, 255, 0.08));
			border-color: var(--chip-hover-border, rgba(255, 255, 255, 0.2));
			color: var(--chip-hover-text, rgba(255, 255, 255, 0.85));
			transform: translateY(-1px);
		}
	}

	/* ================================================================
	   FOCUS
	   ================================================================ */

	.chip-toggle:focus-visible {
		outline: 2px solid var(--chip-focus, rgba(168, 85, 247, 0.6));
		outline-offset: 2px;
	}

	/* ================================================================
	   ACTIVE PRESS
	   ================================================================ */

	.chip-toggle:active:not(:disabled) {
		transform: scale(0.98);
	}

	/* ================================================================
	   ACTIVE STATES BY COLOR
	   Each color reads --chip-{color}-bg, border, text, glow, focus.
	   Fallbacks are neutral so the component works without token CSS.
	   ================================================================ */

	/* Default + Purple (aliases) */
	.chip-toggle[data-color='default'][data-active='true'],
	.chip-toggle[data-color='purple'][data-active='true'] {
		background: var(--chip-purple-bg, rgba(168, 85, 247, 0.2));
		border-color: var(--chip-purple-border, rgba(168, 85, 247, 0.5));
		color: var(--chip-purple-text, #d8b4fe);
		box-shadow: var(--chip-purple-glow, 0 0 16px rgba(168, 85, 247, 0.15));
	}

	.chip-toggle[data-color='default']:focus-visible,
	.chip-toggle[data-color='purple']:focus-visible {
		outline-color: var(--chip-purple-focus, rgba(168, 85, 247, 0.6));
	}

	/* Flame */
	.chip-toggle[data-color='flame'][data-active='true'] {
		background: var(--chip-flame-bg, rgba(249, 115, 22, 0.2));
		border-color: var(--chip-flame-border, rgba(249, 115, 22, 0.5));
		color: var(--chip-flame-text, #fdba74);
		box-shadow: var(--chip-flame-glow, 0 0 16px rgba(249, 115, 22, 0.15));
	}

	.chip-toggle[data-color='flame']:focus-visible {
		outline-color: var(--chip-flame-focus, rgba(249, 115, 22, 0.6));
	}

	/* Gold */
	.chip-toggle[data-color='gold'][data-active='true'] {
		background: var(--chip-gold-bg, rgba(234, 179, 8, 0.2));
		border-color: var(--chip-gold-border, rgba(234, 179, 8, 0.5));
		color: var(--chip-gold-text, #fde047);
		box-shadow: var(--chip-gold-glow, 0 0 16px rgba(234, 179, 8, 0.15));
	}

	.chip-toggle[data-color='gold']:focus-visible {
		outline-color: var(--chip-gold-focus, rgba(234, 179, 8, 0.6));
	}

	/* Cyan */
	.chip-toggle[data-color='cyan'][data-active='true'] {
		background: var(--chip-cyan-bg, rgba(6, 182, 212, 0.2));
		border-color: var(--chip-cyan-border, rgba(6, 182, 212, 0.5));
		color: var(--chip-cyan-text, #67e8f9);
		box-shadow: var(--chip-cyan-glow, 0 0 16px rgba(6, 182, 212, 0.15));
	}

	.chip-toggle[data-color='cyan']:focus-visible {
		outline-color: var(--chip-cyan-focus, rgba(6, 182, 212, 0.6));
	}

	/* Blue */
	.chip-toggle[data-color='blue'][data-active='true'] {
		background: var(--chip-blue-bg, rgba(59, 130, 246, 0.2));
		border-color: var(--chip-blue-border, rgba(59, 130, 246, 0.5));
		color: var(--chip-blue-text, #93c5fd);
		box-shadow: var(--chip-blue-glow, 0 0 16px rgba(59, 130, 246, 0.15));
	}

	.chip-toggle[data-color='blue']:focus-visible {
		outline-color: var(--chip-blue-focus, rgba(59, 130, 246, 0.6));
	}

	/* Lime */
	.chip-toggle[data-color='lime'][data-active='true'] {
		background: var(--chip-lime-bg, rgba(132, 204, 22, 0.2));
		border-color: var(--chip-lime-border, rgba(132, 204, 22, 0.5));
		color: var(--chip-lime-text, #bef264);
		box-shadow: var(--chip-lime-glow, 0 0 16px rgba(132, 204, 22, 0.15));
	}

	.chip-toggle[data-color='lime']:focus-visible {
		outline-color: var(--chip-lime-focus, rgba(132, 204, 22, 0.6));
	}

	/* Amber */
	.chip-toggle[data-color='amber'][data-active='true'] {
		background: var(--chip-amber-bg, rgba(245, 158, 11, 0.2));
		border-color: var(--chip-amber-border, rgba(245, 158, 11, 0.5));
		color: var(--chip-amber-text, #fcd34d);
		box-shadow: var(--chip-amber-glow, 0 0 16px rgba(245, 158, 11, 0.15));
	}

	.chip-toggle[data-color='amber']:focus-visible {
		outline-color: var(--chip-amber-focus, rgba(245, 158, 11, 0.6));
	}

	/* Rose */
	.chip-toggle[data-color='rose'][data-active='true'] {
		background: var(--chip-rose-bg, rgba(244, 63, 94, 0.2));
		border-color: var(--chip-rose-border, rgba(244, 63, 94, 0.5));
		color: var(--chip-rose-text, #fda4af);
		box-shadow: var(--chip-rose-glow, 0 0 16px rgba(244, 63, 94, 0.15));
	}

	.chip-toggle[data-color='rose']:focus-visible {
		outline-color: var(--chip-rose-focus, rgba(244, 63, 94, 0.6));
	}

	/* Emerald */
	.chip-toggle[data-color='emerald'][data-active='true'] {
		background: var(--chip-emerald-bg, rgba(16, 185, 129, 0.2));
		border-color: var(--chip-emerald-border, rgba(16, 185, 129, 0.5));
		color: var(--chip-emerald-text, #6ee7b7);
		box-shadow: var(--chip-emerald-glow, 0 0 16px rgba(16, 185, 129, 0.15));
	}

	.chip-toggle[data-color='emerald']:focus-visible {
		outline-color: var(--chip-emerald-focus, rgba(16, 185, 129, 0.6));
	}

	/* Red */
	.chip-toggle[data-color='red'][data-active='true'] {
		background: var(--chip-red-bg, rgba(239, 68, 68, 0.2));
		border-color: var(--chip-red-border, rgba(239, 68, 68, 0.5));
		color: var(--chip-red-text, #fca5a5);
		box-shadow: var(--chip-red-glow, 0 0 16px rgba(239, 68, 68, 0.15));
	}

	.chip-toggle[data-color='red']:focus-visible {
		outline-color: var(--chip-red-focus, rgba(239, 68, 68, 0.6));
	}

	/* Gray */
	.chip-toggle[data-color='gray'][data-active='true'] {
		background: var(--chip-gray-bg, rgba(156, 163, 175, 0.2));
		border-color: var(--chip-gray-border, rgba(156, 163, 175, 0.5));
		color: var(--chip-gray-text, #d1d5db);
		box-shadow: var(--chip-gray-glow, 0 0 16px rgba(156, 163, 175, 0.15));
	}

	.chip-toggle[data-color='gray']:focus-visible {
		outline-color: var(--chip-gray-focus, rgba(156, 163, 175, 0.6));
	}

	/* ================================================================
	   REDUCED MOTION
	   ================================================================ */

	@media (prefers-reduced-motion: reduce) {
		.chip-toggle {
			transition: none;
		}
	}
</style>
