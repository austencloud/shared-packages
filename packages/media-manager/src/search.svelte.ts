/** Reactive search controller shared by media library clients. */

import { filterMediaItems } from './catalog.js';
import type { CatalogMediaItem as MediaItem, MediaSearchFilters, SortField } from './catalog-types.js';

export type { MediaSearchFilters, SortField } from './catalog-types.js';

export interface MediaSearchController {
	readonly filters: MediaSearchFilters;
	readonly activeFilterCount: number;
	readonly hasActiveFilters: boolean;

	setQuery(query: string): void;
	addTag(tagId: string): void;
	removeTag(tagId: string): void;
	toggleTag(tagId: string): void;
	addExcludeTag(tagId: string): void;
	removeExcludeTag(tagId: string): void;
	setTagMode(mode: 'and' | 'or'): void;
	setType(type: 'all' | 'image' | 'video' | 'document' | 'audio'): void;
	setDateFrom(date: Date | null): void;
	setDateTo(date: Date | null): void;
	setUntaggedOnly(value: boolean): void;
	setNeedsEditingOnly(value: boolean): void;
	setIncludeDescendants(value: boolean): void;
	setTagCountMin(value: number | null): void;
	setTagCountMax(value: number | null): void;
	setSort(field: SortField, direction?: 'asc' | 'desc'): void;
	// EXIF-based filter setters
	setYearTaken(value: number | null): void;
	setCameraMake(value: string | null): void;
	setHasLocation(value: boolean): void;
	// Curation
	setFavoritesOnly(value: boolean): void;
	clearTags(): void;
	clearAll(): void;

	apply(items: MediaItem[], getDescendantTagIds?: (tagId: string) => string[]): MediaItem[];
}

function createDefaultFilters(): MediaSearchFilters {
	return {
		query: '',
		tags: [],
		excludeTags: [],
		tagMode: 'and',
		type: 'all',
		dateFrom: null,
		dateTo: null,
		untaggedOnly: false,
		needsEditingOnly: false,
		includeDescendants: false,
		tagCountMin: null,
		tagCountMax: null,
		sort: { field: 'createdAt', direction: 'desc' },
		// EXIF-based filters
		yearTaken: null,
		cameraMake: null,
		hasLocation: false,
		// Curation
		favoritesOnly: false,
	};
}

export function createMediaSearchController(): MediaSearchController {
	let filters = $state<MediaSearchFilters>(createDefaultFilters());
	// Debounced query: filters.query updates immediately (for input display),
	// but _debouncedQuery lags by 300ms (used for actual filtering).
	let _debouncedQuery = $state('');
	let _debounceTimer: ReturnType<typeof setTimeout> | undefined;

	const activeFilterCount = $derived.by(() => {
		let count = 0;
		if (filters.query.trim()) count++;
		if (filters.tags.length > 0) count++;
		if (filters.excludeTags.length > 0) count++;
		if (filters.type !== 'all') count++;
		if (filters.dateFrom) count++;
		if (filters.dateTo) count++;
		if (filters.untaggedOnly) count++;
		if (filters.needsEditingOnly) count++;
		if (filters.tagCountMin !== null) count++;
		if (filters.tagCountMax !== null) count++;
		// EXIF-based filters
		if (filters.yearTaken !== null) count++;
		if (filters.cameraMake !== null) count++;
		if (filters.hasLocation) count++;
		// Curation
		if (filters.favoritesOnly) count++;
		return count;
	});

	const hasActiveFilters = $derived(activeFilterCount > 0);

	function apply(items: MediaItem[], getDescendantTagIds?: (tagId: string) => string[]): MediaItem[] {
		return filterMediaItems(items, { ...filters, query: _debouncedQuery }, getDescendantTagIds);
	}

	return {
		get filters() {
			return filters;
		},
		get activeFilterCount() {
			return activeFilterCount;
		},
		get hasActiveFilters() {
			return hasActiveFilters;
		},

		setQuery(query: string) {
			filters = { ...filters, query };
			// Debounce the actual filtering query by 300ms
			clearTimeout(_debounceTimer);
			_debounceTimer = setTimeout(() => {
				_debouncedQuery = query;
			}, 300);
			// If query is cleared, update immediately (no lag on clearing)
			if (!query.trim()) {
				clearTimeout(_debounceTimer);
				_debouncedQuery = '';
			}
		},
		addTag(tagId: string) {
			if (!filters.tags.includes(tagId)) {
				filters = { ...filters, tags: [...filters.tags, tagId] };
			}
		},
		removeTag(tagId: string) {
			filters = { ...filters, tags: filters.tags.filter((t) => t !== tagId) };
		},
		toggleTag(tagId: string) {
			if (filters.tags.includes(tagId)) {
				filters = { ...filters, tags: filters.tags.filter((t) => t !== tagId) };
			} else {
				filters = { ...filters, tags: [...filters.tags, tagId] };
			}
		},
		addExcludeTag(tagId: string) {
			if (!filters.excludeTags.includes(tagId)) {
				// Remove from include if present
				const tags = filters.tags.filter((t) => t !== tagId);
				filters = { ...filters, tags, excludeTags: [...filters.excludeTags, tagId] };
			}
		},
		removeExcludeTag(tagId: string) {
			filters = { ...filters, excludeTags: filters.excludeTags.filter((t) => t !== tagId) };
		},
		setTagMode(mode: 'and' | 'or') {
			filters = { ...filters, tagMode: mode };
		},
		setType(type: 'all' | 'image' | 'video' | 'document' | 'audio') {
			filters = { ...filters, type };
		},
		setDateFrom(date: Date | null) {
			filters = { ...filters, dateFrom: date };
		},
		setDateTo(date: Date | null) {
			filters = { ...filters, dateTo: date };
		},
		setUntaggedOnly(value: boolean) {
			filters = { ...filters, untaggedOnly: value };
		},
		setNeedsEditingOnly(value: boolean) {
			filters = { ...filters, needsEditingOnly: value };
		},
		setIncludeDescendants(value: boolean) {
			filters = { ...filters, includeDescendants: value };
		},
		setTagCountMin(value: number | null) {
			filters = { ...filters, tagCountMin: value };
		},
		setTagCountMax(value: number | null) {
			filters = { ...filters, tagCountMax: value };
		},
		setSort(field: SortField, direction?: 'asc' | 'desc') {
			// If same field, toggle direction. Otherwise use provided or default.
			if (field === filters.sort.field && direction === undefined) {
				filters = {
					...filters,
					sort: { field, direction: filters.sort.direction === 'asc' ? 'desc' : 'asc' },
				};
			} else {
				const defaultDir: Record<SortField, 'asc' | 'desc'> = {
					createdAt: 'desc',
					dateTaken: 'desc',
					name: 'asc',
					tagCount: 'asc',
					size: 'desc',
				};
				filters = {
					...filters,
					sort: { field, direction: direction ?? defaultDir[field] },
				};
			}
		},
		// EXIF-based filter setters
		setYearTaken(value: number | null) {
			filters = { ...filters, yearTaken: value };
		},
		setCameraMake(value: string | null) {
			filters = { ...filters, cameraMake: value };
		},
		setHasLocation(value: boolean) {
			filters = { ...filters, hasLocation: value };
		},
		setFavoritesOnly(value: boolean) {
			filters = { ...filters, favoritesOnly: value };
		},
		clearTags() {
			filters = { ...filters, tags: [], excludeTags: [], untaggedOnly: false };
		},
		clearAll() {
			filters = createDefaultFilters();
			clearTimeout(_debounceTimer);
			_debouncedQuery = '';
		},

		apply,
	};
}
