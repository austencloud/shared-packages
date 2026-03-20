<!--
  CollapsedModuleButton.svelte - Activity bar module icon (collapsed mode)
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ModuleDefinition } from '../types.js';

	let {
		module,
		isActive = false,
		badgeCount = 0,
		renderIcon,
		onclick,
		onmouseenter
	}: {
		module: ModuleDefinition;
		isActive?: boolean;
		badgeCount?: number;
		renderIcon?: Snippet<[name: string, size: number]> | undefined;
		onclick: () => void;
		onmouseenter?: (() => void) | undefined;
	} = $props();

	const label = $derived(module.label);
</script>

<button
	class="sidebar-collapsed-button"
	class:active={isActive}
	onclick={onclick}
	onmouseenter={onmouseenter}
	aria-label={label}
	disabled={module.disabled}
	style="--module-color: {module.color || 'rgba(156, 163, 175, 1)'}"
>
	{#if renderIcon}
		{@render renderIcon(module.icon, 22)}
	{:else}
		{@html module.icon}
	{/if}
	{#if badgeCount > 0}
		<span class="sidebar-collapsed-badge">{badgeCount > 99 ? '99+' : badgeCount}</span>
	{/if}
	<span class="sidebar-collapsed-tooltip">{label}</span>
</button>
