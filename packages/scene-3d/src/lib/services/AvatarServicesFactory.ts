import { AvatarSkeletonBuilder } from './AvatarSkeletonBuilder.js';
import { IKSolver } from './IKSolver.js';
import { AvatarAnimator } from './AvatarAnimator.js';
import { ElbowPoleComputer } from './ElbowPoleComputer.js';
import { ClavicleRaiser } from './ClavicleRaiser.js';
import { SpineTwister } from './SpineTwister.js';
import { FingerAnimator } from './FingerAnimator.js';

export interface AvatarServices {
  skeleton: AvatarSkeletonBuilder;
  ikSolver: IKSolver;
  animator: AvatarAnimator;
  fingers: FingerAnimator;
}

export interface AvatarServicesOptions {
  enableFootPlanting?: boolean;
}

export function createAvatarServices(
  options: AvatarServicesOptions = {},
): AvatarServices {
  const skeleton = new AvatarSkeletonBuilder();
  const ikSolver = new IKSolver();
  const poleComputer = new ElbowPoleComputer();
  const clavicleRaiser = new ClavicleRaiser();
  const spineTwister = new SpineTwister();
  const animator = new AvatarAnimator(
    ikSolver,
    skeleton,
    poleComputer,
    clavicleRaiser,
    spineTwister,
  );

  if (options.enableFootPlanting) {
    animator.setSkipHipsTwist(true);
  }

  const fingers = new FingerAnimator();

  return { skeleton, ikSolver, animator, fingers };
}
