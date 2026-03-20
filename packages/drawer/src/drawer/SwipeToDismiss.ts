/**
 * SwipeToDismiss - Manages swipe-to-dismiss gesture interactions
 *
 * Handles touch and mouse events for drawer dismissal with threshold-based detection.
 * Prevents conflicts with interactive elements and manages drag state.
 *
 * Placement-aware: horizontal gestures for right/left drawers, vertical for top/bottom.
 */

import { isTopDrawer, dismissTopDrawer } from './DrawerStack.js';
import type { SwipeToDismissOptions } from '../types.js';

/**
 * Swipe-to-dismiss threshold constants
 */
const DISMISS_THRESHOLDS = {
	/** Minimum distance (px) for a slow swipe to trigger dismiss */
	DISTANCE_SLOW: 100,
	/** Minimum distance (px) for a fast swipe to trigger dismiss */
	DISTANCE_FAST: 50,
	/** Maximum duration (ms) for a swipe to be considered "fast" */
	FAST_SWIPE_MAX_DURATION: 500,
	/** Minimum movement (px) to consider gesture as intentional drag */
	MOVEMENT_THRESHOLD: 5
} as const;

export { type SwipeToDismissOptions };

export class SwipeToDismiss {
	private element: HTMLElement | null = null;
	private isDragging = false;
	private startY = 0;
	private currentY = 0;
	private startX = 0;
	private currentX = 0;
	private startTime = 0;
	private hasMoved = false;
	private startedOnInteractive = false;
	private justDragged = false;
	private cleanupFn: (() => void) | null = null;

	// Scroll-aware dismiss: track scrollable container state
	private scrollableContainer: HTMLElement | null = null;
	private scrollAtBoundary = true;

	// Delegation flag: when true, this drawer is not the top drawer,
	// so swipe gestures should dismiss the top drawer instead
	private delegatingToTopDrawer = false;

	// Disabled flag: when true, all gesture handling is blocked
	// Used during open/close animations to prevent conflicts
	private disabled = false;

	constructor(private options: SwipeToDismissOptions) {}

	/**
	 * Temporarily disable gesture handling (e.g., during animations)
	 */
	setDisabled(disabled: boolean) {
		this.disabled = disabled;
		if (disabled && this.isDragging) {
			this.isDragging = false;
			this.options.onDragChange?.(0, 1, false);
		}
	}

	/**
	 * Find the nearest scrollable ancestor from the touch target
	 */
	private findScrollableAncestor(target: HTMLElement): HTMLElement | null {
		let current: HTMLElement | null = target;
		while (current && current !== this.element) {
			const tagName = current.tagName.toLowerCase();
			if (tagName === 'textarea' || tagName === 'input' || tagName === 'select') {
				current = current.parentElement;
				continue;
			}

			const style = window.getComputedStyle(current);
			const overflowY = style.overflowY;
			const overflowX = style.overflowX;

			const isScrollableY =
				(overflowY === 'auto' || overflowY === 'scroll') &&
				current.scrollHeight > current.clientHeight;
			const isScrollableX =
				(overflowX === 'auto' || overflowX === 'scroll') &&
				current.scrollWidth > current.clientWidth;

			if (isScrollableY || isScrollableX) {
				return current;
			}
			current = current.parentElement;
		}
		return null;
	}

	/**
	 * Check if scroll is at the boundary where dismiss gesture would occur
	 */
	private isScrollAtDismissBoundary(container: HTMLElement): boolean {
		const { placement } = this.options;

		if (placement === 'bottom') {
			return container.scrollTop <= 1;
		} else if (placement === 'top') {
			const maxScroll = container.scrollHeight - container.clientHeight;
			return container.scrollTop >= maxScroll - 1;
		} else if (placement === 'right') {
			return container.scrollLeft <= 1;
		} else if (placement === 'left') {
			const maxScroll = container.scrollWidth - container.clientWidth;
			return container.scrollLeft >= maxScroll - 1;
		}
		return true;
	}

