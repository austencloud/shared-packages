/**
 * Media Curator Controller
 *
 * Generalized state machine for curating media items one at a time.
 * Handles navigation, filtering, and progress tracking.
 * Does NOT include any Firebase/storage references — purely UI state management.
 */
import type { MediaItem, MediaTag, CuratorProgress, CuratorConfig } from '../types.js';

export type CuratorMode = 'closed' | 'curate';

export interface MediaCurator {
	// State (reactive)
	readonly mode: CuratorMode;
	readonly currentIndex: number;
	readonly items: MediaItem[];
	readonly tags: MediaTag[];

	// Computed
	readonly currentItem: MediaItem | null;
	readonly workingItems: MediaItem[];
	readonly progress: CuratorProgress;
	readonly isOpen: boolean;
	readonly canGoNext: boolean;
	readonly canGoPrev: boolean;

	// Actions
	open: (startItem?: MediaItem) => void;
	close: () => void;
	next: () => void;
	prev: () => void;
	goToIndex: (index: number) => void;

	// Tag helpers
	hasTag: (tagId: string) => boolean;

	// Sync external updates
	syncItems: (items: MediaItem[]) => void;
	syncTags: (tags: MediaTag[]) => void;
}

export function createMediaCurator(config: CuratorConfig): MediaCurator {
	// Reactive state
	let mode = $state<CuratorMode>('closed');
	let currentIndex = $state(config.startIndex ?? 0);
	let items = $state<MediaItem[]>(config.items);
	let tags = $state<MediaTag[]>(config.tags);

	// Snapshot of item IDs captured when curator opens in filtered mode.
	// Items stay in the working set even after tagging so users can apply multiple tags.
	let workingItemIds = $state<Set<string> | null>(null);

	// Apply custom sort if provided
	function getSortedItems(sourceItems: MediaItem[]): MediaItem[] {
		if (config.sortFn) {
			return [...sourceItems].sort(config.sortFn);
		}
		return sourceItems;
	}

	// Filter items based on mode
	const workingItems = $derived.by(() => {
		let filtered: MediaItem[];

		if (workingItemIds) {
			// Use snapshot from open()
			filtered = items.filter((item) => workingItemIds!.has(item.id));
		} else if (config.filterFn) {
			filtered = items.filter(config.filterFn);
		} else if (config.filterMode === 'untagged') {
			filtered = items.filter((item) => item.tags.length === 0);
		} else if (config.filterMode === 'needsReview') {
			filtered = items.filter((item) => item.needsReview);
		} else {
			filtered = items;
		}

		return getSortedItems(filtered);
	});

	// Computed values
	const currentItem = $derived(
		workingItems.length > 0 && currentIndex >= 0 && currentIndex < workingItems.length
			? (workingItems[currentIndex] ?? null)
			: null
	);

	const progress: CuratorProgress = $derived({
		current: currentIndex + 1,
		total: workingItems.length,
		percent: workingItems.length > 0 ? ((currentIndex + 1) / workingItems.length) * 100 : 0
	});

	const isOpen = $derived(mode !== 'closed');
	const canGoNext = $derived(currentIndex < workingItems.length - 1);
	const canGoPrev = $derived(currentIndex > 0);

	return {
		get mode() {
			return mode;
		},
		get currentIndex() {
			return currentIndex;
		},
		get items() {
			return items;
		},
		get tags() {
			return tags;
		},
		get currentItem() {
			return currentItem;
		},
		get workingItems() {
			return workingItems;
		},
		get progress() {
			return progress;
		},
		get isOpen() {
			return isOpen;
		},
		get canGoNext() {
			return canGoNext;
		},
		get canGoPrev() {
			return canGoPrev;
		},

		// Navigation
		open(startItem?: MediaItem) {
			// Snapshot the working set so items don't vanish mid-curation
			const filterFn = config.filterFn;
			const filterMode = config.filterMode;

			if (filterFn) {
				workingItemIds = new Set(items.filter(filterFn).map((item) => item.id));
			} else if (filterMode === 'untagged') {
				workingItemIds = new Set(
					items.filter((item) => item.tags.length === 0).map((item) => item.id)
				);
			} else if (filterMode === 'needsReview') {
				workingItemIds = new Set(
					items.filter((item) => item.needsReview).map((item) => item.id)
				);
			}

			if (startItem) {
				const idx = workingItems.findIndex((item) => item.id === startItem.id);
				currentIndex = idx >= 0 ? idx : 0;
			} else {
				currentIndex = 0;
			}
			mode = 'curate';
		},

		close() {
			mode = 'closed';
			workingItemIds = null;
		},

		next() {
			if (canGoNext) {
				currentIndex++;
				config.onchange?.(currentIndex);
			}
		},

		prev() {
			if (canGoPrev) {
				currentIndex--;
				config.onchange?.(currentIndex);
			}
		},

		goToIndex(index: number) {
			if (index >= 0 && index < workingItems.length) {
				currentIndex = index;
				config.onchange?.(currentIndex);
			}
		},

		hasTag(tagId: string) {
			return currentItem?.tags.includes(tagId) ?? false;
		},

		syncItems(newItems: MediaItem[]) {
			items = newItems;
			config.onitemsupdate?.(newItems);
		},

		syncTags(newTags: MediaTag[]) {
			tags = newTags;
		}
	};
}
