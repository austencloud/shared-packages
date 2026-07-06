<!-- Module Button Component -->
<!-- Button for a module that can expand/collapse to show sections -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ModuleDefinition } from '../types';
  import NotificationBadge from '../NotificationBadge.svelte';

  let {
    module,
    isActive,
    isExpanded,
    isCollapsed,
    onClick,
    onContextMenu,
    hasSections = false,
    insideGlassContainer = false,
    badgeCount = 0,
    translateLabel,
    onModuleHover,
    renderIcon,
  } = $props<{
    module: ModuleDefinition;
    isActive: boolean;
    isExpanded: boolean;
    isCollapsed: boolean;
    onClick: () => void;
    onContextMenu?: ((e: MouseEvent) => void) | undefined;
    hasSections?: boolean | undefined;
    insideGlassContainer?: boolean | undefined;
    badgeCount?: number | undefined;
    translateLabel?: ((moduleId: string) => string) | undefined;
    onModuleHover?: ((moduleId: string) => void) | undefined;
    renderIcon?: Snippet<[name: string, size: number]> | undefined;
  }>();

  const isDisabled = $derived(module.disabled ?? false);
  const label = $derived(translateLabel?.(module.id) ?? module.label);

  // Haptics are owned by the orchestrator's tap handlers (single fire per
  // action), so this button just forwards the click.
  function handleMouseEnter() {
    if (!isActive && !isDisabled) {
      onModuleHover?.(module.id);
    }
  }
</script>

<button
  class="module-button"
  class:active={isActive}
  class:expanded={isExpanded}
  class:disabled={isDisabled}
  class:sidebar-collapsed={isCollapsed}
  class:has-sections={hasSections}
  class:inside-glass={insideGlassContainer}
  data-tour-module={module.id}
  onclick={onClick}
  oncontextmenu={onContextMenu}
  onmouseenter={handleMouseEnter}
  onfocus={handleMouseEnter}
  aria-label={label}
  aria-expanded={isExpanded}
  aria-controls="module-sections-{module.id}"
  aria-current={isActive ? 'page' : undefined}
  aria-disabled={isDisabled}
  disabled={isDisabled}
  style="--module-color: {module.color || 'var(--theme-accent)'};"
