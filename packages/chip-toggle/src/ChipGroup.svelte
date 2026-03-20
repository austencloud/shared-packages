<!--
	ChipGroup — Container for ChipToggle items.
	Supports labeled groups, flex wrap, row/grid variants, and fixed column grids.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ChipGroupProps } from './types.js';

	interface Props extends ChipGroupProps {
		children: Snippet;
	}

	let {
		label,
		layout = 'horizontal',
		variant = 'grid',
		columns,
		gap = 'md',
		wrap = true,
		children
	}: Props = $props();

	const useFixedGrid = $derived(columns !== undefined);
</script>

<div
	class="chip-group"
	class:vertical={layout === 'vertical'}
	role="group"
>
	{#if label}
		<span class="chip-group-label">{label}</span>
	{/if}
	<div
		class="chip-group-content {variant}"
		class:fixed-grid={useFixedGrid}
		class:no-wrap={!wrap}
		class:gap-sm={gap === 'sm'}
		class:gap-md={gap === 'md'}
		class:gap-lg={gap === 'lg'}
		style={useFixedGrid ? `--columns: ${columns}` : undefined}
	>
		{@render children()}
	</div>
</div>

<style>
	.chip-group {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.chip-group-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--chip-group-label, #6b7280);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.chip-group-content {
		display: flex;
	}

	.chip-group-content.row {
		flex-wrap: nowrap;
	}

	.chip-group-content.grid {
		flex-wrap: wrap;
	}

	.chip-group-content.no-wrap {
		flex-wrap: nowrap;
		overflow-x: auto;
	}

	.chip-group-content.fixed-grid {
		display: grid;
		grid-template-columns: repeat(var(--columns, 4), 1fr);
	}

	.chip-group-content.gap-sm {
		gap: 4px;
	}

	.chip-group-content.gap-md {
		gap: 8px;
	}

	.chip-group-content.gap-lg {
		gap: 12px;
	}

	.chip-group.vertical > .chip-group-content {
		flex-direction: column;
		align-items: stretch;
	}
</style>
