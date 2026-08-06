import { describe, expect, it } from "vitest";
import { WinterParallaxTracker } from "./WinterParallaxTracker.js";

const dimensions = { width: 1920, height: 1080 };

function advance(
  tracker: WinterParallaxTracker,
  frames: number,
  frameMultiplier: number = 1,
): void {
  for (let frame = 0; frame < frames; frame++) {
    tracker.update(frameMultiplier);
  }
}

describe("WinterParallaxTracker", () => {
  it("moves nearby snow farther than distant snow opposite the pointer", () => {
    const tracker = new WinterParallaxTracker();
    tracker.setPointer(
      dimensions.width,
      dimensions.height / 2,
      true,
      "mouse",
      dimensions,
    );
    advance(tracker, 120);

    const far = tracker.getOffset(0, dimensions);
    const middle = tracker.getOffset(0.5, dimensions);
    const near = tracker.getOffset(1, dimensions);

    expect(near.x).toBeLessThan(0);
    expect(Math.abs(far.x)).toBeGreaterThanOrEqual(2);
    expect(Math.abs(middle.x)).toBeGreaterThan(Math.abs(far.x) * 3);
    expect(Math.abs(near.x)).toBeGreaterThan(Math.abs(middle.x) * 1.8);
    expect(Math.abs(near.x)).toBeLessThanOrEqual(28);
  });

  it("returns to the anchored sky position without overshoot", () => {
    const tracker = new WinterParallaxTracker();
    tracker.setPointer(0, 0, true, "mouse", dimensions);
    advance(tracker, 60);
    expect(tracker.getStats().currentX).toBeGreaterThan(0);

    tracker.setPointer(0, 0, false, "mouse", dimensions);
    let previous = tracker.getStats().currentX;
    for (let frame = 0; frame < 120; frame++) {
      tracker.update(1);
      const current = tracker.getStats().currentX;
      expect(current).toBeGreaterThanOrEqual(0);
      expect(current).toBeLessThanOrEqual(previous);
      previous = current;
    }

    expect(tracker.getStats().currentX).toBeLessThan(0.0001);
  });

  it("is time-corrected across different frame multipliers", () => {
    const sixtyFps = new WinterParallaxTracker();
    const thirtyFps = new WinterParallaxTracker();
    sixtyFps.setPointer(0, 0, true, "mouse", dimensions);
    thirtyFps.setPointer(0, 0, true, "mouse", dimensions);

    advance(sixtyFps, 60, 1);
    advance(thirtyFps, 30, 2);

    expect(thirtyFps.getStats().currentX).toBeCloseTo(
      sixtyFps.getStats().currentX,
      8,
    );
    expect(thirtyFps.getStats().currentY).toBeCloseTo(
      sixtyFps.getStats().currentY,
      8,
    );
  });

  it("stays flat for touch input", () => {
    const tracker = new WinterParallaxTracker();
    tracker.setPointer(0, 0, true, "mouse", dimensions);
    advance(tracker, 30);
    expect(tracker.getStats().currentX).toBeGreaterThan(0);

    tracker.setPointer(800, 400, true, "touch", dimensions);

    expect(tracker.getStats().enabled).toBe(false);
    expect(tracker.getOffset(1, dimensions)).toEqual({ x: 0, y: 0 });
  });

  it("resets immediately when reduced motion is enabled", () => {
    const tracker = new WinterParallaxTracker();
    tracker.setPointer(0, 0, true, "pen", dimensions);
    advance(tracker, 30);

    tracker.setReducedMotion(true);
    tracker.setPointer(1920, 1080, true, "mouse", dimensions);
    advance(tracker, 30);

    expect(tracker.getStats()).toEqual({
      enabled: false,
      currentX: 0,
      currentY: 0,
      targetX: 0,
      targetY: 0,
    });
  });
});
