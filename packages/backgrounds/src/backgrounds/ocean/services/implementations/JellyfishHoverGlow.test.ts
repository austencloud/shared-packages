import { describe, it, expect } from "vitest";
import { JellyfishAnimator } from "./JellyfishAnimator.js";
import type { JellyfishMarineLife } from "../../domain/models/OceanModels.js";

const DIMS = { width: 1000, height: 800 };

function makeJelly(x: number, y: number, size = 60): JellyfishMarineLife {
  return {
    x, y, baseY: y, size,
    horizontalSpeed: 0, verticalSpeed: 0,
    pulsePhase: 0, pulseSpeed: 0,
    animationPhase: 0, frillPhase: 0,
    glowPhase: 0, glowSpeed: 0, glowIntensity: 0.5,
    flashTimer: 0, hoverGlow: 0,
    oralArms: [], tentacles: [], trailPositions: [],
  } as unknown as JellyfishMarineLife;
}

/** Run n update frames at 60fps with the given pointer. */
function frames(
  anim: JellyfishAnimator,
  jellies: JellyfishMarineLife[],
  n: number,
  pointer: { x: number; y: number; active: boolean } | null
): JellyfishMarineLife[] {
  let js = jellies;
  for (let i = 0; i < n; i++) js = anim.updateJellyfish(js, DIMS, 1.0, pointer);
  return js;
}

describe("Jellyfish hover glow", () => {
  const anim = new JellyfishAnimator();

  it("eases hoverGlow up while the pointer rests inside the bell radius", () => {
    const [j] = frames(anim, [makeJelly(500, 400)], 30, { x: 500, y: 400, active: true });
    expect(j!.hoverGlow).toBeGreaterThan(0.9);
    expect(j!.hoverGlow).toBeLessThanOrEqual(1);
  });

  it("stays dark when the pointer is outside the bell radius", () => {
    // radius = 60 * 0.6 = 36; pointer 50px away
    const [j] = frames(anim, [makeJelly(500, 400)], 30, { x: 550, y: 400, active: true });
    expect(j!.hoverGlow).toBeLessThan(0.001);
  });

  it("stays dark when the pointer is inactive even at the same spot", () => {
    const [j] = frames(anim, [makeJelly(500, 400)], 30, { x: 500, y: 400, active: false });
    expect(j!.hoverGlow).toBeLessThan(0.001);
  });

  it("eases back to 0 after the pointer leaves", () => {
    let js = frames(anim, [makeJelly(500, 400)], 30, { x: 500, y: 400, active: true });
    expect(js[0]!.hoverGlow).toBeGreaterThan(0.9);
    js = frames(anim, js, 60, null);
    expect(js[0]!.hoverGlow).toBeLessThan(0.01);
  });

  it("does not fire the startle: hover leaves flashTimer and baseY alone", () => {
    const j0 = makeJelly(500, 400);
    const [j] = frames(anim, [j0], 30, { x: 500, y: 400, active: true });
    expect(j!.flashTimer).toBe(0);
  });

  it("heals a pre-hoverGlow jelly (undefined field) instead of NaN-ing", () => {
    const stale = makeJelly(500, 400);
    delete (stale as unknown as Record<string, unknown>).hoverGlow;
    const [j] = frames(anim, [stale], 10, { x: 500, y: 400, active: true });
    expect(Number.isFinite(j!.hoverGlow)).toBe(true);
    expect(j!.hoverGlow).toBeGreaterThan(0.5);
  });
});
