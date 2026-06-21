import { describe, it, expect } from "vitest";
import { FishCursorAvoidance } from "./FishCursorAvoidance.js";
import type { FishMarineLife } from "../../domain/models/OceanModels.js";

function makeFish(x: number, y: number): FishMarineLife {
  return {
    x, baseY: y, y, direction: 1, speed: 40, baseSpeed: 40, targetSpeed: 40,
    headingFactor: 1, behavior: "cruising", behaviorTimer: 5,
    fleeTimer: 0, fleeIntensity: 0,
    personality: { boldness: 0.5, curiosity: 0.5, sociability: 0.5, activity: 0.5 },
  } as unknown as FishMarineLife;
}

describe("FishCursorAvoidance", () => {
  const av = new FishCursorAvoidance();

  it("does nothing when pointer is inactive", () => {
    const f = makeFish(100, 100);
    av.apply([f], { x: 100, y: 100, active: false }, 0.016, 0);
    expect(f.fleeTimer).toBe(0);
    expect(f.behavior).toBe("cruising");
  });

  it("triggers flee when cursor is near and pushes fish away", () => {
    const f = makeFish(100, 100);
    av.apply([f], { x: 110, y: 100, active: true }, 0.016, 0); // cursor just right of fish
    expect(f.fleeTimer).toBeGreaterThan(0);
    expect(f.behavior).toBe("darting");
    expect(f.targetSpeed).toBeGreaterThan(f.baseSpeed); // sped up
    expect(f.direction).toBe(-1); // cursor on the right -> flee left
  });

  it("does not trigger when cursor is far", () => {
    const f = makeFish(0, 0);
    av.apply([f], { x: 5000, y: 5000, active: true }, 0.016, 0);
    expect(f.fleeTimer).toBe(0);
  });

  it("decays fleeTimer over time", () => {
    const f = makeFish(100, 100);
    av.apply([f], { x: 110, y: 100, active: true }, 0.016, 0);
    const t0 = f.fleeTimer;
    av.apply([f], { x: 5000, y: 5000, active: true }, 0.5, 0); // cursor gone
    expect(f.fleeTimer).toBeLessThan(t0);
  });
});
