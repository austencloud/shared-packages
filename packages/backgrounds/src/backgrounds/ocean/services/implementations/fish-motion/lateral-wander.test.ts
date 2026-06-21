import { describe, it, expect } from "vitest";
import { wanderOffset } from "./lateral-wander.js";

describe("wanderOffset", () => {
  it("stays within the amplitude bound", () => {
    for (let t = 0; t < 50; t += 0.1) {
      const v = wanderOffset(3.2, t, 1.5, 4);
      expect(Math.abs(v)).toBeLessThanOrEqual(4 + 1e-9);
    }
  });

  it("is continuous (no per-frame teleport)", () => {
    let prev = wanderOffset(1.0, 0, 1.5, 4);
    for (let t = 0.016; t < 5; t += 0.016) {
      const cur = wanderOffset(1.0, t, 1.5, 4);
      // smooth signal: adjacent-frame change is small relative to amplitude
      expect(Math.abs(cur - prev)).toBeLessThan(0.6);
      prev = cur;
    }
  });

  it("is deterministic for a given seed+time", () => {
    expect(wanderOffset(7, 2.5, 1.5, 4)).toBe(wanderOffset(7, 2.5, 1.5, 4));
  });

  it("differs between seeds", () => {
    expect(wanderOffset(1, 2.5, 1.5, 4)).not.toBe(wanderOffset(9, 2.5, 1.5, 4));
  });
});
