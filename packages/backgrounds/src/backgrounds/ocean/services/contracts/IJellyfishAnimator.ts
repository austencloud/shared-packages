import type { Dimensions } from "../../../../core/domain/types.js";
import type { JellyfishMarineLife } from "../../domain/models/OceanModels.js";

/**
 * Contract for jellyfish animation and movement
 */
export interface IJellyfishAnimator {
  /**
   * Initialize jellyfish population
   */
  initializeJellyfish(
    dimensions: Dimensions,
    count: number
  ): JellyfishMarineLife[];

  /**
   * Create a single jellyfish
   */
  createJellyfish(dimensions: Dimensions): JellyfishMarineLife;

  /**
   * Update all jellyfish positions and animations. The optional pointer
   * (canvas-logical px) drives the hover shimmer — pass null/omit when no
   * pointer is available and the shimmer simply eases out.
   */
  updateJellyfish(
    jellyfish: JellyfishMarineLife[],
    dimensions: Dimensions,
    frameMultiplier: number,
    pointer?: { x: number; y: number; active: boolean } | null
  ): JellyfishMarineLife[];

  /**
   * Get optimal jellyfish count for quality level
   */
  getJellyfishCount(quality: string): number;
}
