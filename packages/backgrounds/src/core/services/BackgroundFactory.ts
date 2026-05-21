/**
 * Background Factory
 *
 * Creates background animation systems with lazy loading.
 * Each background type is loaded on-demand to reduce initial bundle size.
 */

import type {
  AccessibilitySettings,
} from "../domain/types.js";
import type { BackgroundSystem } from "../domain/models.js";
import type { QualityLevel } from "../domain/types.js";
import { BackgroundType } from "../domain/enums.js";

export interface BackgroundFactoryParams {
  type: BackgroundType;
  quality: QualityLevel;
  initialQuality: QualityLevel;
  accessibility?: Record<string, unknown>;
  thumbnailMode?: boolean;
  // Simple background settings
  backgroundColor?: string;
  gradientColors?: string[];
  gradientDirection?: number;
}

// Lazy loaders for background systems
const backgroundLoaders = {
  pride: () => import("../../backgrounds/rainbow/services/RainbowBackgroundSystem.js"),
  winter: () => import("../../backgrounds/winter/services/WinterBackgroundSystem.js"),
  cosmic: () => import("../../backgrounds/cosmic/services/CosmicBackgroundSystem.js"),
  ocean: () => import("../../backgrounds/ocean/services/OceanBackgroundOrchestrator.js"),
  ember: () => import("../../backgrounds/ember/services/EmberBackgroundSystem.js"),
  blossom: () => import("../../backgrounds/blossom/services/BlossomBackgroundSystem.js"),
  forest: () => import("../../backgrounds/forest/services/ForestBackgroundSystem.js"),
  autumn: () => import("../../backgrounds/autumn/services/AutumnBackgroundSystem.js"),
  celestial: () => import("../../backgrounds/celestial/services/CelestialBackgroundSystem.js"),
  void: () => import("../../backgrounds/void/services/VoidBackgroundSystem.js"),
};

export class BackgroundFactory {
  // Default accessibility settings
  private static readonly defaultAccessibility: AccessibilitySettings = {
    reducedMotion: false,
    highContrast: false,
    visibleParticleSize: 2,
  };

  public static async createBackgroundSystem(
    options: BackgroundFactoryParams
  ): Promise<BackgroundSystem> {
    const quality: QualityLevel = options.initialQuality;

    // Accessibility detection for window environments
    const accessibility: AccessibilitySettings = {
      ...this.defaultAccessibility,
      ...(options.accessibility ?? {}),
    };

    // Check for reduced motion preference
    if (typeof window !== "undefined") {
      try {
        const prefersReducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        );
        if (prefersReducedMotion.matches) {
          accessibility.reducedMotion = true;
        }
      } catch (_error) {
        console.warn("Could not detect reduced motion preference:", _error);
      }
    }

    let backgroundSystem: BackgroundSystem;

    // Switch statement for background types - with lazy loading
    switch (options.type) {
      case BackgroundType.PRIDE: {
        const { RainbowBackgroundSystem } = await backgroundLoaders.pride();
        backgroundSystem = new RainbowBackgroundSystem();
        break;
      }
      case BackgroundType.WINTER: {
        const { WinterBackgroundSystem } = await backgroundLoaders.winter();
        backgroundSystem = new WinterBackgroundSystem();
        break;
      }
      case BackgroundType.COSMIC: {
        const { CosmicBackgroundSystem } = await backgroundLoaders.cosmic();
        backgroundSystem = CosmicBackgroundSystem.create();
        break;
      }
      case BackgroundType.OCEAN: {
        const { OceanBackgroundOrchestrator } = await backgroundLoaders.ocean();
        backgroundSystem = OceanBackgroundOrchestrator.create();
        break;
      }
      case BackgroundType.EMBER: {
        const { EmberBackgroundSystem } = await backgroundLoaders.ember();
        backgroundSystem = new EmberBackgroundSystem();
        break;
      }
      case BackgroundType.BLOSSOM: {
        const { BlossomBackgroundSystem } = await backgroundLoaders.blossom();
        backgroundSystem = new BlossomBackgroundSystem();
        break;
      }
      case BackgroundType.FOREST: {
        const { ForestBackgroundSystem } = await backgroundLoaders.forest();
        backgroundSystem = new ForestBackgroundSystem();
        break;
      }
      case BackgroundType.AUTUMN: {
        const { AutumnBackgroundSystem } = await backgroundLoaders.autumn();
        backgroundSystem = new AutumnBackgroundSystem();
        break;
      }
      case BackgroundType.CELESTIAL: {
        const { CelestialBackgroundSystem } = await backgroundLoaders.celestial();
        backgroundSystem = new CelestialBackgroundSystem();
        break;
      }
      case BackgroundType.VOID: {
        const { VoidBackgroundSystem } = await backgroundLoaders.void();
        backgroundSystem = new VoidBackgroundSystem();
        break;
      }
      default: {
        console.warn(
          `Background type "${String(options.type)}" not implemented. Defaulting to Pride.`
        );
        const { RainbowBackgroundSystem } = await backgroundLoaders.pride();
        backgroundSystem = new RainbowBackgroundSystem();
      }
    }

    // Apply accessibility settings if the background system supports them
    if (backgroundSystem.setAccessibility) {
      backgroundSystem.setAccessibility(accessibility);
    }

    // Apply thumbnail mode if specified and supported
    if (options.thumbnailMode && "setThumbnailMode" in backgroundSystem) {
      (
        backgroundSystem as { setThumbnailMode: (enabled: boolean) => void }
      ).setThumbnailMode(true);
    }

    // Set initial quality
    backgroundSystem.setQuality(quality);

    return backgroundSystem;
  }

  public static async createOptimalBackgroundSystem(): Promise<BackgroundSystem> {
    // Default to Pride as the default background
    return await this.createBackgroundSystem({
      type: BackgroundType.PRIDE,
      quality: "medium",
      initialQuality: "medium",
    });
  }

  public static isBackgroundSupported(type: BackgroundType): boolean {
    switch (type) {
      case BackgroundType.WINTER:
      case BackgroundType.COSMIC:
      case BackgroundType.PRIDE:
      case BackgroundType.OCEAN:
      case BackgroundType.EMBER:
      case BackgroundType.BLOSSOM:
      case BackgroundType.FOREST:
      case BackgroundType.AUTUMN:
      case BackgroundType.CELESTIAL:
      case BackgroundType.VOID:
        return true;
      default:
        return false;
    }
  }

  public static getSupportedBackgroundTypes(): BackgroundType[] {
    return [
      BackgroundType.COSMIC,
      BackgroundType.WINTER,
      BackgroundType.PRIDE,
      BackgroundType.OCEAN,
      BackgroundType.EMBER,
      BackgroundType.BLOSSOM,
      BackgroundType.FOREST,
      BackgroundType.AUTUMN,
      BackgroundType.CELESTIAL,
      BackgroundType.VOID,
    ];
  }
}
