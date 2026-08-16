/**
 * Triquetra silhouette profile
 *
 * The 3D triquetra is not an approximation of the 2D prop — it IS the 2D
 * artwork, given depth. These contours are a direct transcription of the
 * filled path in `static/images/props/triquetra.svg` (viewBox 290.3x169.6):
 * every cubic below comes from that path, with its elliptical arcs converted
 * to beziers. One closed outline plus four holes — the two lower lobes, the
 * core triangle, and the upper lobe's ring interior.
 *
 * Coordinates are normalized to the STAFF's drawn span (252.8 SVG units, the
 * shared unit across every prop drawing) and rotated into prop-local 2D space,
 * so the prop's reach runs along +Y like every other prop:
 *
 *   x = (svgY - 84.8)  / 252.8    across the prop, spans [-0.335, 0.335]
 *   y = (svgX - 150.5) / 252.8    along the prop,  spans [-0.060, 0.553]
 *
 * The origin is the hand. The 2D prop's hand point is its viewBox centre
 * (`prop-svg-loader.ts`), which for this artwork lands 5.35 SVG units short of
 * the material; the transcription snaps it onto the plate's near cusp instead,
 * so the prop touches the hand the way Hoop3D's ring does. That is a 2cm
 * correction at default size and it moves nothing about the shape itself.
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
 * as the closest approach between the outline and any hole. The grip band and
 * the bevel ceiling are both sized from it.
 */
export const TRIQUETRA_RIBBON_WIDTH = 0.0542;

/**
 * The grip wrap, sized against the plate rather than guessed at.
 *
 * The hand sits at the origin, which is the cusp tip where the two near lobes
 * cross — the outline touches it exactly, so there is no material at or below
 * y = 0 near x = 0 and the wrap has to start there and run outward. Sampling
 * the silhouette on a grid gives the widest band the plate can hold at each
 * height, and the plate narrows fast: 2.2cm tall leaves room for a 9.7cm wrap,
 * while 3.6cm tall is already down to 7.6cm as the two near lobes' interiors
 * close in. Tape proportions win — a band as tall as it is deep reads as a
 * wrap around the crossing, where a squarer one reads as a badge stuck on the
 * face.
 */
const GRIP_HALF_WIDTH = 0.056;
const GRIP_HALF_HEIGHT = 0.013;
const GRIP_CORNER = 0.006;

/** Centre of the grip wrap along the prop, normalized to staff length. */
export const TRIQUETRA_GRIP_CENTER_Y = GRIP_HALF_HEIGHT;

/**
 * Ceiling on the wrap's own rolled edge. Unlike the plate, the binding
 * constraint here is the band's half-height, not a narrow feature of the
 * silhouette: a bevel that insets further than the band is thin folds the roll
 * through itself along the whole length of the wrap.
 */
export const TRIQUETRA_GRIP_MAX_BEVEL = GRIP_HALF_HEIGHT * 0.4;

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
 * Build the triquetra silhouette as a Three.js shape, sized against a staff of
 * `staffLength` units and lying in the XY plane ready to extrude, with the hand
 * at the origin and the prop reaching along +Y.
 */
export function buildTriquetraShape(staffLength: number): Shape {
  const shape = trace(new Shape(), OUTLINE, staffLength);
  shape.holes = [
    trace(new Path(), HOLE_LEFT_LOBE, staffLength),
    trace(new Path(), HOLE_RIGHT_LOBE, staffLength),
    trace(new Path(), HOLE_CORE, staffLength),
    trace(new Path(), HOLE_FAR_LOBE, staffLength),
  ];
  return shape;
}

/**
 * Build the grip wrap as a rounded rectangle in the same space as the plate,
 * centred on `TRIQUETRA_GRIP_CENTER_Y`. Extruding it rather than boxing it is
 * what makes it read as tape wrapped around plate stock: the rolled edge
 * catches the same highlight the plate's rim does, where a hard box face sits
 * on the artwork like a sticker.
 */
export function buildTriquetraGripShape(staffLength: number): Shape {
  const w = GRIP_HALF_WIDTH * staffLength;
  const h = GRIP_HALF_HEIGHT * staffLength;
  const r = GRIP_CORNER * staffLength;
  const cy = TRIQUETRA_GRIP_CENTER_Y * staffLength;

  const shape = new Shape();
  shape.moveTo(-w + r, cy - h);
  shape.lineTo(w - r, cy - h);
  shape.quadraticCurveTo(w, cy - h, w, cy - h + r);
  shape.lineTo(w, cy + h - r);
  shape.quadraticCurveTo(w, cy + h, w - r, cy + h);
  shape.lineTo(-w + r, cy + h);
  shape.quadraticCurveTo(-w, cy + h, -w, cy + h - r);
  shape.lineTo(-w, cy - h + r);
  shape.quadraticCurveTo(-w, cy - h, -w + r, cy - h);
  shape.closePath();
  return shape;
}
