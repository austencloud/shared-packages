/**
 * Torch profile
 *
 * `torch.svg` is not a shape anyone can extrude. It is an Illustrator raster
 * trace — 296 paths with colour classes `.st0`-`.st295` and no single
 * silhouette contour — so the plate pipeline has nothing to cut. But a torch is
 * a solid of revolution, and a side-on drawing of one carries its lathe profile
 * exactly: the half-height at every column IS the radius at that height.
 *
 * So this table was MEASURED, not transcribed. The svg was rasterized at 20x
 * and read column by column for (a) first and last opaque row, giving the
 * radius, and (b) the colour on the axis, giving the material. Sampling colour
 * on the axis matters: a dominant-colour vote reads the traced outline instead
 * of the fill on anything thin, and reported the chrome shaft as black.
 *
 * The measured bands, and what each one is on the real prop (Austen sent three
 * reference photos, 2026-08-16 — a Juggle Dream Supernova, a black-wrap torch,
 * and three practice torches):
 *
 *   pommel   #ffffff  the knob at the butt — wider than it is long
 *   grip     #231f20  the wrapped handle, tapering wider as it rises
 *   band     #ffffff  the ring partway up the wrap
 *   flare    #231f20  the cone. THE COLOURED PART on every torch sold — red,
 *                     blue, gold, green or silver — so it carries blue/red here
 *   ferrule  #ffffff  the collar closing the flare's wide end
 *   shaft    #c1c0c0 -> #908e8e -> #5e5b5c   chrome. The artwork shades this
 *                     one as real metal, top-lit; the photos agree
 *   wick     #f6e5b6  cream unburnt kevlar, a fat wound cylinder
 *
 * Every number below is a fraction of staff length (svg units / 252.8, the
 * viewBox width of `staff.svg`), measured from the hand at the viewBox centre.
 * The artwork puts that centre at the butt of the torch, inside the pommel —
 * which is where you hold one, with the knob under your hand.
 *
 * Reach is 0.59335 of a staff. The old procedural torch reached 0.9, so it was
 * more than half again too long.
 */

import type { ProfileStop } from "./prop-lathe";

/** One material band of the torch, as a revolved profile. */
export interface TorchBand {
  readonly id:
    | "pommel"
    | "grip"
    | "band"
    | "flare"
    | "ferrule"
    | "shaft"
    | "wick";
  readonly stops: readonly ProfileStop[];
}

/**
 * The bands, butt to tip. Adjacent bands share a radius at their seam so the
 * joins are invisible, and the two places the real prop steps — the flare's
 * ferrule down onto the shaft, and the shaft up into the wick — keep their
 * step, because that shoulder is the prop.
 */
export const TORCH_BANDS: readonly TorchBand[] = [
  {
    id: "pommel",
    stops: [
      { at: -0.01464, radius: 0 },
      { at: -0.01384, radius: 0.00781 },
      { at: -0.01187, radius: 0.01483 },
      { at: -0.0089, radius: 0.02027 },
      { at: -0.00593, radius: 0.02334 },
      { at: -0.00198, radius: 0.02522 },
      { at: 0.00198, radius: 0.02522 },
      { at: 0.00593, radius: 0.02364 },
      { at: 0.00989, radius: 0.02027 },
      { at: 0.01187, radius: 0.0175 },
      { at: 0.01384, radius: 0.01355 },
    ],
  },
  {
    id: "grip",
    stops: [
      { at: 0.01384, radius: 0.01355 },
      { at: 0.03659, radius: 0.01335 },
      { at: 0.10285, radius: 0.01375 },
      { at: 0.19976, radius: 0.01493 },
      { at: 0.24031, radius: 0.0177 },
      { at: 0.24426, radius: 0.01859 },
    ],
  },
  {
    id: "band",
    stops: [
      { at: 0.24426, radius: 0.01859 },
      { at: 0.26503, radius: 0.01998 },
    ],
  },
  {
    id: "flare",
    stops: [
      { at: 0.26503, radius: 0.01998 },
      { at: 0.26899, radius: 0.01968 },
      { at: 0.28184, radius: 0.02067 },
      { at: 0.33228, radius: 0.02779 },
      { at: 0.35107, radius: 0.02927 },
      { at: 0.35403, radius: 0.02878 },
    ],
  },
  {
    id: "ferrule",
    stops: [
      { at: 0.35403, radius: 0.02878 },
      { at: 0.357, radius: 0.02462 },
      { at: 0.35799, radius: 0.02275 },
      { at: 0.35898, radius: 0.01978 },
      // The shoulder: the assembly ends and a thin rod carries on. Two stops
      // at one height make the flat annulus that step really is.
      { at: 0.35997, radius: 0.0101 },
    ],
  },
  {
    id: "shaft",
    stops: [
      { at: 0.35997, radius: 0.0101 },
      { at: 0.36096, radius: 0.0092 },
      { at: 0.52907, radius: 0.00939 },
      { at: 0.53006, radius: 0.01958 },
    ],
  },
  {
    id: "wick",
    stops: [
      { at: 0.53006, radius: 0.01958 },
      { at: 0.53303, radius: 0.02265 },
      { at: 0.53501, radius: 0.02344 },
      { at: 0.53797, radius: 0.02383 },
      { at: 0.58643, radius: 0.02383 },
      { at: 0.59237, radius: 0.02116 },
      { at: 0.59335, radius: 0.017 },
    ],
  },
];

/** Hand to the end of the wick, as a fraction of staff length. */
export const TORCH_REACH = 0.59335;
