import type { Bone, SkinnedMesh, Object3D, Vector3 } from 'three';
import type { FingerChains } from '../../domain/GripPose.js';

export type BoneName =
  | 'Hips'
  | 'Spine'
  | 'Spine1'
  | 'Spine2'
  | 'Neck'
  | 'Head'
  | 'LeftShoulder'
  | 'LeftArm'
  | 'LeftForeArm'
  | 'LeftHand'
  | 'RightShoulder'
  | 'RightArm'
  | 'RightForeArm'
  | 'RightHand'
  | 'LeftUpLeg'
  | 'LeftLeg'
  | 'LeftFoot'
  | 'RightUpLeg'
  | 'RightLeg'
  | 'RightFoot';

export interface BoneChain {
  root: Bone;
  middle: Bone;
  effector: Bone;
  totalLength: number;
  upperLength: number;
  lowerLength: number;
  rootRestDir: Vector3;
  middleRestDir: Vector3;
}

export interface SkeletonState {
  isLoaded: boolean;
  root: Object3D | null;
  meshes: SkinnedMesh[];
  bones: Map<BoneName, Bone>;
  leftArmChain: BoneChain | null;
  rightArmChain: BoneChain | null;
  leftLegChain: BoneChain | null;
  rightLegChain: BoneChain | null;
  fingerChains: FingerChains | null;
}

export interface IAvatarSkeletonBuilder {
  loadModel(url: string): Promise<void>;
  getState(): SkeletonState;
  getBone(name: BoneName): Bone | null;
  getLeftArmChain(): BoneChain | null;
  getRightArmChain(): BoneChain | null;
  getLeftLegChain(): BoneChain | null;
  getRightLegChain(): BoneChain | null;
  getRoot(): Object3D | null;
  updateMatrices(): void;
  setScale(scale: number): void;
  setHeight(height: number): void;
  getFeetOffset(): number;
  getGroundOffset(): number;
  dispose(): void;
}
