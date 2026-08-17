/**
 * Triad frame
 *
 * A triad is not a flat plate. `triad.svg` draws a solid three-armed star
 * because a pictograph needs one readable silhouette, but the object in your
 * hand is a frame: a small hub with a finger ring, three straight spines out of
 * it at 120 degrees, and a wick on the end of each spine. Extruding the
 * pictograph gives a shape with the right outline and the wrong prop.
 *
 * Austen, 2026-08-16, on the extruded version: *"Real triads aren't flat —
 * they're actual wicks around wire rims."*
 *
 * Two builds, both real, both shipped:
 *
 *   fire — steel spines out of a machined hub, a one-inch chrome finger ring,
 *          kevlar wicks. What Forged Creations sells.
 *   day  — a printed hub with a fatter ring, textured grip tube between black
 *          ferrules, and translucent glow heads. The practice/LED build.
 *
 * The frame keeps the artwork's REACH exactly, because reach is what the
 * notation and the mandala radius are measured against: arm centre-line
 * 0.44707 of a staff from the hub, tips reaching 0.4936. Only the construction
 * changes. Everything below is a fraction of the arm length so both sizes and
 * both builds stay in proportion.
 */

/** Hub centre to the centre of a tip, as a fraction of staff length. */
export const TRIAD_ARM_LENGTH = 0.44707;

/** How far past the arm's centre-line end the tip reaches, in arm lengths. */
const REACH = 1.104;

export interface TriadSection {
  /** Distance from the hub to the near end, in arm lengths. */
  readonly from: number;
  /** Distance from the hub to the far end, in arm lengths. */
  readonly to: number;
  /** Radius at the near end, in arm lengths. */
  readonly radius: number;
  /** Radius at the far end. Defaults to `radius`. */
  readonly radiusEnd?: number;
}

export interface TriadFrame {
  /**
   * The hub's own arm, thick and short, that a spine plugs into. It starts at
   * the ring's OUTER edge, not at the centre: the spines are welded to the
   * outside of the finger ring, so nothing crosses the hole your finger goes
   * through.
   */
  readonly hubArm: TriadSection;
  /** Sleeve where the spine leaves the hub. */
  readonly innerCollar: TriadSection;
  /** The long rod. */
  readonly spine: TriadSection;
  /** Sleeve where the spine enters the tip. Absent on the fire build, which
   *  clamps the wick directly. */
  readonly outerCollar?: TriadSection;
  /** Kevlar wick or glow head. */
  readonly tip: TriadSection;
  /** Finger-ring radius to the centre of the tube, in arm lengths. */
  readonly ringRadius: number;
  /** Ring tube radius, in arm lengths. */
  readonly ringTube: number;
  /** Corner break on the turned parts, in arm lengths. */
  readonly fillet: number;
}

/**
 * Fire build. The spine is bare rod, so it is thin; the wick is a wrapped
 * cylinder about three times the spine across, and the ring is the one-inch
 * single finger ring these ship with.
 */
export const TRIAD_FIRE: TriadFrame = {
  hubArm: { from: 0.095, to: 0.26, radius: 0.03, radiusEnd: 0.022 },
  innerCollar: { from: 0.24, to: 0.36, radius: 0.02 },
  spine: { from: 0.24, to: 0.92, radius: 0.013 },
  tip: { from: 0.9, to: REACH, radius: 0.048 },
  ringRadius: 0.085,
  ringTube: 0.016,
  fillet: 0.014,
};

/**
 * Day build. Everything is fatter: a printed hub, a grip tube you can actually
 * hold, black ferrules at both ends of it, and a head that flares out to
 * spread the light.
 */
export const TRIAD_DAY: TriadFrame = {
  hubArm: { from: 0.128, to: 0.34, radius: 0.052, radiusEnd: 0.04 },
  innerCollar: { from: 0.32, to: 0.39, radius: 0.032 },
  spine: { from: 0.33, to: 0.85, radius: 0.026 },
  outerCollar: { from: 0.79, to: 0.86, radius: 0.032 },
  tip: { from: 0.85, to: REACH, radius: 0.05, radiusEnd: 0.068 },
  ringRadius: 0.108,
  ringTube: 0.03,
  fillet: 0.016,
};
