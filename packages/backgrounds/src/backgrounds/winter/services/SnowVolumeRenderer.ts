import type { Dimensions, QualityLevel } from "../../../core/domain/types.js";
import type { DepthParallaxTracker } from "../../../core/services/DepthParallaxTracker.js";
import {
  SNOW_ATLAS_CELLS,
  SNOW_LIGHT_RESPONSES,
  SNOW_OPTICS_URL,
  getSnowGustStretch,
} from "../domain/snow-optics.js";
import type { Snowflake } from "../domain/models/winter-models.js";
import type { WinterCursorLightTracker } from "./WinterCursorLightTracker.js";

export interface SnowBandIndices {
  readonly powder: readonly number[];
  readonly crystal: readonly number[];
  readonly foreground: readonly number[];
}

export type SnowOpticsStatus = "idle" | "loading" | "loaded" | "failed";

export interface SnowVolumeStats {
  atlasStatus: SnowOpticsStatus;
  atlasRequests: number;
  powder: number;
  crystal: number;
  foreground: number;
}

interface SnowVolumeRendererOptions {
  createImage?: () => HTMLImageElement;
}

const POWDER_ALPHA = [0.12, 0.18, 0.25] as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export class SnowVolumeRenderer {
  private atlas: HTMLImageElement | null = null;
  private atlasStatus: SnowOpticsStatus = "idle";
  private atlasRequests = 0;
  private loadGeneration = 0;
  private quality: QualityLevel = "medium";
  private readonly createImage?: () => HTMLImageElement;
  private readonly parallax: DepthParallaxTracker;
  private readonly cursorLight: WinterCursorLightTracker;
  private lastCounts = { powder: 0, crystal: 0, foreground: 0 };

  constructor(
    parallax: DepthParallaxTracker,
    cursorLight: WinterCursorLightTracker,
    options: SnowVolumeRendererOptions = {},
  ) {
    this.parallax = parallax;
    this.cursorLight = cursorLight;
    this.createImage = options.createImage;
  }

  initialize(quality: QualityLevel): void {
    this.quality = quality;
    this.requestAtlasWhenNeeded();
  }

  setQuality(quality: QualityLevel): void {
    this.quality = quality;
    this.requestAtlasWhenNeeded();
  }

  draw(
    flakes: readonly Snowflake[],
    bands: SnowBandIndices,
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions,
  ): void {
    this.lastCounts.powder = bands.powder.length;
    this.lastCounts.crystal = bands.crystal.length;
    this.lastCounts.foreground = 0;
    for (const index of bands.foreground) {
      if ((flakes[index]?.opticalAlpha ?? 0) > 0.01) {
        this.lastCounts.foreground += 1;
      }
    }

    const parallaxEnabled = this.parallax.getStats().enabled;

    this.drawPowder(
      flakes,
      bands.powder,
      ctx,
      dimensions,
      parallaxEnabled,
    );
    this.drawCrystals(
      flakes,
      bands.crystal,
      ctx,
      dimensions,
      parallaxEnabled,
    );
    this.drawForeground(
      flakes,
      bands.foreground,
      ctx,
      dimensions,
      parallaxEnabled,
    );
  }

  getStats(): SnowVolumeStats {
    return {
      atlasStatus: this.atlasStatus,
      atlasRequests: this.atlasRequests,
      ...this.lastCounts,
    };
  }

  cleanup(): void {
    this.loadGeneration += 1;
    this.atlas = null;
    this.atlasStatus = "idle";
    this.lastCounts = { powder: 0, crystal: 0, foreground: 0 };
  }

  private requestAtlasWhenNeeded(): void {
    if (
      (this.quality !== "high" && this.quality !== "medium") ||
      this.atlasStatus !== "idle"
    ) {
      return;
    }

    const imageFactory =
      this.createImage ??
      (typeof Image === "undefined" ? undefined : () => new Image());
    if (!imageFactory) {
      this.atlasStatus = "failed";
      return;
    }

    const generation = ++this.loadGeneration;
    const image = imageFactory();
    this.atlasRequests += 1;
    this.atlasStatus = "loading";
    image.decoding = "async";
    image.onload = () => {
      if (generation !== this.loadGeneration) return;
      this.atlas = image;
      this.atlasStatus = "loaded";
    };
    image.onerror = () => {
      if (generation !== this.loadGeneration) return;
      this.atlas = null;
      this.atlasStatus = "failed";
    };
    image.src = SNOW_OPTICS_URL;
  }

  private drawPowder(
    flakes: readonly Snowflake[],
    indices: readonly number[],
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions,
    parallaxEnabled: boolean,
  ): void {
    const deviceScale =
      typeof devicePixelRatio === "number" ? Math.max(1, devicePixelRatio) : 1;
    const minimumRadius = 0.8 / deviceScale;

    ctx.save();
    ctx.fillStyle = "#d9e8f4";
    for (let bucket = 0; bucket < POWDER_ALPHA.length; bucket += 1) {
      ctx.beginPath();
      for (const index of indices) {
        const flake = flakes[index];
        if (!flake || flake.opticalVariant % 3 !== bucket) continue;

        const offset = parallaxEnabled
          ? this.parallax.getOffset(flake.depth, dimensions)
          : null;
        const x = flake.x + (offset?.x ?? 0);
        const y = flake.y + (offset?.y ?? 0);
        const radius = Math.max(minimumRadius, flake.opticalScale * 0.5);
        ctx.moveTo(x + radius, y);
        ctx.arc(x, y, radius, 0, Math.PI * 2);
      }
      ctx.globalAlpha = POWDER_ALPHA[bucket] ?? 0.18;
      ctx.fill();
    }

    ctx.beginPath();
    let litPowder = false;
    for (const index of indices) {
      const flake = flakes[index];
      if (!flake) continue;
      const offset = parallaxEnabled
        ? this.parallax.getOffset(flake.depth, dimensions)
        : null;
      const x = flake.x + (offset?.x ?? 0);
      const y = flake.y + (offset?.y ?? 0);
      const light =
        this.cursorLight.getIntensityAt(x, y, flake.depth, dimensions) *
        SNOW_LIGHT_RESPONSES.powder;
      if (light <= 0.06) continue;
      const radius = Math.max(minimumRadius, flake.opticalScale * 0.62);
      ctx.moveTo(x + radius, y);
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      litPowder = true;
    }
    if (litPowder) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = "#eaf8ff";
      ctx.fill();
    }
    ctx.restore();
  }

  private drawCrystals(
    flakes: readonly Snowflake[],
    indices: readonly number[],
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions,
    parallaxEnabled: boolean,
  ): void {
    for (const index of indices) {
      const flake = flakes[index];
      if (!flake) continue;
      const offset = parallaxEnabled
        ? this.parallax.getOffset(flake.depth, dimensions)
        : null;
      const x = flake.x + (offset?.x ?? 0);
      const y = flake.y + (offset?.y ?? 0);
      const light = this.cursorLight.getIntensityAt(
        x,
        y,
        flake.depth,
        dimensions,
      );
      const facetResponse =
        0.82 + Math.abs(Math.cos(flake.rotation * 3)) * 0.18;
      const reflectedLight = light * facetResponse;
      const depthFactor = 0.3 + flake.depth * 0.7;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(flake.rotation);
      ctx.globalAlpha = Math.min(
        1,
        flake.opacity * depthFactor +
          reflectedLight * (0.06 + flake.depth * 0.12),
      );
      ctx.strokeStyle = flake.color;
      ctx.lineWidth = 0.4 + depthFactor * 0.5;
      ctx.stroke(flake.shape);

      if (reflectedLight > 0.01) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = reflectedLight * (0.028 + flake.depth * 0.07);
        ctx.strokeStyle = "#dff5ff";
        ctx.lineWidth = 0.9 + flake.depth * 0.8;
        ctx.stroke(flake.shape);

        const glintPulse = Math.max(0, Math.sin(flake.sparklePhase)) ** 14;
        const qualityFactor =
          this.quality === "high" ? 1 : this.quality === "medium" ? 0.45 : 0;
        const glintStrength =
          reflectedLight *
          flake.sparkle *
          Math.pow(flake.depth, 1.6) *
          glintPulse *
          qualityFactor;

        if (glintStrength > 0.08) {
          const rayLength = 1.4 + glintStrength * 4.6;
          const diagonalLength = rayLength * 0.42;
          ctx.globalAlpha = Math.min(0.42, glintStrength * 0.55);
          ctx.strokeStyle = "#f7fdff";
          ctx.lineWidth = 0.45 + flake.depth * 0.4;
          ctx.beginPath();
          ctx.moveTo(-rayLength, 0);
          ctx.lineTo(rayLength, 0);
          ctx.moveTo(0, -rayLength);
          ctx.lineTo(0, rayLength);
          ctx.moveTo(-diagonalLength, -diagonalLength);
          ctx.lineTo(diagonalLength, diagonalLength);
          ctx.moveTo(-diagonalLength, diagonalLength);
          ctx.lineTo(diagonalLength, -diagonalLength);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  private drawForeground(
    flakes: readonly Snowflake[],
    indices: readonly number[],
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions,
    parallaxEnabled: boolean,
  ): void {
    if (this.quality !== "high" && this.quality !== "medium") return;

    for (const index of indices) {
      const flake = flakes[index];
      if (!flake || flake.opticalAlpha <= 0.001) continue;
      const offset = parallaxEnabled
        ? this.parallax.getOffset(flake.depth, dimensions)
        : null;
      const x = flake.x + (offset?.x ?? 0);
      const y = flake.y + (offset?.y ?? 0);
      const sampleOffset = flake.opticalScale * 0.4;
      const sampleX = Math.cos(flake.rotation) * sampleOffset;
      const sampleY = Math.sin(flake.rotation) * sampleOffset;
      const light =
        ((this.cursorLight.getIntensityAt(x, y, flake.depth, dimensions) +
          this.cursorLight.getIntensityAt(
            x + sampleX,
            y + sampleY,
            flake.depth,
            dimensions,
          ) +
          this.cursorLight.getIntensityAt(
            x - sampleX,
            y - sampleY,
            flake.depth,
            dimensions,
          )) /
          3) *
        SNOW_LIGHT_RESPONSES.foreground;
      const stretch = getSnowGustStretch(
        flake.windVelocityX,
        flake.windVelocityY,
      );
      const rotation =
        flake.rotation +
        Math.atan2(flake.windVelocityY, flake.windVelocityX || 0.0001) * 0.08;
      const alpha =
        clamp(0.12 + flake.opacity * 0.16 + light * 0.1, 0.1, 0.3) *
        flake.opticalAlpha;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(stretch, 1);
      ctx.globalAlpha = alpha;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      const cell = SNOW_ATLAS_CELLS[flake.opticalVariant];
      if (this.atlasStatus === "loaded" && this.atlas && cell) {
        const size = flake.opticalScale * 1.18;
        ctx.drawImage(
          this.atlas,
          cell.x,
          cell.y,
          cell.width,
          cell.height,
          -size * 0.5,
          -size * 0.5,
          size,
          size,
        );
      } else {
        const sourceDiameter = Math.max(1, flake.size * 2.2);
        const scale = (flake.opticalScale * 1.18) / sourceDiameter;
        ctx.scale(scale, scale);
        ctx.strokeStyle = flake.color;
        ctx.lineWidth = 1.4;
        ctx.stroke(flake.shape);
      }
      ctx.restore();
    }
  }
}
