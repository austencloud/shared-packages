/**
 * @austencloud/image-loader
 *
 * Framework-agnostic image loading with multi-tier caching, priority queuing,
 * and lazy loading. Pure TypeScript, zero dependencies.
 *
 * Features:
 * - Multi-tier caching (memory L2 → IndexedDB L1 → network)
 * - Connection-aware concurrency limiting
 * - Priority-based request queuing
 * - IntersectionObserver-based lazy loading
 * - Off-main-thread image decoding
 *
 * For Svelte bindings (LazyImage component, use:lazyImage action),
 * see @austencloud/image-loader-svelte
 *
 * Usage:
 * ```ts
 * import { loadImageWithCache, PRIORITY } from '@austencloud/image-loader';
 *
 * const result = await loadImageWithCache(url, { priority: PRIORITY.CRITICAL });
 * img.src = result.objectUrl;
 * ```
 */

// Main image loader API
export {
	loadImageWithCache,
	preloadImages,
	cancelLoad,
	revokeObjectUrl,
	clearAllCaches,
	getCacheStats,
	getLoadingProgress,
	onLoadingProgress,
	warmupCache,
	PRIORITY,
	type Priority,
	type LoadOptions,
	type LoadResult
} from './image-loader.js';

// Connection quality detection
export {
	getConnectionInfo,
	getLoadingStrategy,
	onConnectionChange,
	shouldUseReducedQuality,
	type ConnectionInfo,
	type ConnectionType,
	type LoadingStrategy
} from './connection-quality.js';

// Request queue (for advanced usage)
export { getRequestQueue, loadImage, loadImageBlob } from './request-queue.js';

// Blob cache (for advanced usage)
export { getBlobCache, type CacheStats } from './blob-cache.js';

// Lazy load controller (for advanced usage)
export {
	getLazyLoadController,
	createLazyLoadAction,
	type LazyLoadOptions,
	type ObservedElement
} from './lazy-load-controller.js';
