/**
 * Gesture Controller
 *
 * Handles touch and pointer gestures for the media spotlight:
 * - Horizontal swipe for navigation
 * - Vertical swipe for dismiss
 * - Pinch to zoom
 * - Double-tap to toggle zoom
 * - Pan when zoomed
 */

import type { GestureState } from '../types.js';

export interface GestureControllerConfig {
  /** Minimum distance (px) to trigger a swipe */
  swipeThreshold: number;

  /** Velocity (px/ms) that triggers a fast swipe */
  fastSwipeVelocity: number;

  /** Distance (px) to trigger dismiss */
  dismissThreshold: number;

  /** Maximum zoom scale */
  maxScale: number;

  /** Minimum zoom scale */
  minScale: number;

  /** Whether to enable horizontal swipe */
  enableHorizontal: boolean;

  /** Whether to enable vertical swipe */
  enableVertical: boolean;

  /** Whether to enable pinch zoom */
  enablePinch: boolean;

  /** Whether to enable double-tap zoom */
  enableDoubleTap: boolean;
}

const DEFAULT_CONFIG: GestureControllerConfig = {
  swipeThreshold: 80,
  fastSwipeVelocity: 0.5,
  dismissThreshold: 150,
  maxScale: 5,
  minScale: 1,
  enableHorizontal: true,
  enableVertical: true,
  enablePinch: true,
  enableDoubleTap: true,
};

export type GestureEvent =
  | { type: 'swipe-left' }
  | { type: 'swipe-right' }
  | { type: 'dismiss' }
  | { type: 'tap' }
  | { type: 'double-tap'; x: number; y: number }
  | { type: 'zoom-change'; scale: number }
  | { type: 'pan-change'; x: number; y: number };

export type GestureEventHandler = (event: GestureEvent) => void;

interface TouchPoint {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  startTime: number;
}

export class GestureController {
  private config: GestureControllerConfig;
  private element: HTMLElement | null = null;
  private handler: GestureEventHandler | null = null;

  // Touch tracking
  private touches: Map<number, TouchPoint> = new Map();
  private lastTapTime = 0;
  private lastTapX = 0;
  private lastTapY = 0;

  // Gesture state
  private _state: GestureState = {
    swipeX: 0,
    swipeY: 0,
    scale: 1,
    panX: 0,
    panY: 0,
    isGestureActive: false,
    velocityX: 0,
    velocityY: 0,
  };

  // Pinch tracking
  private initialPinchDistance = 0;
  private initialScale = 1;

