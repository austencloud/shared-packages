import Dexie, { type Table } from "dexie";
import type { PreviewVideoStore } from "./preview-video-cache-contract.js";
import {
	MAX_PREVIEW_CACHE_BYTES,
	MAX_PREVIEW_VIDEO_BYTES,
	PREVIEW_VIDEO_POLICY,
	type PreviewVideoCopy,
} from "../../core/preview-video.js";

/** Copies made under an older policy are never read again. */
function stale(key: string): boolean {
	try {
		return (JSON.parse(key) as unknown[])[0] !== PREVIEW_VIDEO_POLICY;
	} catch {
		return true;
	}
}

interface PreviewRecord extends Omit<PreviewVideoCopy, "blob"> {
	key: string;
	assetKey: string;
	bytes: number;
	accessed: number;
}

class PreviewDatabase extends Dexie {
	records!: Table<PreviewRecord, string>;
	files!: Table<{ key: string; blob: Blob }, string>;

	constructor() {
		super("tka-post-studio-preview-videos");
		this.version(1).stores({ records: "key,assetKey,accessed", files: "key" });
	}
}

/** Byte limits for the device cache. A test lowers them; the app keeps the defaults. */
export interface PreviewVideoLocalStoreLimits {
	/** Bytes the whole device cache may hold. Defaults to `MAX_PREVIEW_CACHE_BYTES`. */
	maxCacheBytes?: number;
	/** Bytes one copy may take. Defaults to `MAX_PREVIEW_VIDEO_BYTES`. */
	maxVideoBytes?: number;
}

export class PreviewVideoLocalStore implements PreviewVideoStore {
	private database: PreviewDatabase | null = null;
	private readonly maxCacheBytes: number;
	private readonly maxVideoBytes: number;

	constructor(limits: PreviewVideoLocalStoreLimits = {}) {
		this.maxCacheBytes = limits.maxCacheBytes ?? MAX_PREVIEW_CACHE_BYTES;
		this.maxVideoBytes = limits.maxVideoBytes ?? MAX_PREVIEW_VIDEO_BYTES;
	}

	private db() {
		this.database ??= new PreviewDatabase();
		return this.database;
	}

	async remove(key: string): Promise<void> {
		if (typeof indexedDB === "undefined") return;
		const db = this.db();
		await db.transaction("rw", db.records, db.files, async () => {
			await db.records.delete(key);
			await db.files.delete(key);
		});
	}

	async read(key: string): Promise<PreviewVideoCopy | null> {
		if (typeof indexedDB === "undefined") return null;
		const db = this.db();
		return db.transaction("rw", db.records, db.files, async () => {
			const record = await db.records.get(key);
			if (!record) return null;
			const file = await db.files.get(key);
			if (!file || file.blob.size !== record.bytes || record.bytes > this.maxVideoBytes) {
				await db.records.delete(key);
				await db.files.delete(key);
				return null;
			}
			await db.records.update(key, { accessed: Date.now() });
			return {
				blob: file.blob,
				width: record.width,
				height: record.height,
				sourceWidth: record.sourceWidth,
				sourceHeight: record.sourceHeight,
				durationSeconds: record.durationSeconds,
			};
		});
	}

	async write(key: string, assetKey: string, copy: PreviewVideoCopy): Promise<void> {
		if (typeof indexedDB === "undefined" || copy.blob.size > this.maxVideoBytes) return;
		const db = this.db();
		await db.transaction("rw", db.records, db.files, async () => {
			const records = await db.records.toArray();
			let bytes = copy.blob.size;
			const replaced = (record: PreviewRecord) => record.assetKey === assetKey || stale(record.key);
			const retained = records.filter((record) => !replaced(record));
			bytes += retained.reduce((sum, record) => sum + record.bytes, 0);
			const removed = records.filter(replaced);
			retained.sort((a, b) => a.accessed - b.accessed);
			for (const record of retained) {
				if (bytes <= this.maxCacheBytes) break;
				removed.push(record);
				bytes -= record.bytes;
			}
			await db.records.bulkDelete(removed.map((record) => record.key));
			await db.files.bulkDelete(removed.map((record) => record.key));
			const { blob, ...metadata } = copy;
			await db.files.put({ key, blob });
			await db.records.put({
				key,
				assetKey,
				...metadata,
				bytes: blob.size,
				accessed: Date.now(),
			});
		});
	}
}
