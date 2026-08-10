import { describe, expect, it } from "vitest";
import { CelestialBackgroundSystem } from "./CelestialBackgroundSystem.js";

describe("CelestialBackgroundSystem layer contract", () => {
  it("uses the cloud-only Celestial layers by default", () => {
    const system = new CelestialBackgroundSystem();

    expect(system.getLayerVisibility()).toEqual({
      gradient: true,
      clouds: true,
      sunGlow: true,
      atmosphere: true,
      vignette: true,
    });
  });

  it("updates supported cloud-scene layers without mutating the snapshot", () => {
    const system = new CelestialBackgroundSystem();
    const snapshot = system.getLayerVisibility();

    system.setLayerVisibility({ clouds: false, atmosphere: false });

    expect(system.getLayerVisibility()).toEqual({
      gradient: true,
      clouds: false,
      sunGlow: true,
      atmosphere: false,
      vignette: true,
    });
    expect(snapshot.clouds).toBe(true);
    expect(snapshot.atmosphere).toBe(true);
  });
});
