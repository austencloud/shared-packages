/**
 * @austencloud/media-spotlight
 *
 * A premium full-screen media viewer with gestures, tagging, and auto-hiding chrome.
 */

// Main component
export { default as MediaSpotlight } from './MediaSpotlight.svelte';

// Display components
export { default as SpotlightImage } from './SpotlightImage.svelte';
export { default as SpotlightVideo } from './SpotlightVideo.svelte';

// Chrome & navigation
export { default as SpotlightChrome } from './SpotlightChrome.svelte';
export { default as SpotlightFilmstrip } from './SpotlightFilmstrip.svelte';

// Curation features
export { default as SpotlightTagBar } from './SpotlightTagBar.svelte';
export { default as SpotlightActions } from './SpotlightActions.svelte';
export { default as SpotlightDeleteButton } from './SpotlightDeleteButton.svelte';
export { default as SpotlightKeyboardHints } from './SpotlightKeyboardHints.svelte';

// Gesture controller
export { GestureController, type GestureEvent, type GestureEventHandler, type GestureControllerConfig } from './gestures/gesture-controller.js';

// Utilities
export { getCropStyles } from './types.js';

// Types
export type {
  MediaItem,
  MediaTag,
  TagColor,
  CropSettings,
  SnipSettings,
  SpotlightMode,
  NavigationDirection,
  KeyboardHint,
  GestureState,
  SpotlightCallbacks,
  SpotlightConfig,
  HeroOrigin,
} from './types.js';
