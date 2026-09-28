import { TAG_COLORS, getTagHex, type MediaTag, type TagColor, type TagCategory } from '../types.js';
import { createCategoryKey, getCategoryLabel } from '../catalog.js';

export { TAG_COLORS, getTagHex, createCategoryKey, getCategoryLabel };
export type { MediaTag, TagColor, TagCategory };
export type MediaItem = { tags: string[] };

/** Keep host-defined categories first, then include categories found in tags. */
export function getAllCategories(tags: readonly MediaTag[], categoryOrder: readonly string[] = ['content']): string[] {
	const result = [...categoryOrder];
	for (const tag of tags) if (!result.includes(tag.category)) result.push(tag.category);
	return result;
}
