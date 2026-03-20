/**
 * Image Request Queue
 *
 * Priority-based request queue with connection-aware concurrency limiting.
 * Prevents "thundering herd" by limiting concurrent requests and prioritizing
 * visible images over preloaded ones.
 */

import { getLoadingStrategy, onConnectionChange } from './connection-quality.js';

export type Priority = 0 | 1 | 2 | 3 | 5 | 10;

export const PRIORITY = {
	/** Not yet visible, preloading via rootMargin */
	PRELOAD: 0 as Priority,
	/** 1-50% visible */
	PARTIAL: 1 as Priority,
	/** 50-75% visible */
	HALF: 2 as Priority,
	/** 75%+ visible */
	MOSTLY: 3 as Priority,
	/** User-initiated retry */
	RETRY: 5 as Priority,
	/** Above the fold, critical path */
	CRITICAL: 10 as Priority
};

interface QueuedRequest<T> {
	id: string;
	priority: Priority;
	execute: () => Promise<T>;
	resolve: (value: T) => void;
	reject: (error: Error) => void;
	abortController: AbortController;
	timeoutId?: ReturnType<typeof setTimeout>;
}

interface QueueStats {
	queued: number;
	active: number;
	completed: number;
	failed: number;
}

class ImageRequestQueue {
	private queue: QueuedRequest<unknown>[] = [];
	private active = new Map<string, QueuedRequest<unknown>>();
	private maxConcurrent: number;
	private timeout: number;
	private stats: QueueStats = { queued: 0, active: 0, completed: 0, failed: 0 };

	constructor() {
		const strategy = getLoadingStrategy();
		this.maxConcurrent = strategy.maxConcurrent;
		this.timeout = strategy.timeout;

		// Adapt to connection changes
		onConnectionChange((info) => {
			const newStrategy = getLoadingStrategy();
			this.maxConcurrent = newStrategy.maxConcurrent;
			this.timeout = newStrategy.timeout;
			// If we now have more capacity, process queue
			this.processQueue();
		});
	}

	/**
	 * Enqueue a request with priority
	 * Returns existing promise if same ID is already queued/active (deduplication)
	 */
	enqueue<T>(id: string, priority: Priority, execute: () => Promise<T>): Promise<T> {
		// Check if already active
		const existing = this.active.get(id);
		if (existing) {
			return new Promise((resolve, reject) => {
				// Piggyback on existing request
				const originalResolve = existing.resolve;
				const originalReject = existing.reject;
				existing.resolve = (value) => {
					originalResolve(value);
					resolve(value as T);
				};
				existing.reject = (error) => {
					originalReject(error);
					reject(error);
				};
			});
		}

		// Check if already queued
		const queuedIndex = this.queue.findIndex((q) => q.id === id);
		if (queuedIndex !== -1) {
			const queued = this.queue[queuedIndex];
			// Upgrade priority if higher
			if (priority > queued.priority) {
				queued.priority = priority;
				this.sortQueue();
			}
			return new Promise((resolve, reject) => {
				const originalResolve = queued.resolve;
				const originalReject = queued.reject;
				queued.resolve = (value) => {
					originalResolve(value);
					resolve(value as T);
				};
				queued.reject = (error) => {
					originalReject(error);
					reject(error);
				};
			});
		}

		// Create new request
		return new Promise<T>((resolve, reject) => {
			const request: QueuedRequest<T> = {
				id,
				priority,
				execute,
				resolve: resolve as (value: unknown) => void,
				reject,
				abortController: new AbortController()
			};

			this.queue.push(request as QueuedRequest<unknown>);
			this.stats.queued++;
			this.sortQueue();
			this.processQueue();
		});
	}

