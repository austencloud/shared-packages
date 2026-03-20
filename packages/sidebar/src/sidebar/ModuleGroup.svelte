<!--
  ModuleGroup.svelte - Module wrapper with expandable sections
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ModuleDefinition, Section } from '../types.js';
	import ModuleButton from './ModuleButton.svelte';
	import SectionsList from './SectionsList.svelte';

	let {
		module,
		isExpanded = false,
		currentModule,
		currentSection,
		renderIcon,
		translateLabel,
		translateSectionLabel,
		filterSection,
		getBadgeCount,
		onModuleTap,
		onSectionTap,
		onHaptic,
		onModuleHover
	}: {
		module: ModuleDefinition;
		isExpanded?: boolean;
		currentModule: string;
		currentSection: string;
		renderIcon?: Snippet<[name: string, size: number]> | undefined;
		translateLabel?: ((moduleId: string) => string) | undefined;
		translateSectionLabel?: ((moduleId: string, sectionId: string, fallback: string) => string) | undefined;
		filterSection?: ((moduleId: string, sectionId: string) => boolean) | undefined;
		getBadgeCount?: ((moduleId: string, sectionId?: string) => number) | undefined;
		onModuleTap: (moduleId: string, hasSections: boolean) => void;
		onSectionTap: (moduleId: string, section: Section) => void;
		onHaptic?: (() => void) | undefined;
		onModuleHover?: ((moduleId: string) => void) | undefined;
	} = $props();

	const hasSections = $derived(module.sections.length > 0);
	const moduleLabel = $derived(translateLabel ? translateLabel(module.id) : module.label);
	const moduleBadge = $derived(getBadgeCount ? getBadgeCount(module.id) : 0);

	function handleModuleClick() {
		onHaptic?.();
		onModuleTap(module.id, hasSections);
	}

	function handleMouseEnter() {
		onModuleHover?.(module.id);
	}
</script>

<div
	class="sidebar-module-group"
	class:active={currentModule === module.id}
	class:has-sections={hasSections}
	style="--module-color: {module.color || 'rgba(156, 163, 175, 1)'}"
>
	<ModuleButton
		{module}
		{isExpanded}
		label={moduleLabel}
		badgeCount={moduleBadge}
		{renderIcon}
		onclick={handleModuleClick}
		onmouseenter={handleMouseEnter}
	/>

	{#if isExpanded && hasSections}
		<SectionsList
			{module}
			{currentModule}
			{currentSection}
			{renderIcon}
			{translateSectionLabel}
			{filterSection}
			{getBadgeCount}
			{onSectionTap}
			{onHaptic}
		/>
	{/if}
</div>
