<!--
  Sidebar.svelte - Main orchestrator

  Composable sidebar navigation component with:
  - Module groups with expandable sections
  - Collapsible activity bar mode
  - Snippet slots for header, footer, and icon rendering
  - Callback props for DI replacement (haptics, i18n, feature flags, badges, prefetching)
  - localStorage persistence for collapse state
  - Themeable via --sidebar-* CSS custom properties
-->
<script lang="ts">
	import './sidebar/Sidebar.css';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { ModuleDefinition, Section } from './types.js';
	import { readCollapseState, writeCollapseState } from './sidebar/collapse-state.js';
	import ModuleGroup from './sidebar/ModuleGroup.svelte';
	import CollapsedModuleButton from './sidebar/CollapsedModuleButton.svelte';
	import CollapsedTabButton from './sidebar/CollapsedTabButton.svelte';

	let {
		// Required
		modules,
		currentModule,
		currentSection,

		// Navigation
		onModuleChange,
		onSectionChange,

		// Collapse
		collapsible = false,
		collapsed = $bindable(false),
		collapseStorageKey = null,

		// Optional callbacks
		onHaptic,
		translateLabel,
		translateSectionLabel,
		filterSection,
		getBadgeCount,
		onModuleHover,

		// Snippet slots
		renderIcon,
		header,
		footer,

		// Styling
		class: sidebarClass = ''
	}: {
		modules: ModuleDefinition[];
		currentModule: string;
		currentSection: string;
		onModuleChange?: ((moduleId: string, targetSection?: string) => void | Promise<void>) | undefined;
		onSectionChange?: ((sectionId: string) => void) | undefined;
		collapsible?: boolean;
		collapsed?: boolean;
		collapseStorageKey?: string | null | undefined;
		onHaptic?: (() => void) | undefined;
		translateLabel?: ((moduleId: string) => string) | undefined;
		translateSectionLabel?: ((moduleId: string, sectionId: string, fallback: string) => string) | undefined;
		filterSection?: ((moduleId: string, sectionId: string) => boolean) | undefined;
		getBadgeCount?: ((moduleId: string, sectionId?: string) => number) | undefined;
		onModuleHover?: ((moduleId: string) => void) | undefined;
		renderIcon?: Snippet<[name: string, size: number]> | undefined;
		header?: Snippet<[collapsed: boolean]> | undefined;
		footer?: Snippet<[collapsed: boolean]> | undefined;
		class?: string;
	} = $props();

	// Filter modules to only main ones
	const mainModules = $derived(modules.filter((m) => m.isMain !== false));

	// Track which modules are expanded (initialized with current module)
	let expandedModules = $state<Set<string>>(new Set());

	// Ensure current module is always expanded
	$effect(() => {
		if (currentModule && !expandedModules.has(currentModule)) {
			expandedModules = new Set([...expandedModules, currentModule]);
		}
	});

	// Restore collapse state from localStorage on mount
	onMount(() => {
		if (collapsible && collapseStorageKey) {
			const stored = readCollapseState(collapseStorageKey);
			if (stored !== collapsed) {
				collapsed = stored;
			}
		}
	});

	// Persist collapse state changes
	$effect(() => {
		if (collapsible && collapseStorageKey) {
			writeCollapseState(collapseStorageKey, collapsed);
		}
	});

	function toggleModuleExpansion(moduleId: string) {
		const newExpanded = new Set(expandedModules);
		if (newExpanded.has(moduleId)) {
			newExpanded.delete(moduleId);
		} else {
			newExpanded.add(moduleId);
		}
		expandedModules = newExpanded;
	}

	function handleModuleTap(moduleId: string, hasSections: boolean) {
		if (!hasSections) {
			onModuleChange?.(moduleId);
		} else {
			toggleModuleExpansion(moduleId);
		}
	}

	function handleSectionTap(moduleId: string, section: Section) {
		if (section.disabled) return;

		// Switch to the section's module if not already on it
		if (moduleId !== currentModule) {
			onModuleChange?.(moduleId);
		}

		// Then switch to the section
		onSectionChange?.(section.id);

		// Ensure the module is expanded after navigation
		expandedModules = new Set([...expandedModules, moduleId]);
	}

	function handleCollapsedModuleClick(moduleId: string) {
		onHaptic?.();
		onModuleChange?.(moduleId);
	}

	function handleCollapsedTabClick(section: Section) {
		if (section.disabled) return;
		onHaptic?.();
		onSectionChange?.(section.id);
	}

	function handleModuleMouseEnter(moduleId: string) {
		onModuleHover?.(moduleId);
	}

	// Get sections for the active module in collapsed mode
	const activeModuleSections = $derived.by(() => {
		const active = modules.find((m) => m.id === currentModule);
		if (!active || active.sections.length === 0) return [];
		if (filterSection) {
			return active.sections.filter((s) => filterSection(active.id, s.id));
		}
		return active.sections;
	});

	const sidebarClasses = $derived(
		['sidebar', collapsed ? 'collapsed' : '', sidebarClass].filter(Boolean).join(' ')
	);
</script>

<nav class={sidebarClasses} aria-label="Sidebar navigation">
	<!-- Header slot -->
	{#if header}
		{@render header(collapsed)}
	{/if}

	<!-- Modules area -->
	<div class="sidebar-modules">
		{#if collapsed && collapsible}
			<!-- Collapsed activity bar -->
			{#each mainModules as module (module.id)}
				<CollapsedModuleButton
					{module}
					isActive={currentModule === module.id}
					badgeCount={getBadgeCount ? getBadgeCount(module.id) : 0}
					{renderIcon}
					onclick={() => handleCollapsedModuleClick(module.id)}
					onmouseenter={() => handleModuleMouseEnter(module.id)}
				/>

				<!-- Show tabs for active module -->
				{#if currentModule === module.id && activeModuleSections.length > 0}
					<div class="sidebar-collapsed-tabs">
						{#each activeModuleSections as section (section.id)}
							<CollapsedTabButton
								{section}
								isActive={currentSection === section.id}
								{renderIcon}
								onclick={() => handleCollapsedTabClick(section)}
							/>
						{/each}
					</div>
				{/if}
			{/each}
		{:else}
			<!-- Expanded mode with module groups -->
			{#each mainModules as module (module.id)}
				<ModuleGroup
					{module}
					isExpanded={expandedModules.has(module.id)}
					{currentModule}
					{currentSection}
					{renderIcon}
					{translateLabel}
					{translateSectionLabel}
					{filterSection}
					{getBadgeCount}
					onModuleTap={handleModuleTap}
					onSectionTap={handleSectionTap}
					{onHaptic}
					{onModuleHover}
				/>
			{/each}
		{/if}
	</div>

	<!-- Footer slot -->
	{#if footer}
		{@render footer(collapsed)}
	{/if}
</nav>
