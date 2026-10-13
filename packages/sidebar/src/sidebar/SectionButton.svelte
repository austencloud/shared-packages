<!-- Section Button Component -->
<!-- Individual section/tab button within a module -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Section } from '../types';
  import NotificationBadge from '../NotificationBadge.svelte';

  let {
    section,
    moduleId,
    isActive,
    isCollapsed = false,
    onClick,
    onContextMenu,
    badgeCount = 0,
    translateSectionLabel,
    renderIcon,
  } = $props<{
    section: Section;
    moduleId: string;
    isActive: boolean;
    isCollapsed?: boolean | undefined;
    onClick: (e: MouseEvent) => void;
    onContextMenu?: ((e: MouseEvent) => void) | undefined;
    badgeCount?: number | undefined;
    translateSectionLabel?: ((moduleId: string, sectionId: string, fallback: string) => string) | undefined;
    renderIcon?: Snippet<[name: string, size: number]> | undefined;
  }>();

  const label = $derived(
    translateSectionLabel?.(moduleId, section.id, section.label) ?? section.label
  );
  // A section with an href is a real link (crawlable, router-interceptable).
  const asLink = $derived(!!section.href && !section.disabled);
  // No icon: a plain text row of the expanded tree (the rail skips these).
  const labelOnly = $derived(!section.icon);
</script>

<svelte:element
  this={asLink ? 'a' : 'button'}
  role={asLink ? 'link' : 'button'}
  class="section-button"
  class:is-link={asLink}
  class:label-only={labelOnly}
  class:active={isActive}
  class:disabled={section.disabled}
  class:collapsed={isCollapsed}
  onclick={onClick}
  oncontextmenu={onContextMenu}
  disabled={asLink ? undefined : section.disabled}
  type={asLink ? undefined : 'button'}
  href={asLink ? section.href : undefined}
  download={asLink && section.download ? '' : undefined}
  aria-current={isActive && asLink ? 'page' : undefined}
  aria-label={labelOnly ? undefined : label}
  title={labelOnly ? label : undefined}
  style="--section-depth: {section.depth ?? 0}; --section-color: {section.color ||
    'var(--muted-foreground)'}; --section-gradient: {section.gradient ||
    section.color ||
    'var(--muted-foreground)'};"
>
  {#if section.icon}
    <div class="icon-wrapper">
      <span class="section-icon">
        {#if renderIcon}{@render renderIcon(section.icon, 22)}{:else}{@html section.icon}{/if}
      </span>
      {#if badgeCount > 0}
        <NotificationBadge count={badgeCount} />
      {/if}
    </div>
  {/if}
  <span class="section-label">{label}</span>
  {#if labelOnly && badgeCount > 0}
    <NotificationBadge count={badgeCount} />
  {/if}
</svelte:element>

<style>
  /* ============================================================================
     SECTION BUTTON - Refined Minimal Design
     ============================================================================ */
  /* Skeleton mirrors ModuleButton: a fixed 44px leading icon column pins the
     icon to a predictable x in BOTH rail and expanded states (unified tree).
     The rail<->expanded inset is a single transitioning padding-left on the
     parent .sections-list, which slides this whole button right; nothing here
     animates geometry. */
  .section-button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0;
    height: var(--min-touch-target);
    min-height: var(--min-touch-target);
    padding: 0 14px 0 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 10px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition:
      background-color var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1),
      border-color var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1),
      color var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1),
      transform var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    margin-bottom: 3px;
    overflow: hidden;
  }

  /* Link rows read exactly like button rows. */
  .section-button.is-link {
    box-sizing: border-box;
    text-decoration: none;
    font: inherit;
  }

  /* Depth indents a sub-row under the row above it (expanded tree only). */
  .section-button {
    padding-inline-start: calc(var(--section-depth, 0) * 16px);
  }

  /* Label-only rows have no icon column; a small lead inset keeps the text off
     the edge, and depth adds to it. The label truncates instead of wrapping so
     the row pitch never changes while the sidebar width animates. */
  .section-button.label-only {
    padding-inline-start: calc(12px + var(--section-depth, 0) * 16px);
  }

  .section-button.label-only .section-label {
    text-overflow: ellipsis;
  }

  .section-button.collapsed {
    padding: 0;
  }

  .section-button:hover:not(.disabled) {
    background: var(--theme-card-bg);
    color: var(--theme-text, var(--theme-text));
    transform: translateX(3px);
  }

  .section-button:active:not(.disabled) {
    transform: translateX(2px) scale(0.99);
    transition-duration: var(--duration-instant);
  }

  .section-button.active {
    color: var(--theme-text);
    background: color-mix(in srgb, var(--section-color) 12%, transparent);
    border-color: color-mix(in srgb, var(--section-color) 25%, transparent);
    box-shadow: 0 0 12px
      color-mix(in srgb, var(--section-color) 15%, transparent);
  }

  .section-button.disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .icon-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    flex-shrink: 0;
  }

  .section-icon {
    font-size: var(--font-size-base);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    transition: transform var(--duration-emphasis) cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .section-icon :global(i) {
    background: var(--section-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.3));
    transition: all var(--duration-emphasis) ease;
  }

  .section-button:not(.active) .section-icon :global(i) {
    opacity: 0.7;
  }

  .section-button:hover:not(.disabled) .section-icon {
    transform: scale(1.15);
  }

  .section-button:hover:not(.disabled) .section-icon :global(i) {
    opacity: 1;
    filter: drop-shadow(
      0 1px 4px color-mix(in srgb, var(--section-color) 30%, transparent)
    );
  }

  .section-button.active .section-icon :global(i) {
    opacity: 1;
    filter: drop-shadow(
        0 0 6px color-mix(in srgb, var(--section-color) 40%, transparent)
      )
      brightness(1.1);
  }

  .section-label {
    flex: 1;
    text-align: left;
    font-size: var(--font-size-compact);
    font-weight: 500;
    letter-spacing: -0.005em;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
    white-space: nowrap;
    overflow: hidden;
    /* Always mounted so it can MORPH, not mount/unmount. Rail zeroes opacity;
       expand fades it back in. */
    opacity: 1;
    transition: opacity var(--duration-normal) ease;
  }

  .section-button.collapsed .section-label {
    opacity: 0;
  }

  .section-button.active .section-label {
    font-weight: 600;
  }

  .section-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  @media (prefers-contrast: high) {
    .section-button.active {
      background: var(--theme-card-hover-bg);
      outline: 2px solid white;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .section-button,
    .section-button::before,
    .section-icon,
    .section-icon :global(i) {
      transition: none !important;
      animation: none !important;
    }
    .section-button:hover {
      transform: none;
    }
  }
</style>
