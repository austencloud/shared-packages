/**
 * AvatarAnimator
 *
 * Manages avatar pose states and smooth animation blending.
 * Bridges TKA prop states to skeleton IK targets.
 */

import { Vector3, Quaternion, Matrix4 } from "three";
import type { Bone } from "three";
import type {
  IAvatarAnimator,
  HandPose,
  BodyPose,
  AnimationLayer,
  TransitionConfig,
  PositionOffset,
  PropOrientations,
} from "../contracts/IAvatarAnimator";
import type { IIKSolver, IKTarget } from "../contracts/IIKSolver";
import type {
  IAvatarSkeletonBuilder,
  BoneName,
  BoneChain,
  SkeletonState,
} from "../contracts/IAvatarSkeletonBuilder";
import type { PropState3D } from "../../domain/models/PropState3D";
import type { IElbowPoleComputer } from "../contracts/IElbowPoleComputer";
import type { IClavicleRaiser } from "../contracts/IClavicleRaiser";
import type { ISpineTwister, BodyFrame } from "../contracts/ISpineTwister";
import type { FingerBoneName } from "../../domain/models/GripPose";

/** Max wrist swing toward the staff axis. Beyond this the alignment is
 *  anatomically implausible - bend partway and let the rest read as strain. */
const MAX_WRIST_SWING = (55 * Math.PI) / 180;

/** Per-frame smoothing for the wrist alignment (higher = snappier). */
const WRIST_SMOOTHING = 0.25;

/** Palm center sits this fraction of the way from the wrist joint to the
 *  Middle1 knuckle - the spot a staff shaft actually crosses the hand. */
const PALM_CENTER_FRACTION = 0.65;

/** Reach deficits (meters) below this don't trigger escalation. */
const REACH_EPSILON = 0.015;

/** Deficit (meters) at which clavicle reach-extension saturates. */
const REACH_FULL_DEFICIT = 0.1;

/** Max clavicle reach-extension swing (protraction toward the target). */
const MAX_REACH_EXT = (12 * Math.PI) / 180;

/** Max spine lean toward an unreachable target. */
const MAX_REACH_LEAN = (10 * Math.PI) / 180;

/** Radians of spine lean per meter of reach deficit. */
const REACH_LEAN_GAIN = 1.2;

/** Stance yaw input clamp (~matches the thoracic+cervical twist budget). */
const MAX_STANCE_YAW = (60 * Math.PI) / 180;

const WORLD_UP = new Vector3(0, 1, 0);

export class AvatarAnimator implements IAvatarAnimator {
  private currentPose: BodyPose;
  private targetPose: BodyPose;
  private layers: Map<string, AnimationLayer> = new Map();

  // Per-arm IK blend weights: 0 = animation drives the arm, 1 = IK drives the arm
  private leftArmIK = { weight: 0, targetWeight: 0 };
  private rightArmIK = { weight: 0, targetWeight: 0 };
  private ikBlendSpeed = 1 / 0.3; // ~0.3s ramp time
  private smoothBlending = true;
  private smoothingFactor = 0.15; // 0-1, higher = smoother but laggier
  private transitioning = false;
  private transitionStart: BodyPose | null = null;
  private transitionEnd: BodyPose | null = null;
  private transitionProgress = 0;
  private transitionConfig: TransitionConfig | null = null;
  private poleComputer: IElbowPoleComputer | null;
  private leftPoleVector = new Vector3(0, 0, 1);
  private rightPoleVector = new Vector3(0, 0, 1);
  private _poleVectorsEnabled = true;

  private clavicleRaiser: IClavicleRaiser | null;
  private leftClavicleQuat = new Quaternion();
  private rightClavicleQuat = new Quaternion();
  // The bone's original rest quaternion - we COMPOSE with this, never replace it
  private leftClavicleRestQuat = new Quaternion();
  private rightClavicleRestQuat = new Quaternion();
  private _clavicleRaiseEnabled = true;
  // Cached shoulder rest Y positions - captured once when skeleton loads.
  // Must NOT be read per-frame after clavicle rotation, or the elevated
  // position feeds back into the next frame and causes oscillation.
  private leftShoulderRestY = 0;
  private rightShoulderRestY = 0;
  private shoulderRestCached = false;
  private spineTwister: ISpineTwister | null;
  private spineTwistQuats = {
    spine1: new Quaternion(),
    spine2: new Quaternion(),
    neck: new Quaternion(),
    head: new Quaternion(),
    hips: new Quaternion(),
  };
  private spineTwistRestQuats = {
    spine1: new Quaternion(),
    spine2: new Quaternion(),
    neck: new Quaternion(),
    head: new Quaternion(),
    hips: new Quaternion(),
    leftUpLeg: new Quaternion(),
    rightUpLeg: new Quaternion(),
  };
  private _spineTwistEnabled = true;
  /** When true, skip SpineTwister's Hips counter-rotation so planted legs don't slide. */
  private _skipHipsTwist = false;
  private spineRestCached = false;
  /** Which spine/head bones the model actually has - used for weight redistribution */
  private availableSpineBones = new Set<string>();

  /**
   * Extra forward pitch (radians) applied to Spine1 each frame. Composed
   * on top of the twist rest pose before arm IK runs. 0 = disabled.
   */
  private externalSpinePitchRad = 0;

  // --- Wrist orientation goal + palm socket (grip geometry) ---
  // Hand-local grip geometry calibrated once from the finger chains: the
  // Index1->Pinky1 knuckle line is the axis a staff shaft crosses the palm
  // along, and the palm center sits partway to the Middle1 knuckle. MCP
  // bone ORIGINS don't move when fingers curl, so this is pose-invariant.
  private leftGripAxisLocal: Vector3 | null = null;
  private rightGripAxisLocal: Vector3 | null = null;
  private leftPalmLocal: Vector3 | null = null;
  private rightPalmLocal: Vector3 | null = null;
  private gripCalibrated = false;
  // Smoothed wrist local quaternions - persistent so a staff-axis sign
  // flip reads as a natural regrasp instead of an instant 180 snap.
  private leftWristQuat = new Quaternion();
  private rightWristQuat = new Quaternion();
  private leftWristInit = false;
  private rightWristInit = false;

