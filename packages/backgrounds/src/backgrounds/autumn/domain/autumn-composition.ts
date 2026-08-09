import type { Dimensions } from "../../../core/domain/types.js";

export interface AutumnLeafReleaseZone {
  x: number;
  y: number;
  width: number;
  height: number;
  weight: number;
  drift: number;
}

export interface AutumnComposition {
  quietZone: { x: number; y: number; width: number; height: number };
  glow: { x: number; y: number; radius: number };
  leafReleaseZones: AutumnLeafReleaseZone[];
}

export function getAutumnComposition(
  dimensions: Dimensions,
): AutumnComposition {
  const { width, height } = dimensions;
  const portrait = width / Math.max(height, 1) < 0.9;

  return {
    quietZone: {
      x: width * (portrait ? 0.14 : 0.24),
      y: height * 0.16,
      width: width * (portrait ? 0.72 : 0.52),
      height: height * 0.62,
    },
    glow: {
      x: width * (portrait ? 0.55 : 0.62),
      y: height * (portrait ? 0.38 : 0.42),
      radius: Math.max(width, height) * (portrait ? 0.25 : 0.2),
    },
    leafReleaseZones: [
      {
        x: width * 0.02,
        y: height * 0.08,
        width: width * (portrait ? 0.31 : 0.26),
        height: height * 0.3,
        weight: 0.46,
        drift: 0.2,
      },
      {
        x: width * (portrait ? 0.69 : 0.72),
        y: height * 0.06,
        width: width * (portrait ? 0.29 : 0.26),
        height: height * 0.34,
        weight: 0.46,
        drift: -0.16,
      },
      {
        x: width * 0.42,
        y: height * 0.02,
        width: width * 0.16,
        height: height * 0.11,
        weight: 0.08,
        drift: 0.04,
      },
    ],
  };
}
