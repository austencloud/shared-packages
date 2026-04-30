import type { Vector3 } from 'three';
import type { MotionPlane } from '../../domain/types.js';

export interface IElbowPoleComputer {
  computePoleVector(
    handTarget: Vector3,
    plane: MotionPlane,
    side: 'left' | 'right',
    bodyCenter: Vector3,
  ): Vector3;
}