  // --- Stance yaw input track (planner-shaped facing/stance input) ---
  private stanceYawTargetRad = 0;
  private stanceYawSmoothedRad = 0;

  // --- Reach-deficit escalation ---
  // Clavicle reach-extension: smoothed local-delta quats premultiplied
  // onto the (rest x raise) clavicle pose when the two-bone solve can't
  // reach. Decays to identity once the target is reachable again.
  private leftReachExtQuat = new Quaternion();
  private rightReachExtQuat = new Quaternion();
  // Spine lean toward the deficit: measured during this frame's arm
  // solves, applied at the top of the NEXT frame (the one-frame latency
  // plus smoothing reads as leaning into the reach).
  private reachLeanDirSmoothed = new Vector3(0, 0, 1);
  private reachLeanAngleSmoothed = 0;
  private readonly _frameLeanVec = new Vector3();

  // The body's own horizontal axes in world space (from the skeleton
  // root), so spine twist and depth terms survive rig yaw.
  private readonly _bodyFrame: BodyFrame = {
    lateral: new Vector3(1, 0, 0),
    forward: new Vector3(0, 0, 1),
  };

  // Scratch objects for per-frame math (no allocation in the hot path)
  private readonly _v1 = new Vector3();
  private readonly _v2 = new Vector3();
  private readonly _v3 = new Vector3();
  private readonly _q1 = new Quaternion();
  private readonly _q2 = new Quaternion();
  private readonly _q3 = new Quaternion();
  private readonly _q4 = new Quaternion();
  private readonly _m1 = new Matrix4();
  private readonly _socketTargetLeft = new Vector3();
  private readonly _socketTargetRight = new Vector3();
  private static readonly _clampScratch = new Quaternion();

  /** Scale a unit quaternion's rotation down to maxAngle if it exceeds it. */
  private static clampQuatAngle(q: Quaternion, maxAngle: number): void {
    const angle = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
    if (angle <= maxAngle || angle < 1e-6) return;
    AvatarAnimator._clampScratch.identity().slerp(q, maxAngle / angle);
    q.copy(AvatarAnimator._clampScratch);
  }

  constructor(
    private ikSolver: IIKSolver,
    private skeleton: IAvatarSkeletonBuilder,
    poleComputer?: IElbowPoleComputer,
    clavicleRaiser?: IClavicleRaiser,
    spineTwister?: ISpineTwister
  ) {
    this.poleComputer = poleComputer ?? null;
    this.clavicleRaiser = clavicleRaiser ?? null;
    this.spineTwister = spineTwister ?? null;

    // Default pose: no props in either hand. Hands become non-null once
    // setPropsAndBlend / setHandTargetsFromProps is called with a prop.
    this.currentPose = {
      leftHand: null,
      rightHand: null,
      timestamp: Date.now(),
    };
    this.targetPose = {
      leftHand: null,
      rightHand: null,
      timestamp: Date.now(),
    };
  }

  /** Deep-clone a HandPose, preserving null. */
  private static cloneHandPose(p: HandPose | null): HandPose | null {
    if (!p) return null;
    return {
      targetPosition: p.targetPosition.clone(),
      wristRotation: p.wristRotation?.clone(),
      staffAngle: p.staffAngle,
      gripType: p.gripType,
      plane: p.plane,
      weight: p.weight,
    };
  }

  /** Deep-clone a BodyPose (nullable hands, cloned Vector3s). */
  private static cloneBodyPose(p: BodyPose): BodyPose {
    return {
      leftHand: AvatarAnimator.cloneHandPose(p.leftHand),
      rightHand: AvatarAnimator.cloneHandPose(p.rightHand),
      headLookAt: p.headLookAt?.clone(),
      rootOffset: p.rootOffset?.clone(),
      timestamp: p.timestamp,
    };
  }

  setHandTargetsFromProps(
    blueProp: PropState3D | null,
    redProp: PropState3D | null,
    offset?: PositionOffset
  ): void {
    // Hand mapping:
    // - Blue prop = performer's LEFT hand = skeleton's LeftHand bone
    // - Red prop = performer's RIGHT hand = skeleton's RightHand bone
    //
    // From viewer's perspective (looking at performer facing us):
    // - Skeleton's LeftHand appears on screen RIGHT (+X)
    // - Skeleton's RightHand appears on screen LEFT (-X)
    //
    // offset converts world positions to local (skeleton) coordinates
    const ox = offset?.x ?? 0;
    const oy = offset?.y ?? 0;
    const oz = offset?.z ?? 0;

    // Blue prop → performer's left hand → skeleton's LeftHand
    // Red prop → performer's right hand → skeleton's RightHand
    // When a prop is absent, the hand becomes null so body systems know
    // not to read a stale position.
    this.targetPose.leftHand = blueProp
      ? {
          targetPosition: new Vector3(
            blueProp.worldPosition.x - ox,
            blueProp.worldPosition.y - oy,
            blueProp.worldPosition.z - oz
          ),
          plane: blueProp.plane,
          weight: 1,
        }
      : null;

    this.targetPose.rightHand = redProp
      ? {
          targetPosition: new Vector3(
            redProp.worldPosition.x - ox,
            redProp.worldPosition.y - oy,
            redProp.worldPosition.z - oz
          ),
          plane: redProp.plane,
          weight: 1,
        }
      : null;

    this.targetPose.timestamp = Date.now();
  }

