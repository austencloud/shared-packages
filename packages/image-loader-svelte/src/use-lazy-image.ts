/**
 * Svelte Action: use:lazyImage
 *
 * Apply lazy loading to any existing <img> element.
 *
 * Usage:
 * ```svelte
 * <img use:lazyImage={{ src: imageUrl, thumbnailUrl }} alt="..." />
 * ```
 */

import { loadImageWithCache, cancelLoad, PRIORITY, type Priority } from '@austencloud/image-loader';
import { getLazyLoadController } from '@austencloud/image-loader';

export interface LazyImageParams {
	/** The image source URL */
	src: string;
	/** Optional thumbnail for slow connections */
	thumbnailUrl?: string;
	/** Whether to load immediately (skip lazy loading) */
	eager?: boolean;
	/** Callback when loaded */
	onload?: () => void;
	/** Callback on error */
	onerror?: (error: Error) => void;
}

/**
 * Svelte action for lazy loading images
 */
export function lazyImage(node: HTMLImageElement, params: LazyImageParams) {
	const instanceId = `use-lazy-${Math.random().toString(36).slice(2, 11)}`;
	let currentSrc = '';
	let isVisible = params.eager ?? false;
	let currentPriority: Priority = PRIORITY.PRELOAD;

	// Add skeleton class while loading
	node.classList.add('lazy-image-loading');

	async function load(priority: Priority): Promise<void> {
		if (currentSrc === params.src) return;

		try {
			const result = await loadImageWithCache(params.src, {
				priority,
				thumbnailUrl: params.thumbnailUrl
			});

			if (result.url === params.src || result.url === params.thumbnailUrl) {
				node.src = result.objectUrl;
				currentSrc = params.src;
				node.classList.remove('lazy-image-loading');
				node.classList.add('lazy-image-loaded');
				params.onload?.();
			}
		} catch (e) {
			node.classList.remove('lazy-image-loading');
			node.classList.add('lazy-image-error');
			const err = e instanceof Error ? e : new Error(String(e));
			params.onerror?.(err);
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

	// Setup observer
	const controller = getLazyLoadController();

	if (params.eager) {
		load(PRIORITY.CRITICAL);
	} else {
		controller.observe({
			element: node,
			id: instanceId,
			onVisible: handleVisible,
			onHidden: handleHidden
		});
	}

	return {
		update(newParams: LazyImageParams) {
			params = newParams;

			// If src changed and we're visible, reload
			if (params.src !== currentSrc && isVisible) {
				node.classList.remove('lazy-image-loaded', 'lazy-image-error');
				node.classList.add('lazy-image-loading');
				load(currentPriority);
			}
		},
		destroy() {
			controller.unobserve(node);
			cancelLoad(params.src);
		}
	};
}

/**
 * CSS styles to inject for the action (optional, can use your own)
 */
export const lazyImageStyles = `
.lazy-image-loading {
  opacity: 0;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.03) 0%,
    rgba(255, 255, 255, 0.08) 50%,
    rgba(255, 255, 255, 0.03) 100%
  );
  background-size: 200% 100%;
  animation: lazy-image-shimmer 1.5s ease-in-out infinite;
}

.lazy-image-loaded {
  opacity: 1;
  transition: opacity 200ms ease-out;
}

.lazy-image-error {
  opacity: 0.5;
}

@keyframes lazy-image-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .lazy-image-loading {
    animation: none;
  }
  .lazy-image-loaded {
    transition: none;
  }
}
`;
