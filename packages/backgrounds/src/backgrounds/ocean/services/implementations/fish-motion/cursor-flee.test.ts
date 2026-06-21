import { describe, it, expect } from "vitest";
import { computeFlee } from "./cursor-flee.js";

const base = { radius: 200, boldness: 0.5, direction: 1 as 1 | -1 };

describe("computeFlee", () => {
  it("returns zero intensity outside the (boldness-scaled) radius", () => {
    const r = computeFlee({ fishX: 0, fishY: 0, cursorX: 1000, cursorY: 0, ...base });
    expect(r.intensity).toBe(0);
  });

  it("flees away from the cursor (sign of direction is correct)", () => {
    // cursor to the LEFT of fish -> fish should be pushed RIGHT (+x)
    const r = computeFlee({ fishX: 100, fishY: 0, cursorX: 50, cursorY: 0, ...base });
    expect(r.intensity).toBeGreaterThan(0);
    expect(r.dirX).toBeGreaterThan(0);
  });

  it("intensity increases as the cursor gets closer", () => {
    const far = computeFlee({ fishX: 0, fishY: 0, cursorX: 150, cursorY: 0, ...base });
    const near = computeFlee({ fishX: 0, fishY: 0, cursorX: 30, cursorY: 0, ...base });
    expect(near.intensity).toBeGreaterThan(far.intensity);
  });

  it("returns a unit-length flee direction", () => {
    const r = computeFlee({ fishX: 0, fishY: 0, cursorX: 40, cursorY: 40, ...base });
    expect(Math.hypot(r.dirX, r.dirY)).toBeCloseTo(1, 5);
  });

  it("bolder fish have a smaller effective radius", () => {
    const timid = computeFlee({ fishX: 0, fishY: 0, cursorX: 250, cursorY: 0, radius: 200, boldness: 0.0, direction: 1 });
    const bold = computeFlee({ fishX: 0, fishY: 0, cursorX: 250, cursorY: 0, radius: 200, boldness: 1.0, direction: 1 });
    expect(timid.intensity).toBeGreaterThan(0);
    expect(bold.intensity).toBe(0);
  });

  it("degenerate zero-distance flees upward without NaN", () => {
    const r = computeFlee({ fishX: 0, fishY: 0, cursorX: 0, cursorY: 0, ...base });
    expect(Number.isNaN(r.dirX)).toBe(false);
    expect(Number.isNaN(r.dirY)).toBe(false);
    expect(r.intensity).toBeGreaterThan(0);
  });
});
