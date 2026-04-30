import type { GripType, FingerChains } from '../../domain/GripPose.js';

export interface IFingerAnimator {
  initialize(fingerChains: FingerChains): void;
  isReady(): boolean;
  setGrip(hand: 'left' | 'right', type: GripType): void;
  setGrips(leftGrip: GripType, rightGrip: GripType): void;
  update(deltaTime: number): void;
  setBlendSpeed(speed: number): void;
  getCurrentGrip(hand: 'left' | 'right'): GripType;
  dispose(): void;
}
