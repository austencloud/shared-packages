/**
 * SpineTwister
 *
 * When your hands reach across your body, your torso and head naturally
 * turn toward the reaching direction. This reframes the coordinate
 * system - a cross-body reach becomes more like a front-body reach
 * from the spine's perspective. Without this, the avatar looks like
 * a mannequin bolted to a pole.
 *
 * Three degrees of freedom:
 * 1. YAW (Y-axis): torso turns left/right toward the crossing direction
 * 2. LATERAL TILT (Z-axis): torso leans sideways when hands are high
 *    and crossing - prevents arms from clipping through the head
 * 3. FORWARD PITCH (X-axis): shoulders follow a cross-body reach so the
 *    arms can clear the chest instead of solving from a rigid torso
 *
 * The twist distributes anatomically up the spine chain. If the model
 * is missing bones (common: Spine2/upper_chest), the missing bone's
 * weight is redistributed proportionally to the bones that exist.
 *
 * Hips counter-rotate opposite to the upper body at ~20% of the
 * total twist, keeping the avatar grounded rather than spinning
 * from the waist up.
 *
 * Biomechanics reference:
 * - Thoracic spine: ~47° total axial rotation capacity
 * - Cervical spine: ~85° total axial rotation capacity
 * - Lateral flexion: ~25° thoracic, ~45° cervical
 * - We use ~60° max yaw, ~25° max tilt - within safe range
 */

import { Vector3, Quaternion, Euler } from "three";
import type {
  ISpineTwister,
  SpineTwistResult,
  BodyFrame,
} from "../contracts/ISpineTwister";

/** Maximum total upper-body yaw (turning left/right) in radians (~60 degrees). */
const MAX_YAW = (60 * Math.PI) / 180;

/** Maximum yaw in single-hand gaze mode (~40 degrees). Softer than
 *  the cross-body reach case - you turn to LOOK at a held prop, you
 *  don't lean your whole torso toward it. */
const SINGLE_HAND_MAX_YAW = (40 * Math.PI) / 180;

/** Maximum lateral tilt (leaning sideways) in radians (~25 degrees). */
const MAX_TILT = (25 * Math.PI) / 180;

/** Maximum forward shoulder carry for a fully crossed two-hand pose. */
const MAX_FORWARD_PITCH = (10 * Math.PI) / 180;

/** Half shoulder width for normalizing lateral offset */
const SHOULDER_HALF_WIDTH = 0.2;

/** Hand reach used to normalize single-hand yaw. A hand extended to this
 *  X-offset from body center drives the single-hand yaw to its max. */
const SINGLE_HAND_REACH = 0.5;

/** Identity quaternion reused across idle-branch returns. */
const IDENTITY_QUAT = new Quaternion();

/** How much cross-body tension contributes relative to lateral bias */
const CROSS_TENSION_WEIGHT = 0.5;

/** Hip counter-rotation as a fraction of the total upper-body twist.
 * Negative because hips rotate opposite to the upper body. */
const HIP_COUNTER_FRACTION = -0.20;

/**
 * How high (relative to body center) hands need to be before lateral
 * tilt kicks in. Below this, only yaw is applied. Above, tilt ramps
 * in proportionally. This prevents unnecessary leaning for waist-level
 * cross-body moves where yaw alone is sufficient.
 */
const TILT_HEIGHT_THRESHOLD = 0.25;

/** How strongly a behind-the-body hand drives yaw. 1.0 would treat a hand
 *  one full dead-zone-adjusted meter behind the plane as a max-yaw signal;
 *  0.8 keeps the blading present but subordinate to lateral crossing. */
const DEPTH_YAW_WEIGHT = 0.8;

/** Hands within this many meters of the body plane are treated as ON the
 *  plane. Wall-plane spinning hovers around zero depth; without a dead
 *  zone the depth term would jitter the torso on every frame. */
const DEPTH_DEAD_ZONE = 0.02;

/** Fallback body axes when no BodyFrame is supplied (unrotated rig). */
const DEFAULT_LATERAL = new Vector3(1, 0, 0);
const DEFAULT_FORWARD = new Vector3(0, 0, 1);

/**
 * Ideal distribution weights for the upper spine chain.
 * Weighted toward the upper back where shoulders attach.
 * These get redistributed at runtime if bones are missing.
 */
const IDEAL_WEIGHTS: Record<string, number> = {
  spine1: 0.25,
  spine2: 0.35,
  neck: 0.15,
  head: 0.25,
};

export class SpineTwister implements ISpineTwister {
  /** Scratch vector for lateral/depth offset math (avoids per-call allocation). */
  private readonly _offset = new Vector3();

  computeSpineTwist(
    leftHandTarget: Vector3 | null,
    rightHandTarget: Vector3 | null,
    bodyCenter: Vector3,
    availableBones?: Set<string>,
    bodyFrame?: BodyFrame
  ): SpineTwistResult {
    if (leftHandTarget && rightHandTarget) {
      return this.computeTwoHandedTwist(
        leftHandTarget,
        rightHandTarget,
        bodyCenter,
        availableBones,
        bodyFrame
      );
    }
    const presentHand = leftHandTarget ?? rightHandTarget;
    if (presentHand) {
      return this.computeSingleHandGaze(
        presentHand,
        bodyCenter,
        availableBones,
        bodyFrame
      );
    }
    return this.identityResult();
  }

