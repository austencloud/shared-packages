<!--
  SectionsList.svelte - Animated section list with slide transition
-->
<script lang="ts">
	import { slide } from 'svelte/transition';
	import type { Snippet } from 'svelte';
	import type { ModuleDefinition, Section } from '../types.js';
	import SectionButton from './SectionButton.svelte';

	let {
		module,
		currentModule,
		currentSection,
		renderIcon,
		translateSectionLabel,
		filterSection,
		getBadgeCount,
		onSectionTap,
		onHaptic
	}: {
		module: ModuleDefinition;
		currentModule: string;
		currentSection: string;
		renderIcon?: Snippet<[name: string, size: number]> | undefined;
		translateSectionLabel?: ((moduleId: string, sectionId: string, fallback: string) => string) | undefined;
		filterSection?: ((moduleId: string, sectionId: string) => boolean) | undefined;
		getBadgeCount?: ((moduleId: string, sectionId?: string) => number) | undefined;
		onSectionTap: (moduleId: string, section: Section) => void;
		onHaptic?: (() => void) | undefined;
	} = $props();

	const isModuleActive = $derived(currentModule === module.id);

	const visibleSections = $derived(
		filterSection
			? module.sections.filter((s) => filterSection(module.id, s.id))
			: module.sections
	);

	function handleSectionClick(section: Section) {
		if (section.disabled) return;
		onHaptic?.();
		onSectionTap(module.id, section);
	}

	function getSectionLabel(section: Section): string {
		if (translateSectionLabel) {
			return translateSectionLabel(module.id, section.id, section.label);
		}
		return section.label;
	}

	function getSectionBadge(section: Section): number {
		if (getBadgeCount) {
			return getBadgeCount(module.id, section.id);
		}
		return 0;
	}
</script>

{#if visibleSections.length > 0}
	<div class="sidebar-sections-list" transition:slide={{ duration: 200 }}>
		{#each visibleSections as section, i (section.id)}
			<SectionButton
				{section}
				isActive={currentSection === section.id && isModuleActive}
				label={getSectionLabel(section)}
				badgeCount={getSectionBadge(section)}
				index={i}
				{renderIcon}
				onclick={() => handleSectionClick(section)}
			/>
		{/each}
	</div>
{/if}
