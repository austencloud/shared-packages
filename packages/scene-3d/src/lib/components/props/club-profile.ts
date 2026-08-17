/**
 * Club lathe profile, built from a real juggling club.
 *
 * Every other prop in this round was measured off its own 2D artwork, because
 * the artwork is the authority on the prop's shape. `club.svg` is the exception:
 * it is a stylized pictograph glyph, not a drawing of a club. Measured against
 * `staff.svg` it draws an 18in club -- shorter than anything sold -- and it
 * tapers the body to a point, which no club has. Fitting that silhouette to real
 * anchors still left a club that read wrong.
 *
 * So this is built from the published dimensions of the club in the reference
 * photos instead, a Henrys Delphin in the 105mm body:
 *
 *   Henrys Delphin   52cm overall, 22cm handle, 30cm body, 200g,
 *                    flat cap and semi-round knob (both EVA), 16mm wood dowel
 *   Renegade         body models 75/85/95/105mm; 105mm is the size they
 *                    recommend for people over 6ft, and the avatar is 6'3"
 *   Play PX3         20.5in overall, 15.5mm dowel, 81.6mm shell -- the slim one,
 *                    kept here as the lower bound on a believable body
 *
 * Two numbers have no published spec and were read off the product photos: the
 * 36mm knob and the 25mm flat cap. Everything else is quoted.
 *
 * Colour comes from the photos too, since the glyph is a flat silhouette. Every
 * club sold is a dark knob, a light handle, a dark band at the shoulder, and a
 * coloured body with a dark cap -- never one solid colour.
 */

import type { ProfileStop } from "./prop-lathe";

/** One material band of the club, as a revolved profile. */
export interface ClubBand {
  readonly id: "knob" | "handle" | "marker" | "body" | "cap";
  readonly stops: readonly ProfileStop[];
}

/** Overall length: the Delphin's 52cm. */
export const CLUB_LENGTH_M = 0.52;

/** Body at its widest: the 105mm model. */
export const CLUB_BODY_DIAMETER_M = 0.105;

/**
 * The bands, butt to tip, in world units (metres).
 *
 * A club is a standardized object, so unlike Staff3D this does NOT scale with
 * the user's staff length. Set a 40in staff and your clubs stay 52cm, which is
 * how a prop bag works.
 *
 * The hand sits at 0, just above the knob's widest point -- the standard club
 * grip puts the pinky against the knob, and it is also where `club.svg` puts the
 * 2D hand point, so the pictographs and the 3D scene stay in register. The knob
 * is the only band that reaches below the origin.
 *
 * Adjacent bands share a stop exactly, so no join is visible: the club is one
 * continuous turned body and only its colour changes along the length. The cap's
 * two stops sit at the same height, which revolves into the flat disc face a
 * Delphin actually ends in.
 */
export const CLUB_BANDS: readonly ClubBand[] = [
  {
    id: "knob",
    stops: [
      { at: -0.01302, radius: 0.0035 },
      { at: -0.00987, radius: 0.01008 },
      { at: -0.00777, radius: 0.01375 },
      { at: -0.00567, radius: 0.01642 },
      { at: -0.00357, radius: 0.01782 },
      { at: -0.00252, radius: 0.018 },
      { at: -0.00199, radius: 0.01779 },
      { at: 0.0043, radius: 0.012 },
      { at: 0.00641, radius: 0.01079 },
      { at: 0.00798, radius: 0.0105 },
    ],
  },
  {
    // 21mm at the butt thickening to 23mm: the 16mm dowel plus a taped grip.
    id: "handle",
    stops: [
      { at: 0.00798, radius: 0.0105 },
      { at: 0.19298, radius: 0.0115 },
    ],
  },
  {
    // The dark band at the shoulder, where the handle meets the body.
    id: "marker",
    stops: [
      { at: 0.19298, radius: 0.0115 },
      { at: 0.20698, radius: 0.0155 },
    ],
  },
  {
    // Flares out of the shoulder, swells to 105mm two thirds up the body, then
    // rounds off into the cap. The balance sits toward the body end, which is
    // why the widest point is high rather than centred.
    id: "body",
    stops: [
      { at: 0.20698, radius: 0.0155 },
      { at: 0.23059, radius: 0.02452 },
      { at: 0.2542, radius: 0.03218 },
      { at: 0.27856, radius: 0.03871 },
      { at: 0.30293, radius: 0.04389 },
      { at: 0.32806, radius: 0.04788 },
      { at: 0.3532, radius: 0.05056 },
      { at: 0.37909, radius: 0.05208 },
      { at: 0.40694, radius: 0.05249 },
      { at: 0.41596, radius: 0.05221 },
      { at: 0.4246, radius: 0.05158 },
      { at: 0.43323, radius: 0.05057 },
      { at: 0.44146, radius: 0.04924 },
      { at: 0.4497, radius: 0.04754 },
      { at: 0.45755, radius: 0.04553 },
      { at: 0.4654, radius: 0.0431 },
      { at: 0.47246, radius: 0.04049 },
      { at: 0.47952, radius: 0.03741 },
      { at: 0.4858, radius: 0.03418 },
      { at: 0.49129, radius: 0.03083 },
      { at: 0.49639, radius: 0.02711 },
      { at: 0.5007, radius: 0.0232 },
      { at: 0.50384, radius: 0.01953 },
      { at: 0.5062, radius: 0.0155 },
      { at: 0.50698, radius: 0.0125 },
    ],
  },
  {
    id: "cap",
    stops: [
      { at: 0.50698, radius: 0.0125 },
      { at: 0.50698, radius: 0 },
    ],
  },
];

/** Hand to the flat cap, in metres. */
export const CLUB_REACH_M = 0.50698;
