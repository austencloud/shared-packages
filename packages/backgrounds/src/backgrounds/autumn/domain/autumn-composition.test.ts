import { describe, expect, it } from "vitest";
import { getAutumnComposition } from "./autumn-composition.js";

const VIEWPORTS = [
  { width: 3840, height: 2160 },
  { width: 1440, height: 900 },
  { width: 820, height: 1180 },
  { width: 375, height: 667 },
];

describe("getAutumnComposition", () => {
  it.each(VIEWPORTS)(
    "keeps the amber focus inside the clearing at $width×$height",
    (dimensions) => {
      const { glow } = getAutumnComposition(dimensions);
      const portrait = dimensions.width / dimensions.height < 0.9;

      expect(glow.x).toBe(dimensions.width * (portrait ? 0.55 : 0.62));
      expect(glow.y).toBe(dimensions.height * (portrait ? 0.38 : 0.42));
      expect(glow.radius).toBeGreaterThan(0);
    },
  );

  it.each(VIEWPORTS)(
    "reserves the central content field at $width×$height",
    (dimensions) => {
      const { quietZone } = getAutumnComposition(dimensions);

      expect(quietZone.x).toBeGreaterThanOrEqual(dimensions.width * 0.14);
      expect(quietZone.width).toBeGreaterThanOrEqual(dimensions.width * 0.52);
      expect(quietZone.height).toBe(dimensions.height * 0.62);
      expect(quietZone.x + quietZone.width).toBeLessThanOrEqual(
        dimensions.width * 0.86,
      );
    },
  );

  it.each(VIEWPORTS)(
    "anchors every leaf source to the canopy edges",
    (dimensions) => {
      const { leafReleaseZones } = getAutumnComposition(dimensions);
      const weight = leafReleaseZones.reduce(
        (total, zone) => total + zone.weight,
        0,
      );

      expect(weight).toBeCloseTo(1);
      for (const zone of leafReleaseZones) {
        expect(zone.x).toBeGreaterThanOrEqual(0);
        expect(zone.y).toBeGreaterThanOrEqual(0);
        expect(zone.x + zone.width).toBeLessThanOrEqual(dimensions.width);
        expect(zone.y + zone.height).toBeLessThan(dimensions.height);
      }
    },
  );
});
