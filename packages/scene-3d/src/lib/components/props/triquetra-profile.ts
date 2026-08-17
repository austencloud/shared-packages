/**
 * Triquetra silhouette profile
 *
 * The 3D triquetra is not an approximation of the 2D prop — it IS the 2D
 * artwork, given depth. These contours are a direct transcription of the knot
 * `static/images/props/triquetra.svg` draws: every cubic below comes from that
 * file, with its elliptical arcs converted to beziers. One closed outline plus
 * four holes — the two near lobes, the core triangle, and the far lobe's ring
 * interior.
 *
 * Coordinates are normalized to the STAFF's drawn span (252.8 SVG units, the
 * shared unit across every prop drawing) and rotated into prop-local 2D space,
 * so the prop's reach runs along +Y like every other prop:
 *
 *   x = (svgY - 84.8)  / 252.8    across the prop
 *   y = (svgX - 150.5) / 252.8    along the prop
 *
 * The two props are ONE knot each. They differ only in where the hand meets it,
 * and the hand is always the viewBox centre — that is where `prop-svg-loader`
 * puts it in 2D, so it is where it goes in 3D.
 *
 * `triquetra.svg` carries a second copy of the knot, mirrored about that
 * centre, marked `fill:none`. It draws nothing. It is there to widen the
 * viewBox so the centre lands near the knot's base rather than through its
 * middle — the drawing's way of moving the hand. Extruding it would put a
 * second knot on the prop that the artwork does not have.
 */

import { Path, Shape } from "three";

/** [c1x, c1y, c2x, c2y, endX, endY] */
type Cubic = readonly [number, number, number, number, number, number];

interface Contour {
  readonly start: readonly [number, number];
  readonly curves: readonly Cubic[];
}

const OUTLINE: Contour = {
  start: [-0.00633, 0.54826],
  curves: [
    [-0.10118, 0.47871, -0.15302, 0.36483, -0.1432, 0.24763],
    [-0.17326, 0.23378, -0.20055, 0.21559, -0.22468, 0.19343],
    [-0.28666, 0.13825, -0.32587, 0.06195, -0.33465, -0.02057],
    [-0.33492, -0.02281, -0.33518, -0.02505, -0.33544, -0.02729],
    [-0.33333, -0.02861, -0.33122, -0.02993, -0.32911, -0.03125],
    [-0.32885, -0.03138, -0.32859, -0.03151, -0.32832, -0.03165],
    [-0.28544, -0.05052, -0.23909, -0.06022, -0.19225, -0.06013],
    [-0.12263, -0.06013, -0.05617, -0.03956, 0, 0],
    [0.05635, -0.03938, 0.1235, -0.06038, 0.19225, -0.06013],
    [0.23932, -0.06013, 0.28521, -0.05063, 0.32832, -0.03165],
    [0.3307, -0.03046, 0.33307, -0.02927, 0.33544, -0.02809],
    [0.33518, -0.02571, 0.33492, -0.02334, 0.33465, -0.02097],
    [0.32596, 0.0617, 0.28675, 0.13815, 0.22468, 0.19343],
    [0.20031, 0.21538, 0.17286, 0.23363, 0.1432, 0.24763],
    [0.15318, 0.36486, 0.1013, 0.47881, 0.00633, 0.54826],
    [0.00422, 0.54971, 0.00211, 0.55116, 0, 0.55261],
  ],
};

/** Interior of the lobe reaching out to -X. */
const HOLE_LEFT_LOBE: Contour = {
  start: [-0.19225, -0.00514],
  curves: [
    [-0.22033, -0.00514, -0.24802, -0.00119, -0.27413, 0.00712],
    [-0.25593, 0.08663, -0.20491, 0.15348, -0.13331, 0.19185],
    [-0.11819, 0.13391, -0.08787, 0.08106, -0.04549, 0.03877],
    [-0.04496, 0.03824, -0.04444, 0.03771, -0.04391, 0.03718],
    [-0.08821, 0.00949, -0.13964, -0.00514, -0.19225, -0.00514],
  ],
};

