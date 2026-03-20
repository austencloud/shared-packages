/**
 * Lazy Load Controller
 *
 * IntersectionObserver-based lazy loading with visibility-based priority
 * and preloading support. Tracks which images are visible and assigns
 * appropriate loading priority.
 */

import { PRIORITY, type Priority } from './request-queue.js';
import { getLoadingStrategy } from './connection-quality.js';

export interface LazyLoadOptions {
	/** Extra margin around viewport for preloading (default: 200px) */
	rootMargin?: string;
	/** Intersection thresholds for priority calculation */
	thresholds?: number[];
	/** Custom root element (default: viewport) */
	root?: Element | null;
}

export interface ObservedElement {
	element: HTMLElement;
	id: string;
	onVisible: (priority: Priority) => void;
	onHidden?: () => void;
}

type VisibilityCallback = (id: string, isVisible: boolean, priority: Priority) => void;

class LazyLoadController {
	private observer: IntersectionObserver | null = null;
	private elements = new Map<HTMLElement, ObservedElement>();
	private visibleIds = new Set<string>();
	private options: Required<LazyLoadOptions>;
	private globalCallbacks = new Set<VisibilityCallback>();

	constructor(options: LazyLoadOptions = {}) {
		const strategy = getLoadingStrategy();

		this.options = {
			rootMargin: options.rootMargin ?? `${strategy.preloadAhead * 50}px`,
			thresholds: options.thresholds ?? [0, 0.25, 0.5, 0.75, 1.0],
			root: options.root ?? null
		};
	}

	private getOrCreateObserver(): IntersectionObserver {
		if (!this.observer) {
			this.observer = new IntersectionObserver(
				(entries) => this.handleIntersection(entries),
				{
					root: this.options.root,
					rootMargin: this.options.rootMargin,
					threshold: this.options.thresholds
				}
			);
		}
		return this.observer;
	}

	private handleIntersection(entries: IntersectionObserverEntry[]): void {
		for (const entry of entries) {
			const element = entry.target as HTMLElement;
			const observed = this.elements.get(element);

			if (!observed) continue;

			const priority = this.calculatePriority(entry.intersectionRatio);
			const wasVisible = this.visibleIds.has(observed.id);
			const isVisible = entry.isIntersecting;

			if (isVisible && !wasVisible) {
				// Became visible
				this.visibleIds.add(observed.id);
				observed.onVisible(priority);
				this.notifyGlobalCallbacks(observed.id, true, priority);
			} else if (isVisible && wasVisible) {
				// Still visible, but visibility changed (priority update)
				observed.onVisible(priority);
				this.notifyGlobalCallbacks(observed.id, true, priority);
			} else if (!isVisible && wasVisible) {
				// Became hidden
				this.visibleIds.delete(observed.id);
				observed.onHidden?.();
				this.notifyGlobalCallbacks(observed.id, false, PRIORITY.PRELOAD);
			}
		}
	}

	private calculatePriority(ratio: number): Priority {
		if (ratio >= 0.75) return PRIORITY.MOSTLY;
		if (ratio >= 0.5) return PRIORITY.HALF;
		if (ratio > 0) return PRIORITY.PARTIAL;
		return PRIORITY.PRELOAD;
	}

	private notifyGlobalCallbacks(id: string, isVisible: boolean, priority: Priority): void {
		for (const callback of this.globalCallbacks) {
			callback(id, isVisible, priority);
		}
	}

	/**
	 * Start observing an element
	 */
	observe(config: ObservedElement): void {
		const observer = this.getOrCreateObserver();
		this.elements.set(config.element, config);
		observer.observe(config.element);
	}

	/**
	 * Stop observing an element
	 */
	unobserve(element: HTMLElement): void {
		this.observer?.unobserve(element);
		const observed = this.elements.get(element);
		if (observed) {
			this.visibleIds.delete(observed.id);
		}
		this.elements.delete(element);
	}

	/**
	 * Check if an element is currently visible
	 */
	isVisible(id: string): boolean {
		return this.visibleIds.has(id);
	}

	/**
	 * Get all currently visible IDs
	 */
	getVisibleIds(): string[] {
		return [...this.visibleIds];
	}

	/**
	 * Subscribe to visibility changes for all elements
	 */
	onVisibilityChange(callback: VisibilityCallback): () => void {
		this.globalCallbacks.add(callback);
		return () => {
			this.globalCallbacks.delete(callback);
		};
	}

	/**
	 * Cleanup all observers
	 */
	destroy(): void {
		this.observer?.disconnect();
		this.observer = null;
		this.elements.clear();
		this.visibleIds.clear();
		this.globalCallbacks.clear();
	}
}

// Singleton instance
let instance: LazyLoadController | null = null;

export function getLazyLoadController(options?: LazyLoadOptions): LazyLoadController {
	if (!instance) {
		instance = new LazyLoadController(options);
	}
	return instance;
}

/**
 * Create a Svelte action for lazy loading
 */
export function createLazyLoadAction(options?: LazyLoadOptions) {
	const controller = getLazyLoadController(options);

	return function lazyLoad(
		node: HTMLElement,
		config: { id: string; onVisible: (priority: Priority) => void; onHidden?: () => void }
	) {
		controller.observe({
			element: node,
			id: config.id,
			onVisible: config.onVisible,
			onHidden: config.onHidden
		});

		return {
			update(newConfig: typeof config) {
				// Re-register with new callbacks
				controller.unobserve(node);
				controller.observe({
					element: node,
					id: newConfig.id,
					onVisible: newConfig.onVisible,
					onHidden: newConfig.onHidden
				});
			},
			destroy() {
				controller.unobserve(node);
			}
		};
	};
}
