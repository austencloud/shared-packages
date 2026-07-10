import type { Dimensions } from "../../../../core/domain/types.js";
import type { FishMarineLife } from "../../domain/models/OceanModels.js";
import type { IFishMovementController } from "../contracts/IFishMovementController.js";
import type { IFishDecisionMaker } from "../contracts/IFishDecisionMaker.js";
import {
  BEHAVIOR_CONFIG,
  EDGE_AWARENESS,
  SPAWN_CONFIG,
  DEPTH_TRANSITION,
  MOTION_SMOOTHING,
  LATERAL_WANDER,
  SWIM_GAIT,
  TURN_ARC,
} from "../../domain/constants/fish-constants.js";
import { approachExponential, easeHeading } from "./fish-motion/velocity-smoothing.js";
import { wanderOffset } from "./fish-motion/lateral-wander.js";
import { FishDecisionMaker } from "./FishDecisionMaker.js";

/**
 * FishMovementController - Manages fish behavior state machine and movement
 *
 * Handles behavior transitions (cruising, turning, darting, schooling),
 * applies movement based on current behavior, and manages edge awareness.
 * Now supports personality-influenced decisions via FishDecisionMaker.
 */
export class FishMovementController implements IFishMovementController {
  private decisionMaker: IFishDecisionMaker;

  constructor(decisionMaker?: IFishDecisionMaker) {
    this.decisionMaker = decisionMaker ?? new FishDecisionMaker();
  }
  applyBehavior(
    fish: FishMarineLife,
    deltaSeconds: number,
    frameMultiplier: number,
    dimensions: Dimensions,
    animationTime: number
  ): void {
    // Spine-chain fish get their eased speed from updatePropulsion (which runs
    // earlier this frame and now eases toward targetSpeed*thrust). Only ease
    // speed here for non-spine fish, to avoid two smoothers fighting.
    if (!fish.useSpineChain) {
      const rate =
        fish.behavior === "darting"
          ? MOTION_SMOOTHING.dartSpeedRate
          : MOTION_SMOOTHING.speedRate;
      fish.speed = approachExponential(fish.speed, fish.targetSpeed, rate, deltaSeconds);
    }

    // Heading easing applies to ALL fish (direction flips ramp through 0).
    fish.headingFactor = easeHeading(
      fish.headingFactor,
      fish.direction,
      MOTION_SMOOTHING.headingRate,
      deltaSeconds
    );

    // Always update depth (z-axis lerping)
    this.updateDepth(fish, frameMultiplier);

    switch (fish.behavior) {
      case "cruising":
      case "schooling":
        this.applyCruising(fish, deltaSeconds, frameMultiplier);
        break;
      case "turning":
        this.applyTurning(fish, deltaSeconds);
        break;
      case "darting":
        this.applyDarting(fish, deltaSeconds, animationTime);
        break;
      case "passing":
        this.applyPassing(fish, deltaSeconds);
        break;
      case "ascending":
        this.applyAscending(fish, deltaSeconds, frameMultiplier, dimensions);
        break;
      case "descending":
        this.applyDescending(fish, deltaSeconds, frameMultiplier, dimensions);
        break;
      case "approaching":
      case "receding":
        // These behaviors use normal horizontal movement,
        // z-axis change is handled by updateDepth via targetZ
        this.applyCruising(fish, deltaSeconds, frameMultiplier);
        break;
    }

    // Clamp to depth band (relaxed for ascending/descending)
    if (fish.behavior !== "ascending" && fish.behavior !== "descending") {
      fish.baseY = Math.max(
        fish.depthBand.min,
        Math.min(fish.depthBand.max, fish.baseY)
      );
    } else {
      // Wider bounds during vertical movement
      const margin = dimensions.height * 0.1;
      fish.baseY = Math.max(margin, Math.min(dimensions.height - margin, fish.baseY));
    }
  }

  /**
   * Updates the fish's z-axis position by lerping toward targetZ.
   * Called every frame to smoothly animate depth changes.
   */
  updateDepth(fish: FishMarineLife, frameMultiplier: number): void {
    const lerpSpeed = DEPTH_TRANSITION.lerpSpeed * frameMultiplier;
    fish.z += (fish.targetZ - fish.z) * lerpSpeed;

    // Clamp to valid range
    fish.z = Math.max(DEPTH_TRANSITION.minZ, Math.min(DEPTH_TRANSITION.maxZ, fish.z));
  }

