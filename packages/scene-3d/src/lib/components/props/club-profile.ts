/**
 * Club lathe profile: the silhouette from `club.svg`, the size from real clubs.
 *
 * This prop took three attempts, and the two failures are worth recording.
 *
 * The first built the club by transcribing `club.svg` outright, the way every
 * other prop in this set is built. That gives an 18in club -- shorter than
 * anything sold -- because the drawing is a pictograph glyph and fattens the
 * body so the shape reads at small sizes, which costs it length.
 *
 * The second threw the drawing away and generated the shape from curve functions
 * against published dimensions. It read as a balloon: a thin handle carrying a
 * fat body that tapered to a narrow nose. Measuring the drawing shows exactly
 * why, and the numbers are all ratios the drawing gets RIGHT:
 *
 *                        club.svg   the balloon
 *   cap dia / body dia     0.351       0.238     <- a club ends BROAD
 *   widest up the body      56%         67%
 *   handle dia / body dia  0.264       0.219
 *   knob dia / body dia    0.423       0.343
 *
 * The body was never too fat in ratio -- the drawing's body is fatter still.
 * Everything else was too thin, and the top was a long convex nose instead of a
 * near-straight cone ending in a broad cap.
 *
 * So this profile takes the whole silhouette from `club.svg` -- every
 * radius-to-radius ratio and all of its edge curvature -- and rescales only the
 * two quantities the drawing is not authoritative on: overall length, and body
 * diameter. Axially in two linear segments so both published lengths land exact;
 * radially by a single factor, so no ratio moves.
 *
 * The published numbers, all from Firetoys product pages:
 *
 *   Henrys Delphin      52cm overall, 22cm handle, 30cm body, 200g,
 *                       16mm ash dowel and a tube handle. No width published.
 *   Play PX3 / EX1      52cm overall, 22cm handle, "Width: 8cm", 205g --
 *                       same geometry as the Delphin, and it does publish a width
 *   Renegade bodies     75 / 85 / 95 / 105mm, plus a 108mm fathead
 *
 * 8cm is the body diameter used here. The earlier 105mm came from Renegade's
 * body range by taking the widest normal body, on a reading of their sizing
 * guide that the guide does not actually support -- body width is a grip and
 * juggling-feel choice, not a function of the juggler's height. 8cm sits between
 * Renegade's 75 and 85mm bodies: an ordinary club.
 *
 * Nothing else needed inventing. The drawing's own ratios against a 8cm body
 * give a 21mm handle, a 34mm knob and a 28mm cap -- which is a 16mm dowel inside
 * a tube handle, a standard knob, and a standard cap. The drawing is
 * proportionally honest about every part of the club except how fat the body is
 * relative to its length.
 *
 * Colour is off the product photos, since the glyph is a flat silhouette: a dark
 * knob, a light taped handle, a dark band at the shoulder, a coloured body and a
 * dark cap. Never one solid colour.
 */

import type { ProfileStop } from "./prop-lathe";

/** One material band of the club, as a revolved profile. */
export interface ClubBand {
  readonly id: "knob" | "handle" | "marker" | "body" | "cap";
  readonly stops: readonly ProfileStop[];
}

/** Overall length: 52cm, which the Delphin and the Play Sirius clubs agree on. */
export const CLUB_LENGTH_M = 0.52;

/** Body at its widest: the Play Sirius published 8cm. */
export const CLUB_BODY_DIAMETER_M = 0.08;

/** Handle length: 22cm, which both clubs also agree on. */
export const CLUB_HANDLE_M = 0.22;

