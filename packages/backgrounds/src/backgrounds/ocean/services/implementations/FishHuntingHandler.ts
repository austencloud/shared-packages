import type { FishMarineLife } from "../../domain/models/OceanModels.js";
import type {
  IFishHuntingHandler,
  ActiveHunt,
  HuntResult,
  HuntOutcome,
  HuntState,
  HuntStats,
} from "../contracts/IFishHuntingHandler.js";
import type { IFishWobbleAnimator } from "../contracts/IFishWobbleAnimator.js";
import { FishWobbleAnimator } from "./FishWobbleAnimator.js";
import {
  steerHeading,
  biasAwayFromEdges,
  type Heading,
} from "./fish-motion/pursuit-steering.js";
import { BEHAVIOR_CONFIG } from "../../domain/constants/fish-constants.js";

/**
 * Below this predator/prey separation (px), facing direction is frozen. An
 * overlapping pair's normalized heading alternates sign every frame, and
 * `direction` is mirrored instantly by the renderer, so letting it track the
 * heading at close quarters reads as a buzzing twitch rather than a turn.
 */
const FLIP_SUPPRESS_DISTANCE = 45;

/**
 * Hunting system configuration
 */
const HUNTING_CONFIG = {
  // Trigger conditions
  hungerThreshold: 0.6, // Min hunger to start hunting
  detectionRadius: 150, // How far predator can spot prey
  chaseRadius: 200, // Max distance predator will chase

  // Timing (seconds)
  stalkDuration: [2, 3] as const, // How long stalk phase lasts
  maxChaseDuration: [4, 6] as const, // Max chase before giving up
  huntCooldown: 30, // Time between hunts

  // Outcomes
  catchProbability: 0.2, // 20% catch rate
  escapeSpeedBoost: 1.5, // Prey speed multiplier when fleeing
  predatorChaseSpeed: 2.0, // Predator burst speed multiplier
  predatorStalkSpeed: 0.6, // Slow approach during stalk

  // School defense
  alertPropagationRadius: 100, // Alert nearby fish in school

  // Steering (rad/s max turn rates - prey out-turns predator, classic pursuit)
  predatorStalkTurnRate: 1.2,
  predatorChaseTurnRate: 2.2,
  preyFleeTurnRate: 3.5,
  /** Edge margin (px) where fleeing prey starts carving back inward */
  fleeEdgeMargin: 120,

  // Near-miss escape juke
  nearMissDistance: 30, // px - close approach that resolves the hunt
  jukeSpeedMultiplier: 3.0, // prey burst on successful juke
};

/**
 * FishHuntingHandler - Manages predator/prey chase sequences
 *
 * Creates emergent drama through pursuit and escape:
 * - Sleek fish are active predators (fast, bold, solitary)
 * - Deep fish are ambush predators (patient, z-axis approach)
 * - Tropical/schooling fish are prey (flee, school up)
 *
 * No death mechanics - just pursuit behavior that adds life to the scene.
 */
export class FishHuntingHandler implements IFishHuntingHandler {
  private activeHunts: Map<number, ActiveHunt> = new Map();
  private stats: HuntStats = {
    activeHunts: 0,
    totalHunts: 0,
    successfulCatches: 0,
    escapes: 0,
  };
  private wobbleAnimator: IFishWobbleAnimator;

  constructor(wobbleAnimator?: IFishWobbleAnimator) {
    this.wobbleAnimator = wobbleAnimator ?? new FishWobbleAnimator();
  }

