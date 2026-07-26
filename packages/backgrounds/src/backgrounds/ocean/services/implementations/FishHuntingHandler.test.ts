import { describe, it, expect } from "vitest";
import { FishHuntingHandler } from "./FishHuntingHandler.js";
import type { FishMarineLife } from "../../domain/models/OceanModels.js";

function makeFish(
  fishId: number,
  species: FishMarineLife["species"],
  x: number,
  y: number
): FishMarineLife {
  return {
    fishId, species, x, y, baseY: y,
    direction: 1, speed: 40, baseSpeed: 40, targetSpeed: 40,
    headingFactor: 1, behavior: "cruising", behaviorTimer: 5,
    hunger: 1, energy: 1, mood: "calm",
    personality: { boldness: 0.5, curiosity: 0.5, sociability: 0.5, activity: 0.5 },
  } as unknown as FishMarineLife;
}

const DT = 0.016;

/** Advances the hunt into its chase phase (stalk lasts 2-3s). */
function runToChase(
  handler: FishHuntingHandler,
  fish: FishMarineLife[]
): number {
  let t = 0;
  handler.processHunting(fish, DT, t); // hunt starts (stalking)
  while (t < 4) {
    t += DT;
    handler.processHunting(fish, DT, t);
    if (fish[0]!.huntState === "chasing") return t;
  }
  throw new Error("hunt never reached chase phase");
}

describe("FishHuntingHandler movement", () => {
  // Gap must survive the stalk without triggering nearMissDistance (30px), or
  // the chase resolves on the sampled frame and neither fish moves. The stalk
  // closes at most baseSpeed(40) * predatorStalkSpeed(0.6) * 3s = 72px, and the
  // hunt only starts inside detectionRadius (150px) — so 145 always leaves
  // >= 73px, while 100 landed between 28 and 52px and failed ~1 run in 6.
  const START_GAP = 145;

  it("moves the chasing predator at baseSpeed * chase multiplier px/s, not 60x", () => {
    const handler = new FishHuntingHandler();
    const predator = makeFish(1, "sleek", 100, 100);
    const prey = makeFish(2, "tropical", 100 + START_GAP, 100);
    const tChase = runToChase(handler, [predator, prey]);

    const xBefore = predator.x;
    handler.processHunting([predator, prey], DT, tChase + DT);
    const step = Math.abs(predator.x - xBefore);

    // chase speed = baseSpeed(40) * 2.0 = 80 px/s -> ~1.28 px per 16ms frame.
    // The old 60x unit bug produced ~77 px per frame.
    expect(step).toBeGreaterThan(0);
    expect(step).toBeLessThan(80 * DT * 1.5);
  });

  it("moves the fleeing prey at baseSpeed * escape boost px/s, not 60x", () => {
    const handler = new FishHuntingHandler();
    const predator = makeFish(1, "sleek", 100, 100);
    const prey = makeFish(2, "tropical", 100 + START_GAP, 100);
    const tChase = runToChase(handler, [predator, prey]);

    const xBefore = prey.x;
    handler.processHunting([predator, prey], DT, tChase + DT);
    const step = Math.abs(prey.x - xBefore);

    // flee speed = baseSpeed(40) * 1.5 = 60 px/s -> ~0.96 px per frame.
    expect(step).toBeGreaterThan(0);
    expect(step).toBeLessThan(60 * DT * 1.5);
  });

  it("keeps baseY in sync with y during vertical chase movement (no snap-back on hunt end)", () => {
    const handler = new FishHuntingHandler();
    const predator = makeFish(1, "sleek", 100, 100);
    const prey = makeFish(2, "tropical", 100, 180); // directly below
    const tChase = runToChase(handler, [predator, prey]);
    handler.processHunting([predator, prey], DT, tChase + DT);

    expect(predator.baseY).toBeCloseTo(predator.y, 5);
    expect(prey.baseY).toBeCloseTo(prey.y, 5);
    expect(predator.baseY).not.toBe(100); // it actually moved
  });

  it("resolves the hunt on close approach - no glued-together lingering", () => {
    const handler = new FishHuntingHandler();
    const predator = makeFish(1, "sleek", 100, 100);
    const prey = makeFish(2, "tropical", 200, 100);
    const tChase = runToChase(handler, [predator, prey]);

    // Teleport prey next to predator to force a close approach
    prey.x = predator.x + 10;
    prey.baseY = predator.baseY;
    prey.y = predator.y;
    const results = handler.processHunting([predator, prey], DT, tChase + DT);

    expect(results).toHaveLength(1);
    expect(["caught", "escaped"]).toContain(results[0]!.outcome);
    expect(handler.getActiveHunts()).toHaveLength(0);
    // On escape, prey jukes via a real darting burst
    if (results[0]!.outcome === "escaped") {
      expect(prey.behavior).toBe("darting");
      expect(prey.targetSpeed).toBeGreaterThan(prey.baseSpeed * 2);
    }
  });

  it("does not flip sprite direction when the pair overlaps horizontally", () => {
    const handler = new FishHuntingHandler();
    const predator = makeFish(1, "sleek", 100, 100);
    const prey = makeFish(2, "tropical", 102, 140); // within deadzone in x
    const tChase = runToChase(handler, [predator, prey]);

    predator.direction = 1;
    prey.direction = 1;
    handler.processHunting([predator, prey], DT, tChase + DT);
    expect(predator.direction).toBe(1);
    expect(prey.direction).toBe(1);
  });
});
