import type { Bone } from 'three';

export enum GripType {
  IDLE = 'idle',
  SQUARE = 'square',
  PENCIL = 'pencil',
  CRADLE = 'cradle',
  OPEN_PALM = 'open_palm',
  RELEASE = 'release',
}

export const FINGER_BONES = [
  'Thumb1', 'Thumb2', 'Thumb3',
  'Index1', 'Index2', 'Index3',
  'Middle1', 'Middle2', 'Middle3',
  'Ring1', 'Ring2', 'Ring3',
  'Pinky1', 'Pinky2', 'Pinky3',
] as const;

export type FingerBoneName = (typeof FINGER_BONES)[number];

export interface GripPose {
  readonly name: string;
  readonly type: GripType;
  readonly rotations: readonly [number, number, number, number][];
}

export interface FingerChains {
  left: Map<FingerBoneName, Bone>;
  right: Map<FingerBoneName, Bone>;
}

export function mirrorQuaternion(
  q: [number, number, number, number],
): [number, number, number, number] {
  return [q[0], -q[1], -q[2], q[3]];
}
