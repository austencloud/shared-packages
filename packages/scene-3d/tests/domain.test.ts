import { describe, it, expect } from 'vitest';
import { GripType, mirrorQuaternion, FINGER_BONES } from '../src/lib/domain/GripPose';

describe('GripPose domain', () => {
  it('GripType enum has all grip types', () => {
    expect(GripType.IDLE).toBe('idle');
    expect(GripType.SQUARE).toBe('square');
    expect(GripType.RELEASE).toBe('release');
  });

  it('mirrorQuaternion negates Y and Z', () => {
    const q: [number, number, number, number] = [0.1, 0.2, 0.3, 0.9];
    const mirrored = mirrorQuaternion(q);
    expect(mirrored).toEqual([0.1, -0.2, -0.3, 0.9]);
  });

  it('FINGER_BONES has 15 entries', () => {
    expect(FINGER_BONES.length).toBe(15);
    expect(FINGER_BONES[0]).toBe('Thumb1');
    expect(FINGER_BONES[14]).toBe('Pinky3');
  });
});
