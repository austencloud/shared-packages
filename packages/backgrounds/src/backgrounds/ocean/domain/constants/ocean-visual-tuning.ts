/**
 * Ocean visual tuning — the presentation layer's knobs, in one place.
 *
 * The ocean's *simulation* (steering, gait, schooling, hunting) had far more
 * rigor applied to it than its *presentation*. Every effect below already
 * existed and already ran every frame; most were tuned so far down they were
 * invisible in practice — fog at 0.02-0.06 alpha, distant glow at 0.015-0.04,
 * caustics self-culling under 0.005.
 *
 * This module makes those strengths addressable so they can be compared
 * side-by-side rather than argued about. Because it is a plain mutable object
 * read at draw time, a harness can render the SAME simulation state twice in
 * one frame under two settings and get a true A/B — see
 * /test/ocean-visual-ab in tka-platform.
 *
 * BASELINE reproduces the historical look exactly (every multiplier 1, every
 * added effect 0). Nothing here changes behavior, physics, or spawn logic —
 * only how the existing state is drawn.
 */

/** Depth-graded rendering + effect strengths. All multipliers are 1 = unchanged. */
export interface OceanVisualTuning {
  /**
   * Global render-time size multiplier for fish.
   *
   * Species body lengths are absolute px (35-120) scaled by depth (0.4-1.0), so
   * the real range is 14-120px. On a 3840-wide display a far tropical fish is
   * 0.36% of screen width — a speck. Sizing is fixed-pixel, so bigger screens
   * get *more, smaller* fish rather than a proportionate scene.
   */
  fishScale: number;

  /**
   * How completely the farthest fish fade out. 0 = no extra fade beyond the
   * existing DEPTH_TRANSITION.opacityReduction, 1 = far fish vanish entirely.
   *
   * Underwater, extinction — not size — is the dominant depth cue. The stock
   * falloff leaves a maximally distant fish at 75% opacity and otherwise fully
   * sharp and saturated, which reads as "small fish" rather than "far fish".
   */
  depthFadeStrength: number;

  /**
   * How strongly distant fish tint toward the surrounding water colour.
   * This is atmospheric perspective: contrast and saturation are lost with
   * distance as water scatters light between subject and viewer.
   */
  depthTintStrength: number;

  /** Colour distant fish tint toward. Should match the mid-depth water. */
  depthTintColor: string;

  /** Blur (px) applied to the most distant depth band. 0 disables blurring. */
  depthBlurMaxPx: number;

  /**
   * Number of depth bands fish are grouped into for grading.
   *
   * Grading is per-band, not per-fish: each band renders to one offscreen
   * layer, which is then tinted, blurred and faded as a unit. Per-fish would
   * mean an offscreen buffer per fish per frame.
   */
  depthBandCount: number;

  /** Multiplier on caustic cell alpha (dancing light). */
  causticIntensity: number;

  /** Multiplier on depth fog layer alpha. */
  fogIntensity: number;

  /** Multiplier on distant bioluminescent glow alpha. */
  glowIntensity: number;
}

/** The historical look — every effect exactly as it shipped. */
export const BASELINE_TUNING: OceanVisualTuning = {
  fishScale: 1,
  depthFadeStrength: 0,
  depthTintStrength: 0,
  depthTintColor: "#1a3a4a",
  depthBlurMaxPx: 0,
  depthBandCount: 1,
  causticIntensity: 1,
  fogIntensity: 1,
  glowIntensity: 1,
};

/**
 * The graded look: depth reads as depth, effects are actually visible, and fish
 * are sized for a large display. These are the values signed off on 2026-07-26
 * from the /test/ocean-visual-ab wipe — don't drift them without re-running it.
 *
 * depthTintColor matches GRADIENT_CONFIG.colors.midDepth so distant fish
 * dissolve into the water they're actually swimming in.
 *
 * causticIntensity stays near 1 deliberately. Caustics were the one effect NOT
 * suffering from under-tuning (cells already run at 0.15-0.29 alpha); pushing
 * them to 4.5 just saturated 24 soft radial blobs into obvious bokeh. Making
 * them read as caustics needs a real interlocking-web pattern, not a multiplier.
 */
export const GRADED_TUNING: OceanVisualTuning = {
  fishScale: 1.5,
  depthFadeStrength: 0.5,
  depthTintStrength: 0.7,
  depthTintColor: "#1a3a4a",
  depthBlurMaxPx: 3.5,
  depthBandCount: 4,
  causticIntensity: 1.3,
  fogIntensity: 2.4,
  glowIntensity: 2.4,
};

/**
 * Live tuning read by the renderers at draw time. Mutate to change the look;
 * assign a whole object to switch presets.
 *
 * Defaults to GRADED — that is the shipping look. The A/B harness flips this to
 * BASELINE and back within a single frame to render its comparison.
 */
export const oceanVisualTuning: OceanVisualTuning = { ...GRADED_TUNING };

/** Replace the live tuning in place (keeps the shared object identity). */
export function setOceanVisualTuning(next: Partial<OceanVisualTuning>): void {
  Object.assign(oceanVisualTuning, next);
}
