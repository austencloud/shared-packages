import type {
  Dimensions,
  QualityLevel,
  AccessibilitySettings,
} from "../../../core/domain/types.js";
import type { IBackgroundSystem } from "../../../core/contracts/IBackgroundSystem.js";

export interface CelestialLayers {
  gradient: boolean;
  clouds: boolean;
  godRays: boolean;
  islands: boolean;
  pillars: boolean;
  vignette: boolean;
}

interface CloudLayer {
  y: number;
  speed: number;
  opacity: number;
  scale: number;
  offset: number;
}

interface GodRay {
  x: number;
  width: number;
  opacity: number;
  speed: number;
  phase: number;
}

interface FloatingIsland {
  x: number;
  y: number;
  width: number;
  height: number;
  drift: number;
  phase: number;
}

interface Pillar {
  x: number;
  width: number;
  height: number;
  opacity: number;
}

export class CelestialBackgroundSystem implements IBackgroundSystem {
  private quality: QualityLevel = "medium";
  private isInitialized = false;
  private dimensions: Dimensions = { width: 0, height: 0 };
  private motionMultiplier = 1.0;
  private time = 0;

  private layers: CelestialLayers = {
    gradient: true,
    clouds: true,
    godRays: true,
    islands: true,
    pillars: true,
    vignette: true,
  };

  private cloudLayers: CloudLayer[] = [];
  private godRays: GodRay[] = [];
  private islands: FloatingIsland[] = [];
  private pillars: Pillar[] = [];

  private readonly GRADIENT_TOP = "#0a1a4a";
  private readonly GRADIENT_MID = "#1a2a5a";
  private readonly GRADIENT_WARM = "#3d2a1a";
  private readonly GRADIENT_BOTTOM = "#5a3a1a";

  public initialize(dimensions: Dimensions, quality: QualityLevel): void {
    this.quality = quality;
    this.dimensions = dimensions;
    this.time = 0;

    const cloudCount = quality === "low" ? 3 : quality === "medium" ? 5 : 7;
    const rayCount = quality === "low" ? 3 : quality === "medium" ? 5 : 8;
    const islandCount = quality === "low" ? 2 : quality === "medium" ? 3 : 5;

    this.cloudLayers = [];
    for (let i = 0; i < cloudCount; i++) {
      const t = i / cloudCount;
      this.cloudLayers.push({
        y: 0.15 + t * 0.45,
        speed: 0.002 + Math.random() * 0.003,
        opacity: 0.08 + (1 - t) * 0.12,
        scale: 0.6 + t * 0.8,
        offset: Math.random() * Math.PI * 2,
      });
    }

    this.godRays = [];
    for (let i = 0; i < rayCount; i++) {
      this.godRays.push({
        x: 0.1 + (i / rayCount) * 0.8,
        width: 0.03 + Math.random() * 0.06,
        opacity: 0.04 + Math.random() * 0.06,
        speed: 0.3 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
      });
    }

    this.islands = [];
    for (let i = 0; i < islandCount; i++) {
      this.islands.push({
        x: 0.1 + (i / islandCount) * 0.7 + Math.random() * 0.1,
        y: 0.3 + Math.random() * 0.25,
        width: 0.08 + Math.random() * 0.1,
        height: 0.02 + Math.random() * 0.03,
        drift: 0.0005 + Math.random() * 0.001,
        phase: Math.random() * Math.PI * 2,
      });
    }

    this.pillars = [
      { x: 0.05, width: 0.03, height: 0.5, opacity: 0.15 },
      { x: 0.2, width: 0.02, height: 0.35, opacity: 0.1 },
      { x: 0.75, width: 0.025, height: 0.45, opacity: 0.12 },
      { x: 0.92, width: 0.03, height: 0.55, opacity: 0.15 },
    ];

    this.isInitialized = true;
  }

  public update(dimensions: Dimensions, frameMultiplier: number = 1.0): void {
    if (dimensions.width > 0 && dimensions.height > 0 && !this.isInitialized) {
      this.initialize(dimensions, this.quality);
    }
    if (!this.isInitialized) return;

    this.dimensions = dimensions;
    this.time += (frameMultiplier * this.motionMultiplier) / 60;
  }

  public draw(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    if (this.layers.gradient) {
      this.drawGradient(ctx, dimensions);
    }

    if (this.layers.pillars && this.isInitialized) {
      this.drawPillars(ctx, dimensions);
    }

    if (this.layers.clouds && this.isInitialized) {
      this.drawClouds(ctx, dimensions);
    }

    if (this.layers.godRays && this.isInitialized) {
      this.drawGodRays(ctx, dimensions);
    }

    if (this.layers.islands && this.isInitialized) {
      this.drawIslands(ctx, dimensions);
    }

    if (this.layers.vignette) {
      this.drawVignette(ctx, dimensions);
    }
  }

