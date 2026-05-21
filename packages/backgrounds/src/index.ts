/**
 * @austencloud/backgrounds
 *
 * Animated canvas background systems for web applications.
 * Provides a unified API for creating, controlling, and rendering
 * canvas-based animated backgrounds with quality adaptation.
 */

// ─── Core Types ──────────────────────────────────────────────────────────────

export type {
  QualityLevel,
  Dimensions,
  PerformanceMetrics,
  BackgroundEvent,
  AccessibilitySettings,
  GradientStop,
  QualityConfig,
  QualitySettings,
} from "./core/domain/types.js";

// ─── Enums ───────────────────────────────────────────────────────────────────

export { BackgroundType, BackgroundCategory } from "./core/domain/enums.js";

// ─── Domain Models ───────────────────────────────────────────────────────────

export type {
  AnimationComponent,
  AnimationSystem,
  BackgroundSystem,
} from "./core/domain/models.js";

// ─── Constants ───────────────────────────────────────────────────────────────

export {
  WinterConfig,
  CoreBackgroundConfig,
  QUALITY_CONFIGS,
} from "./core/domain/constants.js";

// ─── Contracts ───────────────────────────────────────────────────────────────

export type { IBackgroundSystem } from "./core/contracts/IBackgroundSystem.js";

export type {
  IBackgroundController,
  BackgroundOptions,
} from "./core/contracts/IBackgroundController.js";

export type { IBackgroundConfigurationService } from "./core/contracts/IBackgroundConfigurationService.js";

export type { IBackgroundRenderingService } from "./core/contracts/IBackgroundRenderingService.js";

export type { IGeoLocationProvider } from "./core/contracts/IGeoLocationProvider.js";
export { DefaultGeoLocationProvider } from "./core/contracts/IGeoLocationProvider.js";

// ─── Core Services ───────────────────────────────────────────────────────────

export {
  BackgroundController,
  getBackgroundController,
} from "./core/services/BackgroundController.js";

export {
  BackgroundFactory,
} from "./core/services/BackgroundFactory.js";
export type { BackgroundFactoryParams } from "./core/services/BackgroundFactory.js";

export {
  BackgroundConfigurationService,
  getBackgroundConfigurationService,
} from "./core/services/BackgroundConfigurationService.js";

export {
  BackgroundRenderingService,
  getBackgroundRenderingService,
} from "./core/services/BackgroundRenderingService.js";

export {
  getRenderingService,
  getConfigurationService,
  getGeoLocationProvider,
  setGeoLocationProvider,
  setRenderingService,
  setConfigurationService,
  resetServices,
} from "./core/services/ServiceFactory.js";

// ─── Shared Animation Components ────────────────────────────────────────────

export {
  createShootingStarSystem,
} from "./core/services/ShootingStarSystem.js";
export type {
  ShootingStarTailSegment,
  ShootingStar,
  ShootingStarState,
} from "./core/services/ShootingStarSystem.js";

export {
  MoonRenderer,
  createFullMoon,
  createCrescentMoon,
  createRealisticMoon,
} from "./core/services/MoonRenderer.js";
export type {
  MoonConfig,
  MoonState,
} from "./core/services/MoonRenderer.js";

// ─── Background Systems ─────────────────────────────────────────────────────

export { RainbowBackgroundSystem } from "./backgrounds/rainbow/services/RainbowBackgroundSystem.js";

export { WinterBackgroundSystem } from "./backgrounds/winter/services/WinterBackgroundSystem.js";

export { CosmicBackgroundSystem } from "./backgrounds/cosmic/services/CosmicBackgroundSystem.js";

export { OceanBackgroundOrchestrator } from "./backgrounds/ocean/services/OceanBackgroundOrchestrator.js";

export { EmberBackgroundSystem } from "./backgrounds/ember/services/EmberBackgroundSystem.js";

export { BlossomBackgroundSystem } from "./backgrounds/blossom/services/BlossomBackgroundSystem.js";

export { ForestBackgroundSystem } from "./backgrounds/forest/services/ForestBackgroundSystem.js";
export type { ForestLayers } from "./backgrounds/forest/services/ForestBackgroundSystem.js";

export type {
  TreeTypeVisibility,
  EcologicalPattern,
  RenderedTree,
} from "./backgrounds/forest/domain/models/tree-silhouette-models.js";

export {
  ECOLOGICAL_PATTERNS,
} from "./backgrounds/forest/domain/constants/tree-silhouette-constants.js";

export { AutumnBackgroundSystem } from "./backgrounds/autumn/services/AutumnBackgroundSystem.js";

export { CelestialBackgroundSystem } from "./backgrounds/celestial/services/CelestialBackgroundSystem.js";
export type { CelestialLayers } from "./backgrounds/celestial/services/CelestialBackgroundSystem.js";

export { VoidBackgroundSystem } from "./backgrounds/void/services/VoidBackgroundSystem.js";
export type { VoidLayers, VoidConfig } from "./backgrounds/void/services/VoidBackgroundSystem.js";

export { SimpleBackgroundSystem } from "./backgrounds/simple/services/SimpleBackgroundSystem.js";
export type { SimpleBackgroundConfig } from "./backgrounds/simple/services/SimpleBackgroundSystem.js";

// ─── Blossom System Types ───────────────────────────────────────────────────

export type { BlossomLayers } from "./backgrounds/blossom/services/BlossomBackgroundSystem.js";
export type { TimeOfDay } from "./backgrounds/blossom/domain/constants/time-of-day-presets.js";
export { getTimeOfDayPreset } from "./backgrounds/blossom/domain/constants/time-of-day-presets.js";

// ─── Ember System Types ────────────────────────────────────────────────────

export type { HeatIntensity, DensityPreset } from "./backgrounds/ember/domain/constants/ember-constants.js";

// ─── Ocean System Types ─────────────────────────────────────────────────────

export type { FishMarineLife, FishSpecies, FinState, TailState, FishColorPalette } from "./backgrounds/ocean/domain/models/OceanModels.js";
export type { FishMood, FishPersonality } from "./backgrounds/ocean/domain/types/fish-personality-types.js";
export type { OceanLayers } from "./backgrounds/ocean/services/OceanBackgroundOrchestrator.js";
export { fishDebugConfig } from "./backgrounds/ocean/domain/debug-config.js";

// ─── Cosmic System Types ────────────────────────────────────────────────────

export type { UFOMood, WobbleType } from "./backgrounds/cosmic/services/UFOSystem.js";

// ─── Rainbow/Pride System Types ─────────────────────────────────────────────

export { PRIDE_PALETTES } from "./backgrounds/rainbow/domain/constants/rainbow-constants.js";
export type { PridePalette } from "./backgrounds/rainbow/domain/constants/rainbow-constants.js";

// ─── Forest Additional Types ────────────────────────────────────────────────

export type { TreeCategory } from "./backgrounds/forest/services/TreeSilhouetteImageLoader.js";