  /** Signed lateral offset of a target from body center, in the body's own frame. */
  private lateralOf(
    target: Vector3,
    bodyCenter: Vector3,
    frame?: BodyFrame
  ): number {
    this._offset.subVectors(target, bodyCenter);
    return this._offset.dot(frame?.lateral ?? DEFAULT_LATERAL);
  }

  /** How far a target sits BEHIND the body plane (0 when at or in front of it). */
  private behindOf(
    target: Vector3,
    bodyCenter: Vector3,
    frame?: BodyFrame
  ): number {
    this._offset.subVectors(target, bodyCenter);
    const depth = this._offset.dot(frame?.forward ?? DEFAULT_FORWARD);
    return Math.max(0, -depth - DEPTH_DEAD_ZONE);
  }

  /**
   * Cross-body reach: torso leans toward the reaching direction, hips
   * counter-rotate for grounding, head tracks the average cross-body
   * pull. Height-gated lateral tilt keeps high cross-body reaches from
   * clipping arms through the head.
   */
  private computeTwoHandedTwist(
    leftHandTarget: Vector3,
    rightHandTarget: Vector3,
    bodyCenter: Vector3,
    availableBones?: Set<string>,
    bodyFrame?: BodyFrame
  ): SpineTwistResult {
    const leftX = this.lateralOf(leftHandTarget, bodyCenter, bodyFrame);
    const rightX = this.lateralOf(rightHandTarget, bodyCenter, bodyFrame);

    // --- YAW (Y-axis): torso turns toward crossing direction ---

    // Lateral bias: average X offset of both hands
    const lateralBias = (leftX + rightX) / 2;

    // Cross-body tension: how much each hand crosses its natural side
    // Left hand's natural side is -X, so crossing = positive X.
    // Right hand's natural side is +X, so crossing = negative X.
    const leftCross = Math.max(0, leftX);
    const rightCross = Math.max(0, -rightX);
    const directionalCross =
      (leftCross - rightCross) * CROSS_TENSION_WEIGHT;

    // Depth: a hand passing BEHIND the body plane pulls the same-side
    // shoulder back, which reads as the chest turning AWAY from that
    // hand's side. This is the blading a performer does to reach the
    // plane behind them without breaking grip. The sign comes from the
    // hand's lateral side (softened near center so a behind-center hand
    // doesn't flicker the torso), scaled by how far behind it sits.
    const leftBehind = this.behindOf(leftHandTarget, bodyCenter, bodyFrame);
    const rightBehind = this.behindOf(rightHandTarget, bodyCenter, bodyFrame);
    const softSign = (x: number) =>
      Math.max(-1, Math.min(1, x / (SHOULDER_HALF_WIDTH * 0.5)));
    const depthYawSignal =
      -(softSign(leftX) * leftBehind + softSign(rightX) * rightBehind) *
      DEPTH_YAW_WEIGHT;

    // Crossing with one hand turns the torso toward that hand. A symmetric
    // two-hand cross has no arbitrary left/right winner, so it stays centered
    // and uses forward pitch below to carry both shoulders toward the props.
    const yawSignal = lateralBias + directionalCross + depthYawSignal;

    // Normalize to [-1, 1] range
    const normalizedYaw = Math.max(-1, Math.min(1,
      yawSignal / SHOULDER_HALF_WIDTH
    ));

    const totalYaw = normalizedYaw * MAX_YAW;

    // --- LATERAL TILT (Z-axis): lean sideways for high cross-body reaches ---

    // Average hand height relative to body center
    const leftY = leftHandTarget.y - bodyCenter.y;
    const rightY = rightHandTarget.y - bodyCenter.y;
    const avgHeight = (leftY + rightY) / 2;

    // Tilt only kicks in when hands are above the threshold (shoulder-ish height)
    // and there's meaningful cross-body tension
    const heightFactor = Math.max(0, Math.min(1,
      (avgHeight - TILT_HEIGHT_THRESHOLD) / 0.3
    ));

    // Cross-body factor: 0 = hands on their natural sides, 1 = fully crossed
    const crossFactor = Math.max(0, Math.min(1,
      (leftCross + rightCross) / SHOULDER_HALF_WIDTH
    ));

    // Pull the upper body toward crossed targets before arm IK runs. This is
    // the local equivalent of a full-body IK chain pre-pull: the shoulders
    // contribute to the reach rather than leaving the two arm bones alone.
    const totalForwardPitch = crossFactor * MAX_FORWARD_PITCH;

    // Tilt direction matches the yaw direction (lean toward where you're reaching)
    const tiltSignal = Math.sign(normalizedYaw) * heightFactor * crossFactor;
    const totalTilt = tiltSignal * MAX_TILT;

    // Redistribute weights based on available bones
    const weights = this.redistributeWeights(availableBones);

    return {
      spine1: this.makeSpineRotation(totalYaw * (weights.spine1 ?? 0), totalTilt * (weights.spine1 ?? 0), totalForwardPitch * (weights.spine1 ?? 0)),
      spine2: this.makeSpineRotation(totalYaw * (weights.spine2 ?? 0), totalTilt * (weights.spine2 ?? 0), totalForwardPitch * (weights.spine2 ?? 0)),
      neck: this.makeSpineRotation(totalYaw * (weights.neck ?? 0), totalTilt * (weights.neck ?? 0), totalForwardPitch * (weights.neck ?? 0)),
      head: this.makeSpineRotation(totalYaw * (weights.head ?? 0), totalTilt * (weights.head ?? 0), totalForwardPitch * (weights.head ?? 0)),
      hips: this.makeSpineRotation(totalYaw * HIP_COUNTER_FRACTION, totalTilt * HIP_COUNTER_FRACTION * 0.5, 0),
    };
  }

