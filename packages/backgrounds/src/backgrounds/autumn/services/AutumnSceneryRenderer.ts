import type { Dimensions, QualityLevel } from "../../../core/domain/types.js";
import { DepthParallaxTracker } from "../../../core/services/DepthParallaxTracker.js";
import {
  getAutumnFlatPath,
  getAutumnImagePlacement,
  getAutumnPlateAspect,
  type AutumnPlateAspect,
} from "../domain/autumn-plates.js";

export interface AutumnSceneryLayers {
  sky: boolean;
  moon: boolean;
  trees: boolean;
  landscape: boolean;
  owl: boolean;
}

const MATTE_DEPTH = 0.16;

export class AutumnSceneryRenderer {
  private dimensions: Dimensions = { width: 0, height: 0 };
  private readonly parallax = new DepthParallaxTracker({
    horizontalRatio: 0.012,
    horizontalMinimum: 18,
    horizontalMaximum: 48,
    verticalRatio: 0.01,
    verticalMinimum: 10,
    verticalMaximum: 28,
  });
  private artwork?: HTMLImageElement;
  private activeAspect: AutumnPlateAspect | null = null;
  private loadGeneration = 0;

  constructor(_quality: QualityLevel = "medium") {}

  initialize(dimensions: Dimensions, quality: QualityLevel): void {
    this.dimensions = dimensions;
    void quality;
    this.parallax.initialize();
    this.loadArtwork(true);
  }

  private loadArtwork(force: boolean = false): void {
    if (typeof window === "undefined") return;

    const aspect = getAutumnPlateAspect(this.dimensions);
    if (!force && aspect === this.activeAspect) return;

    const generation = ++this.loadGeneration;
    this.activeAspect = aspect;
    this.artwork = undefined;

    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (generation === this.loadGeneration) this.artwork = image;
    };
    image.onerror = () => {
      if (generation === this.loadGeneration) this.artwork = undefined;
    };
    image.src = getAutumnFlatPath(this.dimensions);
  }

  update(frameMultiplier: number): void {
    this.parallax.update(frameMultiplier);
  }

  draw(
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions,
    layers: AutumnSceneryLayers,
  ): void {
    if (
      dimensions.width !== this.dimensions.width ||
      dimensions.height !== this.dimensions.height
    ) {
      this.resize(dimensions);
    }

    if (layers.sky) this.drawMatte(ctx);
  }

  private drawMatte(ctx: CanvasRenderingContext2D): void {
    const image = this.artwork;
    if (image?.naturalWidth && image.naturalHeight) {
      const offset = this.parallax.getOffset(MATTE_DEPTH, this.dimensions);
      const offsetLimit = this.parallax.getOffsetLimit(
        MATTE_DEPTH,
        this.dimensions,
      );
      const placement = getAutumnImagePlacement(
        { width: image.naturalWidth, height: image.naturalHeight },
        this.dimensions,
        offset,
        offsetLimit,
      );
      this.drawImage(ctx, image, placement);
      return;
    }

    const fallback = ctx.createLinearGradient(0, 0, 0, this.dimensions.height);
    fallback.addColorStop(0, "#2a1c16");
    fallback.addColorStop(0.5, "#7a4b24");
    fallback.addColorStop(1, "#17110e");
    ctx.fillStyle = fallback;
    ctx.fillRect(0, 0, this.dimensions.width, this.dimensions.height);
  }

  private drawImage(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    placement: { x: number; y: number; width: number; height: number },
  ): void {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      image,
      placement.x,
      placement.y,
      placement.width,
      placement.height,
    );
    ctx.restore();
  }

  resize(dimensions: Dimensions): void {
    const previousAspect = getAutumnPlateAspect(this.dimensions);
    this.dimensions = dimensions;
    if (getAutumnPlateAspect(dimensions) !== previousAspect) {
      this.loadArtwork();
    }
  }

  setQuality(_quality: QualityLevel): void {}

  setPointer(
    x: number,
    y: number,
    active: boolean,
    pointerType?: string,
  ): void {
    this.parallax.setPointer(x, y, active, pointerType, this.dimensions);
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.parallax.setReducedMotion(reducedMotion);
  }

  getLoadedArtCount(): number {
    return this.artwork ? 1 : 0;
  }

  getExpectedArtCount(): number {
    return 1;
  }

  getLoadedMatteCount(): number {
    return this.getLoadedArtCount() >= this.getExpectedArtCount() ? 1 : 0;
  }

  cleanup(): void {
    this.loadGeneration += 1;
    this.artwork = undefined;
    this.activeAspect = null;
    this.parallax.initialize();
  }
}
