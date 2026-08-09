import type { Dimensions, QualityLevel } from "../../../core/domain/types.js";
import type { SnowOpticalClass } from "./models/winter-models.js";

export const SNOW_OPTICS_URL = "/images/backgrounds/winter/snow-optics.webp";

export const SNOW_LIGHT_RESPONSES: Record<SnowOpticalClass, number> = {
  powder: 0.55,
  crystal: 1,
  foreground: 0.35,
};

export interface SnowAtlasCell {
  x: number;
  y: number;
  width: number;
  height: number;
  focus: number;
}

export const SNOW_ATLAS_CELLS: readonly SnowAtlasCell[] = Array.from(
  { length: 16 },
  (_, index) => ({
    x: (index % 4) * 256,
    y: Math.floor(index / 4) * 256,
    width: 256,
    height: 256,
    focus: Math.floor(index / 4) / 3,
  }),
);

export interface SnowBandTargets {
  powder: number;
  crystal: number;
  foreground: number;
}

interface SnowOpticalFields {
  opticalClass: SnowOpticalClass;
  opticalVariant: number;
  opticalFocus: number;
  opticalScale: number;
  opticalAlpha: number;
}

const BAND_SHARES: Record<"high" | "medium" | "low", SnowBandTargets> = {
  high: { powder: 0.54, crystal: 0.36, foreground: 0.1 },
  medium: { powder: 0.56, crystal: 0.39, foreground: 0.05 },
  low: { powder: 0.58, crystal: 0.42, foreground: 0 },
};

function normalizedQuality(
  quality: QualityLevel | string,
): "high" | "medium" | "low" {
  if (quality === "high" || quality === "medium") return quality;
  return "low";
}

export function getSnowBandTargets(
  total: number,
  dimensions: Dimensions,
  quality: QualityLevel | string,
): SnowBandTargets {
  const safeTotal = Math.max(0, Math.floor(total));
  const tier = normalizedQuality(quality);
  const shares = BAND_SHARES[tier];
  const portrait = dimensions.height > dimensions.width;
  const foregroundCap =
    tier === "high"
      ? portrait
        ? 8
        : 14
      : tier === "medium"
        ? portrait
          ? 4
          : 6
        : 0;
  const foreground = Math.min(
    foregroundCap,
    Math.round(safeTotal * shares.foreground),
  );
  const remaining = safeTotal - foreground;
  const backShare = shares.powder + shares.crystal;
  const powder = Math.round(remaining * (shares.powder / backShare));

  return {
    powder,
    crystal: remaining - powder,
    foreground,
  };
}

export function getForegroundBirthX(
  width: number,
  random: () => number,
): number {
  const safeWidth = Math.max(width, 0);
  if (random() < 0.82) {
    const edgeWidth = safeWidth * 0.22;
    return random() < 0.5
      ? random() * edgeWidth
      : safeWidth - random() * edgeWidth;
  }
  return random() * safeWidth;
}

export function getSnowGustStretch(
  windVelocityX: number,
  windVelocityY: number,
): number {
  return 1 + Math.min(0.35, Math.hypot(windVelocityX, windVelocityY) * 0.12);
}

export function createSnowOpticalFields(
  opticalClass: SnowOpticalClass,
  baseSize: number,
  dimensions: Dimensions,
  random: () => number,
): SnowOpticalFields {
  if (opticalClass === "powder") {
    return {
      opticalClass,
      opticalVariant: Math.floor(random() * 3),
      opticalFocus: 1,
      opticalScale: 0.6 + random() * 1.6,
      opticalAlpha: 1,
    };
  }

  if (opticalClass === "foreground") {
    const wide =
      dimensions.width >= 900 && dimensions.width >= dimensions.height;
    const minimum = wide ? 20 : 16;
    const maximum = wide ? 84 : 48;
    const focusRow = 2;
    const variant = focusRow * 4 + Math.floor(random() * 4);
    const sizeBias = Math.pow(random(), 0.58);

    return {
      opticalClass,
      opticalVariant: variant,
      opticalFocus: SNOW_ATLAS_CELLS[variant]?.focus ?? 0.75,
      opticalScale: minimum + sizeBias * (maximum - minimum),
      opticalAlpha: 1,
    };
  }

  return {
    opticalClass,
    opticalVariant: Math.floor(random() * 8),
    opticalFocus: 0,
    opticalScale: baseSize,
    opticalAlpha: 1,
  };
}
