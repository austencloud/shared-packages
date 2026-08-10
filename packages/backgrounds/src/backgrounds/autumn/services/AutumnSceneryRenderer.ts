import type { Dimensions, QualityLevel } from "../../../core/domain/types.js";
import { DepthParallaxTracker } from "../../../core/services/DepthParallaxTracker.js";
import {
  AUTUMN_GROUND_STOPS,
  AUTUMN_SKY_STOPS,
  AUTUMN_TREE_LAYER_CONFIGS,
  AUTUMN_TREE_PLACEMENT,
  AUTUMN_TREE_STYLE,
  AUTUMN_TREE_VISIBILITY,
} from "../domain/autumn-silhouette-profile.js";
import { createTreeSilhouetteSystem } from "../../forest/services/TreeSilhouetteSystem.js";

export interface AutumnSceneryLayers {
  sky: boolean;
  moon: boolean;
  trees: boolean;
  landscape: boolean;
  owl: boolean;
}

const TREE_PARALLAX_DEPTHS = [0.04, 0.1, 0.18, 0.3, 0.46] as const;

export class AutumnSceneryRenderer {
  private dimensions: Dimensions = { width: 0, height: 0 };
  private readonly parallax = new DepthParallaxTracker({
    horizontalRatio: 0.008,
    horizontalMinimum: 10,
    horizontalMaximum: 30,
    verticalRatio: 0.005,
    verticalMinimum: 4,
    verticalMaximum: 14,
  });
  private readonly trees = createTreeSilhouetteSystem({
    layerConfigs: AUTUMN_TREE_LAYER_CONFIGS,
    style: AUTUMN_TREE_STYLE,
  });

  constructor(_quality: QualityLevel = "medium") {
    this.trees.setTreeVisibility(AUTUMN_TREE_VISIBILITY);
    this.trees.setEcologicalPattern("autumn-clearing");
    this.trees.setPlacementConfig(AUTUMN_TREE_PLACEMENT);
  }

  initialize(dimensions: Dimensions, quality: QualityLevel): void {
    this.dimensions = dimensions;
    void quality;
    this.parallax.initialize();
    this.trees.initialize(dimensions);
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

    if (layers.sky) this.drawSky(ctx);
    if (layers.landscape) this.drawGround(ctx);
    if (layers.trees) this.drawTrees(ctx, layers.landscape);
  }

  private drawSky(ctx: CanvasRenderingContext2D): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, this.dimensions.height);
    for (const stop of AUTUMN_SKY_STOPS) {
      gradient.addColorStop(stop.stop, stop.color);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.dimensions.width, this.dimensions.height);

    const glow = ctx.createRadialGradient(
      this.dimensions.width * 0.58,
      this.dimensions.height * 0.42,
      0,
      this.dimensions.width * 0.58,
      this.dimensions.height * 0.42,
      Math.max(this.dimensions.width, this.dimensions.height) * 0.34,
    );
    glow.addColorStop(0, "rgba(128, 104, 82, 0.09)");
    glow.addColorStop(1, "rgba(128, 104, 82, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.dimensions.width, this.dimensions.height);
  }

  private drawGround(ctx: CanvasRenderingContext2D): void {
    const groundTop = this.dimensions.height * 0.74;
    const gradient = ctx.createLinearGradient(
      0,
      groundTop,
      0,
      this.dimensions.height,
    );
    for (const stop of AUTUMN_GROUND_STOPS) {
      gradient.addColorStop(stop.stop, stop.color);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(
      0,
      groundTop,
      this.dimensions.width,
      this.dimensions.height - groundTop,
    );
  }

  private drawTrees(
    ctx: CanvasRenderingContext2D,
    drawAtmosphere: boolean,
  ): void {
    for (let layer = 0; layer < this.trees.getLayerCount(); layer += 1) {
      const depth = TREE_PARALLAX_DEPTHS[layer] ?? 0.46;
      const offset = this.parallax.getOffset(depth, this.dimensions);
      ctx.save();
      ctx.translate(offset.x, offset.y);
      this.trees.drawLayer(ctx, this.dimensions, layer);
      ctx.restore();

      if (drawAtmosphere && (layer === 0 || layer === 2)) {
        this.drawMistBand(ctx, layer);
      }
    }
  }

  private drawMistBand(ctx: CanvasRenderingContext2D, layer: number): void {
    const centerY = this.dimensions.height * (layer === 0 ? 0.74 : 0.84);
    const bandHeight = this.dimensions.height * (layer === 0 ? 0.12 : 0.09);
    const gradient = ctx.createLinearGradient(
      0,
      centerY - bandHeight,
      0,
      centerY + bandHeight,
    );
    gradient.addColorStop(0, "rgba(119, 117, 112, 0)");
    gradient.addColorStop(
      0.5,
      `rgba(119, 117, 112, ${layer === 0 ? 0.1 : 0.055})`,
    );
    gradient.addColorStop(1, "rgba(119, 117, 112, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(
      0,
      centerY - bandHeight,
      this.dimensions.width,
      bandHeight * 2,
    );
  }

  resize(dimensions: Dimensions): void {
    const previousDimensions = this.dimensions;
    this.dimensions = dimensions;
    this.trees.handleResize(previousDimensions, dimensions);
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

  getTreeCount(): number {
    return this.trees.getTreeCounts().total;
  }

  getLoadedArtCount(): number {
    return 0;
  }

  getExpectedArtCount(): number {
    return 0;
  }

  getLoadedMatteCount(): number {
    return 0;
  }

  cleanup(): void {
    this.trees.cleanup();
    this.parallax.initialize();
  }
}
