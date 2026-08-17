/**
 * Fan silhouette profile
 *
 * The 3D fan is not an approximation of the 2D prop — it IS the 2D artwork,
 * given depth. These contours are a direct transcription of the single path
 * `static/images/props/fan.svg` draws: every cubic below comes from that file,
 * with its elliptical arcs converted to beziers.
 *
 * The prop is a flow fan, not a folding fan: a rigid frame with a grip ring at
 * the pivot, four spokes running out from it, and a rim closing the outside.
 * The gaps between the spokes are holes in the plate, not fabric.
 *
 * Coordinates are normalized to the STAFF's drawn span (252.8 SVG units, the
 * shared unit across every prop drawing) and rotated into prop-local 2D space,
 * so the prop's reach runs along +Y like every other prop:
 *
 *   x = (svgY - 103.5) / 252.8    across the prop
 *   y = (svgX - 130)   / 252.8    along the prop
 *
 * `fan.svg`'s 260x207 box holds a fan that only occupies x >= 129.1 — the left
 * half is empty. That is the drawing placing the hand: the viewBox centre is
 * the point the 2D renderer spins the prop about, and here it lands on the
 * outer web of the grip ring, with the whole fan reaching away from it. The
 * table below is already centred there, so the hand is the origin.
 */

import { Path, Shape } from "three";

/** [c1x, c1y, c2x, c2y, endX, endY] */
type Cubic = readonly [number, number, number, number, number, number];

interface Contour {
  readonly start: readonly [number, number];
  readonly curves: readonly Cubic[];
}

/** Rim, spokes and grip ring in one closed curve. */
const OUTLINE: Contour = {
  start: [0.40229, 0.28441],
  curves: [
    [0.39676, 0.29351, 0.2591, 0.50672, -0.00119, 0.50831],
    [-0.26147, 0.50672, -0.39873, 0.29312, -0.40467, 0.28441],
    [-0.40941, 0.2769, -0.4106, 0.27017, -0.40823, 0.26424],
    [-0.40388, 0.25356, -0.38964, 0.2496, -0.3754, 0.24565],
    [-0.37302, 0.24486, -0.37025, 0.24446, -0.36788, 0.24367],
    [-0.34771, 0.23774, -0.26108, 0.19976, -0.23062, 0.18473],
    [-0.21084, 0.17524, -0.15783, 0.14676, -0.08386, 0.08782],
    [-0.08386, 0.08505, -0.08386, 0.08228, -0.08347, 0.0803],
    [-0.08347, 0.07859, -0.08347, 0.07687, -0.08347, 0.07516],
    [-0.07911, 0.02888, -0.04549, -0.00356, -0.00079, -0.00356],
    [0.04391, -0.00356, 0.07753, 0.02888, 0.08188, 0.07516],
    [0.08188, 0.07687, 0.08188, 0.07859, 0.08188, 0.0803],
    [0.08228, 0.08228, 0.08228, 0.08544, 0.08228, 0.08782],
    [0.15625, 0.14676, 0.20926, 0.17524, 0.22903, 0.18473],
    [0.25989, 0.19976, 0.34652, 0.23774, 0.3663, 0.24367],
    [0.36867, 0.24446, 0.37144, 0.24486, 0.37381, 0.24565],
    [0.38766, 0.2496, 0.40229, 0.25356, 0.40665, 0.26424],
    [0.40823, 0.27017, 0.40665, 0.2769, 0.40229, 0.28441],
  ],
};

/** The wedge between the -X flank spoke and the rim's near corner. */
const HOLE_FLANK_LEFT: Contour = {
  start: [-0.14794, 0.19462],
  curves: [
    [-0.17326, 0.21044, -0.1966, 0.22389, -0.20649, 0.22903],
    [-0.23101, 0.2409, -0.30736, 0.2765, -0.34059, 0.28956],
    [-0.32041, 0.31487, -0.28323, 0.35522, -0.22983, 0.38964],
    [-0.17867, 0.30841, -0.12751, 0.22719, -0.07634, 0.14597],
    [-0.09533, 0.16021, -0.12263, 0.1788, -0.14794, 0.19462],
  ],
};

/** The wedge between the -X flank spoke and the spoke on the reach axis. */
const HOLE_FORWARD_LEFT: Contour = {
  start: [-0.1879, 0.41377],
  curves: [
    [-0.13743, 0.43964, -0.08227, 0.45511, -0.02571, 0.45926],
    [-0.02571, 0.35852, -0.02571, 0.25778, -0.02571, 0.15704],
    [-0.02611, 0.15665, -0.02611, 0.15665, -0.0265, 0.15665],
  ],
};

