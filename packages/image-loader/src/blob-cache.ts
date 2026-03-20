/**
 * IndexedDB Blob Cache
 *
 * Persistent cache for image blobs with LRU eviction. Survives page reloads
 * and provides near-instant retrieval for cached images.
 */

const DB_NAME = 'image-loader-cache';
const DB_VERSION = 1;
const STORE_NAME = 'blobs';
const DEFAULT_MAX_SIZE = 100 * 1024 * 1024; // 100MB default
const DEFAULT_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry {
	key: string;
	blob: Blob;
	timestamp: number;
	accessedAt: number;
	size: number;
}

interface CacheStats {
	count: number;
	sizeBytes: number;
}

class BlobCache {
	private db: IDBDatabase | null = null;
	private dbPromise: Promise<IDBDatabase> | null = null;
	private maxSize: number;
	private maxAge: number;
	private memoryCache = new Map<string, { blob: Blob; accessedAt: number }>();
	private memoryCacheMaxSize = 50; // Keep 50 most recent in memory

	constructor(options: { maxSize?: number; maxAge?: number } = {}) {
		this.maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
		this.maxAge = options.maxAge ?? DEFAULT_MAX_AGE;
	}

	private async getDB(): Promise<IDBDatabase> {
		if (this.db) return this.db;
		if (this.dbPromise) return this.dbPromise;

		this.dbPromise = new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);

			request.onerror = () => reject(request.error);

