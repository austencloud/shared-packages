/**
 * Geng silhouette profiles
 *
 * The geng family is a blade bent into circular arcs: the buugeng is an S of
 * two arcs meeting at the hand, the trigeng is the same blade run three ways
 * out of one centre. Neither is a swept tube and neither is a sine wave — the
 * curvature is constant along each arm and the stock is flat.
 *
 * These contours are a direct transcription of `static/images/props/buugeng.svg`
 * (viewBox 262.6x135.9) and `static/images/props/trigeng.svg` (viewBox
 * 250x236.7): every cubic below comes from those paths, with their elliptical
 * arcs converted to beziers and Illustrator's zero-length segments dropped.
 *
 * Coordinates are normalized to the STAFF's span, so a geng and a staff stand
 * in the same relation in 3D as they do on the pictograph grid, and rotated
 * into prop-local 2D space so the long axis runs along +Y like every other
 * prop:
 *
 *   x = (svgY - handY) / 252.8     across the prop
 *   y = (svgX - handX) / 252.8     along the prop
 *
 * `252.8` is `staff.svg`'s own viewBox width — one staff length. The hand is
 * the artwork's viewBox centre, which is where `prop-svg-loader.ts` puts it in
 * 2D, so the tables are already written with the hand on the origin. Both
 * outlines are a single closed curve with no holes.
 */

import { Shape } from "three";
import type { GripBand } from "./plate-extrude";

/** [c1x, c1y, c2x, c2y, endX, endY] */
type Cubic = readonly [number, number, number, number, number, number];

interface Contour {
  readonly start: readonly [number, number];
  readonly curves: readonly Cubic[];
}

/**
 * The blade at its narrowest, normalized to staff length — measured by stepping
 * inward from the outline until the material ends. Both artworks cut the same
 * 4.6cm blade; the narrower of the two sets the bevel ceiling for the family.
 */
export const GENG_BLADE_WIDTH = 0.0534;

/**
 * Where the hand meets each blade. The buugeng grips the waist where its two
 * arcs cross; the trigeng grips the hub the three arms leave from, which has a
 * little more room. Both bands are sized to sit wholly on material — the blade
 * curves away under them, so a band that spans the full blade width overhangs
 * into open air on the outside of the curve.
 */
export const BUUGENG_GRIP: GripBand = { halfAcross: 0.0277, halfAlong: 0.0297 };
export const TRIGENG_GRIP: GripBand = { halfAcross: 0.0316, halfAlong: 0.0316 };

const BUUGENG_OUTLINE: Contour = {
  start: [0.26325, 0.24446],
  curves: [
    [0.26325, 0.21242, 0.25771, 0.18078, 0.24703, 0.14953],
    [0.21895, 0.06962, 0.15961, 0.00831, 0.08445, -0.01701],
    [0.08089, -0.0178, 0.06824, -0.02097, 0.03936, -0.02809],
    [0.02617, -0.03112, 0.01299, -0.03415, -0.0002, -0.03718],
    [-0.00969, -0.03956, -0.01681, -0.04114, -0.01879, -0.04193],
    [-0.11729, -0.07041, -0.18414, -0.17801, -0.16357, -0.2765],
    [-0.15249, -0.36432, -0.08841, -0.4375, -0.00376, -0.45886],
    [-0.00204, -0.45912, -0.00033, -0.45939, 0.00138, -0.45965],
    [0.00732, -0.46242, 0.01602, -0.46598, 0.02077, -0.47547],
    [0.02314, -0.4822, 0.02393, -0.48892, 0.02156, -0.49565],
    [0.01483, -0.51384, -0.00494, -0.51384, -0.01206, -0.51384],
    [-0.02393, -0.51384, -0.03975, -0.51187, -0.06112, -0.50791],
    [-0.13232, -0.48695, -0.19086, -0.44146, -0.22369, -0.38252],
    [-0.26642, -0.31606, -0.27512, -0.23101, -0.24703, -0.14992],
    [-0.21934, -0.07002, -0.16001, -0.00949, -0.08445, 0.01661],
    [-0.07773, 0.01899, -0.05597, 0.02373, -0.02354, 0.03125],
    [-0.01483, 0.03323, -0.00653, 0.03481, 0.00059, 0.03679],
    [0.00692, 0.03837, 0.01206, 0.03956, 0.01523, 0.03995],
    [0.01628, 0.04022, 0.01734, 0.04048, 0.01839, 0.04074],
    [0.11729, 0.07002, 0.18374, 0.17801, 0.16357, 0.2769],
    [0.1521, 0.36439, 0.08874, 0.43619, 0.00336, 0.45847],
    [0.00165, 0.45912, -0.00007, 0.45978, -0.00178, 0.46044],
    [-0.00494, 0.46123, -0.01602, 0.46479, -0.02077, 0.47627],
    [-0.02354, 0.48259, -0.02393, 0.48932, -0.02116, 0.49644],
    [-0.01167, 0.51978, 0.01839, 0.51582, 0.06032, 0.50831],
    [0.06125, 0.50818, 0.06217, 0.50804, 0.06309, 0.50791],
    [0.13232, 0.48774, 0.19086, 0.44185, 0.22369, 0.38291],
    [0.2494, 0.3413, 0.2631, 0.29338, 0.26325, 0.24446],
  ],
};

