import { describe, expect, it } from "vitest";
import {
  SNOW_ATLAS_CELLS,
  SNOW_LIGHT_RESPONSES,
  createSnowOpticalFields,
  getForegroundBirthX,
  getSnowBandTargets,
  getSnowGustStretch,
} from "./snow-optics.js";

function createRandom(seed: number = 123456789): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

describe("winter snow optics", () => {
  it("holds foreground caps while preserving the complete population", () => {
    const wide = getSnowBandTargets(
      1_244,
      { width: 3840, height: 2160 },
      "high",
    );
    const portrait = getSnowBandTargets(
      800,
      { width: 820, height: 1180 },
      "high",
    );

    expect(wide.foreground).toBe(14);
    expect(portrait.foreground).toBe(8);
    expect(wide.powder + wide.crystal + wide.foreground).toBe(1_244);
    expect(portrait.powder + portrait.crystal + portrait.foreground).toBe(800);
  });

  it("keeps the uncapped high-quality population in the intended bands", () => {
    const targets = getSnowBandTargets(50, { width: 375, height: 667 }, "high");

    expect(targets).toEqual({ powder: 27, crystal: 18, foreground: 5 });
  });

  it("keeps the middle 46 percent below the long-sample birth limit", () => {
    const random = createRandom();
    const width = 1_000;
    let middleBirths = 0;

    for (let index = 0; index < 5_000; index += 1) {
      const x = getForegroundBirthX(width, random);
      if (x >= width * 0.27 && x <= width * 0.73) middleBirths += 1;
    }

    expect(middleBirths / 5_000).toBeLessThanOrEqual(0.35);
  });

  it("caps the strongest gust stretch at the 1.35 aspect-ratio gate", () => {
    expect(getSnowGustStretch(0, 0)).toBe(1);
    expect(getSnowGustStretch(1, 1)).toBeGreaterThan(1);
    expect(getSnowGustStretch(100, 100)).toBe(1.35);
  });

  it("keeps atlas metadata and optical fields inside their render bounds", () => {
    const random = createRandom(42);
    const dimensions = { width: 3840, height: 2160 };
    const foreground = Array.from({ length: 5_000 }, () =>
      createSnowOpticalFields("foreground", 8, dimensions, random),
    );
    const mediumSoftCount = foreground.filter(
      (profile) => profile.opticalVariant < 12,
    ).length;
    const mediumSoftShare = mediumSoftCount / foreground.length;

    expect(SNOW_ATLAS_CELLS).toHaveLength(16);
    expect(
      foreground.every(
        (profile) =>
          profile.opticalVariant >= 8 &&
          profile.opticalVariant < 16 &&
          profile.opticalFocus >= 0 &&
          profile.opticalFocus <= 1 &&
          profile.opticalScale >= 20 &&
          profile.opticalScale <= 84,
      ),
    ).toBe(true);
    expect(
      new Set(foreground.map((profile) => profile.opticalVariant)).size,
    ).toBe(8);
    expect(mediumSoftShare).toBeGreaterThan(0.68);
    expect(mediumSoftShare).toBeLessThan(0.72);
    expect(SNOW_LIGHT_RESPONSES).toEqual({
      powder: 0.55,
      crystal: 1,
      foreground: 0.35,
    });
  });
});