  transitionBehavior(
    fish: FishMarineLife,
    dimensions: Dimensions,
    nearbyFish: FishMarineLife[] = [],
    animationTime: number = 0
  ): void {
    const current = fish.behavior;

    // Complete turning: flip direction. School members drop back into
    // schooling (not cruising) so a turn doesn't silently eject them from
    // the flocking pass.
    if (current === "turning") {
      fish.direction =
        fish.targetDirection ?? ((fish.direction * -1) as 1 | -1);
      fish.behavior = fish.schoolId !== undefined ? "schooling" : "cruising";
      fish.behaviorTimer = this.randomInRange(BEHAVIOR_CONFIG.cruising.duration);
      fish.rotation = 0;
      fish.targetSpeed = fish.baseSpeed;
      return;
    }

    // Complete darting: return to cruise
    if (current === "darting") {
      fish.behavior = "cruising";
      fish.behaviorTimer = this.randomInRange(BEHAVIOR_CONFIG.cruising.duration);
      fish.targetSpeed = fish.baseSpeed;
      return;
    }

    // Complete passing: return to cruise
    if (current === "passing") {
      fish.behavior = "cruising";
      fish.behaviorTimer = this.randomInRange(BEHAVIOR_CONFIG.cruising.duration);
      fish.targetSpeed = fish.baseSpeed;
      fish.rotation = 0;
      return;
    }

    // Complete ascending/descending: return to cruise with updated baseY
    if (current === "ascending" || current === "descending") {
      fish.behavior = "cruising";
      fish.behaviorTimer = this.randomInRange(BEHAVIOR_CONFIG.cruising.duration);
      fish.targetSpeed = fish.baseSpeed;
      fish.rotation = 0;
      fish.targetY = undefined;
      // Update depth band to center around new position
      const bandHeight = fish.depthBand.max - fish.depthBand.min;
      fish.depthBand = {
        min: Math.max(dimensions.height * 0.05, fish.baseY - bandHeight / 2),
        max: Math.min(dimensions.height * 0.95, fish.baseY + bandHeight / 2),
      };
      return;
    }

    // Complete approaching/receding: return to cruise (z already changed via lerp)
    if (current === "approaching" || current === "receding") {
      fish.behavior = "cruising";
      fish.behaviorTimer = this.randomInRange(BEHAVIOR_CONFIG.cruising.duration);
      fish.targetSpeed = fish.baseSpeed;
      return;
    }

    // Use personality-influenced decision making
    const decision = this.decisionMaker.decideNextBehavior({
      fish,
      nearbyFish,
      dimensions,
      animationTime,
    });

    // Apply the decision
    fish.behavior = decision.behavior;

    // Set behavior timer based on behavior type
    switch (decision.behavior) {
      case "turning":
        fish.behaviorTimer = BEHAVIOR_CONFIG.turning.duration;
        fish.targetDirection = decision.targetDirection;
        fish.targetSpeed = fish.baseSpeed * BEHAVIOR_CONFIG.turning.speedMultiplier;
        break;
      case "darting":
        fish.behaviorTimer = BEHAVIOR_CONFIG.darting.duration;
        fish.dartSpeed =
          fish.baseSpeed *
          (decision.speedMultiplier ??
            this.randomInRange(BEHAVIOR_CONFIG.darting.speedMultiplier));
        fish.targetSpeed = fish.dartSpeed;
        break;
      case "passing":
        fish.behaviorTimer = this.randomInRange(BEHAVIOR_CONFIG.passing.duration);
        fish.targetSpeed =
          fish.baseSpeed *
          (decision.speedMultiplier ??
            this.randomInRange(BEHAVIOR_CONFIG.passing.speedMultiplier));
        break;
      case "ascending":
        fish.behaviorTimer = this.randomInRange(BEHAVIOR_CONFIG.ascending.duration);
        fish.targetSpeed = fish.baseSpeed * BEHAVIOR_CONFIG.ascending.speedMultiplier;
        fish.targetY = decision.targetY ?? fish.baseY - this.randomInRange([30, 60]);
        fish.rotation = this.randomInRange(BEHAVIOR_CONFIG.ascending.bodyRotation);
        // Sample vertical speed ONCE on entry; applyAscending reuses it each frame
        // so the climb is steady instead of re-randomized (jittery) per frame.
        fish.verticalSpeed = this.randomInRange(BEHAVIOR_CONFIG.ascending.verticalSpeed);
        break;
      case "descending":
        fish.behaviorTimer = this.randomInRange(BEHAVIOR_CONFIG.descending.duration);
        fish.targetSpeed = fish.baseSpeed * BEHAVIOR_CONFIG.descending.speedMultiplier;
        fish.targetY = decision.targetY ?? fish.baseY + this.randomInRange([30, 60]);
        fish.rotation = this.randomInRange(BEHAVIOR_CONFIG.descending.bodyRotation);
        // Sample vertical speed ONCE on entry; applyDescending reuses it each frame.
        fish.verticalSpeed = Math.abs(
          this.randomInRange(BEHAVIOR_CONFIG.descending.verticalSpeed)
        );
        break;
      case "approaching":
        fish.behaviorTimer = this.randomInRange(BEHAVIOR_CONFIG.approaching.duration);
        fish.targetSpeed = fish.baseSpeed * BEHAVIOR_CONFIG.approaching.speedMultiplier;
        fish.targetZ = Math.max(
          DEPTH_TRANSITION.minZ,
          fish.z + this.randomInRange(BEHAVIOR_CONFIG.approaching.zChange)
        );
        break;
      case "receding":
        fish.behaviorTimer = this.randomInRange(BEHAVIOR_CONFIG.receding.duration);
        fish.targetSpeed = fish.baseSpeed * BEHAVIOR_CONFIG.receding.speedMultiplier;
        fish.targetZ = Math.min(
          DEPTH_TRANSITION.maxZ,
          fish.z + this.randomInRange(BEHAVIOR_CONFIG.receding.zChange)
        );
        break;
      case "cruising":
      case "schooling":
        fish.behaviorTimer = this.randomInRange(BEHAVIOR_CONFIG.cruising.duration);
        // Apply speed modifier for mood-based decisions (e.g., tired fish)
        fish.targetSpeed = decision.speedMultiplier
          ? fish.baseSpeed * decision.speedMultiplier
          : fish.baseSpeed;
        break;
    }

    // Store wobble trigger for visual system to pick up
    if (decision.triggerWobble) {
      fish.wobbleType = decision.triggerWobble;
      fish.wobbleTimer = 0.5; // Half-second wobble
      fish.wobbleIntensity = 1.0;
    }
  }