  processHunting(
    fish: FishMarineLife[],
    deltaSeconds: number,
    animationTime: number,
    dimensions?: { width: number; height: number }
  ): HuntResult[] {
    const results: HuntResult[] = [];

    // Build lookup maps
    const fishById = new Map(fish.map((f) => [f.fishId ?? 0, f]));

    // Update existing hunts
    for (const [hunterId, hunt] of this.activeHunts) {
      const predator = fishById.get(hunterId);
      const prey = fishById.get(hunt.targetId);

      // Cancel if either fish is gone.
      //
      // Whichever fish survived must have its hunt state cleared here. Deleting
      // the hunt alone left the survivor pinned in huntState "stalking"/"chasing"
      // forever: FishDecisionMaker short-circuits on huntState, and neither
      // behavior switch has a case for those behaviors, so the fish got no
      // movement handler, never re-decided, and never drifted off screen to be
      // despawned. Measured 8 permanently frozen fish per session.
      if (!predator || !prey) {
        results.push({ hunt, outcome: "cancelled" });
        if (predator) this.clearPredatorHuntState(predator, animationTime);
        if (prey) this.clearPreyHuntState(prey);
        this.activeHunts.delete(hunterId);
        continue;
      }

      const huntAge = animationTime - hunt.startTime;

      // State machine
      switch (hunt.state) {
        case "stalking": {
          // Stalk length was sampled once at hunt start (re-rolling it every
          // frame made the phase boundary a per-frame dice roll).
          if (huntAge >= hunt.stalkEnd) {
            // Transition to chase
            hunt.state = "chasing";
            predator.huntState = "chasing";
            predator.behavior = "chasing";

            // Prey detects predator and starts fleeing
            prey.isBeingHunted = true;
            prey.hunterId = hunterId;
            prey.mood = "alert";
            prey.behavior = "fleeing";
            this.wobbleAnimator.triggerWobble(prey, "startled_dart", 0.8);

            // Alert nearby schoolmates
            this.alertSchoolmates(prey, fish, animationTime);
          } else {
            // Slow approach during stalk
            this.applyStalking(hunt, predator, prey, deltaSeconds);
          }
          break;
        }

        case "chasing": {
          // Check timeout
          if (huntAge >= hunt.maxDuration) {
            results.push({ hunt, outcome: "timeout" });
            this.clearHuntState(predator, prey, animationTime);
            this.activeHunts.delete(hunterId);
            continue;
          }

          // Check distance - escaped if too far
          const dist = this.distance(predator, prey);
          if (dist > HUNTING_CONFIG.chaseRadius) {
            results.push({ hunt, outcome: "escaped" });
            this.clearHuntState(predator, prey, animationTime);
            this.activeHunts.delete(hunterId);
            this.stats.escapes++;
            continue;
          }

          // Close approach resolves the hunt using the outcome decided at
          // hunt start. On a miss the prey jukes: an explosive dart that
          // re-opens the gap, instead of predator and prey gluing together
          // until the timeout.
          if (dist < HUNTING_CONFIG.nearMissDistance) {
            if (hunt.willCatch) {
              results.push({ hunt, outcome: "caught" });
              this.clearHuntState(predator, prey, animationTime);
              this.activeHunts.delete(hunterId);
              this.stats.successfulCatches++;
            } else {
              results.push({ hunt, outcome: "escaped" });
              this.clearHuntState(predator, prey, animationTime);
              this.activeHunts.delete(hunterId);
              this.stats.escapes++;
              this.applyEscapeJuke(prey);
            }
            continue;
          }

          // Apply chase movement
          this.applyChasing(hunt, predator, prey, deltaSeconds);
          this.applyFleeing(hunt, prey, predator, deltaSeconds, dimensions);
          break;
        }
      }
    }

    // Look for new hunts
    const predators = fish.filter(
      (f) =>
        this.isPredator(f) &&
        !this.activeHunts.has(f.fishId ?? 0) &&
        this.canHunt(f, animationTime)
    );

    for (const predator of predators) {
      const prey = this.findPrey(predator, fish);
      if (prey) {
        this.startHunt(predator, prey, animationTime);
      }
    }

    // Update stats
    this.stats.activeHunts = this.activeHunts.size;

    return results;
  }