/**
 * The bands, butt to tip, in world units (metres).
 *
 * A club is a standardized object, so unlike Staff3D this does NOT scale with
 * the user's staff length. Set a 40in staff and your clubs stay 52cm, which is
 * how a prop bag works.
 *
 * The hand sits at 0, which is where `club.svg` puts its 2D hand point -- the
 * viewBox centre, just above the knob's widest part, where the standard grip puts
 * the pinky. That keeps the pictographs and the 3D scene in register. The knob is
 * the only band reaching below the origin.
 *
 * Adjacent bands share a stop exactly, so the club is one continuous turned body
 * whose colour changes along its length and no join is visible.
 *
 * Two features carry most of the club's character, and both come straight off the
 * drawing rather than from a curve function:
 *
 *   - the body's upper half is a LONG STRAIGHT TAPER, from 37.7mm radius down to
 *     14.6mm in one run. Curving through that stretch is what made the second
 *     attempt read as a balloon.
 *   - the cap is BROAD -- it turns over at 13.9mm radius, a third of the body's
 *     width, into a shallow 3.4mm dome. A club does not come to a point.
 */
export const CLUB_BANDS: readonly ClubBand[] = [
  {
    // Semi-round EVA knob, widest just above the hand.
    id: "knob",
    stops: [
      { at: -0.01657, radius: 0.00528 },
      { at: -0.01631, radius: 0.00771 },
      { at: -0.01593, radius: 0.00922 },
      { at: -0.0153, radius: 0.01071 },
      { at: -0.01416, radius: 0.01239 },
      { at: -0.01251, radius: 0.01389 },
      { at: -0.01061, radius: 0.015 },
      { at: -0.00832, radius: 0.01586 },
      { at: -0.00578, radius: 0.01643 },
      { at: -0.0021, radius: 0.01681 },
      { at: 0.00322, radius: 0.01689 },
      { at: 0.0064, radius: 0.01667 },
      { at: 0.00893, radius: 0.01618 },
      { at: 0.01147, radius: 0.01525 },
      { at: 0.01325, radius: 0.01413 },
      { at: 0.01464, radius: 0.01264 },
      { at: 0.01578, radius: 0.01054 },
    ],
  },
  {
    // 21mm: the 16mm ash dowel inside a tube handle. Straight, then the last
    // millimetre picks up the start of the shoulder.
    id: "handle",
    stops: [
      { at: 0.01578, radius: 0.01054 },
      { at: 0.20216, radius: 0.01054 },
      { at: 0.20343, radius: 0.01077 },
    ],
  },
  {
    // The dark band at the shoulder, where the handle meets the body. The
    // drawing kinks here, and revolvedProfile keeps that kink as a crease.
    id: "marker",
    stops: [
      { at: 0.20343, radius: 0.01077 },
      { at: 0.21743, radius: 0.01381 },
    ],
  },
  {
    // Flares out of the shoulder to 8cm at 56% up the body, holds a short crown,
    // then the long straight taper to the cap.
    id: "body",
    stops: [
      { at: 0.21743, radius: 0.01381 },
      { at: 0.25122, radius: 0.02098 },
      { at: 0.283, radius: 0.02749 },
      { at: 0.30934, radius: 0.03262 },
      { at: 0.33013, radius: 0.03637 },
      { at: 0.34416, radius: 0.03857 },
      { at: 0.35277, radius: 0.03959 },
      { at: 0.35608, radius: 0.03979 },
      { at: 0.3721, radius: 0.04 },
      { at: 0.38176, radius: 0.03987 },
      { at: 0.3901, radius: 0.03948 },
      { at: 0.39884, radius: 0.03872 },
      { at: 0.40718, radius: 0.0377 },
      { at: 0.49787, radius: 0.01457 },
      { at: 0.49986, radius: 0.01406 },
      { at: 0.49999, radius: 0.01388 },
    ],
  },
  {
    // Broad top: turns over at 13.9mm radius into a shallow dome. Same EVA as
    // the knob.
    id: "cap",
    stops: [
      { at: 0.49999, radius: 0.01388 },
      { at: 0.50092, radius: 0.01203 },
      { at: 0.50184, radius: 0.00929 },
      { at: 0.50303, radius: 0.00442 },
      { at: 0.50343, radius: 0.00108 },
    ],
  },
];

/** Hand to the top of the cap, in metres. */
export const CLUB_REACH_M = 0.50343;