>
  <div class="icon-wrapper">
    <span class="module-icon">
      {#if renderIcon}{@render renderIcon(module.icon, 20)}{:else}{@html module.icon}{/if}
    </span>

    {#if !isExpanded && badgeCount > 0}
      <NotificationBadge count={badgeCount} />
    {/if}
  </div>
  {#if !isCollapsed}
    <span class="module-label">{label}</span>
    {#if isDisabled && module.disabledMessage}
      <span class="disabled-badge">{module.disabledMessage}</span>
    {:else if !isExpanded && hasSections}
      <!-- Only show chevron when collapsed AND has sections to expand -->
      <span class="expand-icon">
        <i class="fas fa-chevron-right" aria-hidden="true"></i>
      </span>
    {/if}
  {/if}
</button>

<style>
  /* ============================================================================
     MODULE BUTTON - Refined Minimal Design
     ============================================================================ */
  .module-button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0;
    /* Fixed 44px height so the expanded row is the SAME height as the rail's
       44px icon button — otherwise the two states have different per-module
       pitch and modules jump vertically on the swap. */
    height: var(--min-touch-target);
    min-height: var(--min-touch-target);
    /* Zero left padding: the fixed 44px icon column below centers the icon at
       x=32px from the sidebar edge — the same center in rail and expanded. */
    padding: 0 14px 0 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 12px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    /* Transition visuals + intended transforms only, never layout geometry —
       geometry snaps so the icon column never springs on the morph. */
    transition:
      background-color var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1),
      border-color var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1),
      color var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1),
      transform var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
  }

  /* Rail: keep the icon LEFT-anchored in its fixed 44px column so on collapse
     the width animates 200->44 while the icon center holds x=32. */
  .module-button.sidebar-collapsed {
    padding: 0;
  }

  /* Shimmer effect layer - subtle */
  .module-button::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      135deg,
      transparent 40%,
      var(--theme-card-bg, var(--theme-card-bg)) 50%,
      transparent 60%
    );
    opacity: 0;
    transition: opacity var(--duration-normal) ease;
    pointer-events: none;
  }

  .module-button:hover::before {
    opacity: 1;
    animation: shimmer 1.2s ease-in-out;
  }

  @keyframes shimmer {
    0% {
      transform: translateX(-100%) translateY(-100%);
    }
    100% {
      transform: translateX(100%) translateY(100%);
    }
  }

  .module-button:hover {
    color: var(--theme-text);
    background: var(--theme-card-bg);
    border-color: var(--theme-stroke);
    transform: translateX(3px);
  }

  .module-button:active {
    transform: translateX(2px) scale(0.99);
    transition-duration: var(--duration-instant);
  }

  /* Expanded state - blends with surrounding panel, acts as a collapsible
     group header. Still clickable: click tucks the tab list away. */
  .module-button.expanded {
    color: var(--theme-text);
    background: transparent;
    border-color: transparent;
  }

  .module-button.expanded:hover {
    transform: none;
    background: var(--theme-card-bg);
  }

  .module-button.expanded::before {
    display: none;
  }

  /* Active module indicator - glass effect with module color */
  .module-button.active {
    color: var(--theme-text);
    background: color-mix(
      in srgb,
      var(--module-color) 15%,
      rgba(0, 0, 0, 0.25)
    );
    border-color: color-mix(in srgb, var(--module-color) 35%, transparent);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--module-color) 20%, transparent) inset,
      0 2px 12px color-mix(in srgb, var(--module-color) 18%, transparent);
  }

  .module-button.active.inside-glass {
    background: transparent;
    border-color: transparent;
    box-shadow: none;
  }

  .module-button.active.expanded {
    background: transparent;
    border-color: transparent;
  }

  .module-button.active.expanded:hover {
    background: var(--theme-card-bg);
  }

  .module-button.active::after {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 50%;
    border-radius: 0 3px 3px 0;
    background: linear-gradient(
      180deg,
      var(--module-color, var(--theme-accent)),
      color-mix(
        in srgb,
        var(--module-color, var(--theme-accent)) 50%,
        transparent
      )
    );
  }

  .module-button.active.expanded::after {
    display: none;
  }

  .module-button.sidebar-collapsed.active::after {
    left: 50%;
    transform: translate(-50%, -50%);
    width: 50%;
    height: 3px;
    border-radius: 3px;
    background: linear-gradient(
      90deg,
      color-mix(
        in srgb,
        var(--module-color, var(--theme-accent)) 50%,
        transparent
      ),
      var(--module-color, var(--theme-accent)),
      color-mix(
        in srgb,
        var(--module-color, var(--theme-accent)) 50%,
        transparent
      )
    );
  }

  /* Icon wrapper - fixed 44px column matches the rail's button width so icon
     centers align across the morph. */
  .icon-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    flex-shrink: 0;
  }

  .module-icon {
    font-size: var(--font-size-xl);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    /* transform ONLY — the spring curve is for the hover scale(1.08) pop;
       geometry must snap, not spring. */
    transition: transform var(--duration-emphasis) cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .module-button:hover .module-icon {
    transform: scale(1.08);
  }

  .module-button.active .module-icon {
    filter: drop-shadow(0 1px 3px rgba(255, 255, 255, 0.15));
  }

  .module-label {
    flex: 1;
    text-align: left;
    font-size: var(--font-size-sm);
    font-weight: 600;
    letter-spacing: -0.01em;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    animation: label-fade-in var(--duration-normal) ease-out var(--duration-fast) both;
  }

  @keyframes label-fade-in {
    from {
      opacity: 0;
      transform: translateX(-4px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .expand-icon {
    font-size: var(--font-size-compact);
    opacity: 0.5;
    transition: all var(--duration-normal) ease;
  }

  .module-button.expanded .expand-icon {
    opacity: 0.8;
  }

  .module-button:hover .expand-icon {
    opacity: 1;
    transform: translateX(2px);
  }

  /* Disabled module styles */
  .module-button.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .module-button.disabled:hover {
    transform: none;
    color: var(--theme-text-dim, var(--theme-text-dim));
    background: var(--theme-card-bg);
    box-shadow: none;
  }

  .module-button.disabled::before {
    display: none;
  }

  .disabled-badge {
    font-size: var(--font-size-compact);
    font-weight: 700;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 6px;
    background: var(--theme-card-hover-bg, var(--theme-card-bg));
    color: var(--theme-text-dim, var(--theme-text-dim));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    letter-spacing: 0.5px;
  }

  .module-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .module-button,
    .module-button::before,
    .module-icon,
    .expand-icon {
      transition: none !important;
      animation: none !important;
    }
    .module-button:hover {
      transform: none;
    }
  }
</style>
