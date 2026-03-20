/**
 * Image Loader Orchestrator
 *
 * Coordinates the multi-tier caching pipeline:
 * 1. Memory cache (L2) - instant, session-scoped
 * 2. IndexedDB cache (L1) - fast, persistent
 * 3. Network with priority queue - connection-aware
 *
 * Provides a single entry point for loading images with all optimizations.
 */

import { getBlobCache } from './blob-cache.js';
import { getRequestQueue, PRIORITY, type Priority } from './request-queue.js';
import { shouldUseReducedQuality } from './connection-quality.js';

export interface LoadOptions {
	/** Loading priority (default: PARTIAL) */
	priority?: Priority;
	/** Thumbnail URL for slow connections */
	thumbnailUrl?: string;
	/** Skip cache lookup (force network) */
	skipCache?: boolean;
	/** Abort signal for cancellation */
	signal?: AbortSignal;
	/** Progress callback (0-1) */
	onProgress?: (progress: number) => void;
}

export interface LoadResult {
	url: string;
	objectUrl: string;
	fromCache: boolean;
	tier: 'memory' | 'indexeddb' | 'network';
}

// Memory cache for object URLs (prevents repeated blob URL creation)
const objectUrlCache = new Map<string, string>();

// Track which URLs are currently loading (for deduplication)
const loadingPromises = new Map<string, Promise<LoadResult>>();

// Track loading progress per URL (0-1)
const loadingProgress = new Map<string, number>();

// Progress listeners per URL
const progressListeners = new Map<string, Set<(progress: number) => void>>();

/**
 * Check if a URL is a data URL or blob URL (already loaded, no fetch needed)
 */
function isInlineUrl(url: string): boolean {
	return url.startsWith('data:') || url.startsWith('blob:');
}

/**
 * Notify progress listeners for a URL
 */
function notifyProgress(url: string, progress: number): void {
	loadingProgress.set(url, progress);
	const listeners = progressListeners.get(url);
	if (listeners) {
		for (const listener of listeners) {
			listener(progress);
		}
	}
}

/**
 * Fetch with progress tracking using ReadableStream
 */
