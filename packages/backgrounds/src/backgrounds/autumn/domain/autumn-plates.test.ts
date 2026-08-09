import { describe, expect, it } from "vitest";
import {
  getAutumnImagePlacement,
  getAutumnPlateAspect,
  getAutumnPlateSet,
} from "./autumn-plates.js";

const VIEWPORTS = [
  { width: 3840, height: 2160 },
  { width: 2560, height: 1440 },
  { width: 1440, height: 900 },
  { width: 820, height: 1180 },
  { width: 960, height: 412 },
  { width: 375, height: 667 },
];

describe("Autumn multiplane geometry", () => {
  it("selects the authored aspect and preserves depth order", () => {
    expect(getAutumnPlateAspect({ width: 1440, height: 900 })).toBe("wide");
    expect(getAutumnPlateAspect({ width: 820, height: 1180 })).toBe(
      "portrait",
    );

    for (const dimensions of VIEWPORTS) {
      const plates = getAutumnPlateSet(dimensions);
      expect(plates.map((plate) => plate.role)).toEqual([
        "far",
        "middle",
        "near",
      ]);
      expect(plates[0]?.depth).toBeLessThan(plates[1]?.depth ?? 0);
      expect(plates[1]?.depth).toBeLessThan(plates[2]?.depth ?? 0);
    }
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