  setPropsAndBlend(
    blueProp: PropState3D | null,
    redProp: PropState3D | null,
    offset?: PositionOffset,
    orientations?: PropOrientations
  ): void {
    this.leftArmIK.targetWeight = blueProp ? 1 : 0;
    this.rightArmIK.targetWeight = redProp ? 1 : 0;

    const ox = offset?.x ?? 0;
    const oy = offset?.y ?? 0;
    const oz = offset?.z ?? 0;

    // When a prop is absent, the hand becomes null so downstream systems
    // (spine twist, clavicle, pole vectors, IK) skip the side uniformly
    // instead of reading stale positions from a prior frame.
    this.targetPose.leftHand = blueProp
      ? {
          targetPosition: new Vector3(
            blueProp.worldPosition.x - ox,
            blueProp.worldPosition.y - oy,
            blueProp.worldPosition.z - oz
          ),
          wristRotation: orientations?.blue?.clone(),
          staffAngle: blueProp.staffRotationAngle,
          plane: blueProp.plane,
          weight: 1,
        }
      : null;

    this.targetPose.rightHand = redProp
      ? {
          targetPosition: new Vector3(
            redProp.worldPosition.x - ox,
            redProp.worldPosition.y - oy,
            redProp.worldPosition.z - oz
          ),
          wristRotation: orientations?.red?.clone(),
          staffAngle: redProp.staffRotationAngle,
          plane: redProp.plane,
          weight: 1,
        }
      : null;

    this.targetPose.timestamp = Date.now();
  }

  setStanceYaw(radians: number): void {
    this.stanceYawTargetRad = Math.max(
      -MAX_STANCE_YAW,
      Math.min(MAX_STANCE_YAW, radians)
    );
  }

  getPalmWorldPoint(side: "left" | "right", out: Vector3): Vector3 | null {
    const palmLocal = side === "left" ? this.leftPalmLocal : this.rightPalmLocal;
    const chain =
      side === "left"
        ? this.skeleton.getLeftArmChain()
        : this.skeleton.getRightArmChain();
    if (!palmLocal || !chain) return null;
    out.copy(palmLocal);
    chain.effector.localToWorld(out);
    return out;
  }

  setLeftHandTarget(target: HandPose): void {
    this.targetPose.leftHand = { ...target };
    this.targetPose.timestamp = Date.now();
  }

  setRightHandTarget(target: HandPose): void {
    this.targetPose.rightHand = { ...target };
    this.targetPose.timestamp = Date.now();
  }

  getCurrentPose(): BodyPose {
    return this.currentPose;
  }

  update(deltaTime: number): void {
    // Ramp per-arm IK blend weights (framerate-independent exponential lerp)
    const blendFactor = 1 - Math.exp(-this.ikBlendSpeed * deltaTime);
    this.leftArmIK.weight += (this.leftArmIK.targetWeight - this.leftArmIK.weight) * blendFactor;
    this.rightArmIK.weight += (this.rightArmIK.targetWeight - this.rightArmIK.weight) * blendFactor;

    if (this.transitioning) {
      this.updateTransition(deltaTime);
    } else if (this.smoothBlending) {
      this.blendToTarget(deltaTime);
    } else {
      this.currentPose = { ...this.targetPose };
    }

    // Apply combined layers
    const finalPose = this.computeFinalPose();

    // Solve IK for arms
    this.applyIKToSkeleton(finalPose);
  }

  private blendToTarget(_deltaTime: number): void {
    // Hands snap directly to prop positions - no lerp.
    // This keeps the wrist bones strictly locked to the grid prop location
    // so they never visually detach. Body systems (clavicle, spine twist,
    // pole vectors) still use smoothingFactor for natural motion.
    this.currentPose.leftHand = AvatarAnimator.cloneHandPose(
      this.targetPose.leftHand
    );
    this.currentPose.rightHand = AvatarAnimator.cloneHandPose(
      this.targetPose.rightHand
    );
    this.currentPose.timestamp = Date.now();
  }

  private updateTransition(deltaTime: number): void {
    if (
      !this.transitionConfig ||
      !this.transitionStart ||
      !this.transitionEnd
    ) {
      return;
    }

    this.transitionProgress += deltaTime / this.transitionConfig.duration;

    if (this.transitionProgress >= 1) {
      this.transitionProgress = 1;
      this.transitioning = false;
      this.currentPose = AvatarAnimator.cloneBodyPose(this.transitionEnd);
      return;
    }

    // Apply easing
    const t = this.applyEasing(
      this.transitionProgress,
      this.transitionConfig.easing
    );

    // Interpolate pose hands per side. When either endpoint is null on a
    // side we cannot lerp, so snap to the end's nullability - a hand that
    // appears mid-transition pops in at t=0 and one that vanishes drops
    // out at t=0. In practice transition targets come from set-piece
    // authoring where both hands are consistently present or absent.
    this.currentPose.leftHand = this.lerpHand(
      this.transitionStart.leftHand,
      this.transitionEnd.leftHand,
      t
    );
    this.currentPose.rightHand = this.lerpHand(
      this.transitionStart.rightHand,
      this.transitionEnd.rightHand,
      t
    );

    this.currentPose.timestamp = Date.now();
  }

  private lerpHand(
    start: HandPose | null,
    end: HandPose | null,
    t: number
  ): HandPose | null {
    if (!start || !end) return AvatarAnimator.cloneHandPose(end);
    return {
      targetPosition: new Vector3().lerpVectors(
        start.targetPosition,
        end.targetPosition,
        t
      ),
      wristRotation: end.wristRotation?.clone(),
      staffAngle: end.staffAngle,
      gripType: end.gripType,
      plane: end.plane,
      weight: start.weight + (end.weight - start.weight) * t,
    };
  }

  private applyEasing(t: number, easing: TransitionConfig["easing"]): number {
    switch (easing) {
      case "easeIn":
        return t * t;
      case "easeOut":
        return 1 - (1 - t) * (1 - t);
      case "easeInOut":
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      default:
        return t;
    }
  }

