import { describe, expect, it } from "vitest";
import { WinterCursorLightTracker } from "./WinterCursorLightTracker.js";

const dimensions = { width: 1920, height: 1080 };

function advance(
  tracker: WinterCursorLightTracker,
  frames: number,
  frameMultiplier: number = 1,
): void {
  for (let frame = 0; frame < frames; frame++) {
    tracker.update(frameMultiplier);
  }
}

describe("WinterCursorLightTracker", () => {
  it("starts at the pointer instead of sweeping in from the corner", () => {
    const tracker = new WinterCursorLightTracker();

    tracker.setPointer(1200, 430, true, "mouse");
    tracker.update(1);

    const stats = tracker.getStats(dimensions);
    expect(stats.x).toBe(1200);
    expect(stats.y).toBe(430);
    expect(stats.intensity).toBeGreaterThan(0);
  });

  it("falls off with distance and lights nearby flakes more strongly", () => {
    const tracker = new WinterCursorLightTracker();
    tracker.setPointer(960, 540, true, "mouse");
    advance(tracker, 120);

    const nearForeground = tracker.getIntensityAt(960, 540, 1, dimensions);
    const middleForeground = tracker.getIntensityAt(1035, 540, 1, dimensions);
    const nearBackground = tracker.getIntensityAt(960, 540, 0, dimensions);

    expect(nearForeground).toBeCloseTo(1, 5);
    expect(middleForeground).toBeGreaterThan(0);
    expect(middleForeground).toBeLessThan(nearForeground);
    expect(nearBackground).toBeLessThan(nearForeground * 0.4);
    expect(tracker.getIntensityAt(1200, 540, 1, dimensions)).toBe(0);
  });

  it("is time-corrected across frame multipliers", () => {
    const sixtyFps = new WinterCursorLightTracker();
    const thirtyFps = new WinterCursorLightTracker();
    sixtyFps.setPointer(400, 300, true, "mouse");
    thirtyFps.setPointer(400, 300, true, "mouse");
    sixtyFps.setPointer(1000, 700, true, "mouse");
    thirtyFps.setPointer(1000, 700, true, "mouse");

    advance(sixtyFps, 60, 1);
    advance(thirtyFps, 30, 2);

    const sixtyStats = sixtyFps.getStats(dimensions);
    const thirtyStats = thirtyFps.getStats(dimensions);
    expect(thirtyStats.x).toBeCloseTo(sixtyStats.x, 8);
    expect(thirtyStats.y).toBeCloseTo(sixtyStats.y, 8);
    expect(thirtyStats.intensity).toBeCloseTo(sixtyStats.intensity, 8);
  });

  it("fades after the pointer leaves", () => {
    const tracker = new WinterCursorLightTracker();
    tracker.setPointer(960, 540, true, "pen");
    advance(tracker, 60);
    expect(tracker.getStats(dimensions).intensity).toBeGreaterThan(0.99);

    tracker.setPointer(0, 0, false, "pen");
    advance(tracker, 120);

    expect(tracker.getStats(dimensions).enabled).toBe(false);
    expect(tracker.getIntensityAt(960, 540, 1, dimensions)).toBe(0);
  });

  it("stays dark for touch input", () => {
    const tracker = new WinterCursorLightTracker();
    tracker.setPointer(960, 540, true, "mouse");
    advance(tracker, 30);

    tracker.setPointer(300, 400, true, "touch");

    expect(tracker.getStats(dimensions).enabled).toBe(false);
    expect(tracker.getIntensityAt(300, 400, 1, dimensions)).toBe(0);
  });

  it("resets immediately when reduced motion is enabled", () => {
    const tracker = new WinterCursorLightTracker();
    tracker.setPointer(960, 540, true, "mouse");
    advance(tracker, 30);

    tracker.setReducedMotion(true);
    tracker.setPointer(1200, 500, true, "mouse");
    advance(tracker, 30);

    expect(tracker.getStats(dimensions)).toEqual({
      enabled: false,
      x: 0,
      y: 0,
      intensity: 0,
      targetIntensity: 0,
      radius: 162,
    });
  });
});
