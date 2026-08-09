import { describe, expect, it } from "vitest";
import { createWindSystem, getGustEnvelope } from "./WindSystem.js";

describe("getGustEnvelope", () => {
  it("eases from rest to a peak and back to rest", () => {
    expect(getGustEnvelope(0)).toBe(0);
    expect(getGustEnvelope(0.5)).toBeCloseTo(1);
    expect(getGustEnvelope(1)).toBeCloseTo(0);
  });
});

describe("createWindSystem", () => {
  it("uses one fixed duration for the full gust", () => {
    const wind = createWindSystem(() => 0.5);
    wind.initialize();
    wind.triggerGust(1);

    const totalDuration = wind.state.gust.totalDuration;
    wind.update(totalDuration / 2);

    expect(wind.state.gust.totalDuration).toBe(totalDuration);
    expect(wind.state.gust.duration).toBe(totalDuration / 2);
    expect(wind.state.gust.currentStrength).toBeCloseTo(1);
  });

  it("changes the ambient breeze when the preset changes", () => {
    const wind = createWindSystem(() => 0.5);
    wind.initialize();
    wind.setPreset("calm");
    const calmForce = wind.getWindForce();
    wind.setPreset("windy");

    expect(wind.getWindForce()).toBeGreaterThan(calmForce * 4);
  });
});
