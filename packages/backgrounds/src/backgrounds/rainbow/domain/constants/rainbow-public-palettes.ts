import * as rainbowConstants from "./rainbow-constants.js";

type RainbowConstants = typeof rainbowConstants;
type RainbowPaletteMap = RainbowConstants extends {
  RAINBOW_PALETTES: infer PaletteMap;
}
  ? PaletteMap
  : RainbowConstants extends { PRIDE_PALETTES: infer PaletteMap }
    ? PaletteMap
    : never;

const candidates = rainbowConstants as unknown as {
  RAINBOW_PALETTES?: RainbowPaletteMap;
  PRIDE_PALETTES?: RainbowPaletteMap;
};

const palettes = candidates.RAINBOW_PALETTES ?? candidates.PRIDE_PALETTES;

if (!palettes) {
  throw new Error("The rainbow background did not provide a color palette.");
}

/** Stable public name for both the original and renamed rainbow palette map. */
export const RAINBOW_PALETTES = palettes;
export type RainbowPalette = keyof RainbowPaletteMap;