  private computeFinalPose(): BodyPose {
    const result = AvatarAnimator.cloneBodyPose(this.currentPose);

    // Apply layers. A layer can only influence a hand that's present in
    // both the current pose and the layer's pose - there's nothing to
    // lerp toward or from when one side is null.
    for (const layer of this.layers.values()) {
      if (layer.weight <= 0) continue;

      if (result.leftHand && layer.pose.leftHand) {
        result.leftHand.targetPosition.lerp(
          layer.pose.leftHand.targetPosition,
          layer.weight
        );
      }
      if (result.rightHand && layer.pose.rightHand) {
        result.rightHand.targetPosition.lerp(
          layer.pose.rightHand.targetPosition,
          layer.weight
        );
      }
    }

    return result;
  }

  private applyIKToSkeleton(pose: BodyPose): void {
    const state = this.skeleton.getState();
    if (!state.isLoaded) return;

    const leftChain = this.skeleton.getLeftArmChain();
    const rightChain = this.skeleton.getRightArmChain();

    // Reach deficits accumulate here during the arm solves, then fold
    // into the smoothed spine-lean state at the end of the frame.
    this._frameLeanVec.set(0, 0, 0);

    // One-time grip geometry calibration (knuckle line + palm center).
    if (!this.gripCalibrated) {
      this.calibrateGrips(state);
    }

    // Compute body center from Hips bone (or default to origin)
    const bodyCenter = new Vector3(0, 0, 0);
    const hipsBone = state.bones.get("Hips");
    if (hipsBone) {
      hipsBone.getWorldPosition(bodyCenter);
    }

    // The body's own horizontal axes, from the skeleton root's world
    // orientation. Rig yaw lives OUTSIDE the avatar (PerformerRig rotates
    // the wrapper group), so raw world X/Z comparisons break as soon as
    // the rig faces anywhere but the audience. The root is never modified
    // by IK, so this can't feed back.
    if (state.root) {
      state.root.getWorldQuaternion(this._q1);
      this._bodyFrame.lateral.set(1, 0, 0).applyQuaternion(this._q1);
      this._bodyFrame.lateral.y = 0;
      this._bodyFrame.forward.set(0, 0, 1).applyQuaternion(this._q1);
      this._bodyFrame.forward.y = 0;
      if (
        this._bodyFrame.lateral.lengthSq() > 1e-6 &&
        this._bodyFrame.forward.lengthSq() > 1e-6
      ) {
        this._bodyFrame.lateral.normalize();
        this._bodyFrame.forward.normalize();
      } else {
        // Degenerate (root pitched ~90 deg): fall back to world axes.
        this._bodyFrame.lateral.set(1, 0, 0);
        this._bodyFrame.forward.set(0, 0, 1);
      }
    }

    // Cache shoulder rest Y positions once (before any clavicle rotation has been applied).
    // CRITICAL: Do NOT read these per-frame after clavicle is rotated - the elevated
    // position feeds back and causes oscillation.
    if (!this.shoulderRestCached && leftChain && rightChain) {
      const leftRoot = new Vector3();
      const rightRoot = new Vector3();
      leftChain.root.getWorldPosition(leftRoot);
      rightChain.root.getWorldPosition(rightRoot);
      this.leftShoulderRestY = leftRoot.y;
      this.rightShoulderRestY = rightRoot.y;
      // Cache the bone's original rest quaternions so we can compose with them
      // instead of overwriting them (which would destroy the shoulder's outward position)
      const leftClav = state.bones.get("LeftShoulder");
      const rightClav = state.bones.get("RightShoulder");
      if (leftClav) this.leftClavicleRestQuat.copy(leftClav.quaternion);
      if (rightClav) this.rightClavicleRestQuat.copy(rightClav.quaternion);
      this.shoulderRestCached = true;
    }

    // Cache spine bone rest quaternions once - COMPOSE with these, never replace.
    // Works with whatever bones are available (some models lack Spine2/upper_chest).
    if (!this.spineRestCached) {
      let anyFound = false;
      const cacheSpineBone = (boneName: BoneName, key: "spine1" | "spine2" | "neck" | "head" | "hips") => {
        const bone = state.bones.get(boneName);
        if (bone) {
          this.spineTwistRestQuats[key].copy(bone.quaternion);
          if (key !== "hips") this.availableSpineBones.add(boneName);
          anyFound = true;
        }
      };
      cacheSpineBone("Spine1", "spine1");
      cacheSpineBone("Spine2", "spine2");
      cacheSpineBone("Neck", "neck");
      cacheSpineBone("Head", "head");
      cacheSpineBone("Hips", "hips");
      if (anyFound) this.spineRestCached = true;
    }

    // Spine twist: rotate torso toward cross-body hand positions.
    // Each bone gets its own weighted fraction of the twist, distributed
    // anatomically up the chain. Hips counter-rotate for grounding.
    // Scale twist by max IK weight so it fades out when both arms are in animation mode.
    const maxIKWeight = Math.max(this.leftArmIK.weight, this.rightArmIK.weight);

    if (this._spineTwistEnabled && this.spineTwister && this.spineRestCached && maxIKWeight > 0.001) {
      // Nullable hands are first-class: SpineTwister handles the
      // single-hand-gaze branch and the no-hand identity branch
      // internally, so we pass pose hands through as-is.
      const twistResult = this.spineTwister.computeSpineTwist(
        pose.leftHand?.targetPosition ?? null,
        pose.rightHand?.targetPosition ?? null,
        bodyCenter,
        this.availableSpineBones,
        this._bodyFrame
      );

      // Apply twist to each bone individually for a natural spinal curve.
      // Each bone gets its own weighted quaternion from SpineTwister.
      const applySpineTwist = (
        boneName: BoneName,
        key: "spine1" | "spine2" | "neck" | "head" | "hips",
        twistQuat: Quaternion
      ) => {
        const bone = state.bones.get(boneName);
        if (!bone) return;

        // Scale from identity toward full twist based on max IK weight
        const scaledTwist = new Quaternion().slerp(twistQuat, maxIKWeight);
        this.spineTwistQuats[key].slerp(scaledTwist, this.smoothingFactor);
        bone.quaternion
          .copy(this.spineTwistRestQuats[key])
          .multiply(this.spineTwistQuats[key]);
      };

      applySpineTwist("Spine1", "spine1", twistResult.spine1);
      applySpineTwist("Spine2", "spine2", twistResult.spine2);
      applySpineTwist("Neck", "neck", twistResult.neck);
      applySpineTwist("Head", "head", twistResult.head);
      // Skip Hips counter-rotation for exhibit performers - when leg bones
      // are stripped for foot planting, hip yaw cascades to the feet and
      // makes them slide on the ground.
      if (!this._skipHipsTwist) {
        applySpineTwist("Hips", "hips", twistResult.hips);
      }

      // Update world matrices after all spine bones are adjusted,
      // so IK solves against the twisted skeleton
      const hipsBoneForUpdate = state.bones.get("Hips");
      if (hipsBoneForUpdate) hipsBoneForUpdate.updateMatrixWorld(true);
    }

    // External spine pitch: optional extra forward lean applied to Spine1.
    // Runs whether or not spine twist is enabled so lean-forward stances
    // work in both modes. Composed ON TOP of whatever the twist block set
    // (or the rest pose, if twist didn't run). Applied BEFORE arm IK so
    // the arms solve against the leaned-forward shoulders.
    if (Math.abs(this.externalSpinePitchRad) > 0.0001 && this.spineRestCached) {
      const spine1Bone = state.bones.get("Spine1");
      if (spine1Bone) {
        // If the twist block didn't run this frame, reset spine1 to its
        // cached rest quat before applying pitch so we don't accumulate
        // from the previous frame's rotation.
        const twistRan =
          this._spineTwistEnabled &&
          this.spineTwister !== null &&
          maxIKWeight > 0.001;
        if (!twistRan) {
          spine1Bone.quaternion.copy(this.spineTwistRestQuats.spine1);
        }
        const pitchQuat = new Quaternion().setFromAxisAngle(
          new Vector3(1, 0, 0),
          this.externalSpinePitchRad
        );
        spine1Bone.quaternion.multiply(pitchQuat);
        const hipsBoneForUpdate = state.bones.get("Hips");
        if (hipsBoneForUpdate) hipsBoneForUpdate.updateMatrixWorld(true);
      }
    }

    // Stance yaw + reach lean: sustained torso adjustments composed after
    // twist/pitch and before arm IK, so the arms solve against the
    // adjusted torso. Stance yaw is the planner-shaped facing input
    // track; reach lean is last frame's measured deficit pulling the
    // upper body toward an out-of-reach target. Neither touches the
    // hips, so the feet never slide.
    this.stanceYawSmoothedRad +=
      (this.stanceYawTargetRad - this.stanceYawSmoothedRad) *
      this.smoothingFactor;
    const stanceActive = Math.abs(this.stanceYawSmoothedRad) > 0.001;
    const leanActive = this.reachLeanAngleSmoothed > 0.001;
    if ((stanceActive || leanActive) && this.spineRestCached) {
      const spine1Bone = state.bones.get("Spine1");
      const spine2Bone = state.bones.get("Spine2");
      // Rebase any spine bone nothing else wrote this frame, so these
      // multiplications never accumulate across frames.
      const twistRan =
        this._spineTwistEnabled &&
        this.spineTwister !== null &&
        maxIKWeight > 0.001;
      const pitchRan = Math.abs(this.externalSpinePitchRad) > 0.0001;
      if (!twistRan) {
        if (spine1Bone && !pitchRan) {
          spine1Bone.quaternion.copy(this.spineTwistRestQuats.spine1);
        }
        if (spine2Bone) {
          spine2Bone.quaternion.copy(this.spineTwistRestQuats.spine2);
        }
      }
      if (stanceActive) {
        // Local-Y yaw split across the two spine bones (blading, not a
        // whole-body turn). Models lacking Spine2 get a softer stance -
        // acceptable, since the clamp already bounds the total.
        if (spine1Bone) {
          this._q1.setFromAxisAngle(
            this._v1.set(0, 1, 0),
            this.stanceYawSmoothedRad * 0.45
          );
          spine1Bone.quaternion.multiply(this._q1);
        }
        if (spine2Bone) {
          this._q1.setFromAxisAngle(
            this._v1.set(0, 1, 0),
            this.stanceYawSmoothedRad * 0.55
          );
          spine2Bone.quaternion.multiply(this._q1);
        }
      }
      if (leanActive) {
        // Tilt the upper body toward the (horizontalized) deficit
        // direction: rotate about the axis perpendicular to it.
        this._v1.copy(this.reachLeanDirSmoothed);
        this._v1.y = 0;
        if (this._v1.lengthSq() > 1e-6) {
          this._v1.normalize();
          this._v2.crossVectors(WORLD_UP, this._v1).normalize();
          const applyLean = (bone: Bone | undefined, fraction: number) => {
            if (!bone || !bone.parent) return;
            this._q1.setFromAxisAngle(
              this._v2,
              this.reachLeanAngleSmoothed * fraction
            );
            // World-frame delta -> bone-local delta by conjugation.
            bone.parent.getWorldQuaternion(this._q2);
            this._q3
              .copy(this._q2)
              .invert()
              .multiply(this._q1)
              .multiply(this._q2);
            bone.quaternion.premultiply(this._q3);
          };
          applyLean(spine1Bone, 0.45);
          applyLean(spine2Bone, 0.55);
        }
      }
      const hipsBoneForUpdate = state.bones.get("Hips");
      if (hipsBoneForUpdate) hipsBoneForUpdate.updateMatrixWorld(true);
    }

    const leftHand = pose.leftHand;
    const rightHand = pose.rightHand;

    if (leftChain && leftHand) {
      if (this.leftArmIK.weight > 0.001) {
        // Save what the locomotion animation wrote to bone quaternions
        const animRootQuat = leftChain.root.quaternion.clone();
        const animMiddleQuat = leftChain.middle.quaternion.clone();
        const animEffectorQuat = leftChain.effector.quaternion.clone();

        // Clavicle raise: elevate shoulder bone before IK solve
        if (this._clavicleRaiseEnabled && this.clavicleRaiser && this.shoulderRestCached) {
          const leftShoulder = state.bones.get("LeftShoulder");
          if (leftShoulder) {
            const targetQuat = this.clavicleRaiser.computeClavicleRotation(
              leftHand.targetPosition,
              "left",
              this.leftShoulderRestY,
              leftChain.totalLength
            );
            this.leftClavicleQuat.slerp(targetQuat, this.smoothingFactor);
            leftShoulder.quaternion
              .copy(this.leftClavicleRestQuat)
              .multiply(this.leftClavicleQuat);
            leftShoulder.updateMatrixWorld(true);
          }
        }

        // Palm socket: aim the IK effector so the PALM lands on the grip
        // point, not the wrist joint (which sits a few cm proximal).
        const leftTarget = this.computeSocketTarget(
          "left",
          leftChain,
          leftHand.targetPosition
        );

        // Build IK target with optional pole vector
        const target: IKTarget = {
          position: leftTarget,
          weight: leftHand.weight,
        };

        if (this._poleVectorsEnabled && this.poleComputer && leftHand.plane) {
          const idealPole = this.poleComputer.computePoleVector(
            leftTarget,
            leftHand.plane,
            "left",
            bodyCenter
          );
          this.leftPoleVector.lerp(idealPole, this.smoothingFactor);
          this.leftPoleVector.normalize();
          target.poleHint = this.leftPoleVector.clone();
        }

        // Reach escalation: if the target is beyond the chain, extend the
        // clavicle toward it and record the deficit for the spine lean.
        this.applyReachEscalation("left", leftChain, target, state);

        // Solve IK (overwrites bone quaternions)
        this.ikSolver.solveAndApply(leftChain, target);

        // Save IK results BEFORE blending - .copy() would overwrite them
        const ikRootQuat = leftChain.root.quaternion.clone();
        const ikMiddleQuat = leftChain.middle.quaternion.clone();
        const ikEffectorQuat = leftChain.effector.quaternion.clone();

        // Blend: slerp each bone from animation pose toward IK solution
        const w = this.leftArmIK.weight;
        leftChain.root.quaternion.copy(animRootQuat).slerp(ikRootQuat, w);
        leftChain.middle.quaternion.copy(animMiddleQuat).slerp(ikMiddleQuat, w);
        leftChain.effector.quaternion.copy(animEffectorQuat).slerp(ikEffectorQuat, w);

        // Wrist orientation: align the knuckle line with the staff axis
        this.applyWristOrientation("left", leftChain, leftHand, w);
      }
      // else: weight ~0, skip IK entirely - animation drives the arm
    }

    if (rightChain && rightHand) {
      if (this.rightArmIK.weight > 0.001) {
        // Save what the locomotion animation wrote to bone quaternions
        const animRootQuat = rightChain.root.quaternion.clone();
        const animMiddleQuat = rightChain.middle.quaternion.clone();
        const animEffectorQuat = rightChain.effector.quaternion.clone();

        // Clavicle raise: elevate shoulder bone before IK solve
        if (this._clavicleRaiseEnabled && this.clavicleRaiser && this.shoulderRestCached) {
          const rightShoulder = state.bones.get("RightShoulder");
          if (rightShoulder) {
            const targetQuat = this.clavicleRaiser.computeClavicleRotation(
              rightHand.targetPosition,
              "right",
              this.rightShoulderRestY,
              rightChain.totalLength
            );
            this.rightClavicleQuat.slerp(targetQuat, this.smoothingFactor);
            rightShoulder.quaternion
              .copy(this.rightClavicleRestQuat)
              .multiply(this.rightClavicleQuat);
            rightShoulder.updateMatrixWorld(true);
          }
        }

        // Palm socket: aim the IK effector so the PALM lands on the grip
        // point, not the wrist joint (which sits a few cm proximal).
        const rightTarget = this.computeSocketTarget(
          "right",
          rightChain,
          rightHand.targetPosition
        );

        // Build IK target with optional pole vector
        const target: IKTarget = {
          position: rightTarget,
          weight: rightHand.weight,
        };

        if (this._poleVectorsEnabled && this.poleComputer && rightHand.plane) {
          const idealPole = this.poleComputer.computePoleVector(
            rightTarget,
            rightHand.plane,
            "right",
            bodyCenter
          );
          this.rightPoleVector.lerp(idealPole, this.smoothingFactor);
          this.rightPoleVector.normalize();
          target.poleHint = this.rightPoleVector.clone();
        }

        // Reach escalation: if the target is beyond the chain, extend the
        // clavicle toward it and record the deficit for the spine lean.
        this.applyReachEscalation("right", rightChain, target, state);

        // Solve IK (overwrites bone quaternions)
        this.ikSolver.solveAndApply(rightChain, target);

        // Save IK results BEFORE blending - .copy() would overwrite them
        const ikRootQuat = rightChain.root.quaternion.clone();
        const ikMiddleQuat = rightChain.middle.quaternion.clone();
        const ikEffectorQuat = rightChain.effector.quaternion.clone();

        // Blend: slerp each bone from animation pose toward IK solution
        const w = this.rightArmIK.weight;
        rightChain.root.quaternion.copy(animRootQuat).slerp(ikRootQuat, w);
        rightChain.middle.quaternion.copy(animMiddleQuat).slerp(ikMiddleQuat, w);
        rightChain.effector.quaternion.copy(animEffectorQuat).slerp(ikEffectorQuat, w);

        // Wrist orientation: align the knuckle line with the staff axis
        this.applyWristOrientation("right", rightChain, rightHand, w);
      }
      // else: weight ~0, skip IK entirely - animation drives the arm
    }

    // Fold this frame's accumulated reach deficits into the smoothed lean
    // state that NEXT frame's extras block applies. One frame of latency,
    // but the exponential smoothing makes the loop converge instead of
    // oscillate (the deficit shrinks as the lean grows).
    const leanMag = this._frameLeanVec.length();
    const leanTargetAngle =
      leanMag > 1e-4 ? Math.min(MAX_REACH_LEAN, leanMag * REACH_LEAN_GAIN) : 0;
    if (leanMag > 1e-4) {
      this._v1.copy(this._frameLeanVec).normalize();
      this.reachLeanDirSmoothed.lerp(this._v1, this.smoothingFactor).normalize();
    }
    this.reachLeanAngleSmoothed +=
      (leanTargetAngle - this.reachLeanAngleSmoothed) * this.smoothingFactor;

    this.skeleton.updateMatrices();
  }

