/** Pure catalog operations. No Svelte, storage, or authentication dependency. */
import type { MediaTag } from './types.js';
import type { CatalogMediaItem, CatalogMediaTag, MediaCollection, MediaSearchFilters, SmartCollectionFilters, TagTreeNode } from './catalog-types.js';

export * from './catalog-types.js';

export const DEFAULT_CATEGORY_ORDER = ['performer', 'skill', 'act', 'agent', 'event', 'character', 'occasion', 'content', 'prop'];
export const DEFAULT_CATEGORY_LABELS: Record<string, string> = {
	performer: 'Performers', skill: 'Skills', act: 'Acts', agent: 'Agents', event: 'Events',
	character: 'Characters', occasion: 'Occasions', content: 'Content Type', prop: 'Props'
};
export const ENTITY_BACKED_CATEGORIES: Record<string, string> = {
	performer: 'performers', skill: 'config:subspecialties', act: 'acts', agent: 'agents',
	event: 'events', character: 'characters', occasion: 'occasions', prop: 'props'
};

export function createCategoryKey(displayName: string): string {
	return displayName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export function getCategoryLabel(category: string, persistedLabels?: Record<string, string>): string {
	return persistedLabels?.[category] || DEFAULT_CATEGORY_LABELS[category] ||
		category.replace(/[-_]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getAllCategories(tags: readonly MediaTag[], categoryOrder: readonly string[] = DEFAULT_CATEGORY_ORDER): string[] {
	const seen = new Set(categoryOrder);
	const custom: string[] = [];
	for (const tag of tags) {
		const category = tag.category ?? 'content';
		if (!seen.has(category)) { seen.add(category); custom.push(category); }
	}
	return [...categoryOrder, ...custom.sort((a, b) => getCategoryLabel(a).localeCompare(getCategoryLabel(b)))];
}

/** A category or tag with prerequisite IDs is visible when any one is active. */
export function getVisibleTagsByCategory<T extends { tag: MediaTag }>(
	categoryOrder: readonly string[], tagsByCategory: Map<string, T[]>,
	activeTagIds: readonly string[], categoryPrereqs: Record<string, string[]>
): Map<string, T[]> {
	const active = new Set(activeTagIds);
	const result = new Map<string, T[]>();
	for (const category of categoryOrder) {
		const required = categoryPrereqs[category];
		if (required?.length && !required.some((id) => active.has(id))) continue;
		const visible = (tagsByCategory.get(category) ?? []).filter(({ tag }) =>
			!tag.prereqTagIds?.length || tag.prereqTagIds.some((id) => active.has(id)));
		if (visible.length) result.set(category, visible);
	}
	return result;
}

export function normalizeCatalogTag(tag: MediaTag): CatalogMediaTag {
	return { ...tag, parentId: tag.parentId ?? null, path: tag.path?.length ? [...tag.path] : [tag.id],
		depth: tag.depth ?? 0, aliases: [...(tag.aliases ?? [])] };
}

export function assertTagCanDelete(tag: MediaTag): void {
	if (tag.linkedEntityId || tag.linkedCollection) throw new Error('This tag belongs to an entity. Remove the entity or unlink it first.');
}
export function assertTagCanChangeCategory(tag: MediaTag, category: string, entityCategories: Record<string, string> = ENTITY_BACKED_CATEGORIES): void {
	if (tag.category === category) return;
	assertTagCanDelete(tag);
	if (entityCategories[category]) throw new Error('Move into an entity category requires a canonical link.');
}
export function assertTagsCanMerge(source: MediaTag, target: MediaTag): void {
	if (source.id === target.id) throw new Error('Cannot merge a tag into itself');
	const sourceLinked = !!(source.linkedEntityId || source.linkedCollection);
	const targetLinked = !!(target.linkedEntityId || target.linkedCollection);
	if ((sourceLinked || targetLinked) &&
		(!sourceLinked || !targetLinked || source.linkedEntityId !== target.linkedEntityId || source.linkedCollection !== target.linkedCollection)) {
		throw new Error('Cannot merge tags belonging to different entities.');
	}
}

export function getTagChildren(tags: readonly CatalogMediaTag[], parentId: string): CatalogMediaTag[] {
	return tags.filter((tag) => tag.parentId === parentId);
}
export function getTagDescendants(tags: readonly CatalogMediaTag[], tagId: string): CatalogMediaTag[] {
	return tags.filter((tag) => tag.id !== tagId && tag.path.includes(tagId));
}
export function getTagAncestors(tags: readonly CatalogMediaTag[], tagId: string): CatalogMediaTag[] {
	const tag = tags.find((candidate) => candidate.id === tagId);
	if (!tag) return [];
	const byId = new Map(tags.map((candidate) => [candidate.id, candidate]));
	return tag.path.slice(0, -1).map((id) => byId.get(id)).filter((ancestor): ancestor is CatalogMediaTag => !!ancestor);
}

/** Return changed tags with paths rebuilt; reject missing parents and cycles. */
export function reparentTag(tags: readonly CatalogMediaTag[], tagId: string, newParentId: string | null): CatalogMediaTag[] {
	const byId = new Map(tags.map((tag) => [tag.id, tag]));
	const tag = byId.get(tagId);
	if (!tag) throw new Error('Tag not found');
	const parent = newParentId ? byId.get(newParentId) : null;
	if (newParentId && !parent) throw new Error('Parent tag not found');
	if (parent?.path.includes(tagId)) throw new Error('Cannot reparent a tag under one of its descendants');
	const path = parent ? [...parent.path, tagId] : [tagId];
	return tags.map((candidate) => {
		const position = candidate.path.indexOf(tagId);
		if (position < 0) return candidate;
		const nextPath = [...path, ...candidate.path.slice(position + 1)];
		return { ...candidate, ...(candidate.id === tagId ? { parentId: newParentId } : {}),
			path: nextPath, depth: nextPath.length - 1 };
	});
}

export function buildTagTree(tags: readonly CatalogMediaTag[], items: readonly Pick<CatalogMediaItem, 'tags'>[]): TagTreeNode[] {
	const byParent = new Map<string | null, CatalogMediaTag[]>();
	const counts = new Map<string, number>();
	for (const item of items) for (const id of new Set(item.tags)) counts.set(id, (counts.get(id) ?? 0) + 1);
	const ids = new Set(tags.map((tag) => tag.id));
	for (const tag of tags) {
		const parent = tag.parentId && ids.has(tag.parentId) ? tag.parentId : null;
		byParent.set(parent, [...(byParent.get(parent) ?? []), tag]);
	}
	const visit = (tag: CatalogMediaTag, ancestors: Set<string>): TagTreeNode => {
		const seen = new Set([...ancestors, tag.id]);
		const children = (byParent.get(tag.id) ?? []).filter((child) => !seen.has(child.id)).map((child) => visit(child, seen));
		return { tag, children, itemCount: counts.get(tag.id) ?? 0,
			descendantItemCount: children.reduce((sum, child) => sum + child.itemCount + child.descendantItemCount, 0) };
	};
	return (byParent.get(null) ?? []).map((tag) => visit(tag, new Set()));
}

export const DEFAULT_SMART_FILTERS: SmartCollectionFilters = {
	tags: [], excludeTags: [], tagMode: 'and', type: 'all', query: '', untaggedOnly: false,
	needsEditingOnly: false, tagCountMin: null, tagCountMax: null,
	sort: { field: 'createdAt', direction: 'desc' }
};

export function addCollectionItems(collection: MediaCollection, itemIds: readonly string[]): MediaCollection {
	if (collection.type !== 'manual') return collection;
	return { ...collection, itemIds: [...new Set([...collection.itemIds, ...itemIds])] };
}
export function removeCollectionItems(collection: MediaCollection, itemIds: readonly string[]): MediaCollection {
	if (collection.type !== 'manual') return collection;
	const removed = new Set(itemIds);
	return { ...collection, itemIds: collection.itemIds.filter((id) => !removed.has(id)) };
}

export function filterMediaItems<T extends CatalogMediaItem>(
	items: readonly T[], filters: SmartCollectionFilters | MediaSearchFilters,
	getDescendantTagIds?: (tagId: string) => string[]
): T[] {
	const search = filters as Partial<MediaSearchFilters>;
	const query = filters.query.trim().toLowerCase();
	const matchesTag = (item: T, id: string): boolean => item.tags.includes(id) ||
		(search.includeDescendants === true && !!getDescendantTagIds && getDescendantTagIds(id).some((child) => item.tags.includes(child)));
	const filtered = items.filter((item) => {
		if (query && !(item._lowerName ?? item.name.toLowerCase()).includes(query)) return false;
		if (filters.type !== 'all' && item.type !== filters.type) return false;
		if (filters.untaggedOnly && item.tags.length) return false;
		if (filters.needsEditingOnly && !item.needsEditing) return false;
		if (search.favoritesOnly && !item.favorited) return false;
		if (filters.tagCountMin !== null && item.tags.length < filters.tagCountMin) return false;
		if (filters.tagCountMax !== null && item.tags.length > filters.tagCountMax) return false;
		if (filters.tags.length && !(filters.tagMode === 'and' ? filters.tags.every((id) => matchesTag(item, id)) : filters.tags.some((id) => matchesTag(item, id)))) return false;
		if (filters.excludeTags.some((id) => matchesTag(item, id))) return false;
		if (search.dateFrom && item.createdAt < search.dateFrom) return false;
		if (search.dateTo) { const end = new Date(search.dateTo); end.setHours(23, 59, 59, 999); if (item.createdAt > end) return false; }
		if (filters.yearTaken != null && item.exif?.dateTaken?.getFullYear() !== filters.yearTaken) return false;
		if (filters.cameraMake && !item.exif?.camera?.make?.toLowerCase().includes(filters.cameraMake.toLowerCase())) return false;
		if (filters.cameraModel && !item.exif?.camera?.model?.toLowerCase().includes(filters.cameraModel.toLowerCase())) return false;
		if (filters.hasLocation && !(Number.isFinite(item.exif?.location?.latitude) && Number.isFinite(item.exif?.location?.longitude))) return false;
		return true;
	});
	const value = (item: T): string | number => {
		switch (filters.sort.field) {
			case 'createdAt': return item.createdAt.getTime();
			case 'dateTaken': return (item.exif?.dateTaken ?? item.createdAt).getTime();
			case 'name': return item.name;
			case 'tagCount': return item.tags.length;
			case 'size': return item.size;
		}
	};
	const direction = filters.sort.direction === 'asc' ? 1 : -1;
	return [...filtered].sort((a, b) => { const left = value(a), right = value(b); return (left < right ? -1 : left > right ? 1 : 0) * direction; });
}

export function getCollectionItems<T extends CatalogMediaItem>(collection: MediaCollection, items: readonly T[]): T[] {
	if (collection.type === 'smart' && collection.filters) return filterMediaItems(items, collection.filters);
	if (collection.type === 'smart') return [];
	const ids = new Set(collection.itemIds);
	return items.filter((item) => ids.has(item.id));
}