  constructor(config: Partial<GestureControllerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get state(): Readonly<GestureState> {
    return this._state;
  }

  /**
   * Attach the gesture controller to an element.
   */
  attach(element: HTMLElement, handler: GestureEventHandler): void {
    this.element = element;
    this.handler = handler;

    element.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    element.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    element.addEventListener('touchend', this.handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', this.handleTouchEnd, { passive: true });

    // Pointer events for mouse support
    element.addEventListener('pointerdown', this.handlePointerDown);
    element.addEventListener('pointermove', this.handlePointerMove);
    element.addEventListener('pointerup', this.handlePointerUp);
    element.addEventListener('pointercancel', this.handlePointerUp);
  }

  /**
   * Detach the gesture controller from the element.
   */
  detach(): void {
    if (!this.element) return;

    this.element.removeEventListener('touchstart', this.handleTouchStart);
    this.element.removeEventListener('touchmove', this.handleTouchMove);
    this.element.removeEventListener('touchend', this.handleTouchEnd);
    this.element.removeEventListener('touchcancel', this.handleTouchEnd);

    this.element.removeEventListener('pointerdown', this.handlePointerDown);
    this.element.removeEventListener('pointermove', this.handlePointerMove);
    this.element.removeEventListener('pointerup', this.handlePointerUp);
    this.element.removeEventListener('pointercancel', this.handlePointerUp);

    this.element = null;
    this.handler = null;
  }

  /**
   * Reset gesture state (e.g., after navigation).
   */
  reset(): void {
    this._state = {
      swipeX: 0,
      swipeY: 0,
      scale: 1,
      panX: 0,
      panY: 0,
      isGestureActive: false,
      velocityX: 0,
      velocityY: 0,
    };
    this.touches.clear();
  }

  /**
   * Set zoom level programmatically.
   * @param scale - Target scale level
   * @param _centerX - Reserved for future: zoom center X coordinate
   * @param _centerY - Reserved for future: zoom center Y coordinate
   */
  setZoom(scale: number, _centerX?: number, _centerY?: number): void {
    this._state.scale = Math.max(this.config.minScale, Math.min(this.config.maxScale, scale));

    if (this._state.scale === 1) {
      // Reset pan when zoomed out
      this._state.panX = 0;
      this._state.panY = 0;
    }

    this.handler?.({ type: 'zoom-change', scale: this._state.scale });
  }

  // ===== Touch Handlers =====

  private handleTouchStart = (e: TouchEvent): void => {
    for (const touch of Array.from(e.changedTouches)) {
      this.touches.set(touch.identifier, {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
      });
    }

    this._state.isGestureActive = true;

    if (this.touches.size === 2 && this.config.enablePinch) {
      this.initPinch();
    }
  };

  private handleTouchMove = (e: TouchEvent): void => {
    e.preventDefault();

    for (const touch of Array.from(e.changedTouches)) {
      const tracked = this.touches.get(touch.identifier);
      if (tracked) {
        tracked.x = touch.clientX;
        tracked.y = touch.clientY;
      }
    }

    if (this.touches.size === 2 && this.config.enablePinch) {
      this.updatePinch();
    } else if (this.touches.size === 1) {
      this.updateSwipe();
    }
  };

  private handleTouchEnd = (e: TouchEvent): void => {
    const now = Date.now();

    for (const touch of Array.from(e.changedTouches)) {
      const tracked = this.touches.get(touch.identifier);

      if (tracked && this.touches.size === 1) {
        const deltaX = tracked.x - tracked.startX;
        const deltaY = tracked.y - tracked.startY;
        const elapsed = now - tracked.startTime;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Check for tap
        if (distance < 10 && elapsed < 300) {
          this.handleTap(tracked.x, tracked.y, now);
        } else {
          // Check for swipe completion
          this.completeSwipe(deltaX, deltaY, elapsed);
        }
      }

      this.touches.delete(touch.identifier);
    }

    if (this.touches.size === 0) {
      this._state.isGestureActive = false;
      this._state.swipeX = 0;
      this._state.swipeY = 0;
    }
  };

  // ===== Pointer Handlers (Mouse) =====

  private isPointerDown = false;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private pointerStartTime = 0;

  private handlePointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') return; // Let touch handlers handle it

    this.isPointerDown = true;
    this.pointerStartX = e.clientX;
    this.pointerStartY = e.clientY;
    this.pointerStartTime = Date.now();
    this._state.isGestureActive = true;
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (e.pointerType === 'touch' || !this.isPointerDown) return;

    const deltaX = e.clientX - this.pointerStartX;
    const deltaY = e.clientY - this.pointerStartY;

    if (this._state.scale > 1) {
      // Pan mode when zoomed
      this._state.panX += deltaX;
      this._state.panY += deltaY;
      this.pointerStartX = e.clientX;
      this.pointerStartY = e.clientY;
      this.handler?.({ type: 'pan-change', x: this._state.panX, y: this._state.panY });
    } else {
      // Swipe mode
      this._state.swipeX = deltaX;
      this._state.swipeY = deltaY;
    }
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (e.pointerType === 'touch' || !this.isPointerDown) return;

    const now = Date.now();
    const deltaX = e.clientX - this.pointerStartX;
    const deltaY = e.clientY - this.pointerStartY;
    const elapsed = now - this.pointerStartTime;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance < 10 && elapsed < 300) {
      this.handleTap(e.clientX, e.clientY, now);
    } else if (this._state.scale === 1) {
      this.completeSwipe(deltaX, deltaY, elapsed);
    }

    this.isPointerDown = false;
    this._state.isGestureActive = false;
    this._state.swipeX = 0;
    this._state.swipeY = 0;
  };

