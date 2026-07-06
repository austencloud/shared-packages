<!-- SidebarAccount: clickable account identity row that morphs circle<->row.
     Ported from TKA's AccountRow. Auth + avatar are host concerns: pass
     isAuthenticated, displayName, and an `avatar` snippet (the host renders its
     own photo/fallback). Drop it into the Sidebar's `account` snippet. -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    variant = 'expanded',
    isAuthenticated = false,
    displayName = 'Account',
    avatar,
    onclick,
    onHaptic,
  } = $props<{
    variant?: 'expanded' | 'collapsed' | undefined;
    isAuthenticated?: boolean | undefined;
    displayName?: string | undefined;
    avatar?: Snippet | undefined;
    onclick?: (() => void) | undefined;
    onHaptic?: (() => void) | undefined;
  }>();

  function handleClick() {
    onHaptic?.();
    onclick?.();
  }
</script>

<button
  class="account-row"
  class:collapsed={variant === 'collapsed'}
  onclick={handleClick}
  aria-label={isAuthenticated ? 'Account menu' : 'Sign in'}
  aria-haspopup={isAuthenticated ? 'menu' : undefined}
>
  <span class="avatar-col">
    {#if avatar}
      {@render avatar()}
    {:else}
      <div class="avatar-guest">
        <i class="fas fa-user-plus" aria-hidden="true"></i>
      </div>
    {/if}
  </span>

  {#if variant !== 'collapsed'}
    <span class="account-label">{isAuthenticated ? displayName : 'Sign in'}</span>
    {#if isAuthenticated}
      <i class="fas fa-chevron-up chevron" aria-hidden="true"></i>
    {/if}
  {/if}
</button>

<style>
  .account-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    color: var(--theme-text-dim);
    cursor: pointer;
    /* Visuals morph, layout geometry snaps. The rail->expanded swap flips this
       button between a 44px circle and a full-width row. Width/padding/height
       SNAP; border-radius is paint-only, so it IS morphed: the corner rounding
       eases 22px<->12px so the circle<->rounded-rect change animates. */
    transition:
      background var(--duration-normal) ease,
      border-color var(--duration-normal) ease,
      color var(--duration-normal) ease,
      border-radius var(--duration-emphasis) var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
    font-size: var(--font-size-sm);
    font-weight: 500;
  }

  .account-row:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .account-row:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent) 70%, transparent);
    outline-offset: 2px;
  }

  /* Expanded: same 44px row height as the rail's circle button so the footer's
     total height never changes across the tree swap (no vertical layout shift).
     The 44px avatar column centers the avatar on the rail's icon anchor. */
  .account-row:not(.collapsed) {
    height: var(--min-touch-target);
    gap: 0;
    padding: 0 12px 0 0;
  }

  /* 44px leading column in BOTH states pins the avatar's center on the rail's
     icon anchor — no on/off-hover jiggle. */
  .avatar-col {
    width: 44px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .account-row.collapsed {
    width: var(--min-touch-target, 50px);
    height: var(--min-touch-target, 50px);
    padding: 0;
    /* Half-height radius = a perfect circle at 44x44, but in px so it
       interpolates cleanly to the expanded 12px (a % start would blend as a
       stadium against the snapped 200px width). */
    border-radius: calc(var(--min-touch-target, 50px) / 2);
  }

  /* Guest fallback avatar (authenticated users pass an `avatar` snippet). */
  .avatar-guest {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    color: var(--theme-accent);
    font-size: var(--font-size-sm, 14px);
  }

  .account-label {
    flex: 1;
    text-align: left;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    animation: label-fade-in var(--duration-normal) ease-out var(--duration-fast) both;
  }

  .chevron {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.5;
    transition: opacity var(--duration-normal) ease;
  }

  .account-row:hover .chevron {
    opacity: 0.8;
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

  @media (prefers-reduced-motion: reduce) {
    .account-row,
    .chevron {
      transition: none !important;
    }
    .account-label {
      animation: none;
    }
  }

  @media (prefers-contrast: high) {
    .account-row {
      border: 2px solid white;
    }
  }
</style>
