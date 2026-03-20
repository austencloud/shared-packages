import type { Dimensions } from "../../../../core/domain/types.js";
import type { LightRay, CausticsState } from "../../domain/models/DeepOceanModels.js";

/**
 * Contract for light ray and caustics rendering
 */
export interface ILightRayRenderer {
  /**
   * Draw volumetric light rays from surface
   */
  drawLightRays(
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions,
    lightRays: LightRay[],
    quality: string
  ): void;

  /**
   * Draw caustic patterns (dancing underwater light)
   */
  drawCaustics(
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions,
    caustics: CausticsState,
    quality: string
  ): void;
}
