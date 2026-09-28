/** Pure folder hierarchy rules over storage-neutral collection records. */
import type { MediaCollection } from './catalog-types.js';

export type FolderCollection = Pick<MediaCollection, 'id' | 'type' | 'parentId' | 'itemIds'>;

export interface FolderTreeNode<T extends FolderCollection = MediaCollection> {
	collection: T;
	children: FolderTreeNode<T>[];
	depth: number;
}

const MAX_DEPTH = 3;

/** Build a tree of manual collections, promoting missing parents to root. */
export function buildFolderTree<T extends FolderCollection>(collections: readonly T[]): FolderTreeNode<T>[] {
	const manual = collections.filter((collection) => collection.type === 'manual');
	const ids = new Set(manual.map((collection) => collection.id));
	const children = new Map<string | null, T[]>();
	for (const collection of manual) {
		const parentId = collection.parentId && ids.has(collection.parentId) ? collection.parentId : null;
		const group = children.get(parentId) ?? [];
		group.push(collection);
		children.set(parentId, group);
	}

	const visited = new Set<string>();
	function buildNode(collection: T, depth: number): FolderTreeNode<T> {
		visited.add(collection.id);
		return {
			collection,
			children: (children.get(collection.id) ?? [])
				.filter((child) => !visited.has(child.id))
				.map((child) => buildNode(child, depth + 1)),
			depth
		};
	}
	return (children.get(null) ?? []).map((collection) => buildNode(collection, 0));
}

/** Return all manual descendant IDs, protecting against cycles. */
export function getDescendantIds<T extends FolderCollection>(collections: readonly T[], parentId: string): string[] {
	const children = new Map<string, T[]>();
	for (const collection of collections) {
		if (collection.type !== 'manual' || !collection.parentId) continue;
		const group = children.get(collection.parentId) ?? [];
		group.push(collection);
		children.set(collection.parentId, group);
	}
	const result: string[] = [];
	const stack = [parentId];
	const visited = new Set<string>();
	while (stack.length) {
		for (const child of children.get(stack.pop()!) ?? []) {
			if (visited.has(child.id)) continue;
			visited.add(child.id);
			result.push(child.id);
			stack.push(child.id);
		}
	}
	return result;
}

/** Exclude self and descendants, and parents whose children would exceed depth 3. */
export function getValidParentOptions<T extends FolderCollection>(collections: readonly T[], excludeId?: string): { collection: T; depth: number }[] {
	const excluded = new Set(excludeId ? [excludeId, ...getDescendantIds(collections, excludeId)] : []);
	const result: { collection: T; depth: number }[] = [];
	function walk(nodes: FolderTreeNode<T>[]): void {
		for (const node of nodes) {
			if (excluded.has(node.collection.id)) continue;
			if (node.depth < MAX_DEPTH) result.push({ collection: node.collection, depth: node.depth });
			walk(node.children);
		}
	}
	walk(buildFolderTree(collections));
	return result;
}

/** Count distinct own and descendant items, optionally limited to loaded IDs. */
export function getAggregateItemCount<T extends FolderCollection>(
	node: FolderTreeNode<T>, collections: readonly T[], loadedItemIds?: ReadonlySet<string>
): number {
	const descendantIds = new Set(getDescendantIds(collections, node.collection.id));
	const items = new Set<string>();
	for (const collection of [node.collection, ...collections.filter((entry) => entry.type === 'manual' && descendantIds.has(entry.id))]) {
		for (const itemId of collection.itemIds) {
			if (!loadedItemIds || loadedItemIds.has(itemId)) items.add(itemId);
		}
	}
	return items.size;
}
