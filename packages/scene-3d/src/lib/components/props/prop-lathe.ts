/**
 * Revolved prop parts
 *
 * Several props are not plate stock at all — they are turned or wrapped bodies
 * with a round section: a kevlar wick, a knurled grip, a glow head, a torch
 * shaft. Every one of those is a solid of revolution, so it is described by a
 * half-section and spun, which is exactly what `LatheGeometry` is for.
 *
 * `roundedCylinder` is the shape that keeps coming up: a body of one radius (or
 * a straight taper between two) with its corners broken, which is what a
 * wrapped wick, a moulded head and a machined collar all read as. Squaring the
 * corners instead makes a prop look like a stack of tin cans; rounding them all
 * the way to a capsule makes it look like a pill.
 *
 * `revolvedProfile` is the other half: when the prop's own artwork draws it side
 * on, the silhouette IS the half-section, so there is nothing to idealize. Feed
 * the measured radii straight in.
 */

import { BufferGeometry, LatheGeometry, Vector2 } from "three";

export interface RoundedCylinderOptions {
  /** Overall length along the local +Y axis; the part is centred on origin. */
  readonly length: number;
  /** Radius at the near (-Y) end. */
  readonly radius: number;
  /** Radius at the far (+Y) end. Defaults to `radius` — a straight body. */
  readonly radiusEnd?: number;
  /** Corner break at both ends. Clamped so it can never eat the whole part. */
  readonly fillet: number;
  /** Segments around the axis. */
  readonly radialSegments?: number;
  /** Segments in each corner arc. */
  readonly filletSegments?: number;
}

/**
 * A cylinder — optionally tapered — with both corners rounded off, revolved
 * around its own +Y axis and centred on the origin.
 */
export function roundedCylinder({
  length,
  radius,
  radiusEnd,
  fillet,
  radialSegments = 20,
  filletSegments = 4,
}: RoundedCylinderOptions): BufferGeometry {
  const rNear = radius;
  const rFar = radiusEnd ?? radius;
  const half = length / 2;
  const f = Math.min(fillet, rNear, rFar, half);

  const profile: Vector2[] = [new Vector2(0, -half)];

  // Near corner: quarter arc from the flat end out to the side wall.
  for (let i = 0; i <= filletSegments; i++) {
    const a = -Math.PI / 2 + (Math.PI / 2) * (i / filletSegments);
    profile.push(
      new Vector2(rNear - f + f * Math.cos(a), -half + f + f * Math.sin(a))
    );
  }

  // The side wall is the straight run between the two corner arcs, so a taper
  // needs no points of its own — the lathe interpolates it.

  // Far corner.
  for (let i = 0; i <= filletSegments; i++) {
    const a = (Math.PI / 2) * (i / filletSegments);
    profile.push(
      new Vector2(rFar - f + f * Math.cos(a), half - f + f * Math.sin(a))
    );
  }

  profile.push(new Vector2(0, half));

  const geometry = new LatheGeometry(profile, radialSegments);
  geometry.computeVertexNormals();
  return geometry;
}

export interface ProfileStop {
  /** Height along the local +Y axis, in the prop's own units. */
  readonly at: number;
  /** Radius at that height. */
  readonly radius: number;
}

/**
 * Revolve a measured half-section: a list of (height, radius) stops, spun about
 * +Y. Unlike `roundedCylinder` this idealizes nothing — every bulge, swell and
 * shoulder in the list survives into the mesh, which is the point when the
 * numbers came off the prop's own artwork.
 *
 * Ends are closed by dropping to the axis, so a band that starts or ends fat
 * gets a flat cap. Two stops at the same height with different radii make a
 * flat annulus, which is how a real shoulder reads.
 *
 * `LatheGeometry` generates its own normals, and its handling of a zero-height
 * step is better than a blanket `computeVertexNormals()` — that would smooth
 * the shoulders away into a bevel.
 */
export function revolvedProfile(
  stops: readonly ProfileStop[],
  radialSegments = 24
): BufferGeometry {
  const profile: Vector2[] = [];
  const first = stops[0];
  const last = stops[stops.length - 1];

  if (first.radius > 0) profile.push(new Vector2(0, first.at));
  for (const stop of stops) profile.push(new Vector2(stop.radius, stop.at));
  if (last.radius > 0) profile.push(new Vector2(0, last.at));

  return new LatheGeometry(profile, radialSegments);
}
