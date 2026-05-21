import type {
  Dimensions,
  QualityLevel,
  AccessibilitySettings,
} from "../../../core/domain/types.js";
import type { IBackgroundSystem } from "../../../core/contracts/IBackgroundSystem.js";

export interface VoidLayers {
  grid: boolean;
  vignette: boolean;
}

export interface VoidConfig {
  gridOpacity: number;
  gridSpacing: number;
}

export class VoidBackgroundSystem implements IBackgroundSystem {
  private isInitialized = false;
  private dimensions: Dimensions = { width: 0, height: 0 };

  private layers: VoidLayers = {
    grid: false,
    vignette: false,
  };

  private config: VoidConfig = {
    gridOpacity: 0.08,
    gridSpacing: 40,
  };

  public initialize(dimensions: Dimensions, _quality: QualityLevel): void {
    this.dimensions = dimensions;
    this.isInitialized = true;
  }

  public update(dimensions: Dimensions, _frameMultiplier?: number): void {
    if (dimensions.width > 0 && dimensions.height > 0 && !this.isInitialized) {
      this.initialize(dimensions, "medium");
    }
    this.dimensions = dimensions;
  }

  public draw(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    if (this.layers.grid) {
      this.drawGrid(ctx, dimensions);
    }

    if (this.layers.vignette) {
      this.drawVignette(ctx, dimensions);
    }
  }

  private drawGrid(ctx: CanvasRenderingContext2D, dim: Dimensions): void {
    const spacing = this.config.gridSpacing;
    const alpha = this.config.gridOpacity;

    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();

    for (let x = spacing; x < dim.width; x += spacing) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, dim.height);
    }
    for (let y = spacing; y < dim.height; y += spacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(dim.width, y);
    }

    ctx.stroke();
  }

  private drawVignette(ctx: CanvasRenderingContext2D, dim: Dimensions): void {
    const cx = dim.width * 0.5;
    const cy = dim.height * 0.5;
    const r = Math.max(dim.width, dim.height) * 0.6;

    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, "rgba(0, 0, 0, 0)");
    g.addColorStop(0.5, "rgba(0, 0, 0, 0)");
    g.addColorStop(0.8, "rgba(0, 0, 0, 0.3)");
    g.addColorStop(1, "rgba(0, 0, 0, 0.6)");

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, dim.width, dim.height);
  }

  public setQuality(_quality: QualityLevel): void {
    // No quality scaling needed
  }

  public setAccessibility?(_settings: AccessibilitySettings): void {
    // No motion to reduce
  }

  public handleResize?(_old: Dimensions, next: Dimensions): void {
    this.dimensions = next;
  }

  public cleanup(): void {
    this.isInitialized = false;
  }

  public setLayerVisibility(layers: Partial<VoidLayers>): void {
    this.layers = { ...this.layers, ...layers };
  }

  public setConfig(config: Partial<VoidConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
