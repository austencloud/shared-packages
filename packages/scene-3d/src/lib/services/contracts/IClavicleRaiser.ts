import type { Vector3, Quaternion } from 'three';

export interface IClavicleRaiser {
  computeClavicleRotation(
    handTarget: Vector3,
    side: 'left' | 'right',
    shoulderRestY: number,
    armLength: number,
  ): Quaternion;
}
