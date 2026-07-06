<!-- Module Group Component -->
<!-- Combines a module button with its expandable sections list -->
<script lang="ts">
  import { tick } from 'svelte';
  import type { Snippet } from 'svelte';
  import type { ModuleDefinition, Section } from '../types';
  import ModuleButton from './ModuleButton.svelte';
  import SectionsList from './SectionsList.svelte';

  let {
    module,
    currentModule,
    currentSection,
    isExpanded,
    isCollapsed = false,
    moduleColor,
    onModuleClick,
    onSectionClick,
    onModuleContextMenu,
    onSectionContextMenu,
    celebrateAppearance = false,
    forceActiveStyle = false,
    filterSection,
    getBadgeCount,
    translateLabel,
    translateSectionLabel,
    onModuleHover,
    renderIcon,
  } = $props<{
    module: ModuleDefinition;
    currentModule: string;
    currentSection: string;
    isExpanded: boolean;
    isCollapsed?: boolean | undefined;
    moduleColor?: string | undefined;
    onModuleClick: (moduleId: string, isDisabled: boolean) => void;
    onSectionClick: (moduleId: string, section: Section) => void;
    onModuleContextMenu?: ((e: MouseEvent, moduleId: string) => void) | undefined;
    onSectionContextMenu?: ((e: MouseEvent, moduleId: string, section: Section) => void) | undefined;
    celebrateAppearance?: boolean | undefined;
    forceActiveStyle?: boolean | undefined;
    filterSection?: ((moduleId: string, sectionId: string) => boolean) | undefined;
    getBadgeCount?: ((moduleId: string, sectionId?: string) => number) | undefined;
    translateLabel?: ((moduleId: string) => string) | undefined;
    translateSectionLabel?: ((moduleId: string, sectionId: string, fallback: string) => string) | undefined;
    onModuleHover?: ((moduleId: string) => void) | undefined;
    renderIcon?: Snippet<[name: string, size: number]> | undefined;
  }>();

  let moduleGroupElement = $state<HTMLDivElement | null>(null);

  const isActive = $derived(currentModule === module.id);
  const isDisabled = $derived(module.disabled ?? false);

  // Host-supplied visibility predicate (access tier / feature flags).
  const filteredSections = $derived.by(() =>
    filterSection
      ? module.sections.filter((s: Section) => filterSection(module.id, s.id))
      : module.sections
  );

  const hasSections = $derived(isExpanded && filteredSections.length > 0);
  const showActiveStyle = $derived(hasSections || forceActiveStyle);

  // Module-level badge (shown on the rail icon) + per-section badge map.
  const moduleBadge = $derived(getBadgeCount ? getBadgeCount(module.id) : 0);
  const sectionBadgeCounts = $derived.by((): Record<string, number> => {
    if (!getBadgeCount) return {};
    const map: Record<string, number> = {};
    for (const s of filteredSections) {
      const n = getBadgeCount(module.id, s.id);
      if (n > 0) map[s.id] = n;
    }
    return map;
  });

  // Scroll the expanded module into view when it expands.
  $effect(() => {
    if (!isExpanded || !hasSections || isCollapsed || !moduleGroupElement) return;
    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    tick().then(() => {
      if (cancelled) return;
      scrollTimer = setTimeout(() => {
        moduleGroupElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    });
    return () => {
      cancelled = true;
      if (scrollTimer !== undefined) clearTimeout(scrollTimer);
    };
  });
</script>

<div
  bind:this={moduleGroupElement}
  class="module-group"
  class:active={isActive}
  class:has-sections={showActiveStyle}
  style="--module-color: {moduleColor || '#a855f7'};"
>
  <ModuleButton
    {module}
    {isActive}
    {isExpanded}
    {isCollapsed}
    {hasSections}
    insideGlassContainer={showActiveStyle}
    badgeCount={moduleBadge}
    {translateLabel}
    {onModuleHover}
    {renderIcon}
    onClick={() => onModuleClick(module.id, isDisabled)}
    onContextMenu={onModuleContextMenu ? (e) => onModuleContextMenu(e, module.id) : undefined}
  />

  <!-- Sections/tabs, rendered in BOTH rail and expanded states. SectionsList
       morphs its tabs on isCollapsed instead of swapping to a separate rail. -->
  {#if isExpanded && filteredSections.length > 0}
    <SectionsList
      sections={filteredSections}
      groups={module.groups}
      {currentSection}
      moduleId={module.id}
      {isActive}
      {isCollapsed}
      {onSectionClick}
      {onSectionContextMenu}
      {celebrateAppearance}
      badgeCounts={sectionBadgeCounts}
      {translateSectionLabel}
      {renderIcon}
    />
  {/if}
</div>

<style>
  /* ============================================================================
     MODULE GROUP
     ============================================================================ */
  .module-group {
    /* One unified tree renders this in both rail and expanded states, so these
       metrics ARE the module's y-rhythm. 2px horizontal padding keeps the
       ModuleButton icon center at x=32px. */
    margin-bottom: 4px;
    border-radius: 12px;
    padding: 4px 2px;
    /* Visuals only — geometry must snap so the stack doesn't spring. */
    transition:
      background-color var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1),
      border-color var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Active module with expanded sections gets a unified glass background. */
  .module-group.active.has-sections {
    background: color-mix(in srgb, var(--module-color) 12%, rgba(0, 0, 0, 0.3));
    border: 1px solid color-mix(in srgb, var(--module-color) 20%, transparent);
    padding: 8px 2px;
    margin-bottom: 10px;
  }

  .module-group:last-child {
    margin-bottom: 0;
  }
</style>
