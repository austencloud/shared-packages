<!--
  Sidebar.svelte — hover-expand overlay rail orchestrator.

  A 64px icon rail that content reserves; on hover it floats out to the expanded
  width as an OVERLAY (no content reflow); a pin button locks it open (push
  layout). One morphing module/section tree in both states (no layout shift).

  Everything domain-specific is host-supplied through the seam: translateLabel /
  translateSectionLabel, onHaptic, filterSection, getBadgeCount, onModuleHover,
  and the brand / beforeTree / account / footer slots. Themed via --theme-* /
  --duration-* tokens (each var() carries an inline fallback).
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { ModuleDefinition, Section, SidebarProps } from './types';
  import { createHoverIntent } from './services/hover-intent';
  import { shouldStayOpen, isKeyboardFocus } from './services/overlay-hold';
  import { readPinState, writePinState } from './sidebar/pin-state';
  import SidebarBrand from './sidebar/SidebarBrand.svelte';
  import ModuleGroup from './sidebar/ModuleGroup.svelte';

  let {
    modules,
    currentModule,
    currentSection,

    onModuleChange,
    onSectionChange,
    onModuleContextMenu,
    onSectionContextMenu,
    onModuleHover,

    pinned = $bindable(false),
    pinStorageKey = null,
    railWidth = 64,
    expandedWidth = 220,
    hoverIntent: hoverIntentOptions,
    disableHoverExpand = false,
    holdOpen = false,
    onReservedWidthChange,

    onHaptic,
    translateLabel,
    translateSectionLabel,
    filterSection,
    getBadgeCount,

    homeHref = null,
    brandLead,
    brandRest,
    brand,

    renderIcon,
    beforeTree,
    account,
    footer,

    class: sidebarClass = '',
  }: SidebarProps = $props();

  // Rail (unpinned) vs pinned. hoverExpanded is a purely VISUAL flag that widens
  // the rail above content without touching the reserved width.
  const collapsed = $derived(!pinned);
  let hoverExpanded = $state(false);
  let pointerInside = $state(false);
  // KEYBOARD focus only. Click-focus does not hold the overlay open — see
  // isKeyboardFocus in services/overlay-hold.
  let keyboardFocusInside = $state(false);
  let hoverCapable = $state(false);
  const heldOpen = $derived(!!holdOpen);

  // Single arbiter for every close path, so none of them can be stricter than
  // the others and strand the overlay open.
  const stayOpen = $derived(
    shouldStayOpen({ pointerInside, keyboardFocusInside, heldOpen })
  );

  // What the user SEES (and therefore how the sidebar behaves).
  const visuallyExpanded = $derived(pinned || hoverExpanded);

  // Reserved width the host offsets content by (rail vs pinned). The hover
  // overlay floats above content, so this does NOT change on hover.
  const reservedWidth = $derived(pinned ? expandedWidth : railWidth);
  $effect(() => {
    onReservedWidthChange?.(reservedWidth);
  });

  // Ref for the pointerleave rect-guard + the stuck-open backstop.
  let sidebarElement = $state<HTMLElement | null>(null);

  // Expanded modules: only the current one, synced from currentModule.
  let expandedModules = $state<Set<string>>(new Set());
  $effect(() => {
    if (currentModule) {
      expandedModules = new Set([currentModule]);
    }
  });

  // Main modules: strict isMain when any module declares it (TKA), else all
  // modules (cirque, which may not flag isMain).
  const mainModules = $derived(
    modules.some((m: ModuleDefinition) => m.isMain === true)
      ? modules.filter((m: ModuleDefinition) => m.isMain === true)
      : modules
  );

  const hoverIntent = createHoverIntent({
    openDelay: hoverIntentOptions?.openDelay ?? 50,
    closeDelay: hoverIntentOptions?.closeDelay ?? 300,
    onOpen: () => {
      hoverExpanded = true;
    },
    onClose: () => {
      hoverExpanded = false;
    },
  });

  function handleSidebarPointerEnter() {
    pointerInside = true;
    if (!hoverCapable || !collapsed || disableHoverExpand) return;
    hoverIntent.pointerEnter();
  }

  function handleSidebarPointerLeave(e: PointerEvent) {
    // A navigation view-transition lifts a ::view-transition overlay over the
    // sidebar, firing a spurious pointerleave whose coords are still inside the
    // box. Ignore those so a tab click doesn't flicker the overlay shut.
    const el = sidebarElement;
    if (el) {
      const r = el.getBoundingClientRect();
      const stillInside =
        e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom;
      if (stillInside) return;
    }
    pointerInside = false;
    if (!hoverExpanded) {
      hoverIntent.cancel();
      return;
    }
    // A guard or a keyboard focus still holds it; the $effect below re-arms
    // close when the last holder clears.
    if (stayOpen) return;
    hoverIntent.pointerLeave();
  }

  function handleSidebarFocusIn(e: FocusEvent) {
    // Clicking a module/tab focuses its button. That focus must not hold the
    // overlay open — the pointer already governs the pointer case, and holding
    // on click-focus is what stranded the rail open after a tab click.
    if (!isKeyboardFocus(e.target)) return;
    keyboardFocusInside = true;
    if (!collapsed) return;
    hoverIntent.openNow(); // keyboard users get no intent delay
  }

  function handleSidebarFocusOut(e: FocusEvent) {
    const next = e.relatedTarget as Node | null;
    if (next && sidebarElement?.contains(next)) return;
    keyboardFocusInside = false;
    if (pointerInside || heldOpen) return;
    hoverIntent.closeNow();
  }

  function handleSidebarKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && hoverExpanded) {
      hoverIntent.closeNow();
    }
  }

  // When the last holder clears (guard closed, keyboard focus left, pointer
  // gone), start the close grace so the overlay doesn't hang open.
  $effect(() => {
    if (!stayOpen && hoverExpanded) {
      hoverIntent.pointerLeave();
    }
  });

  // Stuck-open backstop: if the pointer genuinely leaves while the view-
  // transition overlay covers the sidebar (the real leave was swallowed), the
  // covered nav never fires a second leave. While hover-expanded, track the
  // pointer globally and reconcile pointerInside from its true position.
  function reconcilePointerFromMove(e: PointerEvent) {
    const el = sidebarElement;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const inside =
      e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (inside === pointerInside) return;
    pointerInside = inside;
    if (inside) {
      hoverIntent.pointerEnter();
    } else if (!stayOpen) {
      hoverIntent.pointerLeave();
    }
  }

  $effect(() => {
    if (!hoverExpanded) return;
    window.addEventListener('pointermove', reconcilePointerFromMove, { passive: true });
    return () => window.removeEventListener('pointermove', reconcilePointerFromMove);
  });

  // Persist pin state (covers both the pin button and external bind:pinned).
  $effect(() => {
    if (pinStorageKey) writePinState(pinStorageKey, pinned);
  });

  function toggleModuleExpansion(moduleId: string) {
    const next = new Set(expandedModules);
    if (next.has(moduleId)) next.delete(moduleId);
    else next.add(moduleId);
    expandedModules = next;
  }

  function handleModuleTap(moduleId: string, isDisabled = false) {
    if (isDisabled) return;
    onHaptic?.();
    const moduleDefinition = modules.find((m: ModuleDefinition) => m.id === moduleId);
    const hasNoSections = !moduleDefinition?.sections?.length;
    // Rail or no sections → navigate. Expanded with sections → peek (toggle the
    // tab list); tabs are the navigators (navigating here would yank the overlay
    // shut mid-browse via a view transition).
    if (!visuallyExpanded || hasNoSections) {
      onModuleChange?.(moduleId);
      if (visuallyExpanded) toggleModuleExpansion(moduleId);
    } else {
      toggleModuleExpansion(moduleId);
    }
  }

  async function handleSectionTap(moduleId: string, section: Section) {
    if (section.disabled) return;
    onHaptic?.();
    if (moduleId !== currentModule) {
      await onModuleChange?.(moduleId, section.id);
    } else {
      onSectionChange?.(section.id);
    }
    expandedModules = new Set([...expandedModules, moduleId]);
  }

  function handleTogglePin() {
    onHaptic?.();
    const pinning = !pinned; // currently rail → pin it
    pinned = pinning;
    hoverIntent.cancel();
    // Pinning: expansion now comes from `pinned`. Unpinning under the cursor:
    // stay visually open until the pointer leaves (no snap-shut).
    hoverExpanded = pinning ? false : pointerInside;
  }

  function handleModuleContextMenu(e: MouseEvent, moduleId: string) {
    if (!onModuleContextMenu) return;
    e.preventDefault();
    onModuleContextMenu(moduleId, e);
  }

  function handleSectionContextMenu(e: MouseEvent, moduleId: string, section: Section) {
    if (!onSectionContextMenu) return;
    e.preventDefault();
    onSectionContextMenu(moduleId, section.id, e);
  }

  onMount(() => {
    // Seed pin state from storage.
    if (pinStorageKey) {
      const stored = readPinState(pinStorageKey, pinned);
      if (stored !== pinned) pinned = stored;
    }

    // Hover-expand only for real pointers; convertibles can flip mid-session.
    const hoverMq = window.matchMedia('(hover: hover) and (pointer: fine)');
    hoverCapable = hoverMq.matches;
    const onHoverMqChange = (ev: MediaQueryListEvent) => {
      hoverCapable = ev.matches;
      if (!ev.matches) hoverIntent.closeNow();
    };
    hoverMq.addEventListener('change', onHoverMqChange);

    return () => {
      hoverMq.removeEventListener('change', onHoverMqChange);
      hoverIntent.cancel();
    };
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<nav
  class="ac-sidebar {sidebarClass}"
  class:collapsed={!visuallyExpanded}
  class:hover-expanded={hoverExpanded && collapsed}
  bind:this={sidebarElement}
  style="--sidebar-rail-width: {railWidth}px; --sidebar-expanded-width: {expandedWidth}px; --sidebar-reserved-width: {reservedWidth}px; view-transition-name: sidebar;"
  aria-label="Main navigation"
  onpointerenter={handleSidebarPointerEnter}
  onpointerleave={handleSidebarPointerLeave}
  onfocusin={handleSidebarFocusIn}
  onfocusout={handleSidebarFocusOut}
  onkeydown={handleSidebarKeydown}
>
  <SidebarBrand
    mode={!visuallyExpanded ? 'rail' : collapsed ? 'hover' : 'pinned'}
    onToggleCollapse={handleTogglePin}
    {homeHref}
    {brandLead}
    {brandRest}
    {brand}
  />

  <div class="navigation-content" class:tabs-mode={!visuallyExpanded}>
    {#if beforeTree}
      {@render beforeTree(visuallyExpanded)}
    {/if}

    <div class="modules-content">
      <!-- One morphing tree for BOTH rail and expanded. Each ModuleGroup renders
           its own tabs and morphs them on isCollapsed — no separate rail. -->
      {#each mainModules as module (module.id)}
        <ModuleGroup
          {module}
          {currentModule}
          {currentSection}
          isExpanded={expandedModules.has(module.id)}
          isCollapsed={!visuallyExpanded}
          moduleColor={module.color || '#a855f7'}
          onModuleClick={handleModuleTap}
          onSectionClick={handleSectionTap}
          onModuleContextMenu={onModuleContextMenu ? handleModuleContextMenu : undefined}
          onSectionContextMenu={onSectionContextMenu ? handleSectionContextMenu : undefined}
          {filterSection}
          {getBadgeCount}
          {translateLabel}
          {translateSectionLabel}
          {onModuleHover}
          {renderIcon}
        />
      {/each}
    </div>
  </div>

  {#if account}
    {@render account(visuallyExpanded)}
  {/if}

  {#if footer}
    {@render footer(visuallyExpanded)}
  {/if}
</nav>

<style>
  /* ============================================================================
     HOVER-EXPAND OVERLAY SIDEBAR
     ============================================================================ */
  .ac-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    /* Visual width is driven by the .collapsed class (absent = expanded). The
       host offsets content by --sidebar-reserved-width instead, so the hover
       overlay floats above content without reflowing it. */
    width: var(--sidebar-expanded-width, 220px);
    display: flex;
    flex-direction: column;
    background: var(--theme-panel-bg, rgba(10, 10, 15, 0.95));
    backdrop-filter: blur(40px) saturate(180%);
    -webkit-backdrop-filter: blur(40px) saturate(180%);
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    z-index: var(--z-sidebar, 200);
    overflow: hidden;
    transition:
      width var(--duration-emphasis, 280ms) var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)),
      box-shadow var(--duration-emphasis, 280ms) var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
    padding-left: env(safe-area-inset-left);
  }

  .ac-sidebar.collapsed {
    width: var(--sidebar-rail-width, 64px);
  }

  /* Hover-expanded overlay (rail mode): floats above content, so it gets
     elevation. Width comes from the base rule (the collapsed class is absent). */
  .ac-sidebar.hover-expanded {
    box-shadow: 24px 0 48px -12px var(--theme-shadow, rgba(0, 0, 0, 0.45));
    border-right-color: var(--theme-stroke-strong, var(--theme-stroke, rgba(255, 255, 255, 0.16)));
  }

  .navigation-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 16px 8px;
    position: relative;
    /* Width tracks the animating nav; the fixed 44px icon columns left-anchor
       the icons at x=32 regardless of content width — no pin needed. */
    container-type: inline-size;
    container-name: nav-content;
  }

  /* Rail mode. Width is NOT pinned — the box flex-fills the nav so it tracks the
     animating width in both directions (the morph stays smooth on collapse). */
  .navigation-content.tabs-mode {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 8px;
    /* Hide the scrollbar in rail mode; a visible bar eats 10px of the 64px rail
       and shifts the centered icon column off the x=32 anchor. */
    scrollbar-width: none;
  }

  .navigation-content.tabs-mode::-webkit-scrollbar {
    display: none;
  }

  .modules-content {
    width: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    .ac-sidebar,
    .ac-sidebar * {
      transition: none !important;
      animation: none !important;
    }
  }

  @media (prefers-contrast: high) {
    .ac-sidebar {
      background: rgba(0, 0, 0, 0.95);
      border-right: 2px solid white;
    }
  }
</style>