  isOffScreen(fish: FishMarineLife, dimensions: Dimensions): boolean {
    const buffer = fish.bodyLength + SPAWN_CONFIG.offScreenBuffer;
    return fish.x > dimensions.width + buffer || fish.x < -buffer;
  }

  getEdgeProximity(fish: FishMarineLife, dimensions: Dimensions): number {
    // Uses fish.direction (the heading target), not the eased headingFactor:
    // edge proximity is only read at behavior-transition decision points, by
    // which time the ~200ms heading ease has long settled.
    const warningZone = dimensions.width * EDGE_AWARENESS.warningZone;

    if (fish.direction === 1) {
      // Moving right, check right edge
      const distToEdge = dimensions.width - fish.x;
      if (distToEdge < warningZone) return 1 - distToEdge / warningZone;
    } else {
      // Moving left, check left edge
      if (fish.x < warningZone) return 1 - fish.x / warningZone;
    }
    return 0;
  }

  private applyCruising(
    fish: FishMarineLife,
    deltaSeconds: number,
    frameMultiplier: number
  ): void {
    fish.animationPhase += fish.bobSpeed * frameMultiplier;
    fish.x += fish.headingFactor * fish.speed * deltaSeconds;
    fish.baseY += fish.verticalDrift * deltaSeconds;

    // Fast fish hold a level line - bob damps as speed rises above cruise.
    const speedRatio = fish.speed / fish.baseSpeed;
    const bobScale = Math.max(
      SWIM_GAIT.bobScaleMin,
      1 / (1 + Math.max(0, speedRatio - 1) * SWIM_GAIT.bobDamping)
    );
    const bob = Math.sin(fish.animationPhase) * fish.bobAmplitude * bobScale;
    fish.y = fish.baseY + bob;
  }

  private applyTurning(fish: FishMarineLife, deltaSeconds: number): void {
    fish.x += fish.headingFactor * fish.speed * deltaSeconds;

    const turnProgress =
      1 - fish.behaviorTimer / BEHAVIOR_CONFIG.turning.duration;
    fish.rotation =
      fish.direction *
      Math.sin(turnProgress * Math.PI) *
      BEHAVIOR_CONFIG.turning.maxRotation;

    // Banked arc: carve vertically through the turn (peak at mid-turn) so the
    // reversal reads as a U-turn, not an in-place moonwalk. Arc direction
    // follows the fish's current vertical drift so successive turns vary.
    const arcSign = fish.verticalDrift >= 0 ? 1 : -1;
    fish.baseY +=
      arcSign *
      Math.sin(turnProgress * Math.PI) *
      TURN_ARC.peakVerticalSpeed *
      deltaSeconds;
    fish.y = fish.baseY;
  }