  // ===== Gesture Logic =====

  private handleTap(x: number, y: number, now: number): void {
    const timeSinceLastTap = now - this.lastTapTime;
    const distanceFromLastTap = Math.sqrt(
      Math.pow(x - this.lastTapX, 2) + Math.pow(y - this.lastTapY, 2)
    );

    if (timeSinceLastTap < 300 && distanceFromLastTap < 50 && this.config.enableDoubleTap) {
      // Double tap
      this.handler?.({ type: 'double-tap', x, y });
      this.lastTapTime = 0;
    } else {
      // Single tap
      this.handler?.({ type: 'tap' });
      this.lastTapTime = now;
      this.lastTapX = x;
      this.lastTapY = y;
    }
  }

  private updateSwipe(): void {
    const touch = Array.from(this.touches.values())[0];
    if (!touch) return;

    const deltaX = touch.x - touch.startX;
    const deltaY = touch.y - touch.startY;

    if (this._state.scale > 1) {
      // Pan when zoomed
      this._state.panX += deltaX - this._state.swipeX;
      this._state.panY += deltaY - this._state.swipeY;
      this.handler?.({ type: 'pan-change', x: this._state.panX, y: this._state.panY });
    }

    this._state.swipeX = deltaX;
    this._state.swipeY = deltaY;
  }

  private completeSwipe(deltaX: number, deltaY: number, elapsed: number): void {
    const velocityX = deltaX / elapsed;
    const velocityY = deltaY / elapsed;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    this._state.velocityX = velocityX;
    this._state.velocityY = velocityY;

    // Horizontal swipe takes precedence if it's the dominant direction
    if (this.config.enableHorizontal && absX > absY) {
      const fastSwipe = Math.abs(velocityX) > this.config.fastSwipeVelocity;
      const threshold = fastSwipe ? this.config.swipeThreshold / 2 : this.config.swipeThreshold;

      if (deltaX > threshold) {
        this.handler?.({ type: 'swipe-right' });
      } else if (deltaX < -threshold) {
        this.handler?.({ type: 'swipe-left' });
      }
    }
    // Vertical swipe for dismiss
    else if (this.config.enableVertical && absY > absX) {
      if (deltaY > this.config.dismissThreshold) {
        this.handler?.({ type: 'dismiss' });
      }
    }
  }

  private initPinch(): void {
    const touchArray = Array.from(this.touches.values());
    const t1 = touchArray[0];
    const t2 = touchArray[1];
    if (!t1 || !t2) return;

    this.initialPinchDistance = Math.sqrt(
      Math.pow(t2.x - t1.x, 2) + Math.pow(t2.y - t1.y, 2)
    );
    this.initialScale = this._state.scale;
  }

  private updatePinch(): void {
    const touchArray = Array.from(this.touches.values());
    const t1 = touchArray[0];
    const t2 = touchArray[1];
    if (!t1 || !t2) return;

    const currentDistance = Math.sqrt(
      Math.pow(t2.x - t1.x, 2) + Math.pow(t2.y - t1.y, 2)
    );

    const scaleFactor = currentDistance / this.initialPinchDistance;
    const newScale = Math.max(
      this.config.minScale,
      Math.min(this.config.maxScale, this.initialScale * scaleFactor)
    );

    if (newScale !== this._state.scale) {
      this._state.scale = newScale;
      this.handler?.({ type: 'zoom-change', scale: newScale });
    }
  }
}
