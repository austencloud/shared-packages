import { Vector3, Quaternion, Matrix4, Euler } from 'three';
import type { Bone } from 'three';
import type {
  IIKSolver,
  IKAlgorithm,
  JointConstraints,
  IKTarget,
  IKSolution,
  HumanoidConstraints,
} from './contracts/IIKSolver.js';
import type { BoneChain } from './contracts/IAvatarSkeletonBuilder.js';

export class IKSolver implements IIKSolver {
  private maxIterations = 10;
  private convergenceThreshold = 0.01;
  private readonly tempVec = new Vector3();

  solve(
    chain: BoneChain,
    target: IKTarget,
    algorithm: IKAlgorithm = 'analytic',
    constraints?: JointConstraints[],
  ): IKSolution {
    const poleHint = target.poleHint ?? new Vector3(0, 0, -1);
    switch (algorithm) {
      case 'analytic':
        return this.solveTwoBone(chain, target.position, poleHint);
      case 'ccd':
        return this.solveCCD(chain, target, constraints);
      case 'fabrik':
        return this.solveFABRIK(chain, target);
      default:
        return this.solveTwoBone(chain, target.position, poleHint);
    }
  }

  solveAndApply(
    chain: BoneChain,
    target: IKTarget,
    constraints?: JointConstraints[],
  ): void {
    const solution = this.solve(chain, target, 'analytic', constraints);
    const rootRotation = solution.rotations[0];
    const middleRotation = solution.rotations[1];

    if (rootRotation && middleRotation) {
      chain.root.quaternion.copy(rootRotation);
      chain.middle.quaternion.copy(middleRotation);
      chain.root.updateMatrixWorld(true);
    }
  }

  solveTwoBone(
    chain: BoneChain,
    target: Vector3,
    poleHint: Vector3,
  ): IKSolution {
    const rotations: Quaternion[] = [];

    const shoulderWorld = new Vector3();
    chain.root.getWorldPosition(shoulderWorld);

    const toTarget = target.clone().sub(shoulderWorld);
    let dist = toTarget.length();

    const maxReach = chain.upperLength + chain.lowerLength;
    const minReach = Math.abs(chain.upperLength - chain.lowerLength);

    let reachable = true;
    if (dist > maxReach * 0.999) {
      dist = maxReach * 0.999;
      reachable = false;
    } else if (dist < minReach * 1.001) {
      dist = minReach * 1.001;
      reachable = false;
    }

    const clampedTarget = shoulderWorld
      .clone()
      .add(toTarget.clone().normalize().multiplyScalar(dist));

    const cosShoulderAngle =
      (chain.upperLength * chain.upperLength +
        dist * dist -
        chain.lowerLength * chain.lowerLength) /
      (2 * chain.upperLength * dist);
    const shoulderAngle = Math.acos(
      Math.max(-1, Math.min(1, cosShoulderAngle)),
    );

    const targetDir = clampedTarget.clone().sub(shoulderWorld).normalize();

    let bendAxis = new Vector3().crossVectors(targetDir, poleHint);
    if (bendAxis.lengthSq() < 0.0001) {
      bendAxis = new Vector3().crossVectors(targetDir, new Vector3(0, 1, 0));
      if (bendAxis.lengthSq() < 0.0001) {
        bendAxis.set(1, 0, 0);
      }
    }
    bendAxis.normalize();

    const upperArmDir = targetDir
      .clone()
      .applyAxisAngle(bendAxis, shoulderAngle);

    const elbowWorld = shoulderWorld
      .clone()
      .add(upperArmDir.clone().multiplyScalar(chain.upperLength));

    const forearmDir = clampedTarget.clone().sub(elbowWorld).normalize();

    const shoulderParentInverse = new Matrix4();
    if (chain.root.parent) {
      chain.root.parent.updateWorldMatrix(true, false);
      shoulderParentInverse.copy(chain.root.parent.matrixWorld).invert();
    }
    const localUpperArmDir = upperArmDir
      .clone()
      .transformDirection(shoulderParentInverse);

    const shoulderQuat = new Quaternion();
    shoulderQuat.setFromUnitVectors(
      chain.rootRestDir.clone(),
      localUpperArmDir,
    );
    rotations.push(shoulderQuat);

    const shoulderWorldMatrix = chain.root.parent
      ? chain.root.parent.matrixWorld.clone()
      : new Matrix4();

    const shoulderRotMatrix = new Matrix4().makeRotationFromQuaternion(
      shoulderQuat,
    );
    const elbowParentMatrix = shoulderWorldMatrix.multiply(shoulderRotMatrix);
    const elbowParentInverse = elbowParentMatrix.clone().invert();

    const localForearmDir = forearmDir
      .clone()
      .transformDirection(elbowParentInverse);

    const elbowQuat = new Quaternion();
    elbowQuat.setFromUnitVectors(chain.middleRestDir.clone(), localForearmDir);
    rotations.push(elbowQuat);

    const handWorld = elbowWorld
      .clone()
      .add(forearmDir.multiplyScalar(chain.lowerLength));
    const error = target.distanceTo(handWorld);

    return {
      success: reachable,
      iterations: 1,
      error,
      rotations,
    };
  }

