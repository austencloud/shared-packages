/**
 * background-card-constants.ts - Registry of all background card metadata
 *
 * Each entry contains visual data for one BackgroundType: gradient, accent color,
 * label, fallback SVG icon, and theme colors.
 *
 * Icon SVGs extracted from Font Awesome Free (MIT license) path data.
 * Consumers can override with slotted content (Font Awesome <i>, emoji, etc.).
 */

import type { BackgroundCardMetadata } from "./background-card-types.js";

// ─── Font Awesome Free SVG path data (MIT) ──────────────────────────────────
// viewBox="0 0 512 512" unless noted. Extracted from FA 6 Free solid icons.

const FA_FIRE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M159.3 5.4c7.8-7.3 19.9-7.2 27.7 .1c27.6 25.9 53.5 53.8 77.7 84c11-14.4 23.5-30.1 37-42.9c7.9-7.4 20.1-7.4 28 .1c34.6 33 63.9 76.6 84.5 118c20.3 40.8 33.8 82.5 33.8 111.9C448 404.2 348.2 512 224 512C99.8 512 0 404.1 0 276.5c0-38.4 17.8-85.3 45.4-131.7C73.3 97.7 112.7 48.6 159.3 5.4z"/></svg>';

const FA_MOON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><path d="M223.5 32C100 32 0 132.3 0 256S100 480 223.5 480c60.6 0 115.5-24.2 155.8-63.4c5-4.9 6.3-12.5 3.1-18.7s-10.1-9.7-17-8.5c-9.8 1.7-19.8 2.6-30.1 2.6c-96.9 0-175.5-78.8-175.5-176c0-65.8 36-123.1 89.3-153.3c6.1-3.5 9.2-10.5 7.7-17.3s-7.3-11.9-14.3-12.5c-6.3-.5-12.6-.8-19-.8z"/></svg>';

const FA_WATER =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M269.5 69.9c11.1-7.9 25.9-7.9 37 0C329 85.4 356.5 96 384 96c26.9 0 55.4-10.8 77.4-26.1l0 0c11.9-8.5 28.1-7.8 39.2 1.7c14.4 11.9 32.5 21 50.6 25.2c17.2 4 27.9 21.2 23.9 38.4s-21.2 27.9-38.4 23.9c-24.5-5.7-44.9-16.5-58.2-25C449.5 149.7 417 160 384 160c-31.9 0-60.6-9.9-80.4-18.9c-5.8-2.7-11.1-5.3-15.6-7.7c-4.5 2.4-9.7 5.1-15.6 7.7c-19.8 9-48.5 18.9-80.4 18.9c-33 0-65.5-10.3-94.5-25.8c-13.4 8.4-33.7 19.3-58.2 25c-17.2 4-34.4-6.7-38.4-23.9s6.7-34.4 23.9-38.4c18.1-4.2 36.2-13.3 50.6-25.2c11.1-9.4 27.3-10.1 39.2-1.7l0 0C136.7 85.2 165.1 96 192 96c27.5 0 55-10.6 77.5-26.1zm37 288C329 373.4 356.5 384 384 384c26.9 0 55.4-10.8 77.4-26.1l0 0c11.9-8.5 28.1-7.8 39.2 1.7c14.4 11.9 32.5 21 50.6 25.2c17.2 4 27.9 21.2 23.9 38.4s-21.2 27.9-38.4 23.9c-24.5-5.7-44.9-16.5-58.2-25C449.5 437.7 417 448 384 448c-31.9 0-60.6-9.9-80.4-18.9c-5.8-2.7-11.1-5.3-15.6-7.7c-4.5 2.4-9.7 5.1-15.6 7.7c-19.8 9-48.5 18.9-80.4 18.9c-33 0-65.5-10.3-94.5-25.8c-13.4 8.4-33.7 19.3-58.2 25c-17.2 4-34.4-6.7-38.4-23.9s6.7-34.4 23.9-38.4c18.1-4.2 36.2-13.3 50.6-25.2c11.1-9.4 27.3-10.1 39.2-1.7l0 0C136.7 373.2 165.1 384 192 384c27.5 0 55-10.6 77.5-26.1c11.1-7.9 25.9-7.9 37 0zm0-144C329 229.4 356.5 240 384 240c26.9 0 55.4-10.8 77.4-26.1l0 0c11.9-8.5 28.1-7.8 39.2 1.7c14.4 11.9 32.5 21 50.6 25.2c17.2 4 27.9 21.2 23.9 38.4s-21.2 27.9-38.4 23.9c-24.5-5.7-44.9-16.5-58.2-25C449.5 293.7 417 304 384 304c-31.9 0-60.6-9.9-80.4-18.9c-5.8-2.7-11.1-5.3-15.6-7.7c-4.5 2.4-9.7 5.1-15.6 7.7c-19.8 9-48.5 18.9-80.4 18.9c-33 0-65.5-10.3-94.5-25.8c-13.4 8.4-33.7 19.3-58.2 25c-17.2 4-34.4-6.7-38.4-23.9s6.7-34.4 23.9-38.4c18.1-4.2 36.2-13.3 50.6-25.2c11.1-9.4 27.3-10.1 39.2-1.7l0 0C136.7 229.2 165.1 240 192 240c27.5 0 55-10.6 77.5-26.1c11.1-7.9 25.9-7.9 37 0z"/></svg>';

