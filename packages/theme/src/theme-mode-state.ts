/**
 * Theme Mode State
 *
 * State that tracks whether the app is in light or dark mode
 * based on the current background luminance. Components can import
 * this to conditionally apply theme-aware styling.
 *
 * Note: This is plain TypeScript state. For Svelte 5 reactivity,
 * consuming apps should wrap this in their own $state or store.
 */

import type { ThemeMode } from "./types.js";

// Current theme mode - defaults to dark
let currentThemeMode: ThemeMode = "dark";

// Subscribers for state changes
type ThemeModeListener = (mode: ThemeMode) => void;
const listeners = new Set<ThemeModeListener>();

/**
 * Get the current theme mode
 */
export function getThemeMode(): ThemeMode {
  return currentThemeMode;
}

/**
 * Check if currently in light mode
 */
export function isLightMode(): boolean {
  return currentThemeMode === "light";
}

/**
 * Check if currently in dark mode
 */
export function isDarkMode(): boolean {
  return currentThemeMode === "dark";
}

/**
 * Update the theme mode - called by theme-calculator
 * when the background changes
 */
export function setThemeMode(mode: ThemeMode): void {
  if (currentThemeMode !== mode) {
    currentThemeMode = mode;
    // Notify all listeners
    listeners.forEach((listener) => listener(mode));
  }
}

/**
 * Subscribe to theme mode changes
 * Returns an unsubscribe function
 */
export function onThemeModeChange(listener: ThemeModeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
