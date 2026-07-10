/**
 * Pursuit steering - turn-rate-limited heading for chase sequences.
 *
 * Real fish don't beeline: a pursuing predator arcs onto its target and a
 * fleeing prey carves away. We model heading as a unit vector that rotates
 * toward the desired direction at a capped angular rate, so course changes
 * read as swimming, not teleport-aiming.
 */

export interface Heading {
  x: number;
  y: number;
}

/**
 * Rotates `current` (unit heading) toward `desired` (any non-zero vector),
 * clamping angular velocity to `maxTurnRate` rad/s. Returns a unit vector.
 */
export function steerHeading(
  current: Heading,
  desired: Heading,
  maxTurnRate: number,
  dt: number
): Heading {
  const desiredLen = Math.hypot(desired.x, desired.y);
  if (desiredLen <= 0) return current;

  const currentAngle = Math.atan2(current.y, current.x);
  const desiredAngle = Math.atan2(desired.y, desired.x);

  let diff = desiredAngle - currentAngle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;

  const maxStep = maxTurnRate * dt;
  const step = Math.max(-maxStep, Math.min(maxStep, diff));
  const angle = currentAngle + step;

  return { x: Math.cos(angle), y: Math.sin(angle) };
}

/**
 * Biases a flee direction back toward the screen interior so prey carves
 * along edges instead of bolting straight off-screen mid-chase.
 *
 * `margin` is the distance from each edge where the inward push starts;
 * the push ramps linearly to full strength at the edge itself.
 */
export function biasAwayFromEdges(
  direction: Heading,
  x: number,
  y: number,
  width: number,
  height: number,
  margin: number
): Heading {
  let biasX = 0;
  let biasY = 0;

  if (x < margin) biasX += 1 - x / margin;
  if (x > width - margin) biasX -= 1 - (width - x) / margin;
  if (y < margin) biasY += 1 - y / margin;
  if (y > height - margin) biasY -= 1 - (height - y) / margin;

  if (biasX === 0 && biasY === 0) return direction;

  // Bias weight grows with edge proximity; at full strength it dominates.
  const out = {
    x: direction.x + biasX * 1.5,
    y: direction.y + biasY * 1.5,
  };
  const len = Math.hypot(out.x, out.y);
  return len > 0 ? { x: out.x / len, y: out.y / len } : direction;
}
