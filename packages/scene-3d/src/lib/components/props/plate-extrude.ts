/**
 * Flat-prop plate stock
 *
 * The doublestar, the triquetra and the geng family are all the same object in
 * different silhouettes: a 2D outline transcribed from the pictograph artwork,
 * given depth, with a rolled edge and a white band marking the hand. This
 * module owns how that stock is cut, so a new flat prop supplies an outline and
 * nothing else.
 */

import {
  type BufferGeometry,
  ExtrudeGeometry,
  type Shape as ShapeType,
  Shape,
} from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * The extruded plate carries a bullnose edge: a shallow straight section with a
 * generous rounded bevel on each face, so the rim reads as a turned edge
 * catching light rather than a laser-cut card.
 */
const STRAIGHT_FRACTION = 0.16;
const BEVEL_FRACTION = 0.42;

/**
 * Extrude an outline into a bullnose plate, welded into one smooth shell.
 *
 * `maxInset` is the ceiling on how far the bevel may eat into the silhouette.
 * Bevel THICKNESS runs along z, where there is nothing to collide with; bevel
 * SIZE insets across the plane, and an inset larger than the local half-width
 * folds the wall through itself at the outline's narrowest features and
 * scribbles stray edges across the faces. Clamp it to what the narrowest ribbon
 * can take: the bullnose ends up slightly flatter in plane than in depth, which
 * still reads as a rolled edge rather than a defect.
 *
 * ExtrudeGeometry is unindexed, so its normals come out per-triangle and the
 * rim shades as a stack of facets. Welding the seams and deriving normals
 * across them gives the honest surface, since the whole profile is
 * tangent-continuous. Groups survive the weld (triangle order is untouched),
 * which is what keeps face and rim on separate materials: group 0 is the pair
 * of faces, group 1 is the rim.
 */
export function bullnosePlate(
  shape: ShapeType | ShapeType[],
  depth: number,
  maxInset: number,
  curveSegments = 14
): BufferGeometry {
  const bevel = depth * BEVEL_FRACTION;
  const extruded = new ExtrudeGeometry(shape, {
    depth: depth * STRAIGHT_FRACTION,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: Math.min(bevel, maxInset),
    bevelOffset: 0,
    bevelSegments: 5,
    curveSegments,
  });
  // Extrusion runs from z = -bevel to z = depth + bevel, so its middle sits at
  // depth/2. Recentre it: the plate has to spin around its own plane.
  extruded.translate(0, 0, -(depth * STRAIGHT_FRACTION) / 2);
  extruded.deleteAttribute("normal");
  extruded.deleteAttribute("uv");
  const welded = mergeVertices(extruded);
  welded.computeVertexNormals();
  extruded.dispose();
  return welded;
}

/** A grip band's footprint on the plate, in the outline's own coordinates. */
export interface GripBand {
  /** Half-extent across the prop. */
  readonly halfAcross: number;
  /** Half-extent along the prop. */
  readonly halfAlong: number;
  /** Centre along the prop. Defaults to the hand. */
  readonly centerAlong?: number;
}

/**
 * Ceiling on the band's own rolled edge. The band's half-extent along the prop,
 * not a narrow feature of the silhouette, is what binds here.
 */
export function gripBandMaxBevel(band: GripBand): number {
  return band.halfAlong * 0.4;
}

/**
 * Build a grip band as a rounded rectangle in the plate's plane, ready to
 * extrude. Corner radius is tied to the band's own thickness so a squat band
 * does not come out as a lozenge.
 */
export function gripBandShape(scale: number, band: GripBand): Shape {
  const w = band.halfAcross * scale;
  const h = band.halfAlong * scale;
  const r = Math.min(h, w) * 0.45;
  const cy = (band.centerAlong ?? 0) * scale;

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