/** The grip ring — the opening the hand passes through. */
const HOLE_PIVOT: Contour = {
  start: [0.03125, 0.04747],
  curves: [
    [0.02769, 0.04391, 0.02334, 0.04074, 0.01741, 0.03797],
    [0.01266, 0.036, 0.00672, 0.03481, 0.00119, 0.03481],
    [-0.0004, 0.03481, -0.00198, 0.03481, -0.00356, 0.03481],
    [-0.0091, 0.03481, -0.01503, 0.036, -0.01978, 0.03797],
    [-0.02532, 0.04074, -0.02967, 0.04351, -0.03362, 0.04747],
    [-0.04153, 0.05498, -0.04589, 0.06566, -0.04589, 0.07753],
    [-0.04589, 0.089, -0.04153, 0.09968, -0.03323, 0.10759],
    [-0.02967, 0.11155, -0.02532, 0.11511, -0.01938, 0.11709],
    [-0.01503, 0.11907, -0.0091, 0.12025, -0.00356, 0.12025],
    [-0.00198, 0.12025, -0.0004, 0.12025, 0.00119, 0.12025],
    [0.00672, 0.12025, 0.01266, 0.11907, 0.01701, 0.11709],
    [0.02255, 0.11511, 0.0269, 0.11195, 0.03085, 0.10759],
    [0.03916, 0.09968, 0.04351, 0.0894, 0.04351, 0.07753],
    [0.04351, 0.06566, 0.03916, 0.05498, 0.03125, 0.04747],
  ],
};

/** The wedge between the spoke on the reach axis and the +X flank spoke. */
const HOLE_FORWARD_RIGHT: Contour = {
  start: [0.02373, 0.15665],
  curves: [
    [0.02334, 0.15665, 0.02334, 0.15665, 0.02294, 0.15704],
    [0.02294, 0.25778, 0.02294, 0.35852, 0.02294, 0.45926],
    [0.07872, 0.4557, 0.13291, 0.44027, 0.18513, 0.41377],
  ],
};

/** The wedge between the +X flank spoke and the rim's near corner. */
const HOLE_FLANK_RIGHT: Contour = {
  start: [0.20411, 0.22903],
  curves: [
    [0.19422, 0.22389, 0.17089, 0.21084, 0.14557, 0.19462],
    [0.12025, 0.1788, 0.09296, 0.16021, 0.07437, 0.14557],
    [0.12553, 0.22679, 0.17669, 0.30802, 0.22785, 0.38924],
    [0.28125, 0.35483, 0.31804, 0.31448, 0.33861, 0.28916],
    [0.30498, 0.27611, 0.22864, 0.2409, 0.20411, 0.22903],
  ],
};

/**
 * Width of the frame at its narrowest, normalized to staff length — measured by
 * stepping inward along the boundary's normal. It is the web between the grip
 * ring and the near edge of a flank wedge, 9.5 SVG units, and the bevel ceiling
 * is sized from it.
 */
export const FAN_FRAME_WIDTH = 0.03758;

function trace<T extends Shape | Path>(
  target: T,
  contour: Contour,
  scale: number
): T {
  target.moveTo(contour.start[0] * scale, contour.start[1] * scale);
  for (const [c1x, c1y, c2x, c2y, x, y] of contour.curves) {
    target.bezierCurveTo(
      c1x * scale,
      c1y * scale,
      c2x * scale,
      c2y * scale,
      x * scale,
      y * scale
    );
  }
  target.closePath();
  return target;
}

/**
 * Build the fan — sized against a staff of `staffLength` units and lying in the
 * XY plane ready to extrude, with the hand at the origin.
 */
export function buildFanShape(staffLength: number): Shape {
  const shape = trace(new Shape(), OUTLINE, staffLength);
  shape.holes = [
    trace(new Path(), HOLE_FLANK_LEFT, staffLength),
    trace(new Path(), HOLE_FORWARD_LEFT, staffLength),
    trace(new Path(), HOLE_PIVOT, staffLength),
    trace(new Path(), HOLE_FORWARD_RIGHT, staffLength),
    trace(new Path(), HOLE_FLANK_RIGHT, staffLength),
  ];
  return shape;
}
