import type { Dimensions } from "../domain/types.js";

export interface DepthParallaxOffset {
  x: number;
  y: number;
}

export interface DepthParallaxStats {
  enabled: boolean;
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
}

export interface DepthParallaxProfile {
  horizontalRatio: number;
  horizontalMinimum: number;
  horizontalMaximum: number;
  verticalRatio: number;
  verticalMinimum: number;
  verticalMaximum: number;
}

const DEFAULT_PROFILE: DepthParallaxProfile = {
  horizontalRatio: 0.014,
  horizontalMinimum: 20,
  horizontalMaximum: 28,
  verticalRatio: 0.013,
  verticalMinimum: 11,
  verticalMaximum: 16,
};

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
 * Tracks one restrained viewpoint and resolves it at different scene depths.
 * Backgrounds own their visual planes; this class owns the shared interaction,
 * smoothing, accessibility, and depth-response behavior.
 */
export class DepthParallaxTracker {
  private readonly profile: DepthParallaxProfile;
  private currentX = 0;
  private currentY = 0;
  private targetX = 0;
  private targetY = 0;
  private inputEnabled = false;
  private reducedMotion = false;

  constructor(profile: Partial<DepthParallaxProfile> = {}) {
    this.profile = { ...DEFAULT_PROFILE, ...profile };
  }

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

    // Touch stays flat. A tablet may still use depth with a mouse or trackpad.
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

    // The scene travels opposite the viewpoint. Near planes travel farther.
    this.targetX = -removeDeadZone(normalizedX);
    this.targetY = -removeDeadZone(normalizedY);
  }

  getOffset(depth: number, dimensions: Dimensions): DepthParallaxOffset {
    if (!this.inputEnabled || this.reducedMotion) return { x: 0, y: 0 };

    const limit = this.getOffsetLimit(depth, dimensions);
    return {
      x: this.currentX * limit.x,
      y: this.currentY * limit.y,
    };
  }

  getOffsetLimit(depth: number, dimensions: Dimensions): DepthParallaxOffset {
    const safeDepth = clamp(depth, 0, 1);
    const depthScale = 0.12 + Math.pow(safeDepth, 1.35) * 0.88;

    return {
      x:
        clamp(
          dimensions.width * this.profile.horizontalRatio,
          this.profile.horizontalMinimum,
          this.profile.horizontalMaximum,
        ) * depthScale,
      y:
        clamp(
          dimensions.height * this.profile.verticalRatio,
          this.profile.verticalMinimum,
          this.profile.verticalMaximum,
        ) * depthScale,
    };
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
    if (reducedMotion) this.resetImmediately();
  }

  getStats(): DepthParallaxStats {
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