	/**
	 * Cancel a pending request
	 */
	cancel(id: string): void {
		// Cancel if active
		const active = this.active.get(id);
		if (active) {
			active.abortController.abort();
			if (active.timeoutId) clearTimeout(active.timeoutId);
			this.active.delete(id);
			this.stats.active--;
			return;
		}

		// Remove from queue
		const queuedIndex = this.queue.findIndex((q) => q.id === id);
		if (queuedIndex !== -1) {
			const [removed] = this.queue.splice(queuedIndex, 1);
			removed.abortController.abort();
			this.stats.queued--;
		}
	}

	/**
	 * Cancel all pending requests
	 */
	cancelAll(): void {
		// Cancel active
		for (const [id, request] of this.active) {
			request.abortController.abort();
			if (request.timeoutId) clearTimeout(request.timeoutId);
		}
		this.active.clear();

		// Cancel queued
		for (const request of this.queue) {
			request.abortController.abort();
		}
		this.queue = [];

		this.stats = { queued: 0, active: 0, completed: 0, failed: 0 };
	}

	/**
	 * Get queue statistics
	 */
	getStats(): QueueStats {
		return { ...this.stats };
	}

	/**
	 * Update priority of a queued request
	 */
	updatePriority(id: string, priority: Priority): void {
		const queued = this.queue.find((q) => q.id === id);
		if (queued && priority > queued.priority) {
			queued.priority = priority;
			this.sortQueue();
		}
	}

	private sortQueue(): void {
		// Higher priority first
		this.queue.sort((a, b) => b.priority - a.priority);
	}

	private async processQueue(): Promise<void> {
		while (this.active.size < this.maxConcurrent && this.queue.length > 0) {
			const request = this.queue.shift()!;
			this.stats.queued--;
			this.stats.active++;
			this.active.set(request.id, request);

			// Set timeout
			request.timeoutId = setTimeout(() => {
				request.abortController.abort();
				this.handleFailure(request, new Error('Request timeout'));
			}, this.timeout);

			// Execute
			this.executeRequest(request);
		}
	}

	private async executeRequest(request: QueuedRequest<unknown>): Promise<void> {
		try {
			const result = await request.execute();
			this.handleSuccess(request, result);
		} catch (error) {
			this.handleFailure(request, error instanceof Error ? error : new Error(String(error)));
		}
	}

	private handleSuccess(request: QueuedRequest<unknown>, result: unknown): void {
		if (request.timeoutId) clearTimeout(request.timeoutId);
		this.active.delete(request.id);
		this.stats.active--;
		this.stats.completed++;
		request.resolve(result);
		this.processQueue();
	}

	private handleFailure(request: QueuedRequest<unknown>, error: Error): void {
		if (request.timeoutId) clearTimeout(request.timeoutId);
		this.active.delete(request.id);
		this.stats.active--;
		this.stats.failed++;
		request.reject(error);
		this.processQueue();
	}
}

// Singleton instance
let instance: ImageRequestQueue | null = null;

export function getRequestQueue(): ImageRequestQueue {
	if (!instance) {
		instance = new ImageRequestQueue();
	}
	return instance;
}

/**
 * Load an image with priority queuing
 */
export async function loadImage(
	url: string,
	priority: Priority = PRIORITY.PARTIAL
): Promise<HTMLImageElement> {
	const queue = getRequestQueue();

	return queue.enqueue(url, priority, async () => {
		const img = new Image();

		await new Promise<void>((resolve, reject) => {
			img.onload = () => resolve();
			img.onerror = () => reject(new Error(`Failed to load: ${url}`));
			img.src = url;
		});

		// Off-main-thread decoding
		if (img.decode) {
			await img.decode().catch(() => {
				/* Decode failed, but image is still usable */
			});
		}

		return img;
	});
}

/**
 * Load an image as a blob with priority queuing
 */
export async function loadImageBlob(
	url: string,
	priority: Priority = PRIORITY.PARTIAL
): Promise<Blob> {
	const queue = getRequestQueue();

	return queue.enqueue(`blob:${url}`, priority, async () => {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${url}`);
		}
		return response.blob();
	});
}
