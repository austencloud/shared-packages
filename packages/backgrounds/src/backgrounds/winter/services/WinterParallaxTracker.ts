import type { Dimensions } from "../../../core/domain/types.js";

export interface WinterParallaxOffset {
  x: number;
  y: number;
}

export interface WinterParallaxStats {
  enabled: boolean;
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
}

const POINTER_DEAD_ZONE = 0.06;
const FRAME_SMOOTHING = 0.08;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function removeDeadZone(value: number): number {
  const magnitude = Math.abs(value);
  if (magnitude <= POINTER_DEAD_ZONE) return 0;

  return (
    Math.sign(value) *
    ((magnitude - POINTER_DEAD_ZONE) / (1 - POINTER_DEAD_ZONE))
  );
}

/**
 * Tracks a shallow camera offset for the winter snow layers.
 *
 * The sky stays anchored while nearby flakes travel farther than distant
 * flakes. This creates depth without rotating, scaling, or moving the canvas.
 */
export class WinterParallaxTracker {
  private currentX = 0;
  private currentY = 0;
  private targetX = 0;
  private targetY = 0;
  private inputEnabled = false;
  private reducedMotion = false;

  initialize(): void {
    this.currentX = 0;
    this.currentY = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.inputEnabled = false;
  }

  update(frameMultiplier: number = 1): void {
    if (this.reducedMotion) return;

    const step = clamp(frameMultiplier, 0, 4);
    const response = 1 - Math.pow(1 - FRAME_SMOOTHING, step);
    this.currentX += (this.targetX - this.currentX) * response;
    this.currentY += (this.targetY - this.currentY) * response;

    if (Math.abs(this.currentX) < 0.0001 && this.targetX === 0) {
      this.currentX = 0;
    }
    if (Math.abs(this.currentY) < 0.0001 && this.targetY === 0) {
      this.currentY = 0;
    }
  }

  setPointer(
    x: number,
    y: number,
    active: boolean,
    pointerType: string | undefined,
    dimensions: Dimensions,
  ): void {
    if (this.reducedMotion) return;

    // Touch input stays flat. A tablet can still use depth when its current
    // input is a mouse or trackpad, without listening to device orientation.
    if (pointerType === "touch") {
      this.resetImmediately();
      return;
    }

    this.inputEnabled = true;
    if (!active || dimensions.width <= 0 || dimensions.height <= 0) {
      this.targetX = 0;
      this.targetY = 0;
      return;
    }

    const normalizedX = clamp((x / dimensions.width - 0.5) * 2, -1, 1);
    const normalizedY = clamp((y / dimensions.height - 0.5) * 2, -1, 1);

    // Moving the viewpoint right makes nearby snow appear to shift left.
    this.targetX = -removeDeadZone(normalizedX);
    this.targetY = -removeDeadZone(normalizedY);
  }

  getOffset(depth: number, dimensions: Dimensions): WinterParallaxOffset {
    if (!this.inputEnabled || this.reducedMotion) return { x: 0, y: 0 };

    const safeDepth = clamp(depth, 0, 1);
    const depthScale = 0.12 + Math.pow(safeDepth, 1.35) * 0.88;
    const maxHorizontal = clamp(dimensions.width * 0.014, 20, 28);
    const maxVertical = clamp(dimensions.height * 0.013, 11, 16);

    return {
      x: this.currentX * maxHorizontal * depthScale,
      y: this.currentY * maxVertical * depthScale,
    };
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
    if (reducedMotion) this.resetImmediately();
  }

  getStats(): WinterParallaxStats {
    return {
      enabled: this.inputEnabled && !this.reducedMotion,
      currentX: this.currentX,
      currentY: this.currentY,
      targetX: this.targetX,
      targetY: this.targetY,
    };
  }

  private resetImmediately(): void {
    this.currentX = 0;
    this.currentY = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.inputEnabled = false;
  }
}
