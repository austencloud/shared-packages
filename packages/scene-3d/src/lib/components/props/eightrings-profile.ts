/**
 * Eight rings silhouette profile
 *
 * The 3D eight rings is not an approximation of the 2D prop — it IS the 2D
 * artwork, given depth. `static/images/props/eightrings.svg` draws two paths,
 * each an identical flat annulus, set side by side along one axis and
 * overlapping where they cross. The prop is that figure eight: flat ring stock,
 * not tube, and the two rings are coplanar.
 *
 * The drawing's own numbers, read off the two paths:
 *
 *   outer radius   68.25 SVG units
 *   inner radius   52.25
 *   centres        (68.25, 68.85) and (188.75, 68.55), 120.5 apart
 *
 * Which is to say: two rings of identical section, 16 units of stock all the
 * way round, their centres 120.5 apart on a shared axis. Illustrator rounded
 * the two centre heights 0.3 apart and the viewBox 0.3 wider than the figure;
 * that wobble is drawing tolerance, and keeping it would leave a spinning prop
 * a tenth of a percent lopsided for no reason. The rings below sit on one axis,
 * with the hand at their shared centre — the crossing, which is both where the
 * viewBox centre is aiming and the only place a hand can take this prop.
 *
 * Coordinates are normalized to the STAFF's drawn span (252.8 SVG units, the
 * shared unit across every prop drawing), and the prop reaches along +Y like
 * every other one. Both rings are circles, so they are laid down as true arcs
 * rather than transcribed beziers — an exact circle beats a four-cubic
 * approximation of one.
 *
 * The two annuli overlap, so extruding them as two separate plates would leave
 * a lens of doubled coplanar faces to z-fight. The outline below is their union
 * instead: the outer circles cross at two points, and the arc between those
 * points on each ring's far side traces the whole silhouette. Each inner circle
 * stays a clean hole — the inner circles are 120.5 apart with radius 52.25, so
 * they never meet, and each is tangent to the other ring's outer circle at a
 * single interior point rather than cutting it.
 */

import { Path, Shape } from "three";

const OUTER = 68.25 / 252.8;
const INNER = 52.25 / 252.8;
/** Half the distance between the two ring centres. */
const OFFSET = 60.25 / 252.8;

/** Where the outer circles cross, measured across the prop from the hand. */
const CROSSING = Math.sqrt(OUTER * OUTER - OFFSET * OFFSET);

/**
 * Angle from a ring's centre out to a crossing point, off the axis that runs
 * across the prop. Each ring contributes everything but the wedge between its
 * two crossing points, so its arc sweeps `2 * PHI + PI`.
 */
const PHI = Math.atan2(OFFSET, CROSSING);

/**
 * Width of the stock, normalized to staff length. It is the same all the way
 * round both rings, and the bevel ceiling is sized from it.
 */
export const EIGHTRINGS_STOCK_WIDTH = OUTER - INNER;

/**
 * Build the eight rings — sized against a staff of `staffLength` units and
 * lying in the XY plane ready to extrude, with the hand at the origin.
 */
export function buildEightringsShape(staffLength: number): Shape {
  const outer = OUTER * staffLength;
  const inner = INNER * staffLength;
  const offset = OFFSET * staffLength;

  // The far ring's arc, then the near ring's, each skipping the wedge its
  // neighbour covers. They meet exactly at the two crossing points, so the
  // outline closes with no connecting line between them.
  const shape = new Shape();
  shape.absarc(0, offset, outer, -PHI, PHI + Math.PI, false);
  shape.absarc(0, -offset, outer, Math.PI - PHI, PHI + 2 * Math.PI, false);
  shape.closePath();

  shape.holes = [
    new Path().absarc(0, offset, inner, 0, 2 * Math.PI, false),
    new Path().absarc(0, -offset, inner, 0, 2 * Math.PI, false),
  ];
  return shape;
}
