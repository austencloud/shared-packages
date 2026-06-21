import { describe, it, expect } from "vitest";
import { approachExponential, easeHeading } from "./velocity-smoothing.js";

describe("approachExponential", () => {
  it("moves toward the target", () => {
    const next = approachExponential(0, 100, 10, 0.016);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(100);
  });

  it("never overshoots the target", () => {
    let v = 0;
    for (let i = 0; i < 1000; i++) v = approachExponential(v, 100, 10, 0.016);
    expect(v).toBeLessThanOrEqual(100);
    expect(v).toBeGreaterThan(99.9);
  });

  it("is frame-rate independent (two half-steps == one full step)", () => {
    const full = approachExponential(0, 100, 8, 0.032);
    const half1 = approachExponential(0, 100, 8, 0.016);
    const half2 = approachExponential(half1, 100, 8, 0.016);
    expect(Math.abs(full - half2)).toBeLessThan(1e-9);
  });

  it("returns target exactly when already there", () => {
    expect(approachExponential(50, 50, 10, 0.016)).toBe(50);
  });
});

describe("easeHeading", () => {
  it("eases a +1 -> -1 flip through 0, never instant", () => {
    const next = easeHeading(1, -1, 5, 0.016);
    expect(next).toBeLessThan(1);
    expect(next).toBeGreaterThan(-1);
  });
  it("converges to the target heading", () => {
    let h = 1;
    for (let i = 0; i < 1000; i++) h = easeHeading(h, -1, 5, 0.016);
    expect(h).toBeCloseTo(-1, 3);
  });
});
