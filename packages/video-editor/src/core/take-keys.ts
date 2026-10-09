/** What identifies a local file across reloads. */
export interface LocalTakeIdentity {
	readonly name: string;
	readonly size: number;
	readonly lastModified: number;
}

export function localTakeKey(file: LocalTakeIdentity): string {
	return `local:${file.name}:${file.size}:${file.lastModified}`;
}

/** A library take's key. "catalog:" is the saved format. */
export function libraryTakeKey(videoId: string): string {
	return `catalog:${videoId}`;
}
