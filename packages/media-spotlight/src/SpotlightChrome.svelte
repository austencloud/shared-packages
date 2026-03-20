<!--
  SpotlightChrome.svelte - Auto-Hiding UI Overlay

  Contains the close button, navigation arrows, counter, and slots for custom content.
-->
<script lang="ts">
  import type { MediaItem } from './types.js';

  interface Navigation {
    next: () => void;
    prev: () => void;
    close: () => void;
    hasNext: boolean;
    hasPrev: boolean;
    currentIndex: number;
    totalCount: number;
  }

  interface Props {
    visible: boolean;
    navigation: Navigation;
    showArrows?: boolean;
    showClose?: boolean;
    item: MediaItem;
    panelOpen?: boolean;
    actionsSlot?: import('svelte').Snippet;
    bottomSlot?: import('svelte').Snippet;
    hintsSlot?: import('svelte').Snippet;
  }

  let {
    visible,
    navigation,
    showArrows = true,
    showClose = true,
    item,
    panelOpen = false,
    actionsSlot,
    bottomSlot,
    hintsSlot,
  }: Props = $props();

  const counter = $derived(`${navigation.currentIndex + 1} / ${navigation.totalCount}`);
</script>

<div
  class="spotlight-chrome"
  class:visible
  class:panel-open={panelOpen}
  role="toolbar"
  aria-label="Media controls"
>
  <!-- Top bar -->
  <div class="chrome-top">
    <div class="chrome-top-left">
      <span class="counter" aria-live="polite">{counter}</span>

      {#if item.needsEditing}
        <span class="needs-editing-badge">Needs Editing</span>
      {/if}
    </div>

    <div class="chrome-top-right">
      {#if actionsSlot}
        {@render actionsSlot()}
      {/if}

      {#if showClose}
        <button
          class="close-button"
          onclick={navigation.close}
          aria-label="Close viewer"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
            />
          </svg>
        </button>
      {/if}
    </div>
  </div>

  <!-- Side arrows -->
  {#if showArrows && navigation.totalCount > 1}
    <button
      class="nav-arrow nav-arrow-prev"
      onclick={navigation.prev}
      disabled={!navigation.hasPrev}
      aria-label="Previous"
    >
      <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
        <path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
      </svg>
    </button>

    <button
      class="nav-arrow nav-arrow-next"
      onclick={navigation.next}
      disabled={!navigation.hasNext}
      aria-label="Next"
    >
      <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
        <path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
      </svg>
    </button>
  {/if}

  <!-- Bottom bar -->
  <div class="chrome-bottom">
    {#if bottomSlot}
      {@render bottomSlot()}
    {/if}
  </div>

  <!-- Keyboard hints -->
  {#if hintsSlot}
    <div class="chrome-hints">
      {@render hintsSlot()}
    </div>
  {/if}
</div>

<style>
  .spotlight-chrome {
    position: absolute;
    inset: 0;
    z-index: var(--spotlight-z-chrome, 1002);
    pointer-events: none;
    opacity: 0;
    transition: opacity var(--spotlight-duration-out, 250ms) var(--spotlight-ease-out, cubic-bezier(0.16, 1, 0.3, 1));
  }

  .spotlight-chrome.visible {
    opacity: 1;
  }

  .spotlight-chrome.visible .close-button,
  .spotlight-chrome.visible .nav-arrow,
  .spotlight-chrome.visible .chrome-bottom,
  .spotlight-chrome.visible .chrome-top-right {
    pointer-events: auto;
  }

  /* Top bar */
  .chrome-top {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: var(--spotlight-chrome-padding, 16px);
    padding-top: calc(var(--spotlight-chrome-padding, 16px) + var(--spotlight-safe-area-top, 0px));
    background: linear-gradient(rgba(0, 0, 0, 0.5), transparent);
    transition: right 250ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .chrome-top-left,
  .chrome-top-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .counter {
    background: var(--spotlight-counter-bg, rgba(0, 0, 0, 0.4));
    color: var(--spotlight-counter-color, white);
    padding: 6px 12px;
    border-radius: 16px;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }

  .needs-editing-badge {
    background: var(--spotlight-needs-editing-bg, rgba(245, 158, 11, 0.2));
    border: 1px solid var(--spotlight-needs-editing-border, rgba(245, 158, 11, 0.4));
    color: var(--spotlight-needs-editing-color, rgb(245, 158, 11));
    padding: 6px 12px;
    border-radius: 16px;
    font-size: 14px;
  }

  .close-button {
    width: var(--spotlight-close-size, 48px);
    height: var(--spotlight-close-size, 48px);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--spotlight-close-bg, rgba(0, 0, 0, 0.4));
    border: none;
    border-radius: 50%;
    color: var(--spotlight-close-color, white);
    cursor: pointer;
    transition: background 150ms ease-out;
  }

  .close-button:hover {
    background: rgba(0, 0, 0, 0.6);
  }

  /* Navigation arrows */
  .nav-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: var(--spotlight-arrow-size, 64px);
    height: var(--spotlight-arrow-size, 64px);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--spotlight-arrow-bg, rgba(0, 0, 0, 0.4));
    border: none;
    border-radius: 50%;
    color: var(--spotlight-arrow-color, white);
    cursor: pointer;
    transition: background 150ms ease-out, opacity 150ms ease-out, right 250ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .nav-arrow:hover:not(:disabled) {
    background: var(--spotlight-arrow-bg-hover, rgba(0, 0, 0, 0.6));
  }

  .nav-arrow:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .nav-arrow-prev {
    left: var(--spotlight-chrome-padding, 16px);
    left: calc(var(--spotlight-chrome-padding, 16px) + var(--spotlight-safe-area-left, 0px));
  }

  .nav-arrow-next {
    right: var(--spotlight-chrome-padding, 16px);
    right: calc(var(--spotlight-chrome-padding, 16px) + var(--spotlight-safe-area-right, 0px));
  }

  /* Extended hit area for nav arrows - makes clicking near them easier */
  .nav-arrow::before {
    content: '';
    position: absolute;
    top: -32px;
    bottom: -32px;
    left: -20px;
    right: -20px;
  }

  /* When info panel is open, shift right-side elements to avoid overlap */
  .panel-open .chrome-top {
    right: var(--spotlight-panel-width, 280px);
  }

  .panel-open .nav-arrow-next {
    right: calc(var(--spotlight-chrome-padding, 16px) + var(--spotlight-safe-area-right, 0px) + var(--spotlight-panel-width, 280px));
  }

  /* Bottom bar */
  .chrome-bottom {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: var(--spotlight-chrome-padding, 16px);
    padding-bottom: calc(var(--spotlight-chrome-padding, 16px) + var(--spotlight-safe-area-bottom, 0px));
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.5));
  }

  /* Keyboard hints */
  .chrome-hints {
    position: absolute;
    bottom: calc(var(--spotlight-chrome-padding, 16px) + var(--spotlight-safe-area-bottom, 0px) + 60px);
    left: 50%;
    transform: translateX(-50%);
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .chrome-top,
    .chrome-bottom {
      padding: var(--spotlight-chrome-padding-mobile, 12px);
    }

    .nav-arrow {
      width: var(--spotlight-arrow-size-mobile, 80px);
      height: var(--spotlight-arrow-size-mobile, 80px);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .spotlight-chrome,
    .close-button,
    .nav-arrow,
    .chrome-top {
      transition: none;
    }
  }
</style>