  /**
   * Calibrate hand-local grip geometry from the finger chains, once.
   * The Index1->Pinky1 MCP knuckle line is the axis a staff shaft lies
   * along when gripped; the palm center sits partway toward the Middle1
   * knuckle. Bone ORIGINS are invariant to finger curls, so this never
   * needs recalibrating.
   */
  private calibrateGrips(state: SkeletonState): void {
    const leftChain = this.skeleton.getLeftArmChain();
    const rightChain = this.skeleton.getRightArmChain();
    if (!leftChain || !rightChain) return; // retry next frame

    const chains = state.fingerChains;
    if (!chains) {
      // Model has no finger bones - wrist goal and palm socket stay
      // disabled, but don't retry every frame.
      this.gripCalibrated = true;
      return;
    }

    const calibrateSide = (
      hand: Bone,
      fingers: Map<FingerBoneName, Bone>
    ): { axis: Vector3; palm: Vector3 } | null => {
      const index1 = fingers.get("Index1");
      const pinky1 = fingers.get("Pinky1");
      const middle1 = fingers.get("Middle1");
      if (!index1 || !pinky1 || !middle1) return null;
      hand.updateWorldMatrix(true, false);
      this._m1.copy(hand.matrixWorld).invert();
      const i = index1.getWorldPosition(this._v1).applyMatrix4(this._m1);
      const p = pinky1.getWorldPosition(this._v2).applyMatrix4(this._m1);
      const m = middle1.getWorldPosition(this._v3).applyMatrix4(this._m1);
      const axis = new Vector3().subVectors(p, i);
      if (axis.lengthSq() < 1e-10) return null;
      axis.normalize();
      const palm = m.clone().multiplyScalar(PALM_CENTER_FRACTION);
      return { axis, palm };
    };

    const left = calibrateSide(leftChain.effector, chains.left);
    const right = calibrateSide(rightChain.effector, chains.right);
    if (left) {
      this.leftGripAxisLocal = left.axis;
      this.leftPalmLocal = left.palm;
    }
    if (right) {
      this.rightGripAxisLocal = right.axis;
      this.rightPalmLocal = right.palm;
    }
    this.gripCalibrated = true;
  }

