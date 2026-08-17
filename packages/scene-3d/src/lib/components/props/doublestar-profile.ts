/**
 * Doublestar silhouette profile
 *
 * The 3D doublestar is not an approximation of the 2D prop — it IS the 2D
 * artwork, given depth. These contours are a direct transcription of
 * `static/images/props/doublestar.svg` (viewBox 300x150): every cubic below
 * comes from that path, with its elliptical arcs converted to beziers.
 *
 * Coordinates are normalized to the prop's overall LENGTH and rotated into
 * prop-local 2D space, so the long axis runs along +Y like every other prop:
 *
 *   x = (75 - svgY) / 300     perpendicular, spans [-0.25, 0.25]
 *   y = (svgX - 150) / 300    along the prop, spans [-0.50, 0.50]
 *
 * The outline is one continuous closed curve with six rounded outward tips and
 * a smooth waist where the two stars meet. Each star carries a four-pointed
 * concave hole. The whole silhouette is symmetric under a 180 degree turn, so
 * only one hole is stored — the other is that one negated.
 */

import { Path, Shape } from "three";

/** [c1x, c1y, c2x, c2y, endX, endY] */
type Cubic = readonly [number, number, number, number, number, number];

interface Contour {
  readonly start: readonly [number, number];
  readonly curves: readonly Cubic[];
}

const OUTLINE: Contour = {
  start: [0.028, 0.474],
  curves: [
    [0.032, 0.42267, 0.05433, 0.37833, 0.09033, 0.34167],
    [0.12633, 0.305, 0.174, 0.28267, 0.22433, 0.27833],
    [0.23889, 0.27676, 0.24991, 0.26447, 0.24991, 0.24983],
    [0.24991, 0.2352, 0.23889, 0.22291, 0.22433, 0.22133],
    [0.11367, 0.212, 0.027, 0.11267, 0.027, 0],
    [0.027, -0.11267, 0.11367, -0.212, 0.22433, -0.22133],
    [0.23889, -0.22291, 0.24991, -0.2352, 0.24991, -0.24983],
    [0.24991, -0.26447, 0.23889, -0.27676, 0.22433, -0.27833],
    [0.174, -0.28267, 0.12633, -0.305, 0.09033, -0.34167],
    [0.05433, -0.37833, 0.03233, -0.42267, 0.028, -0.474],
    [0.02667, -0.48867, 0.01467, -0.5, 0, -0.5],
    [-0.01433, -0.5, -0.02667, -0.48867, -0.028, -0.474],
    [-0.032, -0.42267, -0.05433, -0.37833, -0.09033, -0.34167],
    [-0.12633, -0.305, -0.174, -0.28267, -0.22433, -0.27833],
    [-0.23889, -0.27676, -0.24991, -0.26447, -0.24991, -0.24983],
    [-0.24991, -0.2352, -0.23889, -0.22291, -0.22433, -0.22133],
    [-0.11367, -0.212, -0.027, -0.11267, -0.027, 0],
    [-0.027, 0.11267, -0.11367, 0.212, -0.22433, 0.22133],
    [-0.23889, 0.22291, -0.24991, 0.2352, -0.24991, 0.24983],
    [-0.24991, 0.26447, -0.23889, 0.27676, -0.22433, 0.27833],
    [-0.174, 0.28267, -0.12633, 0.305, -0.09033, 0.34167],
    [-0.05433, 0.37833, -0.03233, 0.42267, -0.028, 0.474],
    [-0.02667, 0.48867, -0.01467, 0.5, 0, 0.5],
    [0.01467, 0.5, 0.02667, 0.48867, 0.028, 0.474],
  ],
};

/** The four-pointed hole in the star nearer -Y. */
const STAR_HOLE: Contour = {
  start: [-0.12467, -0.25],
  curves: [
    [-0.09767, -0.26333, -0.07333, -0.281, -0.05167, -0.30267],
    [-0.03041, -0.32426, -0.01295, -0.34928, 0, -0.37667],
    [0.013, -0.34933, 0.03033, -0.32467, 0.052, -0.30267],
    [0.07333, -0.281, 0.09767, -0.26333, 0.12467, -0.25],
    [0.07016, -0.22284, 0.02629, -0.17826, 0, -0.12333],
    [-0.02629, -0.17826, -0.07016, -0.22284, -0.12467, -0.25],
  ],
};

function trace<T extends Shape | Path>(
  target: T,
  contour: Contour,
  scale: number,
  turned: boolean
): T {
  const s = turned ? -scale : scale;
  target.moveTo(contour.start[0] * s, contour.start[1] * s);
  for (const [c1x, c1y, c2x, c2y, x, y] of contour.curves) {
    target.bezierCurveTo(c1x * s, c1y * s, c2x * s, c2y * s, x * s, y * s);
  }
  target.closePath();
  return target;
}

/**
 * Build the doublestar silhouette as a Three.js shape, sized so the prop's
 * long axis measures `length` units and lying in the XY plane ready to extrude.
 */
export function buildDoublestarShape(length: number): Shape {
  const shape = trace(new Shape(), OUTLINE, length, false);
  shape.holes = [
    trace(new Path(), STAR_HOLE, length, false),
    trace(new Path(), STAR_HOLE, length, true),
  ];
  return shape;
}
