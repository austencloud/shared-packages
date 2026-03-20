import type { Bubble } from "../../domain/models/DeepOceanModels.js";

/**
 * Contract for bubble rendering
 */
export interface IBubbleRenderer {
  /**
   * Draw all bubbles with highlights
   */
  drawBubbles(ctx: CanvasRenderingContext2D, bubbles: Bubble[]): void;
}
