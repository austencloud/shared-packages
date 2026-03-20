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
  SnowfallConfig,
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

export { SnowfallBackgroundSystem } from "./backgrounds/snowfall/services/SnowfallBackgroundSystem.js";

export { NightSkyBackgroundSystem } from "./backgrounds/night-sky/services/NightSkyBackgroundSystem.js";

export { DeepOceanBackgroundOrchestrator } from "./backgrounds/deep-ocean/services/DeepOceanBackgroundOrchestrator.js";

export { EmberGlowBackgroundSystem } from "./backgrounds/ember-glow/services/EmberGlowBackgroundSystem.js";

export { CherryBlossomBackgroundSystem } from "./backgrounds/cherry-blossom/services/CherryBlossomBackgroundSystem.js";

export { FireflyForestBackgroundSystem } from "./backgrounds/firefly-forest/services/FireflyForestBackgroundSystem.js";
export type { FireflyForestLayers } from "./backgrounds/firefly-forest/services/FireflyForestBackgroundSystem.js";

export type {
  TreeTypeVisibility,
  EcologicalPattern,
  RenderedTree,
} from "./backgrounds/firefly-forest/domain/models/tree-silhouette-models.js";

export {
  ECOLOGICAL_PATTERNS,
} from "./backgrounds/firefly-forest/domain/constants/tree-silhouette-constants.js";

export { AutumnDriftBackgroundSystem } from "./backgrounds/autumn-drift/services/AutumnDriftBackgroundSystem.js";

export { SimpleBackgroundSystem } from "./backgrounds/simple/services/SimpleBackgroundSystem.js";
export type { SimpleBackgroundConfig } from "./backgrounds/simple/services/SimpleBackgroundSystem.js";

// ─── Cherry Blossom System Types ────────────────────────────────────────────

export type { CherryBlossomLayers } from "./backgrounds/cherry-blossom/services/CherryBlossomBackgroundSystem.js";
export type { TimeOfDay } from "./backgrounds/cherry-blossom/domain/constants/time-of-day-presets.js";
export { getTimeOfDayPreset } from "./backgrounds/cherry-blossom/domain/constants/time-of-day-presets.js";

// ─── Ember Glow System Types ────────────────────────────────────────────────

export type { HeatIntensity, DensityPreset } from "./backgrounds/ember-glow/domain/constants/ember-constants.js";

// ─── Deep Ocean System Types ────────────────────────────────────────────────

export type { FishMarineLife, FishSpecies, FinState, TailState, FishColorPalette } from "./backgrounds/deep-ocean/domain/models/DeepOceanModels.js";
export type { FishMood, FishPersonality } from "./backgrounds/deep-ocean/domain/types/fish-personality-types.js";
export type { DeepOceanLayers } from "./backgrounds/deep-ocean/services/DeepOceanBackgroundOrchestrator.js";
export { fishDebugConfig } from "./backgrounds/deep-ocean/domain/debug-config.js";

// ─── Night Sky System Types ─────────────────────────────────────────────────

export type { UFOMood, WobbleType } from "./backgrounds/night-sky/services/UFOSystem.js";

// ─── Rainbow/Pride System Types ─────────────────────────────────────────────

export { PRIDE_PALETTES } from "./backgrounds/rainbow/domain/constants/rainbow-constants.js";
export type { PridePalette } from "./backgrounds/rainbow/domain/constants/rainbow-constants.js";

// ─── Firefly Forest Additional Types ────────────────────────────────────────

export type { TreeCategory } from "./backgrounds/firefly-forest/services/TreeSilhouetteImageLoader.js";