  applyHuntResult(result: HuntResult, fish: FishMarineLife[]): void {
    const fishById = new Map(fish.map((f) => [f.fishId ?? 0, f]));
    const predator = fishById.get(result.hunt.hunterId);
    const prey = fishById.get(result.hunt.targetId);

    switch (result.outcome) {
      case "caught":
        // Predator gets satisfied
        if (predator) {
          predator.hunger = Math.max(0, (predator.hunger ?? 0.5) - 0.4);
          predator.mood = "calm";
          this.wobbleAnimator.triggerWobble(predator, "feeding_lunge", 0.9);
        }
        // Prey gets startled (but survives - no death in this system)
        if (prey) {
          prey.mood = "alert";
          this.wobbleAnimator.triggerWobble(prey, "startled_dart", 1.0);
        }
        break;

      case "escaped":
        // Prey relief
        if (prey) {
          prey.mood = "alert";
          prey.energy = Math.max(0, (prey.energy ?? 0.7) - 0.2); // Tired from fleeing
        }
        break;

      case "timeout":
        // Predator frustrated
        if (predator) {
          predator.mood = "tired";
          predator.energy = Math.max(0, (predator.energy ?? 0.7) - 0.15);
        }
        break;

      case "cancelled":
        // Nothing special
        break;
    }
  }

  isPredator(fish: FishMarineLife): boolean {
    return fish.species === "sleek" || fish.species === "deep";
  }

  isPrey(fish: FishMarineLife): boolean {
    return fish.species === "tropical" || fish.species === "schooling";
  }

  getActiveHunts(): ActiveHunt[] {
    return Array.from(this.activeHunts.values());
  }

  getStats(): HuntStats {
    return { ...this.stats };
  }

  forceHunt(
    predator: FishMarineLife,
    prey: FishMarineLife,
    animationTime: number
  ): void {
    if (!predator.fishId || !prey.fishId) return;

    // Cancel any existing hunt
    this.activeHunts.delete(predator.fishId);

    // Start new hunt (skip hunger check)
    this.startHunt(predator, prey, animationTime);
  }

  cancelAllHunts(): void {
    this.activeHunts.clear();
    this.stats.activeHunts = 0;
  }

