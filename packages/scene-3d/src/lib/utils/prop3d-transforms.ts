import { Euler } from 'three';
import type { PropState } from '../domain/types.js';

export function computePropRotation(propState: PropState): [number, number, number] {
  const euler = new Euler().setFromQuaternion(propState.rotation);
  return [euler.x, euler.y, euler.z];
}
