/**
 * background-card-types.ts - Type definitions for the background card system
 */

export interface BackgroundCardMetadata {
  /** BackgroundType enum value (e.g. "emberGlow", "nightSky") */
  type: string;
  /** Human-readable label (e.g. "Ember Glow") */
  label: string;
  /** CSS linear-gradient for the card preview fill */
  gradient: string;
  /** Accent color for selection ring and glow (CSS color) */
  accentColor: string;
  /** Inline SVG markup for the fallback icon (displayed when no slot content) */
  iconSvg: string;
  /** Theme colors array for the background (dominant visual palette) */
  themeColors: string[];
}

export interface BackgroundCardSelectDetail {
  type: string;
}
