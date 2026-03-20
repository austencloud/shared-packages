<!--
  ModuleButton.svelte - Expanded mode module button
  Displays module icon, label, and expand chevron.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ModuleDefinition } from '../types.js';

	let {
		module,
		isExpanded = false,
		label,
		badgeCount = 0,
		renderIcon,
		onclick,
		onmouseenter
	}: {
		module: ModuleDefinition;
		isExpanded?: boolean;
		label: string;
		badgeCount?: number;
		renderIcon?: Snippet<[name: string, size: number]> | undefined;
		onclick: () => void;
		onmouseenter?: () => void;
	} = $props();

	const hasSections = $derived(module.sections.length > 0);
</script>

<button
	class="sidebar-module-button"
	class:expanded={isExpanded}
	class:has-sections={hasSections}
	onclick={onclick}
	onmouseenter={onmouseenter}
	aria-label={label}
	aria-expanded={hasSections ? isExpanded : undefined}
	disabled={module.disabled}
	title={module.disabled ? module.disabledMessage : undefined}
	style="--module-color: {module.color || 'rgba(156, 163, 175, 1)'}"
>
	<span class="sidebar-module-icon" data-color={module.color}>
		{#if renderIcon}
			{@render renderIcon(module.icon, 20)}
		{:else}
			{@html module.icon}
		{/if}
	</span>
	<span class="sidebar-module-label">{label}</span>
	{#if badgeCount > 0}
		<span class="sidebar-badge">{badgeCount > 99 ? '99+' : badgeCount}</span>
	{/if}
	{#if hasSections}
		<span class="sidebar-expand-icon">
			{#if renderIcon}
				{@render renderIcon(isExpanded ? 'chevron-down' : 'chevron-right', 14)}
			{:else}
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					{#if isExpanded}
						<polyline points="6 9 12 15 18 9"></polyline>
					{:else}
						<polyline points="9 6 15 12 9 18"></polyline>
					{/if}
				</svg>
			{/if}
		</span>
	{/if}
</button>
