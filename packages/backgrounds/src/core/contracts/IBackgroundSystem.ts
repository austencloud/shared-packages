/**
 * Background System Interface
 *
 * Base interface for all background animation systems.
 * Defines the common contract that all background systems must implement.
 */

import type { AccessibilitySettings } from "../domain/types.js";
import type {
  Dimensions,
  QualityLevel,
  PerformanceMetrics,
} from "../domain/types.js";

export interface IBackgroundSystem {
  /**
   * Initialize the background system with dimensions and quality
   */
  initialize(dimensions: Dimensions, quality: QualityLevel): void;

  /**
   * Update the background system animation state
   * @param dimensions - Canvas dimensions
   * @param frameMultiplier - Optional multiplier to normalize animation speed (defaults to 1.0)
   */
  update(dimensions: Dimensions, frameMultiplier?: number): void;

  /**
   * Draw the background system to the canvas
   */
  draw(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void;

  /**
   * Set the quality level for the background system
   */
  setQuality(quality: QualityLevel): void;

  /**
   * Clean up resources used by the background system
   */
  cleanup(): void;

  /**
   * Handle resize events (optional)
   */
  handleResize?(oldDimensions: Dimensions, newDimensions: Dimensions): void;

  /**
   * Set the current pointer position (canvas-logical px) for interactive
   * backgrounds (e.g. fish cursor flee). active=false when pointer left.
   * pointerType lets motion effects keep touch input flat.
   */
  setPointer?(x: number, y: number, active: boolean, pointerType?: string): void;

  /**
   * Tap-test the background at (x, y) in canvas-logical px. Interactive
   * backgrounds (e.g. ocean jellyfish) hit-test their elements and, on a hit,
   * trigger feedback (flash) and return a note mapping the caller can sonify.
   * pitch01 in [0,1] (higher = higher pitch), pan in [-1,1].
   */
  pokeAt?(x: number, y: number): { hit: boolean; pitch01: number; pan: number } | void;

  /**
   * Set accessibility settings (optional)
   */
  setAccessibility?(settings: AccessibilitySettings): void;

  /**
   * Get performance metrics (optional)
   */
  getMetrics?(): PerformanceMetrics;
}
