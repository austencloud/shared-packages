<!--
  SpotlightVideo.svelte - Video Display Component

  Renders a video with custom controls.
  Supports both native HTML5 video and YouTube embeds.
-->
<script lang="ts">
  import { getCropStyles, type MediaItem } from './types.js';

  interface Props {
    item: MediaItem;
    autoplay?: boolean;
    oninteraction?: () => void;
  }

  let {
    item,
    autoplay = false,
    oninteraction,
  }: Props = $props();

  const cropStyles = $derived(getCropStyles(item.crop));

  // Detect if this is a YouTube embed URL
  const isYouTube = $derived(
    item.url.includes('youtube.com/embed/') ||
    item.url.includes('youtube-nocookie.com/embed/')
  );

  let videoEl: HTMLVideoElement | null = $state(null);
  let youtubeIframe: HTMLIFrameElement | null = $state(null);
  let playing = $state(false);
  let currentTime = $state(0);
  let duration = $state(0);
  let loaded = $state(false);
  let error = $state(false);
  let iframeLoaded = $state(false);

  // Add enablejsapi=1 to YouTube URL for postMessage control
  const youtubeUrl = $derived.by(() => {
    if (!isYouTube) return item.url;
    const url = new URL(item.url);
    url.searchParams.set('enablejsapi', '1');
    return url.toString();
  });

  // Pause YouTube video via postMessage
  // Derive the correct origin for postMessage based on the embed URL
  const youtubeOrigin = $derived(
    item.url.includes('youtube-nocookie.com')
      ? 'https://www.youtube-nocookie.com'
      : 'https://www.youtube.com'
  );

  function pauseYouTube(): void {
    if (youtubeIframe?.contentWindow) {
      youtubeIframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
        youtubeOrigin
      );
    }
  }

  // Cleanup: pause video when component unmounts or item changes
  $effect(() => {
    // Track the current URL to re-run cleanup when item changes
    item.url;

    return () => {
      pauseYouTube();
    };
  });

  function handleLoadedMetadata(): void {
    if (videoEl) {
      duration = videoEl.duration;
      loaded = true;
      // Autoplay if enabled
      if (autoplay && !playing) {
        videoEl.play().catch(() => {
          // Autoplay may be blocked by browser policy, ignore
        });
      }
    }
  }

  function handleTimeUpdate(): void {
    if (videoEl) {
      currentTime = videoEl.currentTime;
    }
  }

  function handleError(): void {
    error = true;
    loaded = true;
  }

  function togglePlay(): void {
    if (!videoEl) return;

    if (playing) {
      videoEl.pause();
    } else {
      videoEl.play();
    }

    oninteraction?.();
  }

  function handlePlay(): void {
    playing = true;
  }

  function handlePause(): void {
    playing = false;
  }

  function seek(e: MouseEvent): void {
    if (!videoEl || !duration) return;

    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    videoEl.currentTime = percent * duration;
    oninteraction?.();
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Reset when item changes
  $effect(() => {
    item.url;
    playing = false;
    currentTime = 0;
    duration = 0;
    loaded = false;
    error = false;
  });

  const progress = $derived(duration > 0 ? (currentTime / duration) * 100 : 0);
</script>

<div class="spotlight-video-container">
  {#if isYouTube}
    <!-- YouTube embed via iframe -->
    <div class="spotlight-youtube-container" class:loaded={iframeLoaded}>
      <iframe
        bind:this={youtubeIframe}
        title="YouTube video"
        src={youtubeUrl}
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen
        onload={() => (iframeLoaded = true)}
      ></iframe>
      {#if !iframeLoaded}
        <div class="spotlight-video-loading">
          <span class="loading-spinner"></span>
        </div>
      {/if}
    </div>
  {:else if error}
    <div class="spotlight-video-error">
      <span class="error-icon" aria-hidden="true">⚠</span>
      <span>Failed to load video</span>
    </div>
  {:else}
    {#if item.crop}
      <div class="spotlight-crop-wrapper" style="{cropStyles.containerStyle} overflow: hidden; max-width: 100%; max-height: 100%;">
        <!-- svelte-ignore a11y_media_has_caption -->
        <video
          bind:this={videoEl}
          src={item.url}
          class="spotlight-video spotlight-video-cropped"
          class:loaded
          style={cropStyles.mediaStyle}
          playsinline
          onloadedmetadata={handleLoadedMetadata}
          ontimeupdate={handleTimeUpdate}
          onplay={handlePlay}
          onpause={handlePause}
          onerror={handleError}
        ></video>
      </div>
    {:else}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video
        bind:this={videoEl}
        src={item.url}
        class="spotlight-video"
        class:loaded
        playsinline
        onloadedmetadata={handleLoadedMetadata}
        ontimeupdate={handleTimeUpdate}
        onplay={handlePlay}
        onpause={handlePause}
        onerror={handleError}
      ></video>
    {/if}

    <button
      class="spotlight-video-play-overlay"
      class:hidden={playing}
      onclick={togglePlay}
      aria-label={playing ? 'Pause video' : 'Play video'}
    >
      <span class="play-icon" aria-hidden="true">▶</span>
    </button>

    {#if loaded}
      <div class="spotlight-video-controls">
        <button
          class="control-button"
          onclick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {#if playing}
            <span aria-hidden="true">❚❚</span>
          {:else}
            <span aria-hidden="true">▶</span>
          {/if}
        </button>

        <div
          class="progress-bar"
          role="slider"
          tabindex="0"
          onclick={seek}
          onkeydown={(e) => {
            if (e.key === 'ArrowRight' && videoEl) {
              videoEl.currentTime = Math.min(duration, currentTime + 5);
            } else if (e.key === 'ArrowLeft' && videoEl) {
              videoEl.currentTime = Math.max(0, currentTime - 5);
            }
          }}
          aria-label="Seek video"
          aria-valuenow={currentTime}
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuetext="{formatTime(currentTime)} of {formatTime(duration)}"
        >
          <div class="progress-track">
            <div class="progress-fill" style:width="{progress}%"></div>
          </div>
        </div>

        <span class="time-display">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    {/if}
  {/if}
</div>

<style>
  .spotlight-video-container {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .spotlight-crop-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    position: relative;
  }

  .spotlight-video {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    opacity: 0;
    transition: opacity 200ms ease-out;
  }

  .spotlight-video-cropped {
    width: 100%;
    height: 100%;
    object-fit: cover;
    max-width: none;
    max-height: none;
  }

  .spotlight-video.loaded {
    opacity: 1;
  }

  .spotlight-video-play-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.3);
    border: none;
    cursor: pointer;
    transition: opacity 200ms ease-out;
  }

  .spotlight-video-play-overlay.hidden {
    opacity: 0;
    pointer-events: none;
  }

  .play-icon {
    font-size: 64px;
    color: white;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  }

  .spotlight-video-controls {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  }

  .control-button {
    width: var(--spotlight-touch-min, 48px);
    height: var(--spotlight-touch-min, 48px);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--spotlight-video-control-bg, transparent);
    border: none;
    border-radius: 50%;
    color: white;
    font-size: 16px;
    cursor: pointer;
    transition: background 150ms ease-out;
  }

  .control-button:hover {
    background: var(--spotlight-video-control-hover, rgba(255, 255, 255, 0.1));
  }

  .progress-bar {
    flex: 1;
    height: var(--spotlight-touch-min, 48px);
    display: flex;
    align-items: center;
    padding: 0;
    background: transparent;
    border: none;
    cursor: pointer;
  }

  .progress-track {
    width: 100%;
    height: 4px;
    background: var(--spotlight-video-progress-track, rgba(255, 255, 255, 0.3));
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--spotlight-video-progress-fill, white);
    transition: width 100ms linear;
  }

  .time-display {
    font-size: 14px;
    color: white;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .spotlight-video-error {
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

  /* YouTube iframe container */
  .spotlight-youtube-container {
    position: relative;
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    aspect-ratio: 16 / 9;
    background: #000;
    border-radius: 8px;
    overflow: hidden;
  }

  .spotlight-youtube-container iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
    opacity: 0;
    transition: opacity 300ms ease-out;
  }

  .spotlight-youtube-container.loaded iframe {
    opacity: 1;
  }

  .spotlight-video-loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
  }

  .loading-spinner {
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

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .spotlight-video,
    .spotlight-video-play-overlay,
    .spotlight-youtube-container iframe {
      transition: none;
    }

    .loading-spinner {
      animation: none;
      border-color: white;
    }
  }
</style>
