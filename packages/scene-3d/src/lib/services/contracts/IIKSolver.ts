import type { Vector3, Quaternion } from 'three';
import type { BoneChain } from './IAvatarSkeletonBuilder.js';

export type IKAlgorithm = 'analytic' | 'ccd' | 'fabrik';

export interface JointConstraints {
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
  minZ?: number;
  maxZ?: number;
  poleVector?: Vector3;
}

export interface IKTarget {
  position: Vector3;
  rotation?: Quaternion;
  weight?: number;
  poleHint?: Vector3;
}

export interface IKSolution {
  success: boolean;
  iterations: number;
  error: number;
  rotations: Quaternion[];
}

export interface HumanoidConstraints {
  leftElbow: JointConstraints;
  rightElbow: JointConstraints;
  leftShoulder: JointConstraints;
  rightShoulder: JointConstraints;
  leftKnee: JointConstraints;
  rightKnee: JointConstraints;
}

export interface IIKSolver {
  solve(
    chain: BoneChain,
    target: IKTarget,
    algorithm?: IKAlgorithm,
    constraints?: JointConstraints[],
  ): IKSolution;

  solveAndApply(
    chain: BoneChain,
    target: IKTarget,
    constraints?: JointConstraints[],
  ): void;

  solveTwoBone(
    chain: BoneChain,
    target: Vector3,
    poleHint: Vector3,
  ): IKSolution;

  getHumanoidConstraints(): HumanoidConstraints;
  setMaxIterations(count: number): void;
  setConvergenceThreshold(threshold: number): void;
}
