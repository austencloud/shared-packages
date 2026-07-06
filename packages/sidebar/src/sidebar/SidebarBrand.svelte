<!-- Sidebar Brand -->
<!-- Brand wordmark doubles as a HOME link (when homeHref set); a separate pin
     button locks/unlocks. Ported from TKA's SidebarHeader — the "lead" mark
     stays solid and slides while the "rest" reveals via a 0fr->1fr grid column
     and fades. The pin is package-owned and lives OUTSIDE the brand override, so
     a full-override brand (e.g. a badge) still gets the pin. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  // rail: compact lead mark (not hovered, not pinned)
  // hover: overlay-expanded — the pin button PINS the sidebar open
  // pinned: classic push layout — the pin button collapses back to the rail
  let { mode, onToggleCollapse, homeHref = null, brandLead, brandRest, brand } = $props<{
    mode: 'rail' | 'hover' | 'pinned';
    onToggleCollapse: () => void;
    homeHref?: string | null | undefined;
    brandLead?: Snippet | string | undefined;
    brandRest?: Snippet | string | undefined;
    brand?: Snippet<[expanded: boolean]> | undefined;
  }>();

  const expanded = $derived(mode !== 'rail');
  const pinLabel = $derived(mode === 'pinned' ? 'Collapse sidebar to rail' : 'Pin sidebar open');
  const isLeadString = $derived(typeof brandLead === 'string');
  const isRestString = $derived(typeof brandRest === 'string');
</script>

<div class="sidebar-header">
  <svelte:element
    this={homeHref ? 'a' : 'div'}
    class="brand-home"
    class:expanded
    href={homeHref ?? undefined}
    aria-label={homeHref ? 'Go to home' : undefined}
  >
    {#if brand}
      {@render brand(expanded)}
    {:else}
      <span class="brand" class:expanded>
        {#if isLeadString}<span class="brand-tka">{brandLead}</span>{:else if brandLead}{@render brandLead()}{/if}<span class="brand-rest"><span class="brand-rest-text">{#if isRestString}{brandRest}{:else if brandRest}{@render brandRest()}{/if}</span></span>
      </span>
    {/if}
  </svelte:element>

  <!-- Pin/lock: the only way to pin now that the brand navigates home. Always
       mounted and absolutely placed, so revealing it never shifts the brand. -->
  <button
    class="pin-toggle"
    class:visible={expanded}
    class:pinned={mode === 'pinned'}
    onclick={onToggleCollapse}
    aria-label={pinLabel}
    title={pinLabel}
    tabindex={expanded ? 0 : -1}
    aria-hidden={!expanded}
  >
    <i class="fas {mode === 'pinned' ? 'fa-chevron-left' : 'fa-thumbtack'}" aria-hidden="true"></i>
  </button>
</div>

<style>
  .sidebar-header {
    position: relative;
    border-bottom: 1px solid var(--theme-stroke);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent) 10%, transparent) 0%,
      color-mix(in srgb, var(--theme-accent-strong) 8%, transparent) 50%,
      rgba(236, 72, 153, 0.06) 100%
    );
    display: flex;
    flex-direction: column;
  }

  .sidebar-header::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(in srgb, var(--theme-accent) 40%, transparent),
      color-mix(in srgb, var(--theme-accent-strong) 40%, transparent),
      transparent
    );
  }

  /* Brand = home link. Fixed 44px box so the lead<->lead+rest change never
     alters the header height. Centered so the wordmark balances in the expanded
     panel AND the lead mark sits on the x=32 rail anchor when collapsed — which
     is what lets it slide. */
  .brand-home {
    width: 100%;
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 14px;
    color: var(--theme-text);
    text-decoration: none;
    cursor: pointer;
    overflow: hidden;
    transition:
      background var(--duration-normal) ease,
      padding var(--duration-emphasis)
        var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
  }

  /* Expanded reserves a right gutter so the centered wordmark can't slide under
     the absolute pin button (right:12 + 28px wide). Animates in lockstep with
     the reveal, so the wordmark eases left as the rest wipes in. */
  .brand-home.expanded {
    padding-right: 48px;
  }

  .brand-home:hover {
    background: color-mix(in srgb, var(--theme-accent) 8%, transparent);
  }

  .brand-home:active {
    background: color-mix(in srgb, var(--theme-accent) 12%, transparent);
  }

  .brand-home:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: -2px;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
    /* One typographic treatment for BOTH words — same size/weight/gradient, so
       nothing changes font mid-transition. */
    font-size: 1.05rem;
    font-weight: 800;
    letter-spacing: 0.02em;
    background: linear-gradient(
      135deg,
      var(--theme-text) 0%,
      color-mix(in srgb, var(--theme-accent) 60%, var(--theme-text)) 100%
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* The "rest" sits in a grid column that animates 0fr -> 1fr: a content-width
     reveal, no measured widths. overflow:hidden on the item wipes it; opacity
     fades it. The lead is never faded — it just re-centers as the column grows. */
  .brand-rest {
    display: inline-grid;
    grid-template-columns: 0fr;
    transition: grid-template-columns var(--duration-emphasis)
      var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
  }

  .brand.expanded .brand-rest {
    grid-template-columns: 1fr;
  }

  .brand-rest-text {
    min-width: 0;
    overflow: hidden;
    opacity: 0;
    /* pre preserves an author-supplied leading space in a string brandRest
       (e.g. " Composer") that inline layout would otherwise trim — the
       generalized equivalent of the old hardcoded &nbsp;. */
    white-space: pre;
    transition: opacity var(--duration-normal) ease;
  }

  .brand.expanded .brand-rest-text {
    opacity: 1;
  }

  /* Pin/lock button — absolute so it never participates in the brand's layout.
     Hidden and untabbable in the rail; revealed in hover/pinned. */
  .pin-toggle {
    position: absolute;
    top: 50%;
    right: 12px;
    transform: translateY(-50%);
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
    transition:
      opacity var(--duration-normal) ease,
      background var(--duration-normal) ease,
      color var(--duration-normal) ease;
  }

  .pin-toggle.visible {
    opacity: 0.7;
    pointer-events: auto;
  }

  .pin-toggle.visible:hover {
    opacity: 1;
    background: color-mix(in srgb, var(--theme-accent) 12%, transparent);
    color: var(--theme-text);
  }

  /* Pinned chevron reads as the active/locked state — full strength, accent. */
  .pin-toggle.pinned {
    opacity: 0.9;
    color: var(--theme-accent);
  }

  .pin-toggle:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: 1px;
  }

  @media (prefers-reduced-motion: reduce) {
    .brand-home,
    .brand-rest,
    .brand-rest-text,
    .pin-toggle {
      transition: none !important;
    }
  }
</style>
