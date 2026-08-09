import type { Dimensions, QualityLevel } from "../../../core/domain/types.js";
import { DepthParallaxTracker } from "../../../core/services/DepthParallaxTracker.js";
import {
  getAutumnComposition,
  type AutumnComposition,
} from "../domain/autumn-composition.js";
import {
  getAutumnFlatPath,
  getAutumnImagePlacement,
  getAutumnPlateAspect,
  getAutumnPlateSet,
  type AutumnPlateAspect,
  type AutumnPlateDefinition,
  type AutumnPlateRole,
} from "../domain/autumn-plates.js";

export interface AutumnSceneryLayers {
  sky: boolean;
  moon: boolean;
  trees: boolean;
  landscape: boolean;
  owl: boolean;
}

type AutumnArtworkKey = AutumnPlateRole | "flat";
type AutumnArtwork = Partial<Record<AutumnArtworkKey, HTMLImageElement>>;

export class AutumnSceneryRenderer {
  private dimensions: Dimensions = { width: 0, height: 0 };
  private composition: AutumnComposition = getAutumnComposition(
    this.dimensions,
  );
  private readonly parallax = new DepthParallaxTracker({
    horizontalRatio: 0.012,
    horizontalMinimum: 18,
    horizontalMaximum: 48,
    verticalRatio: 0.01,
    verticalMinimum: 10,
    verticalMaximum: 28,
  });
  private elapsedSeconds = 0;
  private reducedMotion = false;
  private quality: QualityLevel;
  private artwork: AutumnArtwork = {};
  private activeAspect: AutumnPlateAspect | null = null;
  private loadGeneration = 0;

  constructor(quality: QualityLevel = "medium") {
    this.quality = quality;
  }

  initialize(dimensions: Dimensions, quality: QualityLevel): void {
    this.dimensions = dimensions;
    this.quality = quality;
    this.composition = getAutumnComposition(dimensions);
    this.parallax.initialize();
    this.loadArtwork(true);
  }

