import type { MediaTag, TagColor } from './types.js';

export type MediaType = 'image' | 'video' | 'document' | 'audio';
export type SortField = 'createdAt' | 'dateTaken' | 'name' | 'tagCount' | 'size';
export type AspectRatioPreset = 'original' | '16:9' | '1:1' | '9:16' | '4:5';

export const ASPECT_RATIO_VALUES: Record<Exclude<AspectRatioPreset, 'original'>, number> = {
	'16:9': 16 / 9, '1:1': 1, '9:16': 9 / 16, '4:5': 4 / 5
};

export interface CropData {
	position: { x: number; y: number };
	scale: number;
	aspect: number;
	aspectLabel: AspectRatioPreset;
	insets?: { top: number; right: number; bottom: number; left: number };
	rotation?: number;
}

export interface SnipData { inPoint: number; outPoint: number; duration: number }
export interface YouTubeVideoData {
	videoId: string; channelId: string; title: string; description?: string;
	privacy: 'public' | 'unlisted' | 'private'; duration: number; publishedAt: Date;
}
export interface B2BackupData { key: string; url: string; size: number; backedUpAt: Date }
export interface ExifMetadata {
	dateTaken?: Date;
	location?: { latitude: number; longitude: number; altitude?: number };
	locationName?: { city?: string; state?: string; country?: string; formatted: string; geocodedAt: Date };
	camera?: { make?: string; model?: string; lens?: string };
	settings?: { iso?: number; aperture?: number; shutterSpeed?: string; focalLength?: number; flash?: boolean };
	dimensions?: { width: number; height: number };
	orientation?: number;
	software?: string;
	copyright?: string;
}

/** Storage-neutral catalog record. Applications supply URLs and persistence. */
export interface CatalogMediaItem {
	id: string; name: string; type: MediaType; size: number; url: string; tags: string[];
	createdAt: Date; updatedAt: Date;
	thumbnailUrl?: string; previewUrl?: string; width?: number; height?: number;
	mimeType?: string; pageCount?: number; eventIds?: string[];
	crop?: CropData; snip?: SnipData; needsEditing?: boolean; favorited?: boolean;
	contentHash?: string; storageBackend?: 'firebase' | 'r2' | 'youtube';
	youtube?: YouTubeVideoData; b2Backup?: B2BackupData; exif?: ExifMetadata;
	localPath?: string; _lowerName?: string;
	isPublic?: boolean; publicCaption?: string; publicCategory?: string; publicOrder?: number;
	description?: string; descriptionStatus?: 'auto' | 'confirmed' | 'flagged'; describedBy?: string;
	archivedAt?: Date | null; archivedFrom?: string[];
}

export interface CatalogMediaTag extends MediaTag {
	parentId: string | null; path: string[]; depth: number; aliases: string[];
}
export interface TagTreeNode { tag: CatalogMediaTag; children: TagTreeNode[]; itemCount: number; descendantItemCount: number }

export interface SmartCollectionFilters {
	tags: string[]; excludeTags: string[]; tagMode: 'and' | 'or';
	type: 'all' | MediaType; query: string; untaggedOnly: boolean; needsEditingOnly: boolean;
	tagCountMin: number | null; tagCountMax: number | null;
	sort: { field: SortField; direction: 'asc' | 'desc' };
	yearTaken?: number; cameraMake?: string; cameraModel?: string; hasLocation?: boolean;
}
export interface MediaCollection {
	id: string; name: string; description: string; type: 'manual' | 'smart';
	color?: TagColor; parentId: string | null; itemIds: string[];
	filters: SmartCollectionFilters | null; createdAt: Date; updatedAt: Date;
}
export interface MediaSearchFilters extends Omit<SmartCollectionFilters, 'yearTaken' | 'cameraMake' | 'hasLocation'> {
	dateFrom: Date | null; dateTo: Date | null;
	includeDescendants: boolean; favoritesOnly: boolean;
	yearTaken: number | null; cameraMake: string | null; hasLocation: boolean;
}
export interface CatalogLibraryState {
	id: string; sourceId: string | null; activeCollectionId: string | null;
	gridSize: number; filterType: 'all' | MediaType; searchQuery: string;
	categoryLabels: Record<string, string>; categoryPrereqs: Record<string, string[]>;
	updatedAt: Date;
}

/** Implement these against the host app's database or file store. */
export interface MediaCatalogRepository {
	getItems(): Promise<CatalogMediaItem[]>;
	getTags(): Promise<CatalogMediaTag[]>;
	getCollections(): Promise<MediaCollection[]>;
	saveItem(item: CatalogMediaItem): Promise<void>;
	saveTag(tag: CatalogMediaTag): Promise<void>;
	saveCollection(collection: MediaCollection): Promise<void>;
}