const FA_TREE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M210.6 5.9L62 169.4c-3.9 4.2-6 9.8-6 15.5C56 197.7 66.3 208 79.1 208l18.3 0L2.4 344.6C-1.8 350.5 0 359.4 7.7 362.1C10.1 363 12.6 363.5 15.1 363.5c4.1 0 8.1-1.3 11.4-3.8L56 336l-17.4 0c-2 0-4.1 .2-6.1 .7C24.5 338.9 20 347.3 22.2 355.3L80 480c3.6 10.1 13.2 16.9 24 16.9l240 0c10.8 0 20.4-6.8 24-16.9l57.8-124.7c2.2-8-2.3-16.4-10.3-18.6c-2-.5-4.1-.7-6.1-.7L392 336l29.5 23.7c3.3 2.5 7.3 3.8 11.4 3.8c2.5 0 5-.5 7.4-1.4c7.7-2.7 9.5-11.6 5.3-17.5L350.6 208l18.3 0C381.7 208 392 197.7 392 184.9c0-5.7-2.1-11.3-6-15.5L237.4 5.9C232.5 .5 225.9 0 224 0s-8.5 .5-13.4 5.9z"/></svg>';

// Custom crystal snowflake — bold 6-arm design with 12 branches, optimized for
// small-size legibility. The FA solid snowflake has too many thin elements that
// blur together at 20px with drop-shadow effects.
const FA_SNOWFLAKE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M236 46 L236 466 L276 466 L276 46 Z M427.9 133.7 L64.1 343.7 L84.1 378.3 L447.9 168.3 Z M447.9 343.7 L84.1 133.7 L64.1 168.3 L427.9 378.3 Z M263 118.9 L200.6 82.9 L186.6 107.1 L249 143.1 Z M263 143.1 L325.4 107.1 L311.4 82.9 L249 118.9 Z M378.3 193.5 L378.3 121.5 L350.3 121.5 L350.3 193.5 Z M357.3 205.6 L419.6 241.6 L433.6 217.4 L371.3 181.4 Z M371.3 330.6 L433.6 294.6 L419.6 270.4 L357.3 306.4 Z M350.3 318.5 L350.3 390.5 L378.3 390.5 L378.3 318.5 Z M249 393.1 L311.4 429.1 L325.4 404.9 L263 368.9 Z M249 368.9 L186.6 404.9 L200.6 429.1 L263 393.1 Z M133.7 318.5 L133.7 390.5 L161.7 390.5 L161.7 318.5 Z M154.7 306.4 L92.4 270.4 L78.4 294.6 L140.7 330.6 Z M140.7 181.4 L78.4 217.4 L92.4 241.6 L154.7 205.6 Z M161.7 193.5 L161.7 121.5 L133.7 121.5 L133.7 193.5 Z"/></svg>';

const FA_RAINBOW =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" fill="currentColor"><path d="M320 96C178.6 96 64 210.6 64 352l0 96c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-96C0 175.3 143.3 32 320 32s320 143.3 320 320l0 96c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-96C576 210.6 461.4 96 320 96zm0 192c-35.3 0-64 28.7-64 64l0 96c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-96c0-70.7 57.3-128 128-128s128 57.3 128 128l0 96c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-96c0-35.3-28.7-64-64-64zM160 352l0 96c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-96c0-123.7 100.3-224 224-224s224 100.3 224 224l0 96c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-96c0-88.4-71.6-160-160-160s-160 71.6-160 160z"/></svg>';

const FA_SPA =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M183.1 235.3c33.7 20.7 62.9 48.1 85.8 80.5c7 9.9 13.4 20.3 19.1 31c5.7-10.8 12.1-21.1 19.1-31c22.9-32.4 52.1-59.8 85.8-80.5C437.6 207.8 490.1 192 546 192l9.9 0c11.1 0 20.1 9 20.1 20.1C576 360.1 456.1 480 308.1 480L288 480l-20.1 0C119.9 480 0 360.1 0 212.1C0 201 9 192 20.1 192l9.9 0c55.9 0 108.4 15.8 153.1 43.3zM301.5 37.6c15.7 16.9 61.1 71.8 84.4 164.7c-38 21.6-71.4 50.8-97.9 85.6c-26.5-34.8-59.9-63.9-97.9-85.6c23.2-92.9 68.7-147.8 84.4-164.7c4.2-4.5 10.6-7.6 17.5-7.6s13.3 3.1 17.5 7.6z"/></svg>';

