/**
 * Background Configuration Service
 *
 * Detects device capabilities and provides quality-adjusted configuration.
 */

import type { IBackgroundConfigurationService } from "../contracts/IBackgroundConfigurationService.js";
import type { QualityLevel, QualityConfig, QualitySettings } from "../domain/types.js";
import { CoreBackgroundConfig, QUALITY_CONFIGS } from "../domain/constants.js";
import { NightSkyConfig } from "../../backgrounds/night-sky/constants.js";

export class BackgroundConfigurationService implements IBackgroundConfigurationService {
  /**
   * Detects the appropriate quality level based on device capabilities
   * and performance characteristics.
   */
  detectAppropriateQuality(): QualityLevel {
    // Server-side rendering check
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return "medium";
    }

    // Check device memory (if available) - ultra-minimal for extremely low memory
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number })
      .deviceMemory;
    if (deviceMemory && deviceMemory < 2) {
      return "ultra-minimal"; // <2GB RAM = absolute lowest tier
    }

    // Check connection type (if available) - ultra-minimal for slowest connections
    const connection = (
      navigator as Navigator & {
        connection?: {
          effectiveType?: string;
        };
      }
    ).connection;
    if (connection) {
      const effectiveType = connection.effectiveType;
      if (effectiveType === "slow-2g") {
        return "ultra-minimal"; // Slowest connection
      }
      if (effectiveType === "2g") {
        return "minimal";
      }
      if (effectiveType === "3g") {
        return "low";
      }
    }

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) {
      return "minimal";
    }

    // Check device memory (mid-range)
    if (deviceMemory && deviceMemory < 4) {
      return "low"; // 2-4GB RAM
    }

    // Check hardware concurrency (CPU cores)
    const hardwareConcurrency = navigator.hardwareConcurrency || 2;
    if (hardwareConcurrency < 4) {
      return "medium";
    }

    // Check screen size and pixel density
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const pixelRatio = window.devicePixelRatio || 1;

    // Low resolution or small screens
    if (screenWidth < 1024 || screenHeight < 768) {
      return "medium";
    }

    // Very high pixel density might strain performance
    if (pixelRatio > 2) {
      return "medium";
    }

    // Check if we're on a mobile device
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
    if (isMobile) {
      return "medium";
    }

    // Default to high quality for desktop devices with good specs
    return "high";
  }

  /**
   * Get configuration for a specific quality level
   */
  getQualityConfig(quality: QualityLevel): QualityConfig {
    return QUALITY_CONFIGS[quality] || QUALITY_CONFIGS["medium"];
  }

  /**
   * Get optimized configuration for a specific quality level
   * This function provides both the base config and quality-specific settings
   */
  getOptimizedConfig(quality: QualityLevel): {
    config: {
      core: { background: typeof CoreBackgroundConfig };
      nightSky: typeof NightSkyConfig;
    };
    qualitySettings: QualitySettings;
  } {
    const qualitySettings = this.getQualityConfig(quality);

    return {
      config: {
        core: {
          background: CoreBackgroundConfig,
        },
        nightSky: NightSkyConfig,
      },
      qualitySettings: {
        ...qualitySettings,
        enableShootingStars: quality === "high" || quality === "medium",
      },
    };
  }

  /**
   * Gets normalized configuration with quality adjustments
   */
  getQualityAdjustedConfig<T extends Record<string, unknown>>(
    baseConfig: T,
    quality: QualityLevel
  ): T & { quality: QualityConfig } {
    const qualityConfig = QUALITY_CONFIGS[quality] || QUALITY_CONFIGS["medium"];

    const adjustedConfig = {
      ...baseConfig,
      quality: qualityConfig,
    };

    // Apply quality-based adjustments with proper typing
    if ("density" in baseConfig && typeof baseConfig["density"] === "number") {
      (adjustedConfig as unknown as { density: number }).density =
        baseConfig["density"] * qualityConfig.densityMultiplier;
    }

    if ("maxSize" in baseConfig && typeof baseConfig["maxSize"] === "number") {
      (adjustedConfig as unknown as { maxSize: number }).maxSize = Math.max(
        1,
        baseConfig["maxSize"] * (qualityConfig.particleSize / 4)
      );
    }

    return adjustedConfig;
  }

  /**
   * Creates a bounded random value within min/max range
   */
  createBoundedRandom(min: number, max: number): () => number {
    return () => Math.random() * (max - min) + min;
  }

  /**
   * Gets a random color from an array of colors
   */
  getRandomColor(colors: string[]): string {
    return (
      colors[Math.floor(Math.random() * colors.length)] ||
      colors[0] ||
      "#000000"
    );
  }
}

// Singleton instance for internal use
let configurationServiceInstance: BackgroundConfigurationService | null = null;

export function getBackgroundConfigurationService(): BackgroundConfigurationService {
  if (!configurationServiceInstance) {
    configurationServiceInstance = new BackgroundConfigurationService();
  }
  return configurationServiceInstance;
}