/** Interior of the lobe reaching out to +X. */
const HOLE_RIGHT_LOBE: Contour = {
  start: [0.27453, 0.00712],
  curves: [
    [0.19721, -0.01642, 0.1135, -0.00562, 0.0447, 0.03679],
    [0.04509, 0.03718, 0.04549, 0.03758, 0.04589, 0.03797],
    [0.08852, 0.08008, 0.11888, 0.133, 0.1337, 0.19106],
    [0.20492, 0.15286, 0.25623, 0.08584, 0.27453, 0.00712],
  ],
};

/** The curved triangle at the centre, where all three lobes overlap. */
const HOLE_CORE: Contour = {
  start: [0.08228, 0.21242],
  curves: [
    [0.06942, 0.15822, 0.04095, 0.10899, 0.0004, 0.07081],
    [-0.04074, 0.10918, -0.06883, 0.15783, -0.08149, 0.21242],
    [-0.05498, 0.22033, -0.02769, 0.22468, 0.0004, 0.22468],
    [0.02848, 0.22429, 0.05578, 0.22033, 0.08228, 0.21242],
  ],
};

/** Interior of the lobe reaching out along +Y, closed off by the ring. */
const HOLE_FAR_LOBE: Contour = {
  start: [0.08821, 0.27611],
  curves: [
    [0.08821, 0.27334, 0.08821, 0.27057, 0.08821, 0.2678],
    [0.05934, 0.27571, 0.02967, 0.27967, 0, 0.27967],
    [-0.02967, 0.27967, -0.05934, 0.27571, -0.08861, 0.2678],
    [-0.08861, 0.27057, -0.08861, 0.27334, -0.08861, 0.27611],
    [-0.08861, 0.35324, -0.05657, 0.42801, -0.0004, 0.48141],
    [0.05616, 0.42811, 0.08822, 0.35383, 0.08821, 0.27611],
  ],
};

/**
 * Width of the ribbon at its narrowest, normalized to staff length — measured
 * as the closest approach between the outline and any hole. The bevel ceiling
 * is sized from it.
 */
export const TRIQUETRA_RIBBON_WIDTH = 0.0542;

/** The point of the contour table that the hand sits on. */
interface Hand {
  /** Along the prop. */
  readonly along: number;
  /** Across the prop. */
  readonly across: number;
}

/**
 * `triquetra.svg` is a 290.3x169.6 box, so its centre is (145.15, 84.8) — 5.35
 * units short of where this table puts its origin, which is 1.8cm out along the
 * prop. The hand lands just off the knot's near cusp: you hold it at the base
 * and the whole weave reaches away from you.
 */
export const TRIQUETRA_HAND: Hand = { along: -0.02117, across: 0 };

/**
 * `triquetra2.svg` is the same knot in a square 170x170 box, translated 120
 * units left, so its centre is (205, 85) in this table's frame. That lands
 * inside the core hole — the hand goes THROUGH the middle of the weave rather
 * than holding the base. Same drawing, different grip.
 */
export const TRIQUETRA2_HAND: Hand = { along: 0.21559, across: 0.00079 };

function trace<T extends Shape | Path>(
  target: T,
  contour: Contour,
  scale: number,
  hand: Hand
): T {
  const px = (x: number) => (x - hand.across) * scale;
  const py = (y: number) => (y - hand.along) * scale;

  target.moveTo(px(contour.start[0]), py(contour.start[1]));
  for (const [c1x, c1y, c2x, c2y, x, y] of contour.curves) {
    target.bezierCurveTo(px(c1x), py(c1y), px(c2x), py(c2y), px(x), py(y));
  }
  target.closePath();
  return target;
}

/**
 * Build the triquetra — one knot, sized against a staff of `staffLength` units
 * and lying in the XY plane ready to extrude, with `hand` brought to the
 * origin.
 */
export function buildTriquetraShape(staffLength: number, hand: Hand): Shape {
  const shape = trace(new Shape(), OUTLINE, staffLength, hand);
  shape.holes = [
    trace(new Path(), HOLE_LEFT_LOBE, staffLength, hand),
    trace(new Path(), HOLE_RIGHT_LOBE, staffLength, hand),
    trace(new Path(), HOLE_CORE, staffLength, hand),
    trace(new Path(), HOLE_FAR_LOBE, staffLength, hand),
  ];
  return shape;
}