  /**
   * Shift the IK target so the PALM (not the wrist joint) lands on the
   * grip point. Uses the hand's CURRENT world orientation for the
   * palm offset - one frame of latency that converges under the wrist
   * smoothing.
   */
  private computeSocketTarget(
    side: "left" | "right",
    chain: BoneChain,
    gripPoint: Vector3
  ): Vector3 {
    const palmLocal = side === "left" ? this.leftPalmLocal : this.rightPalmLocal;
    const out =
      side === "left" ? this._socketTargetLeft : this._socketTargetRight;
    if (!palmLocal) return out.copy(gripPoint);
    // palmWorld - effectorWorld = the world offset from wrist joint to
    // palm center; pull the IK target back by that offset.
    this._v1.copy(palmLocal);
    chain.effector.localToWorld(this._v1);
    chain.effector.getWorldPosition(this._v2);
    return out.copy(gripPoint).sub(this._v1).add(this._v2);
  }

  /**
   * Probe the IK solve; when the target is out of reach, protract the
   * clavicle toward it (bounded) and record the residual deficit so the
   * next frame's spine lean can make up the rest.
   */
  private applyReachEscalation(
    side: "left" | "right",
    chain: BoneChain,
    target: IKTarget,
    state: SkeletonState
  ): void {
    const probe = this.ikSolver.solve(chain, target);
    const deficit = probe.success ? 0 : probe.error;

    const clav = state.bones.get(
      side === "left" ? "LeftShoulder" : "RightShoulder"
    );
    const extQuat =
      side === "left" ? this.leftReachExtQuat : this.rightReachExtQuat;

    let hasDesired = false;
    if (clav && clav.parent && deficit > REACH_EPSILON) {
      clav.getWorldPosition(this._v1);
      this._v2.copy(chain.root.getWorldPosition(this._v2)).sub(this._v1);
      this._v3.copy(target.position).sub(this._v1);
      if (this._v2.lengthSq() > 1e-8 && this._v3.lengthSq() > 1e-8) {
        this._v3.normalize();
        this._q1.setFromUnitVectors(this._v2.normalize(), this._v3);
        AvatarAnimator.clampQuatAngle(
          this._q1,
          MAX_REACH_EXT * Math.min(1, deficit / REACH_FULL_DEFICIT)
        );
        // World-frame swing -> clavicle-local delta by conjugation
        clav.parent.getWorldQuaternion(this._q2);
        this._q3
          .copy(this._q2)
          .invert()
          .multiply(this._q1)
          .multiply(this._q2);
        hasDesired = true;
        // Record the deficit direction for next frame's spine lean
        this._frameLeanVec.addScaledVector(this._v3, deficit);
      }
    }

    extQuat.slerp(hasDesired ? this._q3 : this._q4.identity(), this.smoothingFactor);

    // Only premultiply when the raise block rebased the clavicle to
    // (rest x raise) THIS frame - otherwise this would accumulate.
    const clavRebased =
      this._clavicleRaiseEnabled &&
      this.clavicleRaiser !== null &&
      this.shoulderRestCached;
    if (clav && clavRebased) {
      clav.quaternion.premultiply(extQuat);
      clav.updateMatrixWorld(true);
    }
  }

