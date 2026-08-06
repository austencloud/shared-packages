import { describe, expect, it } from "vitest";
import { WinterWindField } from "./WinterWindField.js";

const dimensions = { width: 800, height: 600 };

function magnitude(vector: { x: number; y: number }): number {
  return Math.hypot(vector.x, vector.y);
}

function advance(field: WinterWindField, frames: number): void {
  for (let frame = 0; frame < frames; frame++) field.update(1);
}

describe("WinterWindField", () => {
  it("keeps neighboring flakes in one coherent flow", () => {
    const field = new WinterWindField({ seed: 42, random: () => 0.5 });
    const first = field.sample(300, 240, 0.7, dimensions);
    const neighbor = field.sample(306, 244, 0.7, dimensions);

    expect(Math.hypot(first.x - neighbor.x, first.y - neighbor.y)).toBeLessThan(
      0.08,
    );
  });

  it("moves near flakes more strongly than far flakes", () => {
    const field = new WinterWindField({ seed: 7, random: () => 0.5 });
    const far = field.sample(420, 260, 0, dimensions);
    const near = field.sample(420, 260, 1, dimensions);

    expect(magnitude(near)).toBeGreaterThan(magnitude(far) * 2.5);
  });

  it("sweeps a bounded gust front across the viewport", () => {
    const field = new WinterWindField({ seed: 12, random: () => 0 });
    field.triggerGust(1);
    advance(field, 90);

    const center = field.sample(400, 300, 1, dimensions);
    expect(field.getStats().gustActive).toBe(true);
    expect(center.x).toBeGreaterThan(0.5);
    expect(magnitude(center)).toBeLessThanOrEqual(2.4);

    advance(field, 90);
    expect(field.getStats().gustActive).toBe(false);
  });

  it("creates a pointer wake that fades after movement stops", () => {
    const field = new WinterWindField({ seed: 21, random: () => 0.5 });
    const ambient = new WinterWindField({ seed: 21, random: () => 0.5 });
    field.setPointer(200, 200, true);
    field.setPointer(230, 200, true);

    const moving = field.getStats().pointerSpeed;
    const wake = field.sample(240, 205, 1, dimensions);
    expect(moving).toBeGreaterThan(0);
    expect(wake.x).toBeGreaterThan(0.2);

    advance(field, 120);
    advance(ambient, 120);
    expect(field.getStats().pointerSpeed).toBeLessThan(0.001);
    const faded = field.sample(240, 205, 1, dimensions);
    const baseline = ambient.sample(240, 205, 1, dimensions);
    expect(Math.hypot(faded.x - baseline.x, faded.y - baseline.y)).toBeLessThan(
      0.02,
    );
  });

  it("leaves a readable ribbon that parts snow along the pointer path", () => {
    const field = new WinterWindField({ seed: 18, random: () => 0.5 });
    const ambient = new WinterWindField({ seed: 18, random: () => 0.5 });
    field.setPointer(100, 300, true);
    field.setPointer(220, 300, true);
    field.setPointer(520, 300, true);

    const above = field.sample(160, 260, 1, dimensions);
    const aboveAmbient = ambient.sample(160, 260, 1, dimensions);
    const below = field.sample(160, 340, 1, dimensions);
    const belowAmbient = ambient.sample(160, 340, 1, dimensions);

    expect(above.y - aboveAmbient.y).toBeLessThan(-0.15);
    expect(below.y - belowAmbient.y).toBeGreaterThan(0.15);
  });

  it("alternates the curl direction between neighboring wake pockets", () => {
    const field = new WinterWindField({ seed: 27, random: () => 0.5 });
    const ambient = new WinterWindField({ seed: 27, random: () => 0.5 });
    field.setPointer(100, 300, true);
    field.setPointer(200, 300, true);
    field.setPointer(700, 300, true);

    const firstCurl = field.sample(165, 300, 1, dimensions);
    const firstAmbient = ambient.sample(165, 300, 1, dimensions);
    const secondCurl = field.sample(465, 300, 1, dimensions);
    const secondAmbient = ambient.sample(465, 300, 1, dimensions);

    expect(firstCurl.y - firstAmbient.y).toBeGreaterThan(0.2);
    expect(secondCurl.y - secondAmbient.y).toBeLessThan(-0.2);
  });

  it("turns off gust and pointer motion for reduced motion", () => {
    const field = new WinterWindField({ seed: 33, random: () => 0.5 });
    field.triggerGust(1);
    field.setPointer(100, 100, true);
    field.setPointer(140, 100, true);
    field.setReducedMotion(true);

    const stats = field.getStats();
    const reduced = field.sample(140, 100, 1, dimensions);

    expect(stats.gustActive).toBe(false);
    expect(stats.pointerSpeed).toBe(0);
    expect(magnitude(reduced)).toBeLessThan(0.2);
  });
});
