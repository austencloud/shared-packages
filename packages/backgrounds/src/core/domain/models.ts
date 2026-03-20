/**
 * Core model interfaces for the background system
 */

import type {
  Dimensions,
  QualityLevel,
  PerformanceMetrics,
  AccessibilitySettings,
} from "./types.js";

/**
 * Animation component interface - stateful components that render to canvas
 */
export interface AnimationComponent {
  initialize: (dimensions: Dimensions, quality: QualityLevel) => void;
  update: (dimensions: Dimensions) => void;
  draw: (ctx: CanvasRenderingContext2D, dimensions: Dimensions) => void;
  cleanup: () => void;
  setQuality: (quality: QualityLevel) => void;
  setAccessibility?: (settings: AccessibilitySettings) => void;
}

/**
 * Animation system interface - functional pattern for stateless systems
 */
export interface AnimationSystem<T> {
  initialize: (dimensions: Dimensions, quality: QualityLevel) => T;
  update: (state: T, dimensions: Dimensions) => T;
  draw: (
    state: T,
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions
  ) => void;
  cleanup?: () => void;
  setQuality?: (quality: QualityLevel) => void;
  adjustToResize?: (
    state: T,
    oldDimensions: Dimensions,
    newDimensions: Dimensions,
    quality: QualityLevel
  ) => T;
  setAccessibility?: (settings: AccessibilitySettings) => void;
}

/**
 * Background system interface - the main contract all backgrounds implement
 */
export interface BackgroundSystem {
  initialize: (dimensions: Dimensions, quality: QualityLevel) => void;
  update: (dimensions: Dimensions, frameMultiplier?: number) => void;
  draw: (ctx: CanvasRenderingContext2D, dimensions: Dimensions) => void;
  setQuality: (quality: QualityLevel) => void;
  cleanup: () => void;
  handleResize?: (oldDimensions: Dimensions, newDimensions: Dimensions) => void;
  setAccessibility?: (settings: AccessibilitySettings) => void;
  getMetrics?: () => PerformanceMetrics;
}
