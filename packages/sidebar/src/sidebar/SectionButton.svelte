<!--
  SectionButton.svelte - Section/tab button within a module
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Section } from '../types.js';

	let {
		section,
		isActive = false,
		label,
		badgeCount = 0,
		index = 0,
		renderIcon,
		onclick
	}: {
		section: Section;
		isActive?: boolean;
		label: string;
		badgeCount?: number;
		index?: number;
		renderIcon?: Snippet<[name: string, size: number]> | undefined;
		onclick: () => void;
	} = $props();
</script>

<button
	class="sidebar-section-button"
	class:active={isActive}
	class:disabled={section.disabled}
	onclick={onclick}
	disabled={section.disabled}
	aria-label={label}
	style="--section-color: {section.color || 'rgba(156, 163, 175, 1)'}; --section-gradient: {section.gradient || section.color || 'rgba(156, 163, 175, 1)'}; --section-delay: {index * 30}ms;"
>
	<span class="sidebar-section-icon">
		{#if renderIcon}
			{@render renderIcon(section.icon, 16)}
		{:else}
			{@html section.icon}
		{/if}
	</span>
	<span class="sidebar-section-label">{label}</span>
	{#if badgeCount > 0}
		<span class="sidebar-badge">{badgeCount > 99 ? '99+' : badgeCount}</span>
	{/if}
	{#if isActive}
		<span
			class="sidebar-active-indicator"
			style="background: var(--section-gradient); box-shadow: 0 0 8px var(--section-color);"
		></span>
	{/if}
</button>
