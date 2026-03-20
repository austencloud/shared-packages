<!--
  LazyImage.svelte

  Drop-in replacement for <img> with full caching and lazy loading.
  Features:
  - IntersectionObserver-based lazy loading
  - Multi-tier caching (memory → IndexedDB → network)
  - Priority-based loading queue
  - Skeleton placeholder with shimmer
  - Off-main-thread image decoding
  - Error state with retry
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { loadImageWithCache, cancelLoad, PRIORITY, type Priority } from '@austencloud/image-loader';
	import { getLazyLoadController } from '@austencloud/image-loader';

	interface Props {
		/** Image source URL */
		src: string;
		/** Alt text for accessibility */
		alt: string;
		/** Optional thumbnail URL for slow connections */
		thumbnailUrl?: string;
		/** Custom loading priority (default: auto-calculated from visibility) */
		priority?: Priority;
		/** CSS class for the image */
		class?: string;
		/** Inline styles */
		style?: string;
		/** Whether to skip lazy loading (load immediately) */
		eager?: boolean;
		/** Callback when image loads successfully */
		onload?: () => void;
		/** Callback when image fails to load */
		onerror?: (error: Error) => void;
		/** Additional image attributes */
		[key: string]: unknown;
	}

	let {
		src,
		alt,
		thumbnailUrl,
		priority: initialPriority,
		class: className = '',
		style = '',
		eager = false,
		onload,
		onerror,
		...rest
	}: Props = $props();

	let container: HTMLElement;
	let loaded = $state(false);
	let error = $state<Error | null>(null);
	let objectUrl = $state<string | null>(null);
	let isVisible = $state(eager);
	let currentPriority = $state<Priority>(initialPriority ?? PRIORITY.PRELOAD);

	// Unique ID for this instance
	const instanceId = `lazy-img-${Math.random().toString(36).slice(2, 11)}`;

	// Track current src to detect changes
	let loadedSrc = $state('');

	async function load(priority: Priority): Promise<void> {
		if (loadedSrc === src && objectUrl) return; // Already loaded this src

		error = null;

		try {
			const result = await loadImageWithCache(src, {
				priority,
				thumbnailUrl
			});

			// Verify this is still the current src (could have changed during load)
			if (result.url === src || result.url === thumbnailUrl) {
				objectUrl = result.objectUrl;
				loadedSrc = src;
				loaded = true;
				onload?.();
			}
		} catch (e) {
			const err = e instanceof Error ? e : new Error(String(e));
			error = err;
			onerror?.(err);
		}
	}

	function handleVisible(priority: Priority): void {
		isVisible = true;
		currentPriority = priority;
		load(priority);
	}

	function handleHidden(): void {
		isVisible = false;
	}

	function retry(): void {
		error = null;
		load(PRIORITY.RETRY);
	}

	// Reset when src changes
	$effect(() => {
		if (src !== loadedSrc) {
			loaded = false;
			error = null;
			objectUrl = null;

			if (eager || isVisible) {
				load(currentPriority);
			}
		}
	});

	// Setup lazy loading observer
	onMount(() => {
		if (eager) {
			load(initialPriority ?? PRIORITY.CRITICAL);
			return;
		}

		const controller = getLazyLoadController();

		controller.observe({
			element: container,
			id: instanceId,
			onVisible: handleVisible,
			onHidden: handleHidden
		});

		return () => {
			controller.unobserve(container);
			cancelLoad(src);
		};
	});
</script>

<div
	bind:this={container}
	class="lazy-image-container {className}"
	{style}
	data-instance-id={instanceId}
>
	<!-- Skeleton placeholder -->
	{#if !loaded && !error}
		<div class="lazy-image-skeleton" aria-hidden="true"></div>
	{/if}

	<!-- Error state -->
	{#if error}
		<div class="lazy-image-error">
			<span class="error-icon" aria-hidden="true">⚠</span>
			<button type="button" class="retry-button" onclick={retry}>Retry</button>
		</div>
	{/if}

	<!-- Actual image -->
	{#if objectUrl && !error}
		<img
			src={objectUrl}
			{alt}
			class="lazy-image"
			class:loaded
			draggable="false"
			{...rest}
		/>
	{/if}
</div>

<style>
	.lazy-image-container {
		position: relative;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.03);
	}

	.lazy-image-skeleton {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			90deg,
			rgba(255, 255, 255, 0.03) 0%,
			rgba(255, 255, 255, 0.08) 50%,
			rgba(255, 255, 255, 0.03) 100%
		);
		background-size: 200% 100%;
		animation: skeleton-shimmer 1.5s ease-in-out infinite;
	}

	@keyframes skeleton-shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	.lazy-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0;
		transition: opacity 200ms ease-out;
	}

	.lazy-image.loaded {
		opacity: 1;
	}

	.lazy-image-error {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		background: rgba(0, 0, 0, 0.5);
		color: rgba(255, 255, 255, 0.8);
	}

	.error-icon {
		font-size: 24px;
	}

	.retry-button {
		padding: 6px 12px;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 4px;
		color: white;
		font-size: 12px;
		cursor: pointer;
		transition: background 0.15s;
	}

	.retry-button:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.retry-button:focus {
		outline: 2px solid rgba(255, 255, 255, 0.5);
		outline-offset: 2px;
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.lazy-image-skeleton {
			animation: none;
		}
		.lazy-image {
			transition: none;
			opacity: 1;
		}
	}
</style>
