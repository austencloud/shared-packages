import type { Vector3, Quaternion } from 'three';
import type { GripType } from '../../domain/GripPose.js';
import type { MotionPlane } from '../../domain/types.js';

export interface HandPose {
  targetPosition: Vector3;
  wristRotation?: Quaternion;
  gripType?: GripType;
  plane?: MotionPlane;
  weight: number;
}

export interface BodyPose {
  leftHand: HandPose | null;
  rightHand: HandPose | null;
  headLookAt?: Vector3;
  rootOffset?: Vector3;
  timestamp: number;
}

export interface AnimationLayer {
  id: string;
  name: string;
  weight: number;
  pose: BodyPose;
}

export type BlendMode = 'override' | 'additive' | 'multiply';

export interface TransitionConfig {
  duration: number;
  easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
  blendMode: BlendMode;
}

export interface IAvatarAnimator {
  setLeftHandTarget(target: HandPose): void;
  setRightHandTarget(target: HandPose): void;
  getCurrentPose(): BodyPose;
  update(deltaTime: number): void;
  addLayer(layer: AnimationLayer): void;
  removeLayer(layerId: string): void;
  setLayerWeight(layerId: string, weight: number): void;
  transitionTo(pose: BodyPose, config: TransitionConfig): Promise<void>;
  setSmoothBlending(enabled: boolean): void;
  setSmoothingFactor(factor: number): void;
  setSkipHipsTwist(skip: boolean): void;
  setSpineTwistEnabled(enabled: boolean): void;
  setExternalSpinePitch(radians: number): void;
}
