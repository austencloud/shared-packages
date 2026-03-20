<!--
  CollapsedTabButton.svelte - Activity bar tab icon (collapsed mode)
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Section } from '../types.js';

	let {
		section,
		isActive = false,
		renderIcon,
		onclick
	}: {
		section: Section;
		isActive?: boolean;
		renderIcon?: Snippet<[name: string, size: number]> | undefined;
		onclick: () => void;
	} = $props();
</script>

<button
	class="sidebar-collapsed-tab"
	class:active={isActive}
	class:disabled={section.disabled}
	onclick={onclick}
	disabled={section.disabled}
	aria-label={section.label}
	title={section.label}
	style="--section-color: {section.color || 'rgba(156, 163, 175, 1)'};"
>
	{#if renderIcon}
		{@render renderIcon(section.icon, 18)}
	{:else}
		{@html section.icon}
	{/if}
</button>
