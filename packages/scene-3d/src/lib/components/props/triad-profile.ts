/**
 * Triad silhouette profile
 *
 * The 3D triad is not an approximation of the 2D prop — it IS the 2D artwork,
 * given depth. These contours are a direct transcription of the visible path in
 * `static/images/props/triad.svg`: three straight arms of equal width meeting
 * at a hub, 120 degrees apart, each ending in a semicircular cap.
 *
 * Coordinates are normalized to the STAFF's drawn span (252.8 SVG units, the
 * shared unit across every prop drawing) and rotated into prop-local 2D space,
 * so the prop's reach runs along +Y like every other prop:
 *
 *   x = (svgY - 109.545) / 252.8    across the prop
 *   y = (svgX - 124.38)  / 252.8    along the prop
 *
 * `triad.svg` carries a second copy of the star, mirrored about the viewBox
 * centre, marked `fill="none"`. It draws nothing. It is there to widen the box
 * so its centre lands on the hub — the drawing's way of placing the hand.
 * Extruding it would put a second star on the prop that the artwork does not
 * have.
 *
 * One arm reaches forward along +Y and the other two splay back at 120, so the
 * hand takes the hub with a bar running away from it and two behind. That is
 * the whole prop; there is no separate handle, no hub boss, and no cap that is
 * not simply the round end of an arm.
 */

import { Shape } from "three";

/** [c1x, c1y, c2x, c2y, endX, endY] */
type Cubic = readonly [number, number, number, number, number, number];

interface Contour {
  readonly start: readonly [number, number];
  readonly curves: readonly Cubic[];
}

const OUTLINE: Contour = {
  start: [-0.41054, -0.18299],
  curves: [
    [-0.28914, -0.11294, -0.16774, -0.04288, -0.04634, 0.02718],
    [-0.04634, 0.16714, -0.04634, 0.30711, -0.04634, 0.44707],
    [-0.04634, 0.47144, -0.02633, 0.49102, -0.00239, 0.49102],
    [-0.00065, 0.49102, 0.00109, 0.49102, 0.00283, 0.49102],
    [0.02676, 0.49102, 0.04678, 0.47144, 0.04678, 0.44707],
    [0.04678, 0.30696, 0.04678, 0.16685, 0.04678, 0.02674],
    [0.16803, -0.04331, 0.28929, -0.11337, 0.41054, -0.18343],
    [0.43133, -0.19553, 0.43851, -0.22211, 0.42664, -0.24304],
    [0.42577, -0.24463, 0.4249, -0.24623, 0.42403, -0.24782],
    [0.41172, -0.26862, 0.38505, -0.27577, 0.36398, -0.26392],
    [0.24258, -0.19372, 0.12118, -0.12352, -0.00022, -0.05332],
    [-0.12147, -0.12352, -0.24273, -0.19372, -0.36398, -0.26392],
    [-0.38508, -0.27552, -0.41157, -0.26842, -0.42403, -0.24782],
    [-0.4249, -0.24623, -0.42577, -0.24463, -0.42664, -0.24304],
    [-0.43849, -0.22197, -0.43134, -0.1953, -0.41054, -0.18299],
  ],
};

/**
 * Width of an arm at its narrowest, normalized to staff length — measured by
 * stepping inward along the boundary's normal. The bevel ceiling is sized from
 * it. The triad's arms are the widest stock in the flat-prop family.
 */
export const TRIAD_ARM_WIDTH = 0.09296;

/**
 * Build the triad — sized against a staff of `staffLength` units and lying in
 * the XY plane ready to extrude, with the hand at the origin.
 */
export function buildTriadShape(staffLength: number): Shape {
  const shape = new Shape();
  shape.moveTo(OUTLINE.start[0] * staffLength, OUTLINE.start[1] * staffLength);
  for (const [c1x, c1y, c2x, c2y, x, y] of OUTLINE.curves) {
    shape.bezierCurveTo(
      c1x * staffLength,
      c1y * staffLength,
      c2x * staffLength,
      c2y * staffLength,
      x * staffLength,
      y * staffLength
    );
  }
  shape.closePath();
  return shape;
}
