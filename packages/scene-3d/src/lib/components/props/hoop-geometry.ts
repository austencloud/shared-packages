/**
 * Mini-hoop dimensions: the size from hoops people buy, the grip from the glyph.
 *
 * A torus has exactly two free parameters, so unlike `club-profile.ts` there is
 * no silhouette to lift off the 2D artwork -- the only shape statement a ring
 * glyph can make is the ratio of its tube to its diameter. `minihoop.svg` makes
 * that statement and gets it wrong on purpose:
 *
 *                       minihoop.svg   what we ship
 *   outer diameter        18.36 in       18.5 in        <- inside the range
 *   tube diameter          2.15 in       0.625 in       <- 3.4x too fat
 *   tube / outer dia       0.117          0.034
 *
 * That split is the interesting part, and it is the opposite of the club's. A
 * ring's diameter and its tube thickness are independent, so the glyph could
 * fatten the tube for legibility at pictograph size WITHOUT stealing any
 * diameter -- which is exactly what it did. The club had to pay for its fat body
 * in length and came out at 18in when nothing is sold under 19in; the hoop's
 * diameter lands squarely inside the range hoops are actually sold at, and is
 * therefore trustworthy.
 *
 * So:
 *   - Diameter comes from the glyph, rounded to a size vendors actually stock.
 *   - Tube diameter comes from the tubing spec. The glyph is not a witness here.
 *   - The grip point comes from the glyph, and it is a real geometric fact:
 *     the hand sits on the tube's CENTRELINE (measured 0.7% off), not on the
 *     ring's inner or outer surface.
 *
 * The published numbers:
 *
 *   MoodHoops        minis 18-23in OD in HDPE; 3/4in minis ONLY at 20.5in and
 *                    22.5in; 5/8in minis down to 18.5in; polypro minis only
 *                    22-23in. A 3/4in mini weighs about 7.7oz (218g).
 *   Ruby Hooping     mini pairs 19-24in, 3/4in or 5/8in OD HDPE
 *   Hoopologie       minis roughly 16-24in; doubles/multiples 25-38in
 *
 * Hoop tubing is named by its OUTER diameter (unlike polyethylene irrigation
 * tube, which is named by ID), so 5/8in tubing really is 15.875mm across.
 *
 * The tube size is NOT a free choice against the diameter, which is the trap
 * here. MoodHoops: "To preserve the roundness of the hoops in smaller sizes,
 * minis in 3/4in tubing are only available in 20.5in OD and 22.5in OD." That is
 * a physical constraint, not a stocking preference -- 3/4in HDPE is too stiff to
 * hold a circle at the small end, which is also why polypro minis stop at 22in.
 * So a hoop at the glyph's diameter has to be 5/8in tubing; an 18in ring in 3/4in
 * tube is a thing that does not hold its shape.
 *
 * 5/8in is independently the right default here: TKA minihoops are dual-wielded
 * by construction, and dual-wielders prefer 5/8in because two thinner rings sit
 * easier in the hands over a long session. The two constraints agree.
 *
 * 18.5in is MoodHoops' smallest 5/8in mini and lands 0.8% off the glyph's
 * 18.36in, so the 2D and 3D props are the same object at the same size.
 *
 * Deliberately NOT modelled: the connector join. Every hoop has one, and on the
 * product photos it is a hairline mark a couple of millimetres long. At scene
 * scale it would either vanish or read as a defect in the geometry, and it costs
 * a discontinuity in an otherwise perfect ring to find out which.
 *
 * A hoop is sold in discrete inch sizes, so like the club its size is absolute
 * and does not scale with the user's staff length. Vendors do advise sizing a
 * mini to the gap between your armpit and your hand, which is a body-relative
 * rule -- but `userProportionsState` carries no armpit-to-hand measure, and
 * inventing one to drive a prop that ships in 1-inch steps would be worse than
 * picking the size off the drawing.
 */

/**
 * Outer diameter: 18.5in, MoodHoops' smallest 5/8in mini, which is the stocked
 * size nearest the glyph's 18.36in.
 */
export const HOOP_OUTER_DIAMETER_M = 0.4699;

/**
 * Tube outer diameter: 5/8in HDPE. Forced by the diameter -- 3/4in tube will not
 * hold a round hoop this small -- and preferred anyway for a dual-wielded prop.
 */
export const HOOP_TUBE_DIAMETER_M = 0.015875;

/** Radius of the tube itself. */
export const HOOP_TUBE_RADIUS_M = HOOP_TUBE_DIAMETER_M / 2;

/**
 * Centre of the ring to centre of the tube -- which is what Three's
 * `TorusGeometry` means by `radius`, so the outer surface lands at
 * `HOOP_CENTERLINE_RADIUS_M + HOOP_TUBE_RADIUS_M` and the published outer
 * diameter comes out exact.
 */
export const HOOP_CENTERLINE_RADIUS_M =
  HOOP_OUTER_DIAMETER_M / 2 - HOOP_TUBE_RADIUS_M;

/**
 * Segments around the ring (Three calls this `tubularSegments`).
 *
 * The old hoop used 32, which is below Three's own default of 48 and leaves a
 * 1.1mm sagitta on a 227mm ring -- 14% of the tube's radius, so the ring read as
 * a polygon. 128 brings that to 0.07mm, which is a tenth of the deviation
 * anti-aliasing already hides.
 */
export const HOOP_RING_SEGMENTS = 128;

/**
 * Segments around the tube's cross-section (Three's `radialSegments`). The tube
 * is only 7.9mm in radius, so 20 leaves a 0.10mm sagitta and the silhouette
 * reads round.
 */
export const HOOP_TUBE_SEGMENTS = 20;

/**
 * Hand to the far outer edge of the ring, in metres.
 *
 * The hand grips the tube's centreline at the near side of the ring, so the ring
 * hangs entirely above the grip except for the near half of the tube. Hand to
 * the far edge is therefore a full diameter minus one tube radius.
 */
export const HOOP_REACH_M =
  2 * HOOP_CENTERLINE_RADIUS_M + HOOP_TUBE_RADIUS_M;