  private solveCCD(
    chain: BoneChain,
    target: IKTarget,
    constraints?: JointConstraints[],
  ): IKSolution {
    const bones: Bone[] = [chain.root, chain.middle, chain.effector];
    const rotations: Quaternion[] = bones.map((b) => b.quaternion.clone());

    let iterations = 0;
    let error = Infinity;

    for (let iter = 0; iter < this.maxIterations; iter++) {
      iterations++;

      for (let i = bones.length - 2; i >= 0; i--) {
        const bone = bones[i];
        if (!bone) continue;

        const effector = chain.effector;

        const boneWorld = new Vector3();
        const effectorWorld = new Vector3();
        bone.getWorldPosition(boneWorld);
        effector.getWorldPosition(effectorWorld);

        const toEffector = effectorWorld.clone().sub(boneWorld).normalize();
        const toTarget = target.position.clone().sub(boneWorld).normalize();

        const rotation = new Quaternion().setFromUnitVectors(
          toEffector,
          toTarget,
        );

        bone.quaternion.premultiply(rotation);

        const constraint = constraints?.[i];
        if (constraint) {
          this.applyConstraints(bone, constraint);
        }

        bone.updateMatrixWorld(true);
      }

      chain.effector.getWorldPosition(this.tempVec);
      error = this.tempVec.distanceTo(target.position);

      if (error < this.convergenceThreshold) {
        break;
      }
    }

    bones.forEach((bone, i) => {
      if (bone && rotations[i]) {
        rotations[i] = bone.quaternion.clone();
      }
    });

    return {
      success: error < this.convergenceThreshold * 10,
      iterations,
      error,
      rotations,
    };
  }

  private solveFABRIK(chain: BoneChain, target: IKTarget): IKSolution {
    const pos0 = new Vector3();
    const pos1 = new Vector3();
    const pos2 = new Vector3();

    chain.root.getWorldPosition(pos0);
    chain.middle.getWorldPosition(pos1);
    chain.effector.getWorldPosition(pos2);

    const upperLen = chain.upperLength;
    const lowerLen = chain.lowerLength;
    const rootPos = pos0.clone();

    let iterations = 0;
    let error = Infinity;

    for (let iter = 0; iter < this.maxIterations; iter++) {
      iterations++;

      pos2.copy(target.position);

      const dir1to2 = pos1.clone().sub(pos2).normalize();
      pos1.copy(pos2).add(dir1to2.multiplyScalar(lowerLen));

      const dir0to1 = pos0.clone().sub(pos1).normalize();
      pos0.copy(pos1).add(dir0to1.multiplyScalar(upperLen));

      pos0.copy(rootPos);

      const dir1from0 = pos1.clone().sub(pos0).normalize();
      pos1.copy(pos0).add(dir1from0.multiplyScalar(upperLen));

      const dir2from1 = pos2.clone().sub(pos1).normalize();
      pos2.copy(pos1).add(dir2from1.multiplyScalar(lowerLen));

      error = pos2.distanceTo(target.position);
      if (error < this.convergenceThreshold) {
        break;
      }
    }

    const rotations = this.positionsToRotations(pos0, pos1, pos2);

    return {
      success: error < this.convergenceThreshold * 10,
      iterations,
      error,
      rotations,
    };
  }

