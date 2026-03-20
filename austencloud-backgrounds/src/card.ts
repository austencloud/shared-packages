/**
 * @austencloud/backgrounds/card
 *
 * Framework-agnostic <background-card> Custom Element for background selection.
 * Separate entry point — tree-shakeable from the canvas rendering code.
 *
 * Usage:
 *   import { registerBackgroundCard } from '@austencloud/backgrounds/card';
 *   registerBackgroundCard(); // defines <background-card> once
 */

// ── Custom Element ───────────────────────────────────────────────────────────

export {
  BackgroundCardElement,
  registerBackgroundCard,
} from "./card/element/background-card-element.js";

// ── Domain ───────────────────────────────────────────────────────────────────

export {
  BACKGROUND_CARD_REGISTRY,
  getCardMetadata,
} from "./card/domain/background-card-constants.js";

export type {
  BackgroundCardMetadata,
  BackgroundCardSelectDetail,
} from "./card/domain/background-card-types.js";

// ── Effects (standalone, usable outside the card) ────────────────────────────

export { attachTiltEffect } from "./card/effects/tilt-effect.js";
export type {
  TiltEffectOptions,
  TiltEffectHandle,
} from "./card/effects/tilt-effect.js";

export { attachCursorGlowEffect } from "./card/effects/cursor-glow-effect.js";
export type {
  CursorGlowEffectOptions,
  CursorGlowEffectHandle,
} from "./card/effects/cursor-glow-effect.js";

export { createSpring } from "./card/effects/spring.js";
export type {
  Spring,
  SpringOptions,
} from "./card/effects/spring.js";
