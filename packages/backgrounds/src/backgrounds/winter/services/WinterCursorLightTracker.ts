import type { Dimensions } from "../../../core/domain/types.js";

export interface WinterCursorLightStats {
  enabled: boolean;
  x: number;
  y: number;
  intensity: number;
  targetIntensity: number;
  radius: number;
}

const POSITION_FRAME_SMOOTHING = 0.24;
const LIGHT_UP_FRAME_SMOOTHING = 0.16;
const FADE_OUT_FRAME_SMOOTHING = 0.09;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Tracks the small pool of light that catches snow near a mouse or pen.
 *
 * Only flakes sample this position. Nothing is painted behind them, so the
 * night sky never develops a visible cursor-shaped circle.
 */
export class WinterCursorLightTracker {
  private currentX = 0;
  private currentY = 0;
  private targetX = 0;
  private targetY = 0;
  private currentIntensity = 0;
  private targetIntensity = 0;
  private inputEnabled = false;
  private hasPosition = false;
  private reducedMotion = false;

  initialize(): void {
    this.resetImmediately();
  }

  update(frameMultiplier: number = 1): void {
    if (this.reducedMotion || !this.inputEnabled) return;

    const step = clamp(frameMultiplier, 0, 4);
    const positionResponse = 1 - Math.pow(1 - POSITION_FRAME_SMOOTHING, step);
    const intensitySmoothing =
      this.targetIntensity > this.currentIntensity
        ? LIGHT_UP_FRAME_SMOOTHING
        : FADE_OUT_FRAME_SMOOTHING;
    const intensityResponse = 1 - Math.pow(1 - intensitySmoothing, step);

    this.currentX += (this.targetX - this.currentX) * positionResponse;
    this.currentY += (this.targetY - this.currentY) * positionResponse;
    this.currentIntensity +=
      (this.targetIntensity - this.currentIntensity) * intensityResponse;

    if (this.targetIntensity === 0 && this.currentIntensity < 0.0001) {
      this.currentIntensity = 0;
      this.inputEnabled = false;
      this.hasPosition = false;
    }
  }

  setPointer(
    x: number,
    y: number,
    active: boolean,
    pointerType?: string,
  ): void {
    if (this.reducedMotion) return;

    if (pointerType === "touch") {
      this.resetImmediately();
      return;
    }

    if (!active) {
      this.targetIntensity = 0;
      return;
    }

    // The first frame starts at the real pointer position. Easing from (0, 0)
    // would send an unrelated flash across the top-left corner of the scene.
    if (!this.hasPosition) {
      this.currentX = x;
      this.currentY = y;
      this.hasPosition = true;
    }

    this.targetX = x;
    this.targetY = y;
    this.targetIntensity = 1;
    this.inputEnabled = true;
  }

  getIntensityAt(
    x: number,
    y: number,
    depth: number,
    dimensions: Dimensions,
  ): number {
    if (
      this.reducedMotion ||
      !this.inputEnabled ||
      this.currentIntensity <= 0
    ) {
      return 0;
    }

    const radius = this.getRadius(dimensions);
    const distance = Math.hypot(x - this.currentX, y - this.currentY);
    if (distance >= radius) return 0;

    const normalizedDistance = distance / radius;
    const radialFalloff = (1 - normalizedDistance * normalizedDistance) ** 2;
    const safeDepth = clamp(depth, 0, 1);
    const depthResponse = 0.38 + Math.pow(safeDepth, 1.2) * 0.62;

    return clamp(this.currentIntensity * radialFalloff * depthResponse, 0, 1);
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
    if (reducedMotion) this.resetImmediately();
  }

  getStats(dimensions: Dimensions): WinterCursorLightStats {
    return {
      enabled: this.inputEnabled && !this.reducedMotion,
      x: this.currentX,
      y: this.currentY,
      intensity: this.currentIntensity,
      targetIntensity: this.targetIntensity,
      radius: this.getRadius(dimensions),
    };
  }

  private getRadius(dimensions: Dimensions): number {
    return clamp(
      Math.min(dimensions.width, dimensions.height) * 0.15,
      135,
      190,
    );
  }

  private resetImmediately(): void {
    this.currentX = 0;
    this.currentY = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.currentIntensity = 0;
    this.targetIntensity = 0;
    this.inputEnabled = false;
    this.hasPosition = false;
  }
}
