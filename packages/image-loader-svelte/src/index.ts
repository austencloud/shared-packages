/**
 * @austencloud/image-loader-svelte
 *
 * Svelte bindings for @austencloud/image-loader
 *
 * Provides:
 * - LazyImage component: Drop-in <img> replacement with lazy loading
 * - lazyImage action: use:lazyImage directive for existing images
 */

// Re-export core functionality for convenience
export {
	loadImageWithCache,
	cancelLoad,
	PRIORITY,
	getBlobCache,
	type Priority,
	type LoadResult,
	type CacheStats
} from '@austencloud/image-loader';

// Svelte-specific exports
export { default as LazyImage } from './LazyImage.svelte';
export { lazyImage, lazyImageStyles, type LazyImageParams } from './use-lazy-image.js';
