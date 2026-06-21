/**
 * Frame-rate-independent exponential approach toward a target.
 * factor = 1 - e^(-rate*dt) so that two dt/2 steps equal one dt step exactly.
 * Higher `rate` = snappier; lower = smoother.
 */
export function approachExponential(
  current: number,
  target: number,
  rate: number,
  dt: number
): number {
  if (current === target) return target;
  const factor = 1 - Math.exp(-rate * dt);
  return current + (target - current) * factor;
}

/**
 * Eases a continuous heading scalar (e.g. -1..1 direction factor) toward a
 * target. Uses the same exponential approach so direction flips ramp smoothly
 * through zero instead of snapping.
 */
export function easeHeading(
  current: number,
  target: number,
  rate: number,
  dt: number
): number {
  return approachExponential(current, target, rate, dt);
}