	/**
	 * Attach event listeners to the target element
	 */
	attach(element: HTMLElement) {
		this.detach();
		this.element = element;

		const handleStart = (e: TouchEvent | MouseEvent) => this.handleTouchStart(e);
		const handleMove = (e: TouchEvent | MouseEvent) => this.handleTouchMove(e);
		const handleEnd = (e: TouchEvent | MouseEvent) => this.handleTouchEnd(e);
		const handleClick = (e: MouseEvent) => this.handleClick(e);

		element.addEventListener('touchstart', handleStart, { passive: false });
		element.addEventListener('touchmove', handleMove, { passive: false });
		element.addEventListener('touchend', handleEnd, { passive: false });

		element.addEventListener('mousedown', handleStart, { passive: false });
		element.addEventListener('mousemove', handleMove, { passive: false });
		element.addEventListener('mouseup', handleEnd, { passive: false });
		element.addEventListener('mouseleave', handleEnd, { passive: false });

		element.addEventListener('click', handleClick, { capture: true });

		this.cleanupFn = () => {
			element.removeEventListener('touchstart', handleStart);
			element.removeEventListener('touchmove', handleMove);
			element.removeEventListener('touchend', handleEnd);
			element.removeEventListener('mousedown', handleStart);
			element.removeEventListener('mousemove', handleMove);
			element.removeEventListener('mouseup', handleEnd);
			element.removeEventListener('mouseleave', handleEnd);
			element.removeEventListener('click', handleClick, true);
		};
	}

	/**
	 * Remove event listeners and clean up
	 */
	detach() {
		if (this.cleanupFn) {
			this.cleanupFn();
			this.cleanupFn = null;
		}
		this.element = null;
	}

	/**
	 * Update options (e.g., when props change)
	 */
	updateOptions(options: Partial<SwipeToDismissOptions>) {
		this.options = { ...this.options, ...options };
	}

	/**
	 * Get current drag state
	 */
	getIsDragging(): boolean {
		return this.isDragging;
	}

	/**
	 * Get current drag offset for Y axis
	 */
	getDragOffsetY(): number {
		if (!this.isDragging) return 0;
		const delta = this.currentY - this.startY;

		if (this.options.placement === 'bottom') {
			return Math.max(0, delta);
		} else if (this.options.placement === 'top') {
			return Math.min(0, delta);
		}
		return 0;
	}

	/**
	 * Get current drag offset for X axis
	 */
	getDragOffsetX(): number {
		if (!this.isDragging) return 0;
		const delta = this.currentX - this.startX;

		if (this.options.placement === 'right') {
			return Math.max(0, delta);
		} else if (this.options.placement === 'left') {
			return Math.min(0, delta);
		}
		return 0;
	}

	/**
	 * Reset drag state
	 */
	reset() {
		this.isDragging = false;
		this.hasMoved = false;
		this.startedOnInteractive = false;
		this.justDragged = false;
		this.delegatingToTopDrawer = false;
		this.startY = 0;
		this.currentY = 0;
		this.startX = 0;
		this.currentX = 0;
		this.scrollableContainer = null;
		this.scrollAtBoundary = true;
	}

	private handleTouchStart(event: TouchEvent | MouseEvent) {
		if (this.disabled) return;
		if (!this.options.dismissible) return;

		// Ignore right-click
		if (event instanceof MouseEvent && event.button !== 0) return;

		// Only process if this drawer is the top drawer
		if (this.options.drawerId && !isTopDrawer(this.options.drawerId)) return;
		this.delegatingToTopDrawer = false;

		// Track if we started on an interactive element
		const target = event.target as HTMLElement;
		this.startedOnInteractive = !!(
			target.closest('button') ||
			target.closest('a') ||
			target.closest('input') ||
			target.closest('select') ||
			target.closest('textarea') ||
			target.closest('[role="button"]')
		);

		// Find scrollable container and check boundary
		this.scrollableContainer = this.findScrollableAncestor(target);
		this.scrollAtBoundary = this.scrollableContainer
			? this.isScrollAtDismissBoundary(this.scrollableContainer)
			: true;

		if (event instanceof TouchEvent) {
			const touch = event.touches[0]!;
			this.startY = touch.clientY;
			this.startX = touch.clientX;
			this.currentY = this.startY;
			this.currentX = this.startX;
		} else {
			this.startY = event.clientY;
			this.startX = event.clientX;
			this.currentY = this.startY;
			this.currentX = this.startX;
		}
		this.startTime = Date.now();
		this.hasMoved = false;
		this.isDragging = true;

		this.reportDragProgress();
	}

