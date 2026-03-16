/**
 * @austencloud/media-manager
 *
 * Reusable media management UI: tag manager, media grid, curator, and spotlight integration.
 */

// ─── Types & Utilities ────────────────────────────────────────────────────────

export {
	TAG_COLORS,
	CATEGORY_ORDER,
	DEFAULT_CATEGORY_LABELS,
	DEFAULT_LIBRARY_STATE,
	getTagHex,
	getCategoryLabel
} from './types.js';

export type {
	TagColor,
	TagCategory,
	MediaTag,
	MediaItem,
	MediaLibraryState,
	CuratorProgress,
	CuratorConfig
} from './types.js';

// ─── Tag Management Components ───────────────────────────────────────────────

export { default as TagChip } from './tags/TagChip.svelte';
export { default as TagManagerColorPicker } from './tags/TagManagerColorPicker.svelte';
export { default as TagManagerCategoryPicker } from './tags/TagManagerCategoryPicker.svelte';
export { default as TagManagerInlineCreate } from './tags/TagManagerInlineCreate.svelte';
export { default as TagManagerTagRow } from './tags/TagManagerTagRow.svelte';
export { default as TagManagerToolbar } from './tags/TagManagerToolbar.svelte';
export { default as TagManagerBatchBar } from './tags/TagManagerBatchBar.svelte';
export { default as TagManager } from './tags/TagManager.svelte';

// ─── Media Grid Components ───────────────────────────────────────────────────

export { default as MediaGridItem } from './grid/MediaGridItem.svelte';
export { default as MediaGrid } from './grid/MediaGrid.svelte';
export { default as MediaToolbar } from './grid/MediaToolbar.svelte';
export { default as TagPickerPanel } from './grid/TagPickerPanel.svelte';
export { default as TagSidebar } from './grid/TagSidebar.svelte';

// ─── Loading Components ──────────────────────────────────────────────────────

export { default as ShimmerBlock } from './loading/ShimmerBlock.svelte';

// ─── Curator Service ─────────────────────────────────────────────────────────

export { createMediaCurator } from './curator/media-curator.svelte.js';
export type { CuratorMode, MediaCurator } from './curator/media-curator.svelte.js';

// ─── Spotlight Integration ───────────────────────────────────────────────────

export { default as MediaSpotlightCurator } from './spotlight/MediaSpotlightCurator.svelte';
