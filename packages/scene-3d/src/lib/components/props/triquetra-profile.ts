/**
 * Triquetra silhouette profile
 *
 * The 3D triquetra is not an approximation of the 2D prop — it IS the 2D
 * artwork, given depth. These contours are a direct transcription of one knot
 * from `static/images/props/triquetra.svg` (viewBox 290.3x169.6): every cubic
 * below comes from that file, with its elliptical arcs converted to beziers.
 * One closed outline plus four holes — the two near lobes, the core triangle,
 * and the far lobe's ring interior.
 *
 * Coordinates are normalized to the STAFF's drawn span (252.8 SVG units, the
 * shared unit across every prop drawing) and rotated into prop-local 2D space,
 * so the prop's reach runs along +Y like every other prop:
 *
 *   x = (svgY - 84.8)  / 252.8    across the prop, spans [-0.335, 0.335]
 *   y = (svgX - 150.5) / 252.8    along the prop,  spans [-0.060, 0.553]
 *
 * The origin is the hand, and the table is written with the knot's near cusp
 * sitting exactly on it. The artwork actually stands the cusp off the hand by
 * `TRIQUETRA_CUSP_GAP`, which the builders add back — see that constant.
 *
 * One knot is not the whole prop. `triquetra.svg` draws TWO of them, mirrored
 * about the hand, reaching in opposite directions: a double-ended prop just
 * under a metre long, held in the middle where the two knots meet.
 * `triquetra2.svg` draws a single knot held through the middle of the weave.
 * Both are built from this one table.
 */

import { Path, Shape } from "three";
import type { GripBand } from "./plate-extrude";

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
 * as the closest approach between the outline and any hole. The grip band and
 * the bevel ceiling are both sized from it.
 */
export const TRIQUETRA_RIBBON_WIDTH = 0.0542;

/**
 * How far the knot's near cusp stands off the hand in the artwork, normalized
 * to staff length — 5.35 SVG units, 1.8cm at default size.
 *
 * The contour table above is written with the cusp on the origin, so every
 * builder adds this back to restore the drawing. On the double prop it opens a
 * 3.7cm channel between the two knots' cusps, and that channel is not an error
 * in the drawing: it is where the handle goes. The grip band fills it and
 * laps onto both knots, which is what joins them into one prop.
 */
export const TRIQUETRA_CUSP_GAP = 0.02117;

/**
 * The grip band, sized against the plate rather than guessed at. Width is set
 * by the hand — 9.7cm — and is the same on both props. Height and placement
 * are not, because the two bands do different jobs.
 *
 * On the double prop the band is structural and centred on the hand: 4.8cm
 * spans the 3.7cm channel between the two cusps and still laps 0.55cm onto
 * solid material at the narrowest point (x = 0), where sampling the silhouette
 * puts the plate's edge at 1.8cm and unbroken material from there out to
 * 7.9cm. The plate holds far more than 9.7cm of width at that height — 34cm
 * before it runs out — so the band cannot overhang.
 *
 * On the single knot the band is a wrap, seated just past the hand on the
 * ribbon dividing the core from the far lobe. That ribbon is 4.75cm thick but
 * it is an ARC, so a straight band as tall as the ribbon runs off it at both
 * ends: at 4.8cm tall the plate only carries 4.4cm of width, less than half
 * the hand. Tape proportions are what fit — 2.2cm tall leaves room for 24.7cm,
 * so the 9.7cm band sits well inside the material across its whole length.
 */
/** Both bands span the same width across the prop. */
const GRIP_HALF_ACROSS = 0.056;

export const TRIQUETRA_GRIP: GripBand = {
  halfAcross: GRIP_HALF_ACROSS,
  halfAlong: 0.028,
};

/** Wrap seated on the ribbon the single knot hangs from. */
export const TRIQUETRA2_GRIP: GripBand = {
  halfAcross: GRIP_HALF_ACROSS,
  halfAlong: 0.013,
  centerAlong: 0.013,
};

/**
 * How far along the prop the single-knot variant grips, normalized to staff
 * length.
 *
 * triquetra2 is not a second drawing — measured against this profile it is one
 * of the double prop's knots to within drawing noise, in a square viewBox that
 * places the hand somewhere else entirely. Its viewBox centre lands at
 * y = 0.21558 here, which is 0.79cm inside the core hole; the nearest material
 * beyond it is y = 0.22468, exactly the core's far bound. So the hand hangs on
 * the inner edge of the ribbon dividing the core from the far lobe — you put
 * your hand through the middle of the weave rather than holding a junction.
 * Snapping onto that edge is the one correction this variant needs: the prop
 * has to touch the hand.
 */
export const TRIQUETRA2_GRIP_OFFSET = 0.22468;

interface Placement {
  /** Point in the contour table's own frame that is brought to the hand. */
  readonly offset: number;
  /** Reflect the knot back along the prop, for the double's second half. */
  readonly mirror?: boolean;
}

function trace<T extends Shape | Path>(
  target: T,
  contour: Contour,
  scale: number,
  place: Placement
): T {
  const sy = place.mirror ? -scale : scale;
  const shift = place.offset;
  const px = (x: number) => x * scale;
  const py = (y: number) => (y - shift) * sy;

  target.moveTo(px(contour.start[0]), py(contour.start[1]));
  for (const [c1x, c1y, c2x, c2y, x, y] of contour.curves) {
    target.bezierCurveTo(px(c1x), py(c1y), px(c2x), py(c2y), px(x), py(y));
  }
  target.closePath();
  return target;
}

function buildKnot(staffLength: number, place: Placement): Shape {
  const shape = trace(new Shape(), OUTLINE, staffLength, place);
  shape.holes = [
    trace(new Path(), HOLE_LEFT_LOBE, staffLength, place),
    trace(new Path(), HOLE_RIGHT_LOBE, staffLength, place),
    trace(new Path(), HOLE_CORE, staffLength, place),
    trace(new Path(), HOLE_FAR_LOBE, staffLength, place),
  ];
  return shape;
}

/**
 * Build the double triquetra — two knots mirrored about the hand — sized
 * against a staff of `staffLength` units and lying in the XY plane ready to
 * extrude, with the hand at the origin and the prop reaching along both ±Y.
 *
 * The two knots interlock: their near lobes overlap across a lens either side
 * of the junction, about 9% of the plate's area. That needs no boolean union
 * to render. Both are extruded to identical depth in the same plane, so every
 * face one knot contributes inside the other is exactly coplanar with it and
 * every rim it contributes there sits at or below that plane — the depth test
 * resolves the pair into the union's silhouette on its own.
 */
export function buildTriquetraShapes(staffLength: number): Shape[] {
  // The table puts the cusp on the origin; bringing the point one gap SHORT of
  // it to the hand stands both cusps back off by the gap, as drawn.
  const place = { offset: -TRIQUETRA_CUSP_GAP };
  return [
    buildKnot(staffLength, place),
    buildKnot(staffLength, { ...place, mirror: true }),
  ];
}

/**
 * Build a single triquetra knot gripped `gripOffset` along its length — the
 * triquetra2 variant. The shape is the same one the double prop is made of;
 * only where the hand meets it changes.
 */
export function buildTriquetraShape(
  staffLength: number,
  gripOffset: number
): Shape {
  return buildKnot(staffLength, { offset: gripOffset });
}