	private handleTouchMove(event: TouchEvent | MouseEvent) {
		if (!this.isDragging || !this.options.dismissible) return;

		if (event instanceof TouchEvent) {
			const touch = event.touches[0]!;
			this.currentY = touch.clientY;
			this.currentX = touch.clientX;
		} else {
			this.currentY = event.clientY;
			this.currentX = event.clientX;
		}

		if (this.delegatingToTopDrawer) {
			const deltaY = this.currentY - this.startY;
			const deltaX = this.currentX - this.startX;
			if (
				Math.abs(deltaY) > DISMISS_THRESHOLDS.MOVEMENT_THRESHOLD ||
				Math.abs(deltaX) > DISMISS_THRESHOLDS.MOVEMENT_THRESHOLD
			) {
				this.hasMoved = true;
			}
			return;
		}

		const deltaY = this.currentY - this.startY;
		const deltaX = this.currentX - this.startX;
		const absDeltaY = Math.abs(deltaY);
		const absDeltaX = Math.abs(deltaX);

		const isSwipingInDismissDirection =
			(this.options.placement === 'bottom' && deltaY > 0) ||
			(this.options.placement === 'top' && deltaY < 0) ||
			(this.options.placement === 'right' && deltaX > 0) ||
			(this.options.placement === 'left' && deltaX < 0);

		const isSwipingInScrollDirection =
			(this.options.placement === 'bottom' && deltaY < 0) ||
			(this.options.placement === 'top' && deltaY > 0) ||
			(this.options.placement === 'right' && deltaX < 0) ||
			(this.options.placement === 'left' && deltaX > 0);

		// If swiping in scroll direction, abort drag to let native scroll take over
		if (
			isSwipingInScrollDirection &&
			(absDeltaY > DISMISS_THRESHOLDS.MOVEMENT_THRESHOLD ||
				absDeltaX > DISMISS_THRESHOLDS.MOVEMENT_THRESHOLD)
		) {
			this.isDragging = false;
			this.options.onDragChange?.(0, 1, false);
			return;
		}

		// If scrollable container is not at boundary, let scroll handle it
		if (this.scrollableContainer && !this.scrollAtBoundary && isSwipingInDismissDirection) {
			this.scrollAtBoundary = this.isScrollAtDismissBoundary(this.scrollableContainer);
			if (!this.scrollAtBoundary) {
				this.isDragging = false;
				this.options.onDragChange?.(0, 1, false);
				return;
			}
		}

		if (
			absDeltaY > DISMISS_THRESHOLDS.MOVEMENT_THRESHOLD ||
			absDeltaX > DISMISS_THRESHOLDS.MOVEMENT_THRESHOLD
		) {
			this.hasMoved = true;
			if (this.startedOnInteractive) {
				event.preventDefault();
			}
		}

		// Prevent default for valid drag directions
		if (
			(this.scrollAtBoundary || !this.scrollableContainer) &&
			isSwipingInDismissDirection
		) {
			event.preventDefault();
		}

		this.reportDragProgress();
	}

