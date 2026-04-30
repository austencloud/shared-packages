// Analytical 2-link IK solver using law of cosines.
// Standard robotics/CG technique (Marschner & Shirley, "Fundamentals of Computer Graphics").

import { type Vec3, vec3, sub, add, scale, normalize, cross, length, dot } from './vec3.js';

export interface IKConfig {
  upperLength: number;
  lowerLength: number;
  elbowBias?: Vec3;
}

export interface IKResult {
  shoulderPos: Vec3;
  elbowPos: Vec3;
  handPos: Vec3;
  reachable: boolean;
}

export function solveIK2Link(
  shoulderPos: Vec3,
  targetPos: Vec3,
  config: IKConfig,
): IKResult {
  const { upperLength: a, lowerLength: b } = config;
  const toTarget = sub(targetPos, shoulderPos);
  const dist = length(toTarget);

  const maxReach = a + b;
  const minReach = Math.abs(a - b);

  if (dist > maxReach || dist < 0.001) {
    const dir = dist > 0.001 ? normalize(toTarget) : vec3(0, -1, 0);
    const clampedDist = Math.min(dist, maxReach);
    const hand = add(shoulderPos, scale(dir, clampedDist));
    const elbow = add(shoulderPos, scale(dir, a));
    return { shoulderPos, elbowPos: elbow, handPos: hand, reachable: false };
  }

  // Law of cosines: cos(A) = (b² + c² - a²) / (2bc)
  // A = angle at shoulder, a = lower arm, b = upper arm, c = dist
  const cosA = (a * a + dist * dist - b * b) / (2 * a * dist);
  const clampedCosA = Math.max(-1, Math.min(1, cosA));
  const angleA = Math.acos(clampedCosA);

  const forward = normalize(toTarget);

  // Pick elbow plane perpendicular to forward direction
  const bias = config.elbowBias ?? vec3(0, 0, -1);
  let perp = cross(forward, bias);
  if (length(perp) < 0.001) {
    perp = cross(forward, vec3(0, 1, 0));
  }
  if (length(perp) < 0.001) {
    perp = cross(forward, vec3(1, 0, 0));
  }
  perp = normalize(perp);

  const elbowOffset = add(
    scale(forward, a * Math.cos(angleA)),
    scale(perp, a * Math.sin(angleA)),
  );
  const elbowPos = add(shoulderPos, elbowOffset);

  return {
    shoulderPos,
    elbowPos,
    handPos: targetPos,
    reachable: true,
  };
}
