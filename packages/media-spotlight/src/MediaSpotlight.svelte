<!--
  MediaSpotlight.svelte - Main Orchestrator

  A premium full-screen media viewer using native <dialog>.
  Supports swipe navigation, pinch-to-zoom, and auto-hiding chrome.
-->
<script lang="ts">
  import type { MediaItem, SpotlightConfig, SpotlightCallbacks, NavigationDirection, HeroOrigin } from './types.js';
  import { GestureController, type GestureEvent } from './gestures/gesture-controller.js';
  import SpotlightImage from './SpotlightImage.svelte';
  import SpotlightVideo from './SpotlightVideo.svelte';
  import SpotlightChrome from './SpotlightChrome.svelte';
  import SpotlightFilmstrip from './SpotlightFilmstrip.svelte';

  interface Props {
    /** Media items to display */
    items: MediaItem[];
    /** Currently active index (bindable) */
    currentIndex?: number;
    /** Whether the spotlight is open (bindable) */
    open?: boolean;
    /** Configuration options */
    config?: SpotlightConfig;
    /** Event callbacks */
    callbacks?: SpotlightCallbacks;
    /** Origin rect for hero animation (set this when opening from a thumbnail click) */
    heroOrigin?: HeroOrigin | null;
    /** Slot for custom tag bar */
    children?: import('svelte').Snippet;
    /** Slot for custom actions */
    actions?: import('svelte').Snippet;
    /** Slot for keyboard hints */
    hints?: import('svelte').Snippet;
    /** Slot for info panel content (shown when 'i' is pressed) */
    infoPanel?: import('svelte').Snippet;
    /** Slot for overlay content rendered inside the dialog (for modals that need to appear above the spotlight) */
    overlays?: import('svelte').Snippet;
  }

  let {
    items,
    currentIndex = $bindable(0),
    open = $bindable(false),
    config = {},
    callbacks = {},
    heroOrigin = null,
    children,
    actions,
    hints,
    infoPanel,
    overlays,
  }: Props = $props();

  // Merge config with defaults
  const mergedConfig = $derived<SpotlightConfig>({
    showFilmstrip: true,
    showArrows: true,
    showClose: true,
    enableSwipeNav: true,
    enableSwipeDismiss: true,
    enablePinchZoom: true,
    enableDoubleTapZoom: true,
    loop: false,
    chromeTimeout: 3000,
    preloadAdjacent: true,
    autoplayVideo: false,
    ...config,
  });

  // Dialog element ref
  let dialogEl: HTMLDialogElement | null = $state(null);
  let contentEl: HTMLElement | null = $state(null);

  // Gesture controller - NOT reactive to avoid effect loops
  let gestureController: GestureController | null = null;

  // UI state
  let chromeVisible = $state(true);
  let chromeTimer: ReturnType<typeof setTimeout> | null = null;
  let navDirection: NavigationDirection = $state(null);
  let isTransitioning = $state(false);
  let scale = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let swipeOffsetX = $state(0);
  let swipeOffsetY = $state(0);
  let infoPanelOpen = $state(true);

  // For carousel transition: track the incoming item during navigation
  let incomingIndex: number | null = $state(null);

  // Hero animation state - FLIP with clip-path for true "uncropping"
  let heroAnimating = $state(false);
  let heroExpanded = $state(false);
  let heroFadingOut = $state(false);
  let heroStartRect = $state<{ top: number; left: number; width: number; height: number } | null>(null);
  let heroEndRect = $state<{ top: number; left: number; width: number; height: number } | null>(null);
  let heroUrl = $state<string | null>(null);
  let heroTrueAspect = $state<number | null>(null); // True image aspect ratio
  let skipImageFadeIn = $state(false);

  // Cleanup chrome timer on unmount
  $effect(() => {
    return () => {
      clearChromeTimer();
    };
  });

  // Current item
  const currentItem = $derived(items[currentIndex] ?? null);
  const incomingItem = $derived(incomingIndex !== null ? items[incomingIndex] ?? null : null);
  const hasNext = $derived(mergedConfig.loop || currentIndex < items.length - 1);
  const hasPrev = $derived(mergedConfig.loop || currentIndex > 0);

  // Track dialog state ourselves to avoid reading dialogEl.open (which creates dependency)
  let dialogIsOpen = false;

  // Open/close the dialog
  $effect(() => {
    if (!dialogEl) return;

    if (open && !dialogIsOpen) {
      // CRITICAL: Determine if hero animation will run BEFORE opening dialog
      const enableHero = mergedConfig.enableHeroAnimation !== false;
      const willAnimate = enableHero && heroOrigin?.rect;

      if (willAnimate) {
        // Pre-set hero state so dialog content is hidden from first frame
        heroAnimating = true;
        heroExpanded = false;
      }

      dialogEl.showModal();
      dialogIsOpen = true;
      resetState();

      if (willAnimate) {
        startHeroAnimation();
      }

      startChromeTimer();
      previouslyFocused = document.activeElement as HTMLElement | null;
    } else if (!open && dialogIsOpen) {
      dialogEl.close();
      dialogIsOpen = false;
      // Reset hero state
      heroAnimating = false;
      heroExpanded = false;
      heroFadingOut = false;
      heroStartRect = null;
      heroEndRect = null;
      heroUrl = null;
      heroTrueAspect = null;
      skipImageFadeIn = false;
      // Restore focus
      previouslyFocused?.focus();
    }
  });

  /** Calculate centered rect for a given aspect ratio */
  function calculateCenteredRect(
    aspectRatio: number,
    viewportWidth: number,
    viewportHeight: number,
    padding: number
  ): { top: number; left: number; width: number; height: number } {
    const maxWidth = viewportWidth - padding * 2;
    const maxHeight = viewportHeight - padding * 2;

    let width: number;
    let height: number;

    if (aspectRatio > maxWidth / maxHeight) {
      width = maxWidth;
      height = maxWidth / aspectRatio;
    } else {
      height = maxHeight;
      width = maxHeight * aspectRatio;
    }

    return {
      top: (viewportHeight - height) / 2,
      left: (viewportWidth - width) / 2,
      width,
      height,
    };
  }

  /** Calculate where the image will ACTUALLY render in the spotlight */
  function calculateHeroEndRect(aspectRatio: number): { top: number; left: number; width: number; height: number } {
    const contentRect = contentEl?.getBoundingClientRect();
    if (!contentRect) {
      return calculateCenteredRect(aspectRatio, window.innerWidth, window.innerHeight, 40);
    }

    const mediaPadding = typeof mergedConfig.mediaPadding === 'number'
      ? mergedConfig.mediaPadding
      : parseInt(mergedConfig.mediaPadding || '0', 10);

    // CRITICAL: Info panel has a CSS transition (250ms). During hero animation start,
    // the panel may still be transitioning from width:0 to final width.
    // We need to calculate based on the FINAL panel width, not current width.
    // Get the panel's final width from CSS variable (set on .spotlight-dialog) or default.
    let panelWidth = 0;
    if (infoPanelOpen && infoPanel) {
      // Read from dialog element where --spotlight-panel-width may be overridden
      const panelWidthVar = dialogEl
        ? getComputedStyle(dialogEl).getPropertyValue('--spotlight-panel-width').trim()
        : '';
      panelWidth = panelWidthVar ? parseInt(panelWidthVar, 10) : 280;
    }

    // Calculate available width accounting for panel's FINAL width
    // contentRect.width may include the transitioning panel, so use viewport - panel
    const viewportWidth = window.innerWidth;
    const expectedContentWidth = viewportWidth - panelWidth;
    const availableWidth = expectedContentWidth - mediaPadding * 2;
    const availableHeight = contentRect.height - mediaPadding * 2;
    const availableLeft = mediaPadding;
    const availableTop = contentRect.top + mediaPadding;

    let width: number;
    let height: number;

    if (aspectRatio > availableWidth / availableHeight) {
      width = availableWidth;
      height = availableWidth / aspectRatio;
    } else {
      height = availableHeight;
      width = availableHeight * aspectRatio;
    }

    return {
      top: availableTop + (availableHeight - height) / 2,
      left: availableLeft + (availableWidth - width) / 2,
      width,
      height,
    };
  }

  /** Start the hero expand animation with FLIP + clip-path for true uncropping */
  function startHeroAnimation(): void {
    if (!heroOrigin?.rect || !currentItem) return;

    const rect = heroOrigin.rect;
    const isVideo = currentItem.type === 'video';
    const thumbnailAspect = rect.width / rect.height;

    // Store start position (thumbnail rect)
    heroStartRect = {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };

    // For hero, only use thumbnail URLs (never video files in <img>)
    const thumbnailUrl = heroOrigin.thumbnailUrl || currentItem.thumbnailUrl;
    if (!thumbnailUrl) {
      heroAnimating = false;
      return;
    }
    heroUrl = thumbnailUrl;

    // Determine true aspect ratio
    if (currentItem.width && currentItem.height) {
      // Use stored dimensions (best case - no loading delay)
      heroTrueAspect = currentItem.width / currentItem.height;
      heroEndRect = calculateHeroEndRect(heroTrueAspect);
      startAnimation();

      // Preload sharper image and swap during animation for seamless crossfade
      // Priority: previewUrl (~1200px, fast) > heroOrigin.previewUrl > full-res url
      const sharpUrl = currentItem.previewUrl || heroOrigin.previewUrl || currentItem.url;
      if (sharpUrl && sharpUrl !== thumbnailUrl) {
        const sharpImg = new Image();
        sharpImg.src = sharpUrl;
        sharpImg.decode().then(() => {
          // Swap to sharp image during animation (before fade-out)
          if (heroAnimating && !heroFadingOut) {
            heroUrl = sharpUrl;
          }
        }).catch(() => {});
      }
    } else if (!isVideo) {
      // For images without stored dimensions: load to get true aspect
      // Start with thumbnail aspect, update when image loads
      heroTrueAspect = thumbnailAspect;
      heroEndRect = calculateHeroEndRect(thumbnailAspect);

      const fullResImg = new Image();
      fullResImg.src = currentItem.url;
      fullResImg.decode().then(() => {
        if (!heroAnimating || heroFadingOut) return;
        heroTrueAspect = fullResImg.naturalWidth / fullResImg.naturalHeight;
        heroEndRect = calculateHeroEndRect(heroTrueAspect);
        heroUrl = currentItem.url;
      }).catch(() => {});

      startAnimation();
    } else {
      // Video without stored dimensions - use thumbnail aspect (no morph)
      heroTrueAspect = thumbnailAspect;
      heroEndRect = calculateHeroEndRect(thumbnailAspect);
      startAnimation();
    }

    function startAnimation(): void {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Recalculate after dialog fully rendered
          if (heroTrueAspect) {
            heroEndRect = calculateHeroEndRect(heroTrueAspect);
          }
          heroExpanded = true;
        });
      });
    }
  }

  /** Called when hero animation completes - start crossfade */
  function onHeroTransitionEnd(e: TransitionEvent): void {
    // React to transform end (clip-path ends at same time)
    if (e.propertyName !== 'transform' || !heroExpanded || heroFadingOut) return;

    // Start crossfade
    heroFadingOut = true;
    skipImageFadeIn = true;

    // Read crossfade duration from CSS token (matches the CSS transition)
    const crossfadeMs = parseFloat(
      getComputedStyle(document.documentElement)
        .getPropertyValue('--spotlight-duration-crossfade') || '80'
    );

    // After crossfade, clean up
    setTimeout(() => {
      heroAnimating = false;
      heroExpanded = false;
      heroFadingOut = false;
      heroStartRect = null;
      heroEndRect = null;
      heroUrl = null;
      heroTrueAspect = null;

      requestAnimationFrame(() => {
        skipImageFadeIn = false;
      });
    }, crossfadeMs);
  }

  // Track previously focused element for focus restoration
  let previouslyFocused: HTMLElement | null = null;

  // Setup gesture controller
  $effect(() => {
    if (!contentEl || !open) {
      gestureController?.detach();
      gestureController = null;
      return;
    }

    gestureController = new GestureController({
      enableHorizontal: mergedConfig.enableSwipeNav ?? true,
      enableVertical: mergedConfig.enableSwipeDismiss ?? true,
      enablePinch: mergedConfig.enablePinchZoom ?? true,
      enableDoubleTap: mergedConfig.enableDoubleTapZoom ?? true,
    });

    gestureController.attach(contentEl, handleGestureEvent);

    return () => {
      gestureController?.detach();
      gestureController = null;
    };
  });

  // Preload adjacent images
  $effect(() => {
    if (!mergedConfig.preloadAdjacent || !open) return;

    const toPreload: string[] = [];

    if (currentIndex > 0) {
      const prev = items[currentIndex - 1];
      if (prev?.type === 'image') toPreload.push(prev.url);
    }

    if (currentIndex < items.length - 1) {
      const next = items[currentIndex + 1];
      if (next?.type === 'image') toPreload.push(next.url);
    }

    toPreload.forEach(url => {
      const img = new Image();
      img.src = url;
    });
  });

  function resetState(): void {
    scale = 1;
    panX = 0;
    panY = 0;
    swipeOffsetX = 0;
    swipeOffsetY = 0;
    navDirection = null;
    isTransitioning = false;
    incomingIndex = null;
    // Preserve infoPanelOpen - only close on explicit user action (Escape, close button, 'i' key)
    gestureController?.reset();
  }

  function toggleInfoPanel(): void {
    // Don't allow info panel when zoomed
    if (scale !== 1) return;
    infoPanelOpen = !infoPanelOpen;
    showChrome();
  }

  function startChromeTimer(): void {
    clearChromeTimer();

    if (mergedConfig.chromeTimeout && mergedConfig.chromeTimeout > 0) {
      chromeTimer = setTimeout(() => {
        chromeVisible = false;
      }, mergedConfig.chromeTimeout);
    }
  }

  function clearChromeTimer(): void {
    if (chromeTimer) {
      clearTimeout(chromeTimer);
      chromeTimer = null;
    }
  }

  function showChrome(): void {
    chromeVisible = true;
    startChromeTimer();
  }

  function handleGestureEvent(event: GestureEvent): void {
    switch (event.type) {
      case 'tap':
        showChrome();
        break;

      case 'double-tap':
        if (scale === 1) {
          // Zoom to 2x centered on tap point
          scale = 2;
          // Calculate pan offset to center on tap point
          // Tap coordinates are relative to viewport, convert to pan offset
          if (contentEl) {
            const rect = contentEl.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            // Pan to put tap point at center (inverted because we're moving the content)
            panX = (centerX - event.x) * (scale - 1);
            panY = (centerY - event.y) * (scale - 1);
          }
        } else {
          scale = 1;
          panX = 0;
          panY = 0;
        }
        break;

      case 'swipe-left':
        if (scale === 1) navigateNext();
        break;

      case 'swipe-right':
        if (scale === 1) navigatePrev();
        break;

      case 'dismiss':
        if (scale === 1) close();
        break;

      case 'zoom-change':
        scale = event.scale;
        if (scale === 1) {
          panX = 0;
          panY = 0;
        }
        break;

      case 'pan-change':
        panX = event.x;
        panY = event.y;
        break;
    }

    // Update swipe offsets from gesture state (but not if we're transitioning)
    if (gestureController && !isTransitioning) {
      const state = gestureController.state;
      swipeOffsetX = state.swipeX;
      swipeOffsetY = state.swipeY;
    }
  }

  function navigateNext(): void {
    if (!hasNext || isTransitioning) return;

    // Clear swipe offsets IMMEDIATELY so CSS transition starts from clean state
    swipeOffsetX = 0;
    swipeOffsetY = 0;
    gestureController?.reset();

    const nextIndex = mergedConfig.loop
      ? (currentIndex + 1) % items.length
      : currentIndex + 1;

    // Set up carousel: show both current (outgoing) and next (incoming)
    incomingIndex = nextIndex;
    navDirection = 'next';
    isTransitioning = true;

    setTimeout(() => {
      currentIndex = nextIndex;
      callbacks.onchange?.(nextIndex);
      resetState();
    }, 300);
  }

  function navigatePrev(): void {
    if (!hasPrev || isTransitioning) return;

    // Clear swipe offsets IMMEDIATELY so CSS transition starts from clean state
    swipeOffsetX = 0;
    swipeOffsetY = 0;
    gestureController?.reset();

    const prevIndex = mergedConfig.loop
      ? (currentIndex - 1 + items.length) % items.length
      : currentIndex - 1;

    // Set up carousel: show both current (outgoing) and prev (incoming)
    incomingIndex = prevIndex;
    navDirection = 'prev';
    isTransitioning = true;

    setTimeout(() => {
      currentIndex = prevIndex;
      callbacks.onchange?.(prevIndex);
      resetState();
    }, 300);
  }

  function close(): void {
    open = false;
    callbacks.onclose?.();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (!open) return;

    // Don't intercept keys when user is typing in an input/textarea/contenteditable
    const target = e.target as HTMLElement;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable) {
      // Still allow Escape to close modals
      if (e.key !== 'Escape') return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        // Always close the viewer - info panel toggles via 'i' key or button only
        close();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        navigatePrev();
        break;
      case 'ArrowRight':
        e.preventDefault();
        navigateNext();
        break;
      case 'i':
      case 'I':
        e.preventDefault();
        toggleInfoPanel();
        break;
    }

    // Show chrome on any key press
    showChrome();
  }

  function handleDialogClick(e: MouseEvent): void {
    // Close on backdrop click
    if (e.target === dialogEl) {
      close();
    }
  }

  function goToIndex(index: number): void {
    if (index === currentIndex || isTransitioning) return;

    // Set up carousel: show both current (outgoing) and target (incoming)
    incomingIndex = index;
    navDirection = index > currentIndex ? 'next' : 'prev';
    isTransitioning = true;

    setTimeout(() => {
      currentIndex = index;
      callbacks.onchange?.(index);
      resetState();
    }, 300);
  }

  // The display index updates immediately when a transition starts,
  // rather than waiting for the 300ms transition to complete
  const displayIndex = $derived(incomingIndex ?? currentIndex);

  // Expose navigation for child components (must be reactive)
  const navigation = $derived({
    next: navigateNext,
    prev: navigatePrev,
    goTo: goToIndex,
    close,
    hasNext,
    hasPrev,
    currentIndex: displayIndex,
    totalCount: items.length,
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<dialog
  bind:this={dialogEl}
  class="spotlight-dialog"
  onclick={handleDialogClick}
  aria-label="Media viewer"
>
  <!-- Hero animation: FLIP + clip-path for true "uncropping" effect -->
  {#if heroAnimating && heroStartRect && heroEndRect && heroUrl}
    {@const startRect = heroStartRect}
    {@const endRect = heroEndRect}
    {@const thumbAspect = startRect.width / startRect.height}
    {@const trueAspect = endRect.width / endRect.height}

    <!-- Calculate clip-path to show only the "cropped" portion initially -->
    <!-- When thumbnail is squarer than true aspect, we need to clip the hero -->
    {@const clipHorizontal = trueAspect > thumbAspect ? (1 - thumbAspect / trueAspect) / 2 * 100 : 0}
    {@const clipVertical = trueAspect < thumbAspect ? (1 - trueAspect / thumbAspect) / 2 * 100 : 0}

    <!-- FLIP: Calculate inverse transform to make FINAL position appear at START position -->
    {@const scale = heroExpanded ? 1 : startRect.width / endRect.width}
    {@const startCenterX = startRect.left + startRect.width / 2}
    {@const startCenterY = startRect.top + startRect.height / 2}
    {@const endCenterX = endRect.left + endRect.width / 2}
    {@const endCenterY = endRect.top + endRect.height / 2}
    {@const translateX = heroExpanded ? 0 : startCenterX - endCenterX}
    {@const translateY = heroExpanded ? 0 : startCenterY - endCenterY}

    <div
      class="hero-animation"
      class:hero-expanded={heroExpanded}
      class:hero-fading={heroFadingOut}
      style:--hero-top="{endRect.top}px"
      style:--hero-left="{endRect.left}px"
      style:--hero-width="{endRect.width}px"
      style:--hero-height="{endRect.height}px"
      style:--hero-translate-x="{translateX}px"
      style:--hero-translate-y="{translateY}px"
      style:--hero-scale={scale}
      style:--hero-clip-x="{heroExpanded ? 0 : clipHorizontal}%"
      style:--hero-clip-y="{heroExpanded ? 0 : clipVertical}%"
      ontransitionend={onHeroTransitionEnd}
    >
      <img
        src={heroUrl}
        alt=""
        class="hero-image"
        draggable="false"
      />
    </div>
  {/if}

  {#if currentItem}
    <!-- Main layout container - flexbox for push behavior -->
    <div
      class="spotlight-layout"
      class:panel-open={infoPanelOpen && infoPanel}
      class:hero-hidden={heroAnimating && !heroFadingOut}
    >
      <!-- Image/video area - carousel container -->
      <div
        bind:this={contentEl}
        class="spotlight-content"
        class:transitioning={isTransitioning}
        class:nav-next={navDirection === 'next'}
        class:nav-prev={navDirection === 'prev'}
        style:--swipe-x="{swipeOffsetX}px"
        style:--swipe-y="{swipeOffsetY}px"
        style:--scale={scale}
        style:--pan-x="{panX}px"
        style:--pan-y="{panY}px"
        style:--media-padding={typeof mergedConfig.mediaPadding === 'number' ? `${mergedConfig.mediaPadding}px` : mergedConfig.mediaPadding ?? '0px'}
      >
        <!-- Carousel track - holds both current and incoming slides -->
        <div class="carousel-track">
          <!-- Current (outgoing) slide -->
          <div class="carousel-slide current">
            {#if currentItem.type === 'image'}
              <SpotlightImage
                item={currentItem}
                {scale}
                {panX}
                {panY}
                skipFadeIn={skipImageFadeIn}
              />
            {:else}
              <SpotlightVideo
                item={currentItem}
                autoplay={mergedConfig.autoplayVideo ?? false}
                oninteraction={showChrome}
              />
            {/if}
          </div>

          <!-- Incoming slide (only rendered during transition) -->
          {#if incomingItem && isTransitioning}
            <div class="carousel-slide incoming">
              {#if incomingItem.type === 'image'}
                <SpotlightImage
                  item={incomingItem}
                  scale={1}
                  panX={0}
                  panY={0}
                />
              {:else}
                <SpotlightVideo
                  item={incomingItem}
                  autoplay={mergedConfig.autoplayVideo ?? false}
                  oninteraction={showChrome}
                />
              {/if}
            </div>
          {/if}
        </div>
      </div>

      <!-- Info panel (slides in from right, pushes image) -->
      {#if infoPanel}
        <aside
          class="spotlight-info-panel"
          class:open={infoPanelOpen}
          aria-label="Media information"
        >
          <div class="info-panel-header">
            <span class="info-panel-title">Info</span>
          </div>
          <div class="info-panel-content">
            {@render infoPanel()}
          </div>
        </aside>
      {/if}
    </div>

    <SpotlightChrome
      visible={chromeVisible}
      {navigation}
      showArrows={mergedConfig.showArrows ?? true}
      showClose={mergedConfig.showClose ?? true}
      item={currentItem}
      panelOpen={infoPanelOpen && !!infoPanel}
    >
      {#snippet actionsSlot()}
        <!-- Info toggle button -->
        {#if infoPanel}
          <button
            class="info-toggle-button"
            class:active={infoPanelOpen}
            onclick={toggleInfoPanel}
            aria-label={infoPanelOpen ? 'Hide info panel' : 'Show info panel'}
            aria-pressed={infoPanelOpen}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
          </button>
        {/if}
        {#if actions}
          {@render actions()}
        {/if}
      {/snippet}

      {#snippet bottomSlot()}
        {#if children}
          {@render children()}
        {/if}
      {/snippet}

      {#snippet hintsSlot()}
        {#if hints}
          {@render hints()}
        {/if}
      {/snippet}
    </SpotlightChrome>

    {#if mergedConfig.showFilmstrip && items.length > 1}
      <SpotlightFilmstrip
        {items}
        currentIndex={incomingIndex ?? currentIndex}
        visible={chromeVisible}
        onselect={goToIndex}
      />
    {/if}
  {/if}

  {#if overlays}
    {@render overlays()}
  {/if}
</dialog>

<style>
  .spotlight-dialog {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    border: none;
    background: var(--spotlight-backdrop, rgba(0, 0, 0, 0.95));
    z-index: var(--spotlight-z-backdrop, 1000);
    overflow: hidden;

    /* CSS-only open/close animation */
    opacity: 1;
    transition:
      opacity var(--spotlight-duration-out, 250ms) var(--spotlight-ease-out, cubic-bezier(0.16, 1, 0.3, 1)),
      overlay var(--spotlight-duration-out, 250ms) allow-discrete,
      display var(--spotlight-duration-out, 250ms) allow-discrete;
  }

  .spotlight-dialog::backdrop {
    background: transparent;
  }

  @starting-style {
    .spotlight-dialog[open] {
      opacity: 0;
    }
  }

  /* Main layout - flexbox for push behavior */
  .spotlight-layout {
    position: absolute;
    inset: 0;
    display: flex;
    z-index: var(--spotlight-z-content, 1001);
  }

  .spotlight-content {
    flex: 1;
    min-width: 0;
    position: relative;
    overflow: hidden;
    touch-action: none;
    user-select: none;
  }

  /* Carousel track holds both slides side by side */
  .carousel-track {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transform: translateX(var(--swipe-x, 0)) translateY(var(--swipe-y, 0));
    transition: none;
  }

  .spotlight-content.transitioning .carousel-track {
    transition: transform var(--spotlight-duration-nav, 300ms) var(--spotlight-ease-out, cubic-bezier(0.16, 1, 0.3, 1));
  }

  /* During nav-next: track slides left, so current exits left, incoming enters from right */
  .spotlight-content.transitioning.nav-next .carousel-track {
    transform: translateX(-100%);
  }

  /* During nav-prev: track slides right, so current exits right, incoming enters from left */
  .spotlight-content.transitioning.nav-prev .carousel-track {
    transform: translateX(100%);
  }

  /* Each slide takes full width/height, with optional padding for UI elements */
  .carousel-slide {
    position: absolute;
    inset: var(--media-padding, 0);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Current slide is at center (0) */
  .carousel-slide.current {
    transform: translateX(0);
  }

  /* Incoming slide positioned based on direction */
  /* For nav-next: incoming starts at +100% (right side) */
  .spotlight-content.nav-next .carousel-slide.incoming {
    transform: translateX(100%);
  }

  /* For nav-prev: incoming starts at -100% (left side) */
  .spotlight-content.nav-prev .carousel-slide.incoming {
    transform: translateX(-100%);
  }

  /* Info panel - slides in from right, pushes content */
  .spotlight-info-panel {
    width: 0;
    overflow: hidden;
    background: var(--spotlight-panel-bg, rgba(0, 0, 0, 0.85));
    border-left: 1px solid var(--spotlight-panel-border, rgba(255, 255, 255, 0.1));
    display: flex;
    flex-direction: column;
    transition: width var(--spotlight-duration-panel, 250ms) var(--spotlight-ease-out, cubic-bezier(0.16, 1, 0.3, 1));
  }

  .spotlight-info-panel.open {
    width: var(--spotlight-panel-width, 280px);
  }

  .info-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--spotlight-panel-border, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .info-panel-title {
    font-size: 16px;
    font-weight: 500;
    color: var(--spotlight-panel-title-color, white);
  }

  .info-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  /* Info toggle button in chrome */
  .info-toggle-button {
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

  .info-toggle-button:hover {
    background: rgba(0, 0, 0, 0.6);
  }

  .info-toggle-button.active {
    background: var(--spotlight-accent, rgba(59, 130, 246, 0.8));
  }

  /* Mobile: panel overlays instead of push */
  @media (max-width: 768px) {
    .spotlight-info-panel {
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: 0;
      max-width: 85vw;
      z-index: 10;
    }

    .spotlight-info-panel.open {
      width: var(--spotlight-panel-width-mobile, 300px);
    }
  }

  /* Hero animation - FLIP with clip-path for true "uncropping" effect */
  .hero-animation {
    position: fixed;
    z-index: var(--spotlight-z-hero, 1010);
    pointer-events: none;

    /* Positioned at FINAL location (FLIP technique) */
    top: var(--hero-top);
    left: var(--hero-left);
    width: var(--hero-width);
    height: var(--hero-height);

    overflow: hidden;
    background: #000;

    /* GPU compositing — only transform and opacity are compositor-friendly */
    will-change: transform, opacity;
    transform-origin: center center;

    /* Initial state: inverse transform + clip to appear at thumbnail */
    transform: translate(var(--hero-translate-x), var(--hero-translate-y)) scale(var(--hero-scale));
    clip-path: inset(var(--hero-clip-y) var(--hero-clip-x) var(--hero-clip-y) var(--hero-clip-x));
    border-radius: 8px;

    /* Only animate transform (compositor-only) — clip-path and border-radius
       snap to their expanded values instantly via .hero-expanded to avoid
       expensive main thread repaints during the animation */
    transition: transform var(--spotlight-duration-hero, 280ms) var(--spotlight-ease-hero, cubic-bezier(0.32, 0.72, 0, 1));
  }

  .hero-animation.hero-expanded {
    /* Final state: no transform, full reveal */
    transform: translate(0, 0) scale(1);
    clip-path: inset(0 0 0 0);
    border-radius: 0;
  }

  /* Crossfade at end */
  .hero-animation.hero-fading {
    opacity: 0;
    transition: opacity var(--spotlight-duration-crossfade, 80ms) ease-out;
  }

  .hero-image {
    width: 100%;
    height: 100%;
    /* object-fit: contain shows full image (no crop) */
    object-fit: contain;
  }

  /* Hide main content during hero animation (except during crossfade) */
  .spotlight-layout.hero-hidden {
    opacity: 0;
  }

  .spotlight-layout {
    transition: opacity 150ms ease-out;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .spotlight-dialog,
    .carousel-track,
    .spotlight-info-panel,
    .info-toggle-button,
    .hero-animation,
    .spotlight-layout {
      transition: none;
    }
  }
</style>