const FA_LEAF =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M272 96c-78.6 0-145.1 51.5-167.7 122.5c33.6-17 71.5-26.5 111.7-26.5l88 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-16 0-72 0s0 0 0 0c-16.6 0-32.7 1.9-48.3 5.4c-25.9 5.9-49.9 16.4-71.4 30.7c0 0 0 0 0 0C38.3 298.8 0 364.9 0 440l0 16c0 13.3 10.7 24 24 24s24-10.7 24-24l0-16c0-48.7 20.7-92.5 53.8-123.2C121.6 392.3 190.3 448 272 448l1 0c132.1-.7 239-130.9 239-291.4c0-42.6-7.5-83.1-21.1-119.5c-2.6-6.9-12.7-6.6-16.2-.1C455.9 72.1 418.7 96 376 96L272 96z"/></svg>';

const FA_CIRCLE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512z"/></svg>';

const FA_SQUARE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor"><path d="M0 96C0 60.7 28.7 32 64 32l320 0c35.3 0 64 28.7 64 64l0 320c0 35.3-28.7 64-64 64L64 480c-35.3 0-64-28.7-64-64L0 96z"/></svg>';

// ─── Registry ────────────────────────────────────────────────────────────────

export const BACKGROUND_CARD_REGISTRY: ReadonlyArray<BackgroundCardMetadata> = [
  {
    type: "emberGlow",
    label: "Ember Glow",
    gradient: "linear-gradient(135deg, #1a0a00, #7c2d12, #ea580c)",
    accentColor: "#fb923c",
    iconSvg: FA_FIRE,
    themeColors: ["#7c2d12", "#ea580c", "#fb923c"],
  },
  {
    type: "nightSky",
    label: "Night Sky",
    gradient: "linear-gradient(135deg, #1e1b4b, #4338ca, #818cf8)",
    accentColor: "#818cf8",
    iconSvg: FA_MOON,
    themeColors: ["#1e1b4b", "#4338ca", "#818cf8"],
  },
  {
    type: "deepOcean",
    label: "Deep Ocean",
    gradient: "linear-gradient(135deg, #0c4a6e, #0891b2, #22d3ee)",
    accentColor: "#22d3ee",
    iconSvg: FA_WATER,
    themeColors: ["#0c4a6e", "#0891b2", "#22d3ee"],
  },
  {
    type: "fireflyForest",
    label: "Firefly Forest",
    gradient: "linear-gradient(135deg, #0d3320, #166534, #4ade80)",
    accentColor: "#4ade80",
    iconSvg: FA_TREE,
    themeColors: ["#0d3320", "#166534", "#22c55e", "#bef264"],
  },
  {
    type: "snowfall",
    label: "Snowfall",
    gradient: "linear-gradient(135deg, #1e3a5f, #475569, #94a3b8)",
    accentColor: "#94a3b8",
    iconSvg: FA_SNOWFLAKE,
    themeColors: ["#1e3a5f", "#3b82f6", "#93c5fd"],
  },
  {
    type: "pride",
    label: "Rainbow",
    gradient:
      "linear-gradient(135deg, #e74c3c, #f39c12, #f1c40f, #2ecc71, #3498db, #9b59b6)",
    accentColor: "#c084fc",
    iconSvg: FA_RAINBOW,
    themeColors: ["#8b1c1c", "#8b4513", "#6b6b00", "#004d1a", "#1a2d5c", "#4a1a5c"],
  },
  {
    type: "sakuraDrift",
    label: "Cherry Blossom",
    gradient: "linear-gradient(135deg, #831843, #db2777, #f9a8d4)",
    accentColor: "#f9a8d4",
    iconSvg: FA_SPA,
    themeColors: ["#831843", "#db2777", "#f9a8d4"],
  },
  {
    type: "autumnDrift",
    label: "Autumn Drift",
    gradient: "linear-gradient(135deg, #78350f, #b45309, #dc2626)",
    accentColor: "#f59e0b",
    iconSvg: FA_LEAF,
    themeColors: ["#92400e", "#d97706", "#dc2626", "#78350f"],
  },
  {
    type: "solidColor",
    label: "Pure Black",
    gradient: "linear-gradient(135deg, #18181b, #27272a, #3f3f46)",
    accentColor: "#71717a",
    iconSvg: FA_CIRCLE,
    themeColors: ["#18181b", "#3f3f46", "#71717a"],
  },
  {
    type: "linearGradient",
    label: "Modern",
    gradient: "linear-gradient(135deg, #0d1117, #161b22, #21262d)",
    accentColor: "#71717a",
    iconSvg: FA_SQUARE,
    themeColors: ["#0d1117", "#161b22", "#21262d"],
  },
];

/**
 * Look up card metadata by BackgroundType string value.
 * Returns undefined if the type is not in the registry.
 */
export function getCardMetadata(type: string): BackgroundCardMetadata | undefined {
  return BACKGROUND_CARD_REGISTRY.find((entry) => entry.type === type);
}
