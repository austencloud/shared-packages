export interface FleeInput {
  fishX: number;
  fishY: number;
  cursorX: number;
  cursorY: number;
  /** base scatter radius in px */
  radius: number;
  /** 0..1 personality boldness; bolder = smaller effective radius */
  boldness: number;
  /** current horizontal heading */
  direction: 1 | -1;
}

export interface FleeResult {
  /** 0..1 strength (proximity^2) */
  intensity: number;
  /** unit flee direction */
  dirX: number;
  dirY: number;
}

const ZERO: FleeResult = { intensity: 0, dirX: 0, dirY: 0 };

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Screen-space cursor flee, mirroring the 3D boid scatter shader:
 * boldness-scaled radius, proximity^2 falloff, away+tangential blend so fish
 * escape sideways when the cursor is dead ahead instead of only backing up.
 */
export function computeFlee(input: FleeInput): FleeResult {
  const { fishX, fishY, cursorX, cursorY, radius, boldness, direction } = input;
  const effRadius = radius * (1.3 - boldness * 0.6);
  let dx = fishX - cursorX;
  let dy = fishY - cursorY;
  const dist = Math.hypot(dx, dy);

  if (dist >= effRadius) return ZERO;

  // Degenerate: cursor exactly on the fish -> flee straight up.
  if (dist < 1e-4) return { intensity: 1, dirX: 0, dirY: -1 };

  const awayX = dx / dist;
  const awayY = dy / dist;
  const proximity = 1 - dist / effRadius;

  // Tangential escape: stronger when the fish heads toward the cursor.
  const headingDot = Math.abs(direction * awayX); // heading is (direction, 0)
  const tangentWeight = smoothstep(0.3, 0.8, headingDot) * 0.6;
  // tangent perpendicular to away; sign chosen by current heading.
  const sign = direction >= 0 ? 1 : -1;
  const tanX = -awayY * sign;
  const tanY = awayX * sign;

  let fx = awayX * (1 - tangentWeight) + tanX * tangentWeight;
  let fy = awayY * (1 - tangentWeight) + tanY * tangentWeight;
  const len = Math.hypot(fx, fy) || 1;
  fx /= len;
  fy /= len;

  return { intensity: proximity * proximity, dirX: fx, dirY: fy };
}