const TRIGENG_OUTLINE: Contour = {
  start: [-0.00178, -0.29153],
  curves: [
    [-0.05518, -0.22983, -0.07733, -0.15071, -0.0627, -0.07516],
    [-0.06151, -0.06843, -0.05479, -0.04786, -0.04569, -0.01701],
    [-0.04411, -0.01147, -0.04213, -0.00593, -0.04094, -0.00079],
    [-0.04727, 0.00514, -0.04885, 0.00672, -0.05004, 0.00752],
    [-0.12164, 0.07634, -0.24387, 0.0803, -0.31626, 0.01543],
    [-0.3835, -0.0356, -0.41357, -0.12381, -0.39181, -0.20411],
    [-0.39181, -0.20491, -0.39142, -0.2057, -0.39102, -0.20649],
    [-0.39036, -0.20807, -0.3897, -0.20965, -0.38904, -0.21123],
    [-0.38865, -0.21756, -0.38746, -0.22666, -0.393, -0.23497],
    [-0.39735, -0.24011, -0.40289, -0.24407, -0.40961, -0.24525],
    [-0.4282, -0.24842, -0.4377, -0.2318, -0.44126, -0.22587],
    [-0.4468, -0.21598, -0.45312, -0.20174, -0.45985, -0.18196],
    [-0.47686, -0.11234, -0.46697, -0.04114, -0.43335, 0.01464],
    [-0.39854, 0.08267, -0.33129, 0.13093, -0.2498, 0.14676],
    [-0.1695, 0.16218, -0.09039, 0.14161, -0.03184, 0.09098],
    [-0.0267, 0.08663, -0.01206, 0.07041, 0.00969, 0.04707],
    [0.01365, 0.04272, 0.0176, 0.03877, 0.02116, 0.03481],
    [0.02947, 0.03718, 0.03145, 0.03797, 0.03303, 0.03837],
    [0.12836, 0.06606, 0.19284, 0.17009, 0.17306, 0.26503],
    [0.16238, 0.34929, 0.10146, 0.4193, 0.02077, 0.44066],
    [0.01998, 0.44106, 0.01919, 0.44106, 0.01839, 0.44146],
    [0.01668, 0.44172, 0.01497, 0.44198, 0.01325, 0.44225],
    [0.00771, 0.44502, -0.00099, 0.44818, -0.00534, 0.45767],
    [-0.00771, 0.464, -0.0085, 0.47073, -0.00613, 0.47706],
    [0.0002, 0.49446, 0.01958, 0.49446, 0.02631, 0.49446],
    [0.03778, 0.49446, 0.0532, 0.49248, 0.07377, 0.48892],
    [0.1426, 0.46875, 0.19917, 0.42484, 0.23081, 0.36788],
    [0.27195, 0.3038, 0.28066, 0.22152, 0.25336, 0.1432],
    [0.22646, 0.06606, 0.16911, 0.00752, 0.09632, -0.0178],
    [0.08999, -0.02017, 0.06863, -0.02453, 0.03738, -0.03204],
    [0.03145, -0.03323, 0.02631, -0.03441, 0.02116, -0.0356],
    [0.01919, -0.04391, 0.01879, -0.04628, 0.01839, -0.04786],
    [-0.00534, -0.14399, 0.05241, -0.25198, 0.14458, -0.28244],
    [0.22251, -0.31527, 0.31388, -0.29747, 0.37282, -0.23853],
    [0.37322, -0.23813, 0.37401, -0.23734, 0.37441, -0.23695],
    [0.37546, -0.23563, 0.37652, -0.23431, 0.37757, -0.23299],
    [0.38271, -0.22943, 0.38983, -0.22389, 0.40012, -0.22429],
    [0.40684, -0.22547, 0.41278, -0.22824, 0.41752, -0.23339],
    [0.42939, -0.24763, 0.4199, -0.26424, 0.41634, -0.27017],
    [0.4108, -0.28006, 0.40131, -0.29233, 0.38786, -0.30854],
    [0.33604, -0.35799, 0.26958, -0.38489, 0.20431, -0.3841],
    [0.12797, -0.38805, 0.05241, -0.35403, -0.00178, -0.29153],
  ],
};

function trace(contour: Contour, scale: number): Shape {
  const shape = new Shape();
  shape.moveTo(contour.start[0] * scale, contour.start[1] * scale);
  for (const [c1x, c1y, c2x, c2y, x, y] of contour.curves) {
    shape.bezierCurveTo(
      c1x * scale,
      c1y * scale,
      c2x * scale,
      c2y * scale,
      x * scale,
      y * scale
    );
  }
  shape.closePath();
  return shape;
}

/**
 * Build the buugeng — two arcs meeting at the hand — sized against a staff of
 * `staffLength` units and lying in the XY plane ready to extrude, with the hand
 * at the origin and the blade reaching along both ±Y.
 */
export function buildBuugengShape(staffLength: number): Shape {
  return trace(BUUGENG_OUTLINE, staffLength);
}

/** Build the trigeng — three arms off one hub, gripped at the hub. */
export function buildTrigengShape(staffLength: number): Shape {
  return trace(TRIGENG_OUTLINE, staffLength);
}