  /**
   * Natural fish C-start escape response with three phases:
   * 1. COIL - body tenses, slows down briefly (preparatory)
   * 2. BURST - explosive acceleration (propulsive)
   * 3. RECOVERY - gradual easeOutExpo deceleration
   */
  private applyDarting(
    fish: FishMarineLife,
    deltaSeconds: number,
    animationTime: number
  ): void {
    const config = BEHAVIOR_CONFIG.darting;
    const elapsed = config.duration - fish.behaviorTimer;

    // Body flex cue per phase (speed itself is eased in applyBehavior).
    let amp = LATERAL_WANDER.recoveryAmplitude;
    if (elapsed < config.coilDuration) {
      fish.bodyFlexAmount = 1.3;
    } else if (elapsed < config.coilDuration + config.burstDuration) {
      const burstProgress =
        (elapsed - config.coilDuration) / config.burstDuration;
      fish.bodyFlexAmount = 1.0;
      amp = LATERAL_WANDER.dartAmplitude * (1 - burstProgress);
    }

    // Horizontal advance uses the eased speed.
    fish.x += fish.headingFactor * fish.speed * deltaSeconds;

    // Smooth, deterministic lateral wander INTO baseY (not raw fish.y), so the
    // return to cruising doesn't pop. Velocity form (derivative) * dt keeps it
    // frame-rate independent and continuous.
    const seed = fish.bodyFlexPhase; // per-fish constant phase
    const w0 = wanderOffset(seed, animationTime, LATERAL_WANDER.frequency, amp);
    const w1 = wanderOffset(
      seed,
      animationTime + deltaSeconds,
      LATERAL_WANDER.frequency,
      amp
    );
    fish.baseY += w1 - w0;
  }

  /**
   * Fast direct swimming - no bobbing, straight line, streamlined posture.
   * Creates variety with fish that zoom across the screen.
   */
  private applyPassing(fish: FishMarineLife, deltaSeconds: number): void {
    // No bobbing, no vertical drift - straight line
    fish.x += fish.headingFactor * fish.speed * deltaSeconds;
    // Reduced body flex for streamlined appearance
    fish.bodyFlexAmount = BEHAVIOR_CONFIG.passing.bodyFlexMultiplier;
  }

  /**
   * Ascending - swimming upward with vertical focus.
   * Fish browses toward the surface with angled body rotation.
   */
  private applyAscending(
    fish: FishMarineLife,
    deltaSeconds: number,
    frameMultiplier: number,
    dimensions: Dimensions
  ): void {
    // Horizontal movement at reduced speed
    fish.animationPhase += fish.bobSpeed * frameMultiplier;
    fish.x += fish.headingFactor * fish.speed * deltaSeconds;

    // Strong vertical movement upward. Reuse the speed sampled once at behavior
    // entry (fallback-sample only if it was never seeded).
    if (fish.targetY !== undefined) {
      const verticalSpeed =
        fish.verticalSpeed ??
        this.randomInRange(BEHAVIOR_CONFIG.ascending.verticalSpeed);
      const direction = fish.targetY < fish.baseY ? -1 : 1;
      fish.baseY += direction * verticalSpeed * deltaSeconds;
    }

    // Bob around the moving baseY
    const bob = Math.sin(fish.animationPhase) * fish.bobAmplitude * 0.5;
    fish.y = fish.baseY + bob;
  }

  /**
   * Descending - swimming downward with vertical focus.
   * Fish browses toward the depths with angled body rotation.
   */
  private applyDescending(
    fish: FishMarineLife,
    deltaSeconds: number,
    frameMultiplier: number,
    dimensions: Dimensions
  ): void {
    // Horizontal movement at reduced speed
    fish.animationPhase += fish.bobSpeed * frameMultiplier;
    fish.x += fish.headingFactor * fish.speed * deltaSeconds;

    // Strong vertical movement downward. Reuse the speed sampled once at behavior
    // entry (fallback-sample only if it was never seeded).
    if (fish.targetY !== undefined) {
      const verticalSpeed =
        fish.verticalSpeed ??
        Math.abs(this.randomInRange(BEHAVIOR_CONFIG.descending.verticalSpeed));
      const direction = fish.targetY > fish.baseY ? 1 : -1;
      fish.baseY += direction * verticalSpeed * deltaSeconds;
    }

    // Bob around the moving baseY
    const bob = Math.sin(fish.animationPhase) * fish.bobAmplitude * 0.5;
    fish.y = fish.baseY + bob;
  }

  private randomInRange(
    range: [number, number] | readonly [number, number]
  ): number {
    return range[0] + Math.random() * (range[1] - range[0]);
  }
}
