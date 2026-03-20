<!--
  SpotlightImage.svelte - Image Display Component

  Renders an image with zoom and pan support.
-->
<script lang="ts">
  import { getCropStyles, type MediaItem } from './types.js';

  interface Props {
    item: MediaItem;
    scale?: number;
    panX?: number;
    panY?: number;
    /** Skip the fade-in animation (used after hero animation for instant reveal) */
    skipFadeIn?: boolean;
  }

  let {
    item,
    scale = 1,
    panX = 0,
    panY = 0,
    skipFadeIn = false,
  }: Props = $props();

  let loaded = $state(false);
  let error = $state(false);
  let prevUrl = $state('');

  const cropStyles = $derived(getCropStyles(item.crop));

  function handleLoad(): void {
    loaded = true;
    error = false;
  }

  function handleError(): void {
    loaded = true;
    error = true;
  }

  // Reset state only when URL actually changes (not when other item props change)
  $effect(() => {
    const url = item.url;
    if (url !== prevUrl) {
      prevUrl = url;
      loaded = false;
      error = false;
    }
  });
</script>

<div
  class="spotlight-image-container"
  style:--scale={scale}
  style:--pan-x="{panX}px"
  style:--pan-y="{panY}px"
>
  {#if !loaded}
    <div class="spotlight-image-loading">
      <div class="spotlight-spinner" aria-label="Loading"></div>
    </div>
  {/if}

  {#if error}
    <div class="spotlight-image-error">
      <span class="error-icon" aria-hidden="true">⚠</span>
      <span>Failed to load image</span>
    </div>
  {:else if item.crop}
    <div class="spotlight-crop-wrapper" style="{cropStyles.containerStyle} overflow: hidden; max-width: 100%; max-height: 100%;">
      <img
        src={item.url}
        srcset={item.srcset}
        sizes={item.sizes ?? '100vw'}
        alt={item.alt ?? item.name ?? 'Media'}
        class="spotlight-image spotlight-image-cropped"
        class:loaded
        class:instant={skipFadeIn}
        style={cropStyles.mediaStyle}
        draggable="false"
        onload={handleLoad}
        onerror={handleError}
      />
    </div>
  {:else}
    <img
      src={item.url}
      srcset={item.srcset}
      sizes={item.sizes ?? '100vw'}
      alt={item.alt ?? item.name ?? 'Media'}
      class="spotlight-image"
      class:loaded
      class:instant={skipFadeIn}
      draggable="false"
      onload={handleLoad}
      onerror={handleError}
    />
  {/if}
</div>

<style>
  .spotlight-image-container {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    transform: scale(var(--scale, 1)) translate(var(--pan-x, 0), var(--pan-y, 0));
    transform-origin: center center;
  }

  .spotlight-crop-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }

  .spotlight-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    opacity: 0;
    transition: opacity 200ms ease-out;
    pointer-events: none;
  }

  .spotlight-image-cropped {
    width: 100%;
    height: 100%;
    object-fit: cover;
    max-width: none;
    max-height: none;
  }

  .spotlight-image.loaded {
    opacity: 1;
  }

  /* Skip fade-in for instant reveal after hero animation */
  .spotlight-image.instant {
    transition: none;
    opacity: 1;
  }

  .spotlight-image-loading {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .spotlight-spinner {
    width: 48px;
    height: 48px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .spotlight-image-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: var(--spotlight-error-color, rgba(255, 255, 255, 0.8));
    background: var(--spotlight-error-bg, rgba(0, 0, 0, 0.5));
    padding: 24px 32px;
    border-radius: 8px;
  }

  .error-icon {
    font-size: 32px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .spotlight-spinner {
      animation: none;
      border-top-color: white;
    }

    .spotlight-image {
      transition: none;
    }
  }
</style>
