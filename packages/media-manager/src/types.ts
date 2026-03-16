/**
 * Media Manager Types
 *
 * Generalized type definitions for media management across apps.
 * Merged from OCC Admin and Cirque Aflame's ringmaster.
 */

// ─── Tag Colors ───────────────────────────────────────────────────────────────

export type TagColor =
	| 'flame'
	| 'gold'
	| 'royal'
	| 'cyan'
	| 'green'
	| 'red'
	| 'purple'
	| 'navy'
	| 'teal'
	| 'pink'
	| 'lime'
	| 'gray';

/** Hex colors for each TagColor value. */
export const TAG_COLORS: { value: TagColor; hex: string }[] = [
	{ value: 'flame', hex: '#f97316' },
	{ value: 'gold', hex: '#eab308' },
	{ value: 'royal', hex: '#8b5cf6' },
	{ value: 'cyan', hex: '#06b6d4' },
	{ value: 'green', hex: '#22c55e' },
	{ value: 'red', hex: '#ef4444' },
	{ value: 'purple', hex: '#a855f7' },
	{ value: 'navy', hex: '#1e40af' },
	{ value: 'teal', hex: '#0d9488' },
	{ value: 'pink', hex: '#ec4899' },
	{ value: 'lime', hex: '#84cc16' },
	{ value: 'gray', hex: '#6b7280' }
];

/** Look up the hex color for a tag. */
export function getTagHex(tag: MediaTag): string {
	return TAG_COLORS.find((c) => c.value === tag.color)?.hex ?? '#6b7280';
}

// ─── Tag Category ─────────────────────────────────────────────────────────────

/**
 * Tag category — a generic string type.
 * Each consuming app defines its own categories (e.g., 'garment', 'technique', 'act', 'prop').
 */
export type TagCategory = string;

/**
 * Default category display order.
 * Apps should override this with their own order via the `categoryOrder` prop.
 */
export const CATEGORY_ORDER: string[] = ['custom'];

/**
 * Default category labels. Apps provide their own via `categoryLabels` in MediaLibraryState.
 */
export const DEFAULT_CATEGORY_LABELS: Record<string, string> = {
	custom: 'Custom'
};

/**
 * Get the display label for a category.
 * Falls back to title-casing the key.
 */
export function getCategoryLabel(
	category: string,
	persistedLabels?: Record<string, string>
): string {
	if (persistedLabels?.[category]) return persistedLabels[category]!;
	if (category in DEFAULT_CATEGORY_LABELS) return DEFAULT_CATEGORY_LABELS[category]!;
	return category.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

// ─── MediaTag ─────────────────────────────────────────────────────────────────

export interface MediaTag {
	id: string;
	name: string;
	color: TagColor;
	category: TagCategory;
	description?: string;
	createdAt: Date;
	updatedAt: Date;
}

// ─── MediaItem ────────────────────────────────────────────────────────────────

/**
 * A single media item in the library.
 * Merged from OCC Admin's MediaItem and the spotlight package's MediaItem.
 * Includes an index signature for app-specific fields.
 */
export interface MediaItem {
	id: string;
	filename: string;
	url: string;
	thumbnailUrl: string;
	tags: string[];
	description: string;
	suggestedName: string;
	needsReview: boolean;
	sizeFromFilename?: string;
	notes?: string;
	createdAt: Date;
	updatedAt: Date;
	/** Allow app-specific fields */
	[key: string]: unknown;
}

// ─── MediaLibraryState ────────────────────────────────────────────────────────

export interface MediaLibraryState {
	gridSize: number;
	searchQuery: string;
	activeTags: string[];
	filterMode: 'and' | 'or';
	categoryLabels: Record<string, string>;
}

/** Default state for a fresh media library. */
export const DEFAULT_LIBRARY_STATE: MediaLibraryState = {
	gridSize: 4,
	searchQuery: '',
	activeTags: [],
	filterMode: 'or',
	categoryLabels: {}
};

// ─── Curator Types ────────────────────────────────────────────────────────────

export interface CuratorProgress {
	current: number;
	total: number;
	percent: number;
}

export interface CuratorConfig {
	items: MediaItem[];
	tags: MediaTag[];
	filterMode?: 'all' | 'untagged' | 'needsReview';
	filterFn?: (item: MediaItem) => boolean;
	sortFn?: (a: MediaItem, b: MediaItem) => number;
	startIndex?: number;
	onchange?: (index: number) => void;
	onitemsupdate?: (items: MediaItem[]) => void;
}
