import type { FishMarineLife } from "../../domain/models/OceanModels.js";

export interface PointerState {
  x: number;
  y: number;
  active: boolean;
}

export interface IFishCursorAvoidance {
  /** Apply cursor flee to all fish for this frame. Mutates fish in place. */
  apply(
    fish: FishMarineLife[],
    pointer: PointerState | null,
    deltaSeconds: number,
    animationTime: number
  ): void;
}
