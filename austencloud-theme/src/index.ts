/**
 * @austencloud/theme
 *
 * Shared theming system with luminance-aware theme generation.
 * Calculates appropriate glass morphism, matte, and danger zone styles
 * based on background colors for accessibility and visual consistency.
 *
 * ## Quick Start
 *
 * ```typescript
 * import {
 *   setStorageKey,
 *   setThemeColorPalette,
 *   applyThemeFromColors,
 *   ensureThemeApplied
 * } from '@austencloud/theme';
 *
 * // Configure for your app
 * setStorageKey('my-app-settings');
 *
 * // Register your color palettes
 * setThemeColorPalette('AURORA', ['#667eea', '#764ba2', '#f093fb']);
 * setThemeColorPalette('OCEAN', ['#0c4a6e', '#0891b2', '#22d3ee']);
 *
 * // Apply theme based on a solid color
 * applyThemeFromColors('#1a1a2e');
 *
 * // Or apply theme for a registered background
 * applyThemeForBackground('AURORA');
 *
 * // Ensure theme is applied from localStorage on init
 * ensureThemeApplied();
 * ```
 *
 * ## CSS Import
 *
 * ```typescript
 * // In your layout, import the CSS
 * import '@austencloud/theme/css/index.css';
 *
 * // Or cherry-pick
 * import '@austencloud/theme/css/tokens.css';
 * import '@austencloud/theme/css/panel-utilities.css';
 * ```
 */

// Types
export type {
  ThemeMode,
  GlassMorphismTheme,
  MatteTheme,
  DangerTheme,
  ColorPalette,
  ThemeConfig,
} from "./types.js";

// Theme Calculator - Core engine
export {
  // Configuration
  setStorageKey,
  getStorageKey,
  setThemeColorPalette,
  getThemeColorPalette,
  getAllColorPalettes,

  // Luminance calculations
  calculateLuminance,
  calculateGradientLuminance,
  getThemeModeFromLuminance,

  // Theme generation
  generateGlassMorphismTheme,
  generateMatteTheme,
  generateDangerTheme,
  extractAccentColor,

  // Theme application
  applyThemeFromColors,
  applyThemeForBackground,
  ensureThemeApplied,
} from "./theme-calculator.js";

// Theme Mode State
export {
  getThemeMode,
  isLightMode,
  isDarkMode,
  setThemeMode,
  onThemeModeChange,
} from "./theme-mode-state.js";