	private handleTouchEnd(event: TouchEvent | MouseEvent) {
		if (!this.isDragging || !this.options.dismissible) return;

		const deltaY = this.currentY - this.startY;
		const deltaX = this.currentX - this.startX;
		const duration = Date.now() - this.startTime;

		if (this.delegatingToTopDrawer) {
			this.isDragging = false;
			this.delegatingToTopDrawer = false;
			if (this.isAboveDismissThreshold(deltaX, deltaY, duration)) {
				dismissTopDrawer();
			}
			this.reset();
			return;
		}

		if (this.startedOnInteractive && this.hasMoved) {
			event.preventDefault();
			event.stopPropagation();
			this.justDragged = true;
			setTimeout(() => {
				this.justDragged = false;
			}, 100);
		}

		this.isDragging = false;

		const offset =
			this.options.placement === 'right' || this.options.placement === 'left'
				? this.getDragOffsetXInternal(deltaX)
				: this.getDragOffsetYInternal(deltaY);

		const velocity = duration > 0 ? Math.abs(offset) / duration : 0;

		// Allow custom handler to intercept (for snap points)
		if (this.options.onDragEnd) {
			const handled = this.options.onDragEnd(offset, velocity, duration);
			if (handled) {
				this.startY = 0;
				this.currentY = 0;
				this.startX = 0;
				this.currentX = 0;
				this.options.onDragChange?.(0, 1, false);
				return;
			}
		}

		const wasAboveThreshold = this.isAboveDismissThreshold(deltaX, deltaY, duration);

		this.startY = 0;
		this.currentY = 0;
		this.startX = 0;
		this.currentX = 0;

		this.options.onDragChange?.(0, 1, false);

		if (wasAboveThreshold) {
			this.options.onDismiss();
		}
	}

	private getDragOffsetYInternal(delta: number): number {
		if (this.options.placement === 'bottom') {
			return Math.max(0, delta);
		} else if (this.options.placement === 'top') {
			return Math.min(0, delta);
		}
		return 0;
	}

	private getDragOffsetXInternal(delta: number): number {
		if (this.options.placement === 'right') {
			return Math.max(0, delta);
		} else if (this.options.placement === 'left') {
			return Math.min(0, delta);
		}
		return 0;
	}

	/**
	 * Check if a swipe gesture exceeds the dismiss threshold.
	 */
	private isAboveDismissThreshold(deltaX: number, deltaY: number, duration: number): boolean {
		const { DISTANCE_SLOW, DISTANCE_FAST, FAST_SWIPE_MAX_DURATION } = DISMISS_THRESHOLDS;
		const isFastSwipe = duration < FAST_SWIPE_MAX_DURATION;

		switch (this.options.placement) {
			case 'bottom':
				return deltaY > DISTANCE_SLOW || (deltaY > DISTANCE_FAST && isFastSwipe);
			case 'top':
				return deltaY < -DISTANCE_SLOW || (deltaY < -DISTANCE_FAST && isFastSwipe);
			case 'right':
				return deltaX > DISTANCE_SLOW || (deltaX > DISTANCE_FAST && isFastSwipe);
			case 'left':
				return deltaX < -DISTANCE_SLOW || (deltaX < -DISTANCE_FAST && isFastSwipe);
			default:
				return false;
		}
	}

	private handleClick(event: MouseEvent) {
		if (this.justDragged) {
			event.preventDefault();
			event.stopPropagation();
			event.stopImmediatePropagation();
		}
	}

	private reportDragProgress() {
		if (!this.options.onDragChange || !this.isDragging) return;

		const offset =
			this.options.placement === 'right' || this.options.placement === 'left'
				? this.getDragOffsetX()
				: this.getDragOffsetY();

		let progress = 0;
		if (this.options.placement === 'right') {
			const drawerWidth = this.element?.offsetWidth || 600;
			progress = Math.max(0, Math.min(1, 1 - offset / drawerWidth));
		} else if (this.options.placement === 'left') {
			const drawerWidth = this.element?.offsetWidth || 600;
			progress = Math.max(0, Math.min(1, 1 + offset / drawerWidth));
		} else if (this.options.placement === 'bottom') {
			const drawerHeight = this.element?.offsetHeight || 400;
			progress = Math.max(0, Math.min(1, 1 - offset / drawerHeight));
		} else if (this.options.placement === 'top') {
			const drawerHeight = this.element?.offsetHeight || 400;
			progress = Math.max(0, Math.min(1, 1 + offset / drawerHeight));
		}

		this.options.onDragChange(offset, progress, true);
	}
}
