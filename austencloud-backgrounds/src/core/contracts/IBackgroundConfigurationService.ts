/**
 * Service for managing background configuration and quality detection
 */

import type { QualityLevel, QualityConfig, QualitySettings } from "../domain/types.js";

export interface IBackgroundConfigurationService {
  /**
   * Detects the appropriate quality level based on device capabilities
   */
  detectAppropriateQuality(): QualityLevel;

  /**
   * Get configuration for a specific quality level
   */
  getQualityConfig(quality: QualityLevel): QualityConfig;

  /**
   * Get optimized configuration for a specific quality level
   */
  getOptimizedConfig(quality: QualityLevel): {
    config: {
      core: { background: { gradientStops: ReadonlyArray<{ position: number; color: string }> } };
      nightSky: unknown;
    };
    qualitySettings: QualitySettings;
  };

  /**
   * Gets normalized configuration with quality adjustments
   */
  getQualityAdjustedConfig<T extends Record<string, unknown>>(
    baseConfig: T,
    quality: QualityLevel
  ): T & { quality: QualityConfig };

  /**
   * Creates a bounded random value within min/max range
   */
  createBoundedRandom(min: number, max: number): () => number;

  /**
   * Gets a random color from an array of colors
   */
  getRandomColor(colors: string[]): string;
}