async function fetchWithProgress(
	url: string,
	signal?: AbortSignal,
	onProgress?: (progress: number) => void
): Promise<Blob> {
	const response = await fetch(url, { signal });

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${url}`);
	}

	// If no content-length header, we can't track progress accurately
	const contentLength = response.headers.get('content-length');
	if (!contentLength || !response.body) {
		onProgress?.(0.5); // Indeterminate - show 50%
		return response.blob();
	}

	const total = parseInt(contentLength, 10);
	let loaded = 0;

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];

	while (true) {
		const { done, value } = await reader.read();

		if (done) break;

		chunks.push(value);
		loaded += value.length;

		const progress = Math.min(loaded / total, 0.99); // Cap at 99% until fully loaded
		onProgress?.(progress);
		notifyProgress(url, progress);
	}

	// Combine chunks into blob
	const blob = new Blob(chunks as BlobPart[], { type: response.headers.get('content-type') || 'image/jpeg' });
	onProgress?.(1);
	notifyProgress(url, 1);

	return blob;
}

/**
 * Decode an image blob off the main thread using createImageBitmap.
 * This prevents jank when loading many images by moving decode work to a background thread.
 * The decoded ImageBitmap is immediately closed (we don't need it) - the browser caches the decode.
 */
async function decodeImageOffMainThread(blob: Blob): Promise<void> {
	// Skip if createImageBitmap isn't available (old browsers)
	if (typeof createImageBitmap !== 'function') {
		return;
	}

	// Skip videos and non-image blobs
	if (!blob.type.startsWith('image/')) {
		return;
	}

	try {
		// This decodes the image in a background thread
		const bitmap = await createImageBitmap(blob);
		// Close immediately - we just wanted to trigger the decode
		// The browser keeps the decoded data cached for when the blob URL is used
		bitmap.close();
	} catch {
		// Decode failed (corrupted image, unsupported format, etc.)
		// Fall through - the <img> tag will handle the error
	}
}

/**
 * Load an image with full caching pipeline
 */
export async function loadImageWithCache(
	url: string,
	options: LoadOptions = {}
): Promise<LoadResult> {
	const {
		priority = PRIORITY.PARTIAL,
		thumbnailUrl,
		skipCache = false,
		signal,
		onProgress
	} = options;

	// Use thumbnail on slow connections if available
	const effectiveUrl = shouldUseReducedQuality() && thumbnailUrl ? thumbnailUrl : url;

	// Data URLs and blob URLs don't need fetching - return them directly
	// These are already fully loaded and usable as image sources
	if (isInlineUrl(effectiveUrl)) {
		onProgress?.(1);
		return {
			url: effectiveUrl,
			objectUrl: effectiveUrl, // Use the URL directly
			fromCache: true,
			tier: 'memory'
		};
	}

	const cacheKey = effectiveUrl;

	// Register progress listener if provided
	if (onProgress) {
		if (!progressListeners.has(cacheKey)) {
			progressListeners.set(cacheKey, new Set());
		}
		progressListeners.get(cacheKey)!.add(onProgress);

		// If already loading, send current progress
		const currentProgress = loadingProgress.get(cacheKey);
		if (currentProgress !== undefined) {
			onProgress(currentProgress);
		}
	}

	// Check if already loading (deduplication)
	const existing = loadingPromises.get(cacheKey);
	if (existing) {
		return existing.finally(() => {
			// Cleanup listener
			if (onProgress) {
				progressListeners.get(cacheKey)?.delete(onProgress);
			}
		});
	}

	// Check if aborted
	if (signal?.aborted) {
		throw new Error('Aborted');
	}

	const loadPromise = (async (): Promise<LoadResult> => {
		try {
			// Tier 1: Check memory cache (object URL cache)
			const cachedObjectUrl = objectUrlCache.get(cacheKey);
			if (cachedObjectUrl && !skipCache) {
				onProgress?.(1);
				return {
					url: effectiveUrl,
					objectUrl: cachedObjectUrl,
					fromCache: true,
					tier: 'memory'
				};
			}

			// Tier 2: Check IndexedDB cache
			if (!skipCache) {
				const cache = getBlobCache();
				const cachedBlob = await cache.get(cacheKey);

				if (cachedBlob) {
					// Decode off main thread even for cached images
					await decodeImageOffMainThread(cachedBlob);

					const objectUrl = URL.createObjectURL(cachedBlob);
					objectUrlCache.set(cacheKey, objectUrl);
					onProgress?.(1);

					return {
						url: effectiveUrl,
						objectUrl,
						fromCache: true,
						tier: 'indexeddb'
					};
				}
			}

			// Tier 3: Network fetch with priority queue and progress tracking
			const queue = getRequestQueue();

			// Initialize progress
			notifyProgress(cacheKey, 0);

			const blob = await queue.enqueue(cacheKey, priority, async () => {
				return fetchWithProgress(effectiveUrl, signal, onProgress);
			});

			// Decode image off the main thread to prevent jank
			// This runs the decode in a background thread before the <img> needs it
			await decodeImageOffMainThread(blob);

			// Store in IndexedDB cache (async, non-blocking)
			const cache = getBlobCache();
			cache.set(cacheKey, blob).catch(() => {
				/* Ignore cache errors */
			});

			// Create and cache object URL
			const objectUrl = URL.createObjectURL(blob);
			objectUrlCache.set(cacheKey, objectUrl);

			return {
				url: effectiveUrl,
				objectUrl,
				fromCache: false,
				tier: 'network'
			};
		} finally {
			loadingPromises.delete(cacheKey);
			loadingProgress.delete(cacheKey);
			// Cleanup all listeners for this URL
			progressListeners.delete(cacheKey);
		}
	})();

	loadingPromises.set(cacheKey, loadPromise);
	return loadPromise;
}

/**
 * Get current loading progress for a URL (0-1, or undefined if not loading)
 */
export function getLoadingProgress(url: string): number | undefined {
	return loadingProgress.get(url);
}

/**
 * Subscribe to loading progress for a URL
 */
export function onLoadingProgress(url: string, callback: (progress: number) => void): () => void {
	if (!progressListeners.has(url)) {
		progressListeners.set(url, new Set());
	}
	progressListeners.get(url)!.add(callback);

	// Send current progress if available
	const current = loadingProgress.get(url);
	if (current !== undefined) {
		callback(current);
	}

	return () => {
		progressListeners.get(url)?.delete(callback);
	};
}

/**
 * Preload images in the background
 */
export function preloadImages(urls: string[], priority: Priority = PRIORITY.PRELOAD): void {
	for (const url of urls) {
		loadImageWithCache(url, { priority }).catch(() => {
			/* Ignore preload failures */
		});
	}
}

/**
 * Cancel a pending image load
 */
export function cancelLoad(url: string): void {
	const queue = getRequestQueue();
	queue.cancel(url);
	loadingPromises.delete(url);
	loadingProgress.delete(url);
	progressListeners.delete(url);
}

/**
 * Revoke an object URL and remove from cache
 */
export function revokeObjectUrl(url: string): void {
	const objectUrl = objectUrlCache.get(url);
	if (objectUrl) {
		URL.revokeObjectURL(objectUrl);
		objectUrlCache.delete(url);
	}
}

/**
 * Clear all caches (useful for memory pressure)
 */
export async function clearAllCaches(): Promise<void> {
	// Revoke all object URLs
	for (const objectUrl of objectUrlCache.values()) {
		URL.revokeObjectURL(objectUrl);
	}
	objectUrlCache.clear();

	// Clear IndexedDB
	const cache = getBlobCache();
	await cache.clear();

	// Cancel all pending loads
	const queue = getRequestQueue();
	queue.cancelAll();

	// Clear progress tracking
	loadingProgress.clear();
	progressListeners.clear();
}

/**
 * Pre-warm the cache from IndexedDB on app startup.
 * Call this early in your app lifecycle for instant cache hits.
 * Returns the number of entries loaded into memory.
 */
export async function warmupCache(maxEntries: number = 100): Promise<number> {
	const cache = getBlobCache();
	return cache.warmup(maxEntries);
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
	memory: { count: number };
	indexeddb: { count: number; sizeBytes: number };
	queue: { queued: number; active: number; completed: number; failed: number };
}> {
	const cache = getBlobCache();
	const queue = getRequestQueue();

	const [indexeddbStats, queueStats] = await Promise.all([cache.getStats(), queue.getStats()]);

	return {
		memory: { count: objectUrlCache.size },
		indexeddb: indexeddbStats,
		queue: queueStats
	};
}

// Re-export priority constants for convenience
export { PRIORITY };
export type { Priority };
