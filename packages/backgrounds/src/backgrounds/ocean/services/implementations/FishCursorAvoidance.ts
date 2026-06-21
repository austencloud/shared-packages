import type { FishMarineLife } from "../../domain/models/OceanModels.js";
import type {
  IFishCursorAvoidance,
  PointerState,
} from "../contracts/IFishCursorAvoidance.js";
import { CURSOR_FLEE } from "../../domain/constants/fish-constants.js";
import { computeFlee } from "./fish-motion/cursor-flee.js";

/**
 * Applies screen-space cursor flee to fish, mirroring the 3D scatter:
 * proximity-falloff trigger, away+tangential push, boldness-scaled radius,
 * and a panic timer that decays so the fish eases back to normal behavior
 * (no instant snap out of flee).
 */
export class FishCursorAvoidance implements IFishCursorAvoidance {
  apply(
    fish: FishMarineLife[],
    pointer: PointerState | null,
    deltaSeconds: number,
    _animationTime: number
  ): void {
    if (!CURSOR_FLEE.enabled) return;

    for (const f of fish) {
      // Decay any existing panic.
      if (f.fleeTimer > 0) {
        f.fleeTimer = Math.max(0, f.fleeTimer - deltaSeconds);
        f.fleeIntensity = f.fleeTimer / CURSOR_FLEE.panicDuration;
      }

      if (!pointer || !pointer.active) continue;

      const boldness = f.personality?.boldness ?? 0.5;
      const flee = computeFlee({
        fishX: f.x,
        fishY: f.baseY,
        cursorX: pointer.x,
        cursorY: pointer.y,
        radius: CURSOR_FLEE.radius,
        boldness,
        direction: f.direction,
      });

      if (flee.intensity <= 0) continue;

      // Enter / refresh flee: dart away from the cursor.
      f.behavior = "darting";
      f.behaviorTimer = Math.max(f.behaviorTimer, 0.6);
      f.fleeTimer = CURSOR_FLEE.panicDuration;
      f.fleeIntensity = Math.max(f.fleeIntensity, flee.intensity);

      // Horizontal: face away, boost target speed by intensity.
      f.direction = flee.dirX >= 0 ? 1 : -1;
      f.targetSpeed =
        f.baseSpeed * (1 + (CURSOR_FLEE.speedMultiplier - 1) * flee.intensity);

      // Vertical: push baseY along the flee vector (smoothed by integration
      // since we move baseY by a velocity*dt amount, not a teleport).
      f.baseY += flee.dirY * CURSOR_FLEE.verticalForce * flee.intensity * deltaSeconds;
    }
  }
}