  /**
   * Single-hand gaze: performer holds one prop and the other hand is
   * absent. Head and upper spine orient toward the present hand; no
   * tilt (no cross-body lean), no hip counter-rotation (gazing at a
   * held prop doesn't need a counter-balanced stance). Softer max
   * yaw than the two-hand case - this is look-at, not reach-across.
   */
  private computeSingleHandGaze(
    handTarget: Vector3,
    bodyCenter: Vector3,
    availableBones?: Set<string>,
    bodyFrame?: BodyFrame
  ): SpineTwistResult {
    const offsetX = this.lateralOf(handTarget, bodyCenter, bodyFrame);
    // A held prop passing behind the body still blades the chest away
    // from that side, even with no second hand in play.
    const behind = this.behindOf(handTarget, bodyCenter, bodyFrame);
    const softSign = Math.max(
      -1,
      Math.min(1, offsetX / (SHOULDER_HALF_WIDTH * 0.5))
    );
    const yawSignal = offsetX - softSign * behind * DEPTH_YAW_WEIGHT;
    const normalizedYaw = Math.max(
      -1,
      Math.min(1, yawSignal / SINGLE_HAND_REACH)
    );
    const totalYaw = normalizedYaw * SINGLE_HAND_MAX_YAW;

    const weights = this.redistributeWeights(availableBones);

    return {
      spine1: this.makeSpineRotation(totalYaw * (weights.spine1 ?? 0), 0),
      spine2: this.makeSpineRotation(totalYaw * (weights.spine2 ?? 0), 0),
      neck: this.makeSpineRotation(totalYaw * (weights.neck ?? 0), 0),
      head: this.makeSpineRotation(totalYaw * (weights.head ?? 0), 0),
      hips: new Quaternion(),
    };
  }

  /** No twist. Used when both hands are absent. */
  private identityResult(): SpineTwistResult {
    return {
      spine1: IDENTITY_QUAT.clone(),
      spine2: IDENTITY_QUAT.clone(),
      neck: IDENTITY_QUAT.clone(),
      head: IDENTITY_QUAT.clone(),
      hips: IDENTITY_QUAT.clone(),
    };
  }

  /**
   * If the model is missing bones, redistribute their weight proportionally
   * to the bones that exist. This way the total twist stays the same
   * regardless of how many spine bones the model has.
   */
  private redistributeWeights(
    availableBones?: Set<string>
  ): Record<string, number> {
    // If no bone info provided, assume all present
    if (!availableBones) return { ...IDEAL_WEIGHTS };

    const keys = Object.keys(IDEAL_WEIGHTS);
    // Map bone keys to the BoneName format used in the bone map
    const keyToBoneName: Record<string, string> = {
      spine1: "Spine1",
      spine2: "Spine2",
      neck: "Neck",
      head: "Head",
    };

    let presentTotal = 0;
    const present: string[] = [];

    for (const key of keys) {
      const boneName = keyToBoneName[key];
      if (boneName && availableBones.has(boneName)) {
        presentTotal += IDEAL_WEIGHTS[key] ?? 0;
        present.push(key);
      }
    }

    // Build redistributed weights: present bones get scaled up,
    // missing bones get 0
    const result: Record<string, number> = {};
    for (const key of keys) {
      if (present.includes(key) && presentTotal > 0) {
        result[key] = (IDEAL_WEIGHTS[key] ?? 0) / presentTotal;
      } else {
        result[key] = 0;
      }
    }

    return result;
  }

  /**
   * Create a quaternion combining Y-axis yaw and Z-axis lateral tilt.
   * Order matters: tilt first (local Z), then yaw (local Y).
   */
  private makeSpineRotation(
    yaw: number,
    tilt: number,
    forwardPitch: number = 0
  ): Quaternion {
    const q = new Quaternion();
    if (
      Math.abs(yaw) < 0.0001 &&
      Math.abs(tilt) < 0.0001 &&
      Math.abs(forwardPitch) < 0.0001
    ) return q;
    // Euler order YZX: yaw, lateral tilt, then forward pitch.
    const euler = new Euler(forwardPitch, yaw, tilt, "YZX");
    q.setFromEuler(euler);
    return q;
  }
}