  /**
   * Rotate the hand so its knuckle line lies along the staff axis - the
   * wrist orientation goal. Swing-only (no roll about the staff), clamped
   * to anatomical range, sign-disambiguated (staff ends are
   * interchangeable, pick the smaller swing), and smoothed so a sign flip
   * reads as a regrasp rather than a snap.
   */
  private applyWristOrientation(
    side: "left" | "right",
    chain: BoneChain,
    hand: HandPose,
    ikWeight: number
  ): void {
    const staffQuat = hand.wristRotation;
    const gripAxis =
      side === "left" ? this.leftGripAxisLocal : this.rightGripAxisLocal;
    const eff = chain.effector;
    if (!staffQuat || !gripAxis || !eff.parent) return;

    // Bone quaternions changed since the last matrix update - refresh so
    // the knuckle line reflects THIS frame's solve.
    chain.root.updateMatrixWorld(true);

    // Knuckle line in world space
    eff.getWorldQuaternion(this._q1);
    this._v1.copy(gripAxis).applyQuaternion(this._q1);

    // Staff long axis in world space (+Y of the prop cylinder)
    this._v2.set(0, 1, 0).applyQuaternion(staffQuat);
    if (this._v1.dot(this._v2) < 0) this._v2.negate();

    // Swing-only correction, clamped to anatomical range
    this._q2.setFromUnitVectors(this._v1, this._v2);
    AvatarAnimator.clampQuatAngle(this._q2, MAX_WRIST_SWING);

    // Desired world orientation -> hand-local
    this._q3.copy(this._q2).multiply(this._q1);
    eff.parent.getWorldQuaternion(this._q4);
    this._q3.premultiply(this._q4.invert());

    const wristState = side === "left" ? this.leftWristQuat : this.rightWristQuat;
    const isInit = side === "left" ? this.leftWristInit : this.rightWristInit;
    if (!isInit) {
      wristState.copy(eff.quaternion);
      if (side === "left") this.leftWristInit = true;
      else this.rightWristInit = true;
    }
    wristState.slerp(this._q3, WRIST_SMOOTHING);
    eff.quaternion.slerp(wristState, ikWeight);
  }


