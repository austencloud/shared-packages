/**
 * Core type definitions for the background system
 */

export type QualityLevel =
  | "high"
  | "medium"
  | "low"
  | "minimal"
  | "ultra-minimal";

export type Dimensions = {
  width: number;
  height: number;
};

export type PerformanceMetrics = {
  fps: number;
  warnings: string[];
  particleCount?: number;
  renderTime?: number;
  memoryUsage?: number;
};

export type BackgroundEvent =
  | { type: "ready" }
  | { type: "performanceReport"; metrics: PerformanceMetrics }
  | { type: "qualityChanged"; quality: QualityLevel }
  | { type: "error"; message: string; stack?: string };

export interface AccessibilitySettings {
  reducedMotion: boolean;
  highContrast: boolean;
  visibleParticleSize?: number;
}

export interface GradientStop {
  position: number;
  color: string;
}

export interface QualityConfig {
  maxParticles: number;
  animationFrameRate: number;
  enableBlur: boolean;
  enableGlow: boolean;
  particleSize: number;
  densityMultiplier: number;
}

export interface QualitySettings extends QualityConfig {
  enableShootingStars: boolean;
}