  getHuntVisualization(
    fish: FishMarineLife
  ): { targetX: number; targetY: number; state: HuntState } | null {
    const hunt = this.activeHunts.get(fish.fishId ?? 0);
    if (!hunt) return null;

    // We'd need the prey's position, which we don't have here
    // This should be called from a context with access to all fish
    return null;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private canHunt(predator: FishMarineLife, animationTime: number): boolean {
    // Check hunger threshold
    const hunger = predator.hunger ?? 0.3;
    if (hunger < HUNTING_CONFIG.hungerThreshold) return false;

    // Check cooldown
    if (
      predator.huntCooldownEnd &&
      animationTime < predator.huntCooldownEnd
    ) {
      return false;
    }

    // Check mood - don't hunt if tired
    if (predator.mood === "tired") return false;

    return true;
  }

  private findPrey(
    predator: FishMarineLife,
    allFish: FishMarineLife[]
  ): FishMarineLife | null {
    // Find closest prey within detection range
    let closestPrey: FishMarineLife | null = null;
    let closestDist = HUNTING_CONFIG.detectionRadius;

    for (const fish of allFish) {
      if (!this.isPrey(fish)) continue;
      if (fish.isBeingHunted) continue; // Already being chased

      const dist = this.distance(predator, fish);
      if (dist < closestDist) {
        closestDist = dist;
        closestPrey = fish;
      }
    }

    return closestPrey;
  }

  private startHunt(
    predator: FishMarineLife,
    prey: FishMarineLife,
    animationTime: number
  ): void {
    const hunterId = predator.fishId ?? 0;
    const targetId = prey.fishId ?? 0;

    const maxDuration = this.randomInRange(HUNTING_CONFIG.maxChaseDuration);
    const stalkEnd = this.randomInRange(HUNTING_CONFIG.stalkDuration);

    const hunt: ActiveHunt = {
      hunterId,
      targetId,
      state: "stalking",
      startTime: animationTime,
      maxDuration,
      stalkEnd,
      willCatch: Math.random() < HUNTING_CONFIG.catchProbability,
      hunterHeading: { x: predator.direction, y: 0 },
      preyHeading: { x: prey.direction, y: 0 },
    };

    this.activeHunts.set(hunterId, hunt);
    this.stats.totalHunts++;

    // Update predator state
    predator.huntState = "stalking";
    predator.huntingTarget = targetId;
    predator.huntStartTime = animationTime;
    predator.behavior = "stalking";
  }

  private clearHuntState(
    predator: FishMarineLife,
    prey: FishMarineLife,
    animationTime: number
  ): void {
    this.clearPredatorHuntState(predator, animationTime);
    this.clearPreyHuntState(prey);
  }

  /** Return a predator to normal cruising. Safe to call on a half-cancelled hunt. */
  private clearPredatorHuntState(
    predator: FishMarineLife,
    animationTime: number
  ): void {
    predator.huntState = "cooldown";
    predator.huntingTarget = undefined;
    predator.huntStartTime = undefined;
    predator.huntCooldownEnd = animationTime + HUNTING_CONFIG.huntCooldown;
    predator.behavior = "cruising";
  }

  /** Return prey to normal cruising. Safe to call on a half-cancelled hunt. */
  private clearPreyHuntState(prey: FishMarineLife): void {
    prey.isBeingHunted = false;
    prey.hunterId = undefined;
    prey.behavior = "cruising";
  }

  private applyStalking(
    hunt: ActiveHunt,
    predator: FishMarineLife,
    prey: FishMarineLife,
    deltaSeconds: number
  ): void {
    // Slow, steady approach toward prey
    hunt.hunterHeading = steerHeading(
      hunt.hunterHeading,
      { x: prey.x - predator.x, y: prey.y - predator.y },
      HUNTING_CONFIG.predatorStalkTurnRate,
      deltaSeconds
    );
    this.moveAlongHeading(
      predator,
      hunt.hunterHeading,
      predator.baseSpeed * HUNTING_CONFIG.predatorStalkSpeed,
      deltaSeconds,
      this.distance(predator, prey)
    );
  }

  private applyChasing(
    hunt: ActiveHunt,
    predator: FishMarineLife,
    prey: FishMarineLife,
    deltaSeconds: number
  ): void {
    // Burst speed pursuit - heading arcs onto the prey at a capped turn rate
    // so the predator carves a pursuit curve instead of vector-snapping.
    hunt.hunterHeading = steerHeading(
      hunt.hunterHeading,
      { x: prey.x - predator.x, y: prey.y - predator.y },
      HUNTING_CONFIG.predatorChaseTurnRate,
      deltaSeconds
    );
    const chaseSpeed = predator.baseSpeed * HUNTING_CONFIG.predatorChaseSpeed;
    this.moveAlongHeading(
      predator,
      hunt.hunterHeading,
      chaseSpeed,
      deltaSeconds,
      this.distance(predator, prey)
    );
    // Set high speed for visual effect (tail-beat frequency follows)
    predator.speed = chaseSpeed;
  }

  private applyFleeing(
    hunt: ActiveHunt,
    prey: FishMarineLife,
    predator: FishMarineLife,
    deltaSeconds: number,
    dimensions?: { width: number; height: number }
  ): void {
    // Flee away from predator; prey turns tighter than the predator (its one
    // advantage), and carves back inward near screen edges instead of bolting
    // straight off-screen mid-chase.
    let desired: Heading = {
      x: prey.x - predator.x,
      y: prey.y - predator.y,
    };
    if (dimensions) {
      const len = Math.hypot(desired.x, desired.y);
      if (len > 0) {
        desired = biasAwayFromEdges(
          { x: desired.x / len, y: desired.y / len },
          prey.x,
          prey.y,
          dimensions.width,
          dimensions.height,
          HUNTING_CONFIG.fleeEdgeMargin
        );
      }
    }
    hunt.preyHeading = steerHeading(
      hunt.preyHeading,
      desired,
      HUNTING_CONFIG.preyFleeTurnRate,
      deltaSeconds
    );
    const fleeSpeed = prey.baseSpeed * HUNTING_CONFIG.escapeSpeedBoost;
    this.moveAlongHeading(
      prey,
      hunt.preyHeading,
      fleeSpeed,
      deltaSeconds,
      this.distance(prey, predator)
    );
    // Set high speed for visual effect
    prey.speed = fleeSpeed;
  }

  /**
   * Prey wins the close-quarters exchange: explosive dart re-opens the gap.
   * Routed through the normal darting behavior so the C-start coil/burst/
   * recovery phases and speed easing all apply.
   */
  private applyEscapeJuke(prey: FishMarineLife): void {
    prey.behavior = "darting";
    prey.behaviorTimer = BEHAVIOR_CONFIG.darting.duration;
    prey.dartSpeed = prey.baseSpeed * HUNTING_CONFIG.jukeSpeedMultiplier;
    prey.targetSpeed = prey.dartSpeed;
    this.wobbleAnimator.triggerWobble(prey, "startled_dart", 1.0);
  }

  /**
   * Moves a fish along a unit heading at `speed` px/s.
   *
   * baseSpeed is px/s, so displacement is speed * dt — no frame factor. (An
   * older version multiplied by an extra 60, launching hunts at ~60x intended
   * speed: predators teleport-dashed and locked chase pairs oscillated around
   * each other at thousands of px/s.)
   *
   * Writes baseY alongside y so the cruising formula (y = baseY + bob) picks
   * up where the hunt left off instead of snapping back to the pre-hunt
   * vertical position when the hunt ends.
   *
   * Direction flips are gated two ways, because `direction` is a hard ±1 that
   * the renderer mirrors instantly (ctx.scale(-direction, 1)) — every write is a
   * visible snap, not an eased turn:
   *
   * 1. `heading.x` must clear a deadzone, so a near-vertical chase doesn't
   *    flip facing on horizontal noise.
   * 2. `partnerDistance` must exceed FLIP_SUPPRESS_DISTANCE. A deadzone on
   *    heading.x alone does NOT cover the actual failure: once predator and prey
   *    overlap, the steering target is a sub-pixel offset whose NORMALIZED
   *    heading is ≈±1 and alternates sign every frame. That sailed through the
   *    0.15 gate and produced the observed left/right buzz — measured 3562 of
   *    3643 flips landing within one second of the same fish's previous flip,
   *    median gap 0.017s (one frame), essentially all of them in chasing /
   *    fleeing / stalking.
   */
  private moveAlongHeading(
    fish: FishMarineLife,
    heading: Heading,
    speed: number,
    deltaSeconds: number,
    partnerDistance?: number
  ): void {
    const step = speed * deltaSeconds;
    fish.x += heading.x * step;
    fish.baseY += heading.y * step;
    fish.y = fish.baseY;

    const overlapping =
      partnerDistance !== undefined && partnerDistance < FLIP_SUPPRESS_DISTANCE;
    if (!overlapping && Math.abs(heading.x) > 0.15) {
      fish.direction = heading.x > 0 ? 1 : -1;
    }
  }

  private alertSchoolmates(
    alertedFish: FishMarineLife,
    allFish: FishMarineLife[],
    _animationTime: number
  ): void {
    // Find schoolmates within alert radius
    for (const fish of allFish) {
      if (fish === alertedFish) continue;
      if (fish.schoolId !== alertedFish.schoolId) continue;

      const dist = this.distance(alertedFish, fish);
      if (dist < HUNTING_CONFIG.alertPropagationRadius) {
        fish.mood = "alert";
        this.wobbleAnimator.triggerWobble(fish, "startled_dart", 0.5);
      }
    }
  }

  private distance(a: FishMarineLife, b: FishMarineLife): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private randomInRange(range: readonly [number, number]): number {
    return range[0] + Math.random() * (range[1] - range[0]);
  }
}
