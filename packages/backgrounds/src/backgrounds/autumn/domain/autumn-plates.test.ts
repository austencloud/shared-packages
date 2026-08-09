import { describe, expect, it } from "vitest";
import {
  getAutumnFlatPath,
  getAutumnImagePlacement,
  getAutumnPlateAspect,
} from "./autumn-plates.js";

const VIEWPORTS = [
  { width: 3840, height: 2160 },
  { width: 2560, height: 1440 },
  { width: 1440, height: 900 },
  { width: 820, height: 1180 },
  { width: 960, height: 412 },
  { width: 375, height: 667 },
];

describe("Autumn artwork geometry", () => {
  it("selects the authored wide and portrait mattes", () => {
    expect(getAutumnPlateAspect({ width: 1440, height: 900 })).toBe("wide");
    expect(getAutumnPlateAspect({ width: 820, height: 1180 })).toBe(
      "portrait",
    );
    expect(getAutumnFlatPath({ width: 1440, height: 900 })).toBe(
      "/images/backgrounds/autumn/after-rain-grove.webp",
    );
    expect(getAutumnFlatPath({ width: 820, height: 1180 })).toBe(
      "/images/backgrounds/autumn/after-rain-grove-portrait.webp",
    );
  });

  it.each(VIEWPORTS)(
    "covers $width×$height at both parallax extremes",
    (viewport) => {
      const portrait = getAutumnPlateAspect(viewport) === "portrait";
      const source = portrait
        ? { width: 2304, height: 4096 }
        : { width: 4096, height: 2304 };
      const limit = { x: 48, y: 28 };

      for (const direction of [-1, 1]) {
        const placement = getAutumnImagePlacement(
          source,
          viewport,
          { x: limit.x * direction, y: limit.y * direction },
          limit,
        );

        expect(placement.x).toBeLessThanOrEqual(0);
        expect(placement.y).toBeLessThanOrEqual(0);
        expect(placement.x + placement.width).toBeGreaterThanOrEqual(
          viewport.width,
        );
        expect(placement.y + placement.height).toBeGreaterThanOrEqual(
          viewport.height,
        );
      }
    },
  );
});
