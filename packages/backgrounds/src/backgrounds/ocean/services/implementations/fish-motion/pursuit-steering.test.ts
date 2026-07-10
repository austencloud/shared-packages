import { describe, it, expect } from "vitest";
import { steerHeading, biasAwayFromEdges } from "./pursuit-steering.js";

describe("steerHeading", () => {
  it("clamps rotation to maxTurnRate * dt", () => {
    // Heading right, desired straight up (90deg away), rate 2 rad/s, dt 0.016
    const next = steerHeading({ x: 1, y: 0 }, { x: 0, y: 1 }, 2, 0.016);
    const angle = Math.atan2(next.y, next.x);
    expect(angle).toBeCloseTo(2 * 0.016, 5); // rotated exactly the cap
  });

  it("snaps to desired when within the per-step budget", () => {
    const next = steerHeading({ x: 1, y: 0 }, { x: 1, y: 0.001 }, 5, 0.016);
    const angle = Math.atan2(next.y, next.x);
    expect(angle).toBeCloseTo(Math.atan2(0.001, 1), 5);
  });

  it("returns a unit vector", () => {
    const next = steerHeading({ x: 1, y: 0 }, { x: -3, y: 4 }, 3, 0.1);
    expect(Math.hypot(next.x, next.y)).toBeCloseTo(1, 6);
  });

  it("takes the short way around the circle", () => {
    // Heading at +170deg, desired at -170deg: short path is +20deg, not -340
    const from = { x: Math.cos(2.967), y: Math.sin(2.967) };
    const to = { x: Math.cos(-2.967), y: Math.sin(-2.967) };
    const next = steerHeading(from, to, 10, 0.016);
    const angle = Math.atan2(next.y, next.x);
    expect(angle).toBeGreaterThan(2.967); // rotated further positive (wrapping)
  });
});

describe("biasAwayFromEdges", () => {
  it("leaves direction unchanged away from edges", () => {
    const d = biasAwayFromEdges({ x: 1, y: 0 }, 500, 400, 1000, 800, 120);
    expect(d).toEqual({ x: 1, y: 0 });
  });

  it("pushes inward near the right edge", () => {
    const d = biasAwayFromEdges({ x: 1, y: 0 }, 990, 400, 1000, 800, 120);
    expect(d.x).toBeLessThan(1); // no longer pure rightward
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1, 6);
  });

  it("pushes down near the top edge", () => {
    const d = biasAwayFromEdges({ x: 0, y: -1 }, 500, 10, 1000, 800, 120);
    expect(d.y).toBeGreaterThan(-1);
  });
});