  private drawGradient(ctx: CanvasRenderingContext2D, dim: Dimensions): void {
    const g = ctx.createLinearGradient(0, 0, 0, dim.height);
    g.addColorStop(0, this.GRADIENT_TOP);
    g.addColorStop(0.35, this.GRADIENT_MID);
    g.addColorStop(0.7, this.GRADIENT_WARM);
    g.addColorStop(1, this.GRADIENT_BOTTOM);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, dim.width, dim.height);
  }

  private drawClouds(ctx: CanvasRenderingContext2D, dim: Dimensions): void {
    for (const cloud of this.cloudLayers) {
      const y = cloud.y * dim.height;
      const xOffset = Math.sin(this.time * cloud.speed + cloud.offset) * dim.width * 0.05;
      const w = dim.width * cloud.scale;
      const h = dim.height * 0.08 * cloud.scale;

      const g = ctx.createRadialGradient(
        dim.width * 0.5 + xOffset, y,
        0,
        dim.width * 0.5 + xOffset, y,
        w * 0.5
      );
      g.addColorStop(0, `rgba(200, 180, 150, ${cloud.opacity})`);
      g.addColorStop(0.4, `rgba(180, 160, 130, ${cloud.opacity * 0.6})`);
      g.addColorStop(1, "rgba(180, 160, 130, 0)");

      ctx.fillStyle = g;
      ctx.fillRect(0, y - h, dim.width, h * 2);
    }
  }

  private drawGodRays(ctx: CanvasRenderingContext2D, dim: Dimensions): void {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (const ray of this.godRays) {
      const pulse = Math.sin(this.time * ray.speed + ray.phase) * 0.5 + 0.5;
      const alpha = ray.opacity * (0.5 + pulse * 0.5);

      const x = ray.x * dim.width;
      const halfW = ray.width * dim.width * 0.5;
      const topSpread = halfW * 0.3;

      const g = ctx.createLinearGradient(x, 0, x, dim.height);
      g.addColorStop(0, `rgba(255, 220, 150, ${alpha * 0.3})`);
      g.addColorStop(0.3, `rgba(255, 200, 120, ${alpha})`);
      g.addColorStop(0.7, `rgba(255, 180, 100, ${alpha * 0.6})`);
      g.addColorStop(1, `rgba(255, 160, 80, 0)`);

      ctx.beginPath();
      ctx.moveTo(x - topSpread, 0);
      ctx.lineTo(x + topSpread, 0);
      ctx.lineTo(x + halfW, dim.height);
      ctx.lineTo(x - halfW, dim.height);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
    }

    ctx.restore();
  }

  private drawIslands(ctx: CanvasRenderingContext2D, dim: Dimensions): void {
    for (const island of this.islands) {
      const bobY = Math.sin(this.time * 0.3 + island.phase) * dim.height * 0.005;
      const driftX = Math.sin(this.time * island.drift + island.phase) * dim.width * 0.01;
      const cx = island.x * dim.width + driftX;
      const cy = island.y * dim.height + bobY;
      const w = island.width * dim.width;
      const h = island.height * dim.height;

      ctx.fillStyle = "rgba(20, 15, 10, 0.7)";
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * 0.5, h * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(30, 25, 15, 0.8)";
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.3, cy);
      ctx.quadraticCurveTo(cx - w * 0.15, cy - h * 2, cx, cy - h * 1.5);
      ctx.quadraticCurveTo(cx + w * 0.2, cy - h * 2.5, cx + w * 0.1, cy);
      ctx.closePath();
      ctx.fill();

      const glowG = ctx.createRadialGradient(cx, cy + h * 0.2, 0, cx, cy + h * 0.2, w * 0.6);
      glowG.addColorStop(0, "rgba(255, 200, 120, 0.08)");
      glowG.addColorStop(1, "rgba(255, 200, 120, 0)");
      ctx.fillStyle = glowG;
      ctx.fillRect(cx - w, cy - h, w * 2, h * 2);
    }
  }

  private drawPillars(ctx: CanvasRenderingContext2D, dim: Dimensions): void {
    for (const pillar of this.pillars) {
      const x = pillar.x * dim.width;
      const w = pillar.width * dim.width;
      const h = pillar.height * dim.height;
      const y = dim.height - h;

      const g = ctx.createLinearGradient(x, y, x, dim.height);
      g.addColorStop(0, `rgba(40, 30, 20, 0)`);
      g.addColorStop(0.2, `rgba(40, 30, 20, ${pillar.opacity * 0.5})`);
      g.addColorStop(1, `rgba(40, 30, 20, ${pillar.opacity})`);

      ctx.fillStyle = g;
      ctx.fillRect(x - w * 0.5, y, w, h);
    }
  }

  private drawVignette(ctx: CanvasRenderingContext2D, dim: Dimensions): void {
    const cx = dim.width * 0.5;
    const cy = dim.height * 0.4;
    const r = Math.max(dim.width, dim.height) * 0.75;

    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, "rgba(0, 0, 0, 0)");
    g.addColorStop(0.6, "rgba(0, 0, 0, 0)");
    g.addColorStop(0.85, "rgba(0, 0, 0, 0.25)");
    g.addColorStop(1, "rgba(0, 0, 0, 0.5)");

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, dim.width, dim.height);
  }

  public setQuality(quality: QualityLevel): void {
    if (this.quality !== quality) {
      this.quality = quality;
      if (this.isInitialized) {
        this.initialize(this.dimensions, quality);
      }
    }
  }

  public setAccessibility(settings: AccessibilitySettings): void {
    this.motionMultiplier = settings.reducedMotion ? 0.2 : 1.0;
  }

  public handleResize(_old: Dimensions, next: Dimensions): void {
    this.dimensions = next;
  }

  public cleanup(): void {
    this.cloudLayers = [];
    this.godRays = [];
    this.islands = [];
    this.pillars = [];
    this.isInitialized = false;
  }

  public setLayerVisibility(layers: Partial<CelestialLayers>): void {
    this.layers = { ...this.layers, ...layers };
  }
}
