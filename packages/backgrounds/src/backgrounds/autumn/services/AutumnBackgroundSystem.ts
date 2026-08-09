import type { IBackgroundSystem } from "../../../core/contracts/IBackgroundSystem.js";
import type {
  AccessibilitySettings,
  Dimensions,
  PerformanceMetrics,
  QualityLevel,
} from "../../../core/domain/types.js";
import type {
  AutumnDensityPreset,
  AutumnWindPreset,
} from "../domain/models/autumn-models.js";
import {
  AUTUMN_DENSITY_MULTIPLIERS,
  AUTUMN_PARTICLE_COUNTS,
} from "../domain/constants/autumn-constants.js";
import { createLeafSystem, type LeafSystem } from "./LeafSystem.js";
import { createWindSystem, type WindSystem } from "./WindSystem.js";
import {
  AutumnSceneryRenderer,
  type AutumnSceneryLayers,
} from "./AutumnSceneryRenderer.js";

export interface AutumnLayers extends AutumnSceneryLayers {
  leaves: boolean;
}

export class AutumnBackgroundSystem implements IBackgroundSystem {
  private readonly leafSystem: LeafSystem;
  private readonly windSystem: WindSystem;
  private readonly scenery: AutumnSceneryRenderer;
  private quality: QualityLevel = "medium";
  private densityPreset: AutumnDensityPreset = "normal";
  private windPreset: AutumnWindPreset = "breezy";
  private isInitialized = false;
  private reducedMotion = false;
  private thumbnailMode = false;
  private dimensions: Dimensions = { width: 0, height: 0 };
  private layers: AutumnLayers = {
    sky: true,
    moon: true,
    trees: true,
    landscape: true,
    leaves: true,
    owl: true,
  };

  constructor() {
    this.leafSystem = createLeafSystem();
    this.windSystem = createWindSystem();
    this.scenery = new AutumnSceneryRenderer(this.quality);
  }

  initialize(dimensions: Dimensions, quality: QualityLevel): void {
    this.dimensions = dimensions;
    this.quality = quality;
    this.leafSystem.initialize({
      particleCount: this.getParticleCount(),
      canvasWidth: dimensions.width,
      canvasHeight: dimensions.height,
    });
    this.windSystem.initialize();
    this.windSystem.setPreset(this.windPreset);
    this.scenery.initialize(dimensions, quality);
    this.scenery.setReducedMotion(this.reducedMotion);
    this.isInitialized = true;
  }

  update(dimensions: Dimensions, frameMultiplier: number = 1): void {
    if (!this.isInitialized) return;

    if (
      dimensions.width !== this.dimensions.width ||
      dimensions.height !== this.dimensions.height
    ) {
      this.handleResize(this.dimensions, dimensions);
    }

    this.scenery.update(frameMultiplier);
    if (!this.reducedMotion) {
      this.windSystem.update(frameMultiplier);
      this.leafSystem.update(this.windSystem.getWindForce(), frameMultiplier);
    }
  }

  draw(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    if (!this.isInitialized) return;

    this.scenery.draw(ctx, dimensions, this.layers);
    if (this.layers.leaves) this.leafSystem.draw(ctx);
  }

  setQuality(quality: QualityLevel): void {
    if (this.quality === quality) return;
    this.quality = quality;

    if (this.isInitialized) {
      this.leafSystem.setParticleCount(this.getParticleCount());
      this.scenery.setQuality(quality);
    }
  }

  private getParticleCount(): number {
    const baseCount = AUTUMN_PARTICLE_COUNTS[this.quality] ?? AUTUMN_PARTICLE_COUNTS.medium;
    const aspect = this.dimensions.width / Math.max(this.dimensions.height, 1);
    const portraitScale = aspect < 0.9 ? Math.max(0.58, aspect / 0.9) : 1;
    const densityCount = Math.round(
      baseCount * AUTUMN_DENSITY_MULTIPLIERS[this.densityPreset] * portraitScale
    );
    return this.thumbnailMode ? Math.max(4, Math.floor(densityCount * 0.3)) : densityCount;
  }

  setDensityPreset(preset: AutumnDensityPreset): void {
    this.densityPreset = preset;
    if (this.isInitialized) this.leafSystem.setParticleCount(this.getParticleCount());
  }

  setWindPreset(preset: AutumnWindPreset): void {
    this.windPreset = preset;
    this.windSystem.setPreset(preset);
  }

  triggerGust(): void {
    if (!this.reducedMotion) this.windSystem.triggerGust();
  }

  setPointer(x: number, y: number, active: boolean, pointerType?: string): void {
    this.scenery.setPointer(x, y, active, pointerType);
  }

  handleResize(_oldDimensions: Dimensions, newDimensions: Dimensions): void {
    this.dimensions = newDimensions;
    this.leafSystem.resize(newDimensions.width, newDimensions.height);
    this.leafSystem.setParticleCount(this.getParticleCount());
    this.scenery.resize(newDimensions);
  }

  setAccessibility(settings: AccessibilitySettings): void {
    this.reducedMotion = settings.reducedMotion ?? false;
    this.scenery.setReducedMotion(this.reducedMotion);
  }

  setThumbnailMode(enabled: boolean): void {
    this.thumbnailMode = enabled;
    if (this.isInitialized) this.leafSystem.setParticleCount(this.getParticleCount());
  }

  setLayerVisibility(
    layers: Partial<AutumnLayers> & { gradient?: boolean }
  ): void {
    const { gradient, ...nextLayers } = layers;
    this.layers = {
      ...this.layers,
      ...nextLayers,
      ...(gradient === undefined ? {} : { sky: gradient }),
    };
  }

  getStats(): {
    leaves: number;
    matteLoaded: number;
    treesLoaded: number;
    platesLoaded: number;
    plateTarget: number;
  } {
    const matteLoaded = this.scenery.getLoadedMatteCount();
    const platesLoaded = this.scenery.getLoadedArtCount();
    return {
      leaves: this.leafSystem.leaves.length,
      matteLoaded,
      treesLoaded: platesLoaded,
      platesLoaded,
      plateTarget: this.scenery.getExpectedArtCount(),
    };
  }

  getMetrics(): PerformanceMetrics {
    return {
      fps: 0,
      particleCount: this.leafSystem.leaves.length,
      warnings:
        this.scenery.getLoadedArtCount() < this.scenery.getExpectedArtCount()
          ? ["Autumn art planes are loading"]
          : [],
    };
  }

  cleanup(): void {
    this.isInitialized = false;
    this.scenery.cleanup();
  }
}
