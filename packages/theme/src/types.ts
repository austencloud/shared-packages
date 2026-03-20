/**
 * Theme Types
 *
 * Core type definitions for the theme system.
 */

/**
 * Theme mode based on background luminance
 * - "light": Background is luminous (above 0.4 threshold)
 * - "dark": Background is dim (below 0.4 threshold)
 */
export type ThemeMode = "light" | "dark";

/**
 * Glass morphism theme tokens
 * Used for semi-transparent overlays with blur effects
 */
export interface GlassMorphismTheme {
  panelBg: string;
  panelBorder: string;
  panelHover: string;
  cardBg: string;
  cardBorder: string;
  cardHover: string;
  textPrimary: string;
  textSecondary: string;
  inputBg: string;
  inputBorder: string;
  inputFocus: string;
  buttonActive: string;
  backdropBlur: string;
}

/**
 * Matte (non-glass) theme tokens for 2026 bento style
 * Solid surfaces without transparency
 */
export interface MatteTheme {
  panelBg: string;
  panelElevatedBg: string;
  cardBg: string;
  cardHoverBg: string;
  accent: string;
  accentStrong: string;
  stroke: string;
  strokeStrong: string;
  text: string;
  textDim: string;
  shadow: string;
  panelShadow: string;
}

/**
 * Danger zone theme tokens for destructive actions
 * Adapts based on background luminance for visibility
 */
export interface DangerTheme {
  bg: string;
  hoverBg: string;
  border: string;
  hoverBorder: string;
  shadow: string;
  hoverShadow: string;
}

/**
 * Color palette for a background type
 * Format: [dark1, dark2, accent, accentLight?]
 * - First colors are for luminance calculation
 * - Middle/later colors are extracted as accent for buttons and interactive elements
 */
export type ColorPalette = string[];

/**
 * Configuration for the theme system
 */
export interface ThemeConfig {
  /** Storage key for persisting theme settings (default: "theme-settings") */
  storageKey: string;
  /** Whether to enable HMR recovery (default: true in development) */
  enableHmrRecovery: boolean;
}