  private positionsToRotations(
    pos0: Vector3,
    pos1: Vector3,
    pos2: Vector3,
  ): Quaternion[] {
    const rotations: Quaternion[] = [];

    const shoulderDir = pos1.clone().sub(pos0).normalize();
    const shoulderQuat = new Quaternion().setFromUnitVectors(
      new Vector3(1, 0, 0),
      shoulderDir,
    );
    rotations.push(shoulderQuat);

    const elbowDir = pos2.clone().sub(pos1).normalize();
    const elbowQuat = new Quaternion().setFromUnitVectors(
      shoulderDir,
      elbowDir,
    );
    rotations.push(elbowQuat);

    return rotations;
  }

  private applyConstraints(bone: Bone, constraints: JointConstraints): void {
    const euler = new Euler().setFromQuaternion(bone.quaternion);

    if (constraints.minX !== undefined)
      euler.x = Math.max(euler.x, constraints.minX);
    if (constraints.maxX !== undefined)
      euler.x = Math.min(euler.x, constraints.maxX);
    if (constraints.minY !== undefined)
      euler.y = Math.max(euler.y, constraints.minY);
    if (constraints.maxY !== undefined)
      euler.y = Math.min(euler.y, constraints.maxY);
    if (constraints.minZ !== undefined)
      euler.z = Math.max(euler.z, constraints.minZ);
    if (constraints.maxZ !== undefined)
      euler.z = Math.min(euler.z, constraints.maxZ);

    bone.quaternion.setFromEuler(euler);
  }

  getHumanoidConstraints(): HumanoidConstraints {
    const deg = Math.PI / 180;
    return {
      leftElbow: {
        minX: 0,
        maxX: 145 * deg,
        minY: -5 * deg,
        maxY: 5 * deg,
        minZ: -5 * deg,
        maxZ: 5 * deg,
        poleVector: new Vector3(-0.5, -0.3, -1).normalize(),
      },
      rightElbow: {
        minX: 0,
        maxX: 145 * deg,
        minY: -5 * deg,
        maxY: 5 * deg,
        minZ: -5 * deg,
        maxZ: 5 * deg,
        poleVector: new Vector3(0.5, -0.3, -1).normalize(),
      },
      leftShoulder: {
        minX: -180 * deg,
        maxX: 60 * deg,
        minY: -90 * deg,
        maxY: 90 * deg,
        minZ: -45 * deg,
        maxZ: 180 * deg,
      },
      rightShoulder: {
        minX: -180 * deg,
        maxX: 60 * deg,
        minY: -90 * deg,
        maxY: 90 * deg,
        minZ: -180 * deg,
        maxZ: 45 * deg,
      },
      leftKnee: {
        minX: 0,
        maxX: 150 * deg,
        poleVector: new Vector3(0, 0, 1).normalize(),
      },
      rightKnee: {
        minX: 0,
        maxX: 150 * deg,
        poleVector: new Vector3(0, 0, 1).normalize(),
      },
    };
  }

  setMaxIterations(count: number): void {
    this.maxIterations = count;
  }

  setConvergenceThreshold(threshold: number): void {
    this.convergenceThreshold = threshold;
  }
}