  addLayer(layer: AnimationLayer): void {
    this.layers.set(layer.id, layer);
  }

  removeLayer(layerId: string): void {
    this.layers.delete(layerId);
  }

  setLayerWeight(layerId: string, weight: number): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.weight = Math.max(0, Math.min(1, weight));
    }
  }

  async transitionTo(pose: BodyPose, config: TransitionConfig): Promise<void> {
    return new Promise((resolve) => {
      this.transitionStart = AvatarAnimator.cloneBodyPose(this.currentPose);
      this.transitionEnd = pose;
      this.transitionConfig = config;
      this.transitionProgress = 0;
      this.transitioning = true;

      // Wait for transition to complete
      const checkComplete = () => {
        if (!this.transitioning) {
          resolve();
        } else {
          requestAnimationFrame(checkComplete);
        }
      };
      requestAnimationFrame(checkComplete);
    });
  }

  setSmoothBlending(enabled: boolean): void {
    this.smoothBlending = enabled;
  }

  setSmoothingFactor(factor: number): void {
    this.smoothingFactor = Math.max(0, Math.min(1, factor));
  }

  setExternalSpinePitch(radians: number): void {
    this.externalSpinePitchRad = radians;
  }

  /** Debug toggle: disable pole vectors to compare old vs new elbow behavior */
  togglePoleVectors(): boolean {
    this._poleVectorsEnabled = !this._poleVectorsEnabled;
    if (!this._poleVectorsEnabled) {
      // Reset to default backward poles so difference is visible immediately
      this.leftPoleVector.set(0, 0, -1);
      this.rightPoleVector.set(0, 0, -1);
    }
    return this._poleVectorsEnabled;
  }

  /** Debug toggle: disable clavicle raise to compare old vs new shoulder behavior */
  toggleClavicleRaise(): boolean {
    this._clavicleRaiseEnabled = !this._clavicleRaiseEnabled;
    if (!this._clavicleRaiseEnabled) {
      this.leftClavicleQuat.identity();
      this.rightClavicleQuat.identity();
    }
    return this._clavicleRaiseEnabled;
  }

  /** Skip Hips counter-rotation (exhibit performers with planted feet) */
  setSkipHipsTwist(skip: boolean): void {
    this._skipHipsTwist = skip;
  }

  /** Set spine twist enabled/disabled */
  setSpineTwistEnabled(enabled: boolean): void {
    this._spineTwistEnabled = enabled;
    if (!enabled) {
      this.spineTwistQuats.spine1.identity();
      this.spineTwistQuats.spine2.identity();
      this.spineTwistQuats.neck.identity();
      this.spineTwistQuats.head.identity();
    }
  }

  /** Debug toggle: disable spine twist to compare old vs new torso behavior */
  toggleSpineTwist(): boolean {
    this.setSpineTwistEnabled(!this._spineTwistEnabled);
    return this._spineTwistEnabled;
  }
}
