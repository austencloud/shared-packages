import type { Dimensions } from "../../../core/domain/types.js";
import type { DepthParallaxOffset } from "../../../core/services/DepthParallaxTracker.js";

export type AutumnPlateAspect = "wide" | "portrait";
export type AutumnPlateRole = "far" | "middle" | "near";

export interface AutumnPlateDefinition {
  role: AutumnPlateRole;
  depth: number;
  path: string;
}

export interface AutumnImagePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

const WIDE_PLATES: readonly AutumnPlateDefinition[] = [
  {
    role: "far",
    depth: 0.15,
    path: "/images/backgrounds/autumn/amber-rain-far.webp",
  },
  {
    role: "middle",
    depth: 0.45,
    path: "/images/backgrounds/autumn/amber-rain-middle.webp",
  },
  {
    role: "near",
    depth: 1,
    path: "/images/backgrounds/autumn/amber-rain-near.webp",
  },
];

const PORTRAIT_PLATES: readonly AutumnPlateDefinition[] = [
  {
    role: "far",
    depth: 0.15,
    path: "/images/backgrounds/autumn/amber-rain-far-portrait.webp",
  },
  {
    role: "middle",
    depth: 0.45,
    path: "/images/backgrounds/autumn/amber-rain-middle-portrait.webp",
  },
  {
    role: "near",
    depth: 1,
    path: "/images/backgrounds/autumn/amber-rain-near-portrait.webp",
  },
];

const FLAT_PATHS: Record<AutumnPlateAspect, string> = {
  wide: "/images/backgrounds/autumn/amber-rain-grove.webp",
  portrait: "/images/backgrounds/autumn/amber-rain-grove-portrait.webp",
};

export function getAutumnPlateAspect(
  dimensions: Dimensions,
): AutumnPlateAspect {
  return dimensions.width / Math.max(dimensions.height, 1) < 0.9
    ? "portrait"
    : "wide";
}

export function getAutumnPlateSet(
  dimensions: Dimensions,
): readonly AutumnPlateDefinition[] {
  return getAutumnPlateAspect(dimensions) === "portrait"
    ? PORTRAIT_PLATES
    : WIDE_PLATES;
}

export function getAutumnFlatPath(dimensions: Dimensions): string {
  return FLAT_PATHS[getAutumnPlateAspect(dimensions)];
}

/**
 * Cover-crops an art plate with enough transparent overscan for its full
 * parallax range, including a one-pixel guard against sampled canvas seams.
 */
export function getAutumnImagePlacement(
  source: Dimensions,
  viewport: Dimensions,
  offset: DepthParallaxOffset,
  offsetLimit: DepthParallaxOffset,
): AutumnImagePlacement {
  const paddedWidth = viewport.width + Math.abs(offsetLimit.x) * 2 + 2;
  const paddedHeight = viewport.height + Math.abs(offsetLimit.y) * 2 + 2;
  const scale = Math.max(
    paddedWidth / Math.max(source.width, 1),
    paddedHeight / Math.max(source.height, 1),
  );
  const width = source.width * scale;
  const height = source.height * scale;

  return {
    x: (viewport.width - width) / 2 + offset.x,
    y: (viewport.height - height) / 2 + offset.y,
    width,
    height,
  };
}
