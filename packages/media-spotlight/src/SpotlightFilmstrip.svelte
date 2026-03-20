<!--
  SpotlightFilmstrip.svelte - Thumbnail Navigation Strip

  Horizontal strip of thumbnails for quick navigation.
-->
<script lang="ts">
  import { getCropStyles, type MediaItem } from './types.js';

  interface Props {
    items: MediaItem[];
    currentIndex: number;
    visible: boolean;
    onselect: (index: number) => void;
  }

  let {
    items,
    currentIndex,
    visible,
    onselect,
  }: Props = $props();

  let containerEl: HTMLElement | null = $state(null);

  // Auto-scroll to keep active thumbnail centered
  $effect(() => {
    if (!containerEl) return;

    const activeThumb = containerEl.querySelector('[data-active="true"]');
    if (activeThumb) {
      activeThumb.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  });

  function handleKeydown(e: KeyboardEvent, index: number): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onselect(index);
    }
  }

  function getThumbnailUrl(item: MediaItem): string {
    return item.thumbnailUrl ?? item.url;
  }
</script>

<div
  class="spotlight-filmstrip"
  class:visible
  role="listbox"
  aria-label="Thumbnail navigation"
>
  <div
    bind:this={containerEl}
    class="filmstrip-scroll"
  >
    {#each items as item, i}
      {@const distance = Math.abs(i - currentIndex)}
      <button
        class="filmstrip-thumb"
        class:active={i === currentIndex}
        class:adjacent={distance === 1}
        class:distant={distance > 1}
        data-active={i === currentIndex}
        onclick={() => onselect(i)}
        onkeydown={(e) => handleKeydown(e, i)}
        role="option"
        aria-selected={i === currentIndex}
        aria-label={item.alt ?? item.name ?? `Item ${i + 1}`}
      >
        {#if item.type === 'image'}
          {@const crop = getCropStyles(item.crop)}
          {#if item.crop}
            <div class="thumb-crop-wrapper" style={crop.containerStyle}>
              <img
                src={getThumbnailUrl(item)}
                alt=""
                class="thumb-image thumb-image-cropped"
                style={crop.mediaStyle}
                draggable="false"
              />
            </div>
          {:else}
            <img
              src={getThumbnailUrl(item)}
              alt=""
              class="thumb-image"
              draggable="false"
            />
          {/if}
        {:else}
          <div class="thumb-video">
            <span class="video-icon" aria-hidden="true">▶</span>
          </div>
        {/if}

        {#if item.needsEditing}
          <span class="thumb-badge" aria-hidden="true">!</span>
        {/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .spotlight-filmstrip {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: var(--spotlight-filmstrip-height, 80px);
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
    z-index: var(--spotlight-z-filmstrip, 1003);
    opacity: 0;
    transform: translateY(100%);
    transition:
      opacity var(--spotlight-duration-out, 250ms) var(--spotlight-ease-out),
      transform var(--spotlight-duration-out, 250ms) var(--spotlight-ease-out);
    padding-bottom: var(--spotlight-safe-area-bottom, 0px);
  }

  .spotlight-filmstrip.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .filmstrip-scroll {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--spotlight-filmstrip-gap, 6px);
    padding: 10px 16px;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-behavior: smooth;
    scrollbar-width: none;
    min-width: 100%;
  }

  .filmstrip-scroll::-webkit-scrollbar {
    display: none;
  }

  .filmstrip-thumb {
    flex-shrink: 0;
    width: var(--spotlight-filmstrip-thumb-size, 56px);
    height: var(--spotlight-filmstrip-thumb-size, 56px);
    border: 2px solid transparent;
    border-radius: 6px;
    overflow: hidden;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.1);
    padding: 0;
    position: relative;
    opacity: 0.5;
    transition:
      transform 200ms var(--spotlight-ease-out, cubic-bezier(0.16, 1, 0.3, 1)),
      opacity 200ms ease-out,
      border-color 150ms ease-out,
      width 200ms var(--spotlight-ease-out, cubic-bezier(0.16, 1, 0.3, 1)),
      height 200ms var(--spotlight-ease-out, cubic-bezier(0.16, 1, 0.3, 1));
  }

  .filmstrip-thumb:hover {
    border-color: rgba(255, 255, 255, 0.5);
    opacity: 0.8;
  }

  /* Adjacent thumbnails - slightly larger and more visible */
  .filmstrip-thumb.adjacent {
    opacity: 0.7;
    width: calc(var(--spotlight-filmstrip-thumb-size, 56px) * 1.05);
    height: calc(var(--spotlight-filmstrip-thumb-size, 56px) * 1.05);
  }

  /* Active thumbnail - largest and fully visible */
  .filmstrip-thumb.active {
    border-color: var(--spotlight-filmstrip-active-border, white);
    opacity: 1;
    width: calc(var(--spotlight-filmstrip-thumb-size, 56px) * 1.25);
    height: calc(var(--spotlight-filmstrip-thumb-size, 56px) * 1.25);
  }

  .thumb-crop-wrapper {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .thumb-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }

  .thumb-image-cropped {
    transform-origin: center center;
  }

  .thumb-video {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
  }

  .video-icon {
    color: white;
    font-size: 20px;
  }

  .thumb-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--spotlight-needs-editing-color, rgb(245, 158, 11));
    color: black;
    font-size: 12px;
    font-weight: bold;
    border-radius: 50%;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .spotlight-filmstrip,
    .filmstrip-thumb {
      transition: none;
    }

    .filmstrip-scroll {
      scroll-behavior: auto;
    }
  }
</style>