  private loadArtwork(force: boolean = false): void {
    if (typeof window === "undefined") return;

    const aspect = getAutumnPlateAspect(this.dimensions);
    if (!force && aspect === this.activeAspect) return;

    const generation = ++this.loadGeneration;
    this.activeAspect = aspect;
    this.artwork = {};

    const sources: Array<{ key: AutumnArtworkKey; path: string }> = [
      { key: "flat", path: getAutumnFlatPath(this.dimensions) },
      ...getAutumnPlateSet(this.dimensions).map((plate) => ({
        key: plate.role,
        path: plate.path,
      })),
    ];

    for (const source of sources) {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        if (generation === this.loadGeneration) {
          this.artwork[source.key] = image;
        }
      };
      image.onerror = () => {
        if (generation === this.loadGeneration) {
          delete this.artwork[source.key];
        }
      };
      image.src = source.path;
    }
  }

  update(frameMultiplier: number): void {
    if (!this.reducedMotion) this.elapsedSeconds += frameMultiplier / 60;
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

    if (layers.sky) this.drawFarGrove(ctx);
    if (layers.moon) {
      this.drawEmberGlow(ctx);
      this.drawLightShafts(ctx);
    }
    if (layers.landscape) this.drawPlate(ctx, "middle");
    if (layers.trees) this.drawPlate(ctx, "near");
    if (layers.trees) this.drawWarmVignette(ctx);
  }

  private usesMultiplaneArtwork(): boolean {
    return (
      this.quality === "high" ||
      this.quality === "medium" ||
      this.quality === "low"
    );
  }

  private drawFarGrove(ctx: CanvasRenderingContext2D): void {
    if (this.usesMultiplaneArtwork() && this.artwork.far) {
      this.drawPlate(ctx, "far");
      return;
    }

    const flat = this.artwork.flat;
    if (flat?.naturalWidth && flat.naturalHeight) {
      const placement = getAutumnImagePlacement(
        { width: flat.naturalWidth, height: flat.naturalHeight },
        this.dimensions,
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      );
      this.drawImage(ctx, flat, placement);
      return;
    }

    const fallback = ctx.createLinearGradient(0, 0, 0, this.dimensions.height);
    fallback.addColorStop(0, "#2a1c16");
    fallback.addColorStop(0.5, "#7a4b24");
    fallback.addColorStop(1, "#17110e");
    ctx.fillStyle = fallback;
    ctx.fillRect(0, 0, this.dimensions.width, this.dimensions.height);
  }

  private drawPlate(
    ctx: CanvasRenderingContext2D,
    role: AutumnPlateRole,
  ): void {
    if (!this.usesMultiplaneArtwork()) return;

    const image = this.artwork[role];
    const definition = this.getPlateDefinition(role);
    if (!image?.naturalWidth || !image.naturalHeight || !definition) return;

    const offset = this.parallax.getOffset(definition.depth, this.dimensions);
    const offsetLimit = this.parallax.getOffsetLimit(
      definition.depth,
      this.dimensions,
    );
    const placement = getAutumnImagePlacement(
      { width: image.naturalWidth, height: image.naturalHeight },
      this.dimensions,
      offset,
      offsetLimit,
    );
    this.drawImage(ctx, image, placement);
  }

  private getPlateDefinition(
    role: AutumnPlateRole,
  ): AutumnPlateDefinition | undefined {
    return getAutumnPlateSet(this.dimensions).find(
      (plate) => plate.role === role,
    );
  }

  private drawImage(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    placement: { x: number; y: number; width: number; height: number },
    opacity: number = 1,
  ): void {
    ctx.save();
    ctx.globalAlpha = opacity;
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

  private drawEmberGlow(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this.dimensions;
    const { glow } = this.composition;
    const pulse = this.reducedMotion
      ? 1
      : 1 + Math.sin(this.elapsedSeconds * 0.19) * 0.03;
    const driftX = this.reducedMotion
      ? 0
      : Math.sin(this.elapsedSeconds * 0.055) * width * 0.006;

    const light = ctx.createRadialGradient(
      glow.x + driftX,
      glow.y,
      0,
      glow.x + driftX,
      glow.y,
      glow.radius * pulse,
    );
    light.addColorStop(0, "rgba(255, 207, 126, 0.11)");
    light.addColorStop(0.34, "rgba(232, 147, 63, 0.055)");
    light.addColorStop(1, "rgba(217, 127, 53, 0)");

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  private drawLightShafts(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this.dimensions;
    if (this.quality !== "high") return;

    const { glow } = this.composition;
    const shimmer = this.reducedMotion
      ? 1
      : 0.88 + Math.sin(this.elapsedSeconds * 0.23) * 0.12;
    const beams = [
      {
        top: { x: 0, y: glow.y - height * 0.19 },
        bottom: { x: 0, y: glow.y - height * 0.1 },
        alpha: 0.035,
      },
      {
        top: { x: width * 0.06, y: glow.y + height * 0.015 },
        bottom: { x: 0, y: glow.y + height * 0.105 },
        alpha: 0.024,
      },
    ];

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const beam of beams) {
      const beamLight = ctx.createLinearGradient(
        glow.x,
        glow.y,
        beam.top.x,
        beam.top.y,
      );
      beamLight.addColorStop(0, `rgba(245, 178, 92, ${beam.alpha * shimmer})`);
      beamLight.addColorStop(1, "rgba(217, 127, 53, 0)");
      ctx.fillStyle = beamLight;
      ctx.beginPath();
      ctx.moveTo(glow.x, glow.y);
      ctx.lineTo(beam.top.x, beam.top.y);
      ctx.lineTo(beam.bottom.x, beam.bottom.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawWarmVignette(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this.dimensions;
    const { glow } = this.composition;
    const vignette = ctx.createRadialGradient(
      glow.x,
      glow.y,
      Math.min(width, height) * 0.22,
      glow.x,
      glow.y,
      Math.max(width, height) * 0.82,
    );
    vignette.addColorStop(0, "rgba(20, 10, 5, 0)");
    vignette.addColorStop(0.62, "rgba(20, 10, 5, 0.025)");
    vignette.addColorStop(1, "rgba(12, 6, 3, 0.22)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  resize(dimensions: Dimensions): void {
    const previousAspect = getAutumnPlateAspect(this.dimensions);
    this.dimensions = dimensions;
    this.composition = getAutumnComposition(dimensions);
    if (getAutumnPlateAspect(dimensions) !== previousAspect) {
      this.loadArtwork();
    }
  }

  setQuality(quality: QualityLevel): void {
    this.quality = quality;
  }

  setPointer(
    x: number,
    y: number,
    active: boolean,
    pointerType?: string,
  ): void {
    this.parallax.setPointer(x, y, active, pointerType, this.dimensions);
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
    this.parallax.setReducedMotion(reducedMotion);
  }

  getLoadedArtCount(): number {
    if (!this.usesMultiplaneArtwork()) return this.artwork.flat ? 1 : 0;

    return getAutumnPlateSet(this.dimensions).filter(
      (plate) => this.artwork[plate.role],
    ).length;
  }

  getExpectedArtCount(): number {
    return this.usesMultiplaneArtwork() ? 3 : 1;
  }

  getLoadedMatteCount(): number {
    return this.getLoadedArtCount() >= this.getExpectedArtCount() ? 1 : 0;
  }

  cleanup(): void {
    this.loadGeneration += 1;
    this.artwork = {};
    this.activeAspect = null;
    this.parallax.initialize();
  }
}
