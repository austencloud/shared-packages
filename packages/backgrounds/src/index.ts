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

export { AutumnDriftBackgroundSystem } from "./backgrounds/autumn-drift/services/AutumnDriftBackgroundSystem.js";

export { SimpleBackgroundSystem } from "./backgrounds/simple/services/SimpleBackgroundSystem.js";
export type { SimpleBackgroundConfig } from "./backgrounds/simple/services/SimpleBackgroundSystem.js";
