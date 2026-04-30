import type { Vector3, Quaternion } from 'three';

export interface SpineTwistResult {
  spine1: Quaternion;
  spine2: Quaternion;
  neck: Quaternion;
  head: Quaternion;
  hips: Quaternion;
}

export interface ISpineTwister {
  computeSpineTwist(
    leftHandTarget: Vector3 | null,
    rightHandTarget: Vector3 | null,
    bodyCenter: Vector3,
    availableBones?: Set<string>,
  ): SpineTwistResult;
}
