import type { OceanParticle } from "../../domain/models/DeepOceanModels.js";

/**
 * Contract for particle rendering
 */
export interface IParticleRenderer {
  /**
   * Draw all ocean particles
   */
  drawParticles(
    ctx: CanvasRenderingContext2D,
    particles: OceanParticle[]
  ): void;
}