			request.onsuccess = () => {
				this.db = request.result;
				resolve(this.db);
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;

				// Create or upgrade store
				if (!db.objectStoreNames.contains(STORE_NAME)) {
					const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
					store.createIndex('timestamp', 'timestamp', { unique: false });
					store.createIndex('accessedAt', 'accessedAt', { unique: false });
				}
			};
		});

		return this.dbPromise;
	}

	/**
	 * Get a cached blob by key
	 */
	async get(key: string): Promise<Blob | null> {
		// Check memory cache first (L2)
		const memEntry = this.memoryCache.get(key);
		if (memEntry) {
			memEntry.accessedAt = Date.now();
			return memEntry.blob;
		}

		// Check IndexedDB (L1)
		try {
			const db = await this.getDB();
			const tx = db.transaction(STORE_NAME, 'readonly');
			const store = tx.objectStore(STORE_NAME);

			return new Promise((resolve) => {
				const request = store.get(key);

				request.onsuccess = () => {
					const entry = request.result as CacheEntry | undefined;

					if (!entry) {
						resolve(null);
						return;
					}

					// Check if expired
					if (Date.now() - entry.timestamp > this.maxAge) {
						this.delete(key); // Async cleanup
						resolve(null);
						return;
					}

					// Update access time (async, non-blocking)
					this.updateAccessTime(key);

					// Promote to memory cache
					this.addToMemoryCache(key, entry.blob);

					resolve(entry.blob);
				};

				request.onerror = () => resolve(null);
			});
		} catch {
			return null;
		}
	}

	/**
	 * Store a blob in the cache
	 */
	async set(key: string, blob: Blob): Promise<void> {
		// Add to memory cache immediately
		this.addToMemoryCache(key, blob);

		// Persist to IndexedDB
		try {
			const db = await this.getDB();
			const tx = db.transaction(STORE_NAME, 'readwrite');
			const store = tx.objectStore(STORE_NAME);

			const entry: CacheEntry = {
				key,
				blob,
				timestamp: Date.now(),
				accessedAt: Date.now(),
				size: blob.size
			};

			await new Promise<void>((resolve, reject) => {
				const request = store.put(entry);
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			});

			// Check if we need to prune
			this.pruneIfNeeded();
		} catch {
			// Silently fail - memory cache still works
		}
	}

	/**
	 * Check if a key exists in cache
	 */
	async has(key: string): Promise<boolean> {
		// Check memory first
		if (this.memoryCache.has(key)) return true;

		// Check IndexedDB
		try {
			const db = await this.getDB();
			const tx = db.transaction(STORE_NAME, 'readonly');
			const store = tx.objectStore(STORE_NAME);

			return new Promise((resolve) => {
				const request = store.count(IDBKeyRange.only(key));
				request.onsuccess = () => resolve(request.result > 0);
				request.onerror = () => resolve(false);
			});
		} catch {
			return false;
		}
	}

	/**
	 * Delete a cached entry
	 */
	async delete(key: string): Promise<void> {
		this.memoryCache.delete(key);

		try {
			const db = await this.getDB();
			const tx = db.transaction(STORE_NAME, 'readwrite');
			const store = tx.objectStore(STORE_NAME);

			await new Promise<void>((resolve) => {
				const request = store.delete(key);
				request.onsuccess = () => resolve();
				request.onerror = () => resolve();
			});
		} catch {
			// Ignore errors
		}
	}

	/**
	 * Clear all cached entries
	 */
	async clear(): Promise<void> {
		this.memoryCache.clear();

		try {
			const db = await this.getDB();
			const tx = db.transaction(STORE_NAME, 'readwrite');
			const store = tx.objectStore(STORE_NAME);

			await new Promise<void>((resolve) => {
				const request = store.clear();
				request.onsuccess = () => resolve();
				request.onerror = () => resolve();
			});
		} catch {
			// Ignore errors
		}
	}

	/**
	 * Pre-warm memory cache from IndexedDB.
	 * Call this on app startup for instant cache hits.
	 * Returns the number of entries loaded.
	 */
	async warmup(maxEntries: number = 100): Promise<number> {
		try {
			const db = await this.getDB();
			const tx = db.transaction(STORE_NAME, 'readonly');
			const store = tx.objectStore(STORE_NAME);
			const index = store.index('accessedAt');

			return new Promise((resolve) => {
				let loaded = 0;
				// Open cursor in reverse order (most recently accessed first)
				const request = index.openCursor(null, 'prev');

				request.onsuccess = () => {
					const cursor = request.result;
					if (cursor && loaded < maxEntries) {
						const entry = cursor.value as CacheEntry;

						// Check if expired
						if (Date.now() - entry.timestamp <= this.maxAge) {
							// Add to memory cache (skip if already there)
							if (!this.memoryCache.has(entry.key)) {
								this.memoryCache.set(entry.key, {
									blob: entry.blob,
									accessedAt: entry.accessedAt
								});
								loaded++;
							}
						}
						cursor.continue();
					} else {
						resolve(loaded);
					}
				};

				request.onerror = () => resolve(loaded);
			});
		} catch {
			return 0;
		}
	}

	/**
	 * Get cache statistics
	 */
	async getStats(): Promise<CacheStats> {
		try {
			const db = await this.getDB();
			const tx = db.transaction(STORE_NAME, 'readonly');
			const store = tx.objectStore(STORE_NAME);

			return new Promise((resolve) => {
				let count = 0;
				let sizeBytes = 0;

				const request = store.openCursor();

				request.onsuccess = () => {
					const cursor = request.result;
					if (cursor) {
						const entry = cursor.value as CacheEntry;
						count++;
						sizeBytes += entry.size;
						cursor.continue();
					} else {
						resolve({ count, sizeBytes });
					}
				};

				request.onerror = () => resolve({ count: 0, sizeBytes: 0 });
			});
		} catch {
			return { count: 0, sizeBytes: 0 };
		}
	}

	private addToMemoryCache(key: string, blob: Blob): void {
		// Evict oldest if at capacity
		if (this.memoryCache.size >= this.memoryCacheMaxSize) {
			let oldestKey: string | null = null;
			let oldestTime = Infinity;

			for (const [k, v] of this.memoryCache) {
				if (v.accessedAt < oldestTime) {
					oldestTime = v.accessedAt;
					oldestKey = k;
				}
			}

			if (oldestKey) {
				this.memoryCache.delete(oldestKey);
			}
		}

		this.memoryCache.set(key, { blob, accessedAt: Date.now() });
	}

	private async updateAccessTime(key: string): Promise<void> {
		try {
			const db = await this.getDB();
			const tx = db.transaction(STORE_NAME, 'readwrite');
			const store = tx.objectStore(STORE_NAME);

			const request = store.get(key);
			request.onsuccess = () => {
				const entry = request.result as CacheEntry | undefined;
				if (entry) {
					entry.accessedAt = Date.now();
					store.put(entry);
				}
			};
		} catch {
			// Ignore errors
		}
	}

	private async pruneIfNeeded(): Promise<void> {
		const stats = await this.getStats();

		if (stats.sizeBytes <= this.maxSize) return;

		// LRU eviction - remove least recently accessed entries
		try {
			const db = await this.getDB();
			const tx = db.transaction(STORE_NAME, 'readwrite');
			const store = tx.objectStore(STORE_NAME);
			const index = store.index('accessedAt');

			let freedBytes = 0;
			const targetFree = stats.sizeBytes - this.maxSize * 0.8; // Free to 80% capacity

			await new Promise<void>((resolve) => {
				const request = index.openCursor(); // Oldest first

				request.onsuccess = () => {
					const cursor = request.result;
					if (cursor && freedBytes < targetFree) {
						const entry = cursor.value as CacheEntry;
						freedBytes += entry.size;
						this.memoryCache.delete(entry.key);
						cursor.delete();
						cursor.continue();
					} else {
						resolve();
					}
				};

				request.onerror = () => resolve();
			});
		} catch {
			// Ignore errors
		}
	}
}

// Singleton instance
let instance: BlobCache | null = null;

export function getBlobCache(options?: { maxSize?: number; maxAge?: number }): BlobCache {
	if (!instance) {
		instance = new BlobCache(options);
	}
	return instance;
}

export type { CacheStats };
