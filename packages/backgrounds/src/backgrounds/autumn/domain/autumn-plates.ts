import type { Dimensions } from "../../../core/domain/types.js";
import type { DepthParallaxOffset } from "../../../core/services/DepthParallaxTracker.js";

export type AutumnPlateAspect = "wide" | "portrait";

export interface AutumnImagePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

const FLAT_PATHS: Record<AutumnPlateAspect, string> = {
  wide: "/images/backgrounds/autumn/after-rain-grove.webp",
  portrait: "/images/backgrounds/autumn/after-rain-grove-portrait.webp",
};

export function getAutumnPlateAspect(
  dimensions: Dimensions,
): AutumnPlateAspect {
  return dimensions.width / Math.max(dimensions.height, 1) < 0.9
    ? "portrait"
    : "wide";
}

export function getAutumnFlatPath(dimensions: Dimensions): string {
  return FLAT_PATHS[getAutumnPlateAspect(dimensions)];
}

/**
 * Cover-crops the authored matte with enough overscan for its full parallax
 * range, including a one-pixel guard against sampled canvas seams.
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
