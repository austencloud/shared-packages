import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createSnowflakeSystem } from "./SnowflakeSystem.js";

class Path2DStub {
  moveTo(): void {}
  lineTo(): void {}
}

function createRandom(seed: number = 123456789): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function createContext(
  translations: Array<{ x: number; y: number }> = [],
): CanvasRenderingContext2D {
  return {
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high",
    arc: () => undefined,
    beginPath: () => undefined,
    drawImage: () => undefined,
    fill: () => undefined,
    lineTo: () => undefined,
    moveTo: () => undefined,
    save: () => undefined,
    restore: () => undefined,
    rotate: () => undefined,
    scale: () => undefined,
    stroke: () => undefined,
    translate: (x: number, y: number) => translations.push({ x, y }),
  } as unknown as CanvasRenderingContext2D;
}

describe("SnowflakeSystem living wind integration", () => {
  beforeAll(() => {
    vi.stubGlobal("Path2D", Path2DStub);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("keeps a full desktop snow field finite and bounded through gusts and pointer motion", () => {
    const dimensions = { width: 1920, height: 1080 };
    const system = createSnowflakeSystem();
    let flakes = system.initialize(dimensions, "high");

    expect(flakes.length).toBeGreaterThan(250);

    system.setPointer(500, 500, true);
    system.setPointer(560, 520, true);

    for (let frame = 0; frame < 900; frame++) {
      if (frame === 30) system.setPointer(0, 0, false);
      flakes = system.update(flakes, dimensions, 1);
    }

    for (const flake of flakes) {
      expect(Number.isFinite(flake.x)).toBe(true);
      expect(Number.isFinite(flake.y)).toBe(true);
      expect(Number.isFinite(flake.rotation)).toBe(true);
      expect(flake.x).toBeGreaterThanOrEqual(-50);
      expect(flake.x).toBeLessThanOrEqual(dimensions.width + 50);
      expect(flake.y).toBeGreaterThanOrEqual(-110);
      expect(flake.y).toBeLessThanOrEqual(dimensions.height);
      expect(
        Math.hypot(flake.windVelocityX, flake.windVelocityY),
      ).toBeLessThanOrEqual(2.4);
    }

    expect(
      flakes.some(
        (flake) => Math.hypot(flake.windVelocityX, flake.windVelocityY) > 0.01,
      ),
    ).toBe(true);
  });

  it("keeps the snow field distributed when a large viewport shrinks", () => {
    const system = createSnowflakeSystem();
    const large = { width: 3840, height: 2160 };
    const compact = { width: 1440, height: 900 };
    const flakes = system.initialize(large, "high");

    const resized = system.adjustToResize(flakes, large, compact, "high");

    expect(resized).toHaveLength(121);
    expect(Math.max(...resized.map((flake) => flake.x))).toBeLessThanOrEqual(
      compact.width,
    );
    expect(Math.max(...resized.map((flake) => flake.y))).toBeLessThanOrEqual(
      compact.height,
    );
    expect(
      resized.every((flake, index) => {
        const previous = resized[index - 1];
        return !previous || previous.depth <= flake.depth;
      }),
    ).toBe(true);
    expect(
      resized.filter((flake) => flake.opticalClass === "foreground"),
    ).toHaveLength(12);
  });

  it("keeps enough flakes on a narrow phone for the wind field to read", () => {
    const system = createSnowflakeSystem();
    const phone = { width: 375, height: 667 };

    const flakes = system.initialize(phone, "high");

    expect(flakes.length).toBeGreaterThanOrEqual(45);
  });

  it("renders depth parallax for mouse input and stays flat for touch", () => {
    const dimensions = { width: 1920, height: 1080 };
    const system = createSnowflakeSystem();
    let flakes = system.initialize(dimensions, "high");
    const translations: Array<{ x: number; y: number }> = [];
    const context = createContext(translations);

    system.setPointer(dimensions.width, dimensions.height / 2, true, "mouse");
    for (let frame = 0; frame < 120; frame++) {
      flakes = system.update(flakes, dimensions, 1);
    }
    system.draw(flakes, context, dimensions);
    const firstCrystal = system.getBandIndices().crystal[0] ?? 0;

    expect(system.getParallaxStats().enabled).toBe(true);
    expect(system.getCursorLightStats().enabled).toBe(true);
    expect(translations[0]?.x).toBeLessThan(flakes[firstCrystal]?.x ?? 0);

    translations.length = 0;
    system.setPointer(300, 400, true, "touch");
    system.draw(flakes, context, dimensions);

    expect(system.getParallaxStats().enabled).toBe(false);
    expect(system.getCursorLightStats().enabled).toBe(false);
    expect(translations[0]?.x).toBeCloseTo(flakes[firstCrystal]?.x ?? 0, 8);
    expect(translations[0]?.y).toBeCloseTo(flakes[firstCrystal]?.y ?? 0, 8);
  });

  it("keeps optical choices stable and consumes no random values during draw", () => {
    let calls = 0;
    const seeded = createRandom(42);
    const system = createSnowflakeSystem({
      random: () => {
        calls += 1;
        return seeded();
      },
    });
    const dimensions = { width: 1440, height: 900 };
    let flakes = system.initialize(dimensions, "high");
    const opticalBefore = flakes.map((flake) => [
      flake.opticalClass,
      flake.opticalVariant,
      flake.opticalFocus,
      flake.opticalScale,
    ]);

    for (let frame = 0; frame < 120; frame += 1) {
      flakes = system.update(flakes, dimensions, 1);
    }
    expect(
      flakes.map((flake) => [
        flake.opticalClass,
        flake.opticalVariant,
        flake.opticalFocus,
        flake.opticalScale,
      ]),
    ).toEqual(opticalBefore);

    const callsBeforeDraw = calls;
    system.draw(flakes, createContext(), dimensions);
    expect(calls).toBe(callsBeforeDraw);
  });

  it("fades foreground out over twenty reduced-motion frames", () => {
    const system = createSnowflakeSystem({ random: createRandom(7) });
    const dimensions = { width: 1920, height: 1080 };
    let flakes = system.initialize(dimensions, "high");
    system.setReducedMotion(true);

    for (let frame = 0; frame < 20; frame += 1) {
      flakes = system.update(flakes, dimensions, 1);
    }

    expect(
      flakes
        .filter((flake) => flake.opticalClass === "foreground")
        .every((flake) => flake.opticalAlpha <= 0.001),
    ).toBe(true);
    expect(system.getWindStats().gustActive).toBe(false);
  });

  it("converges quality without adding more than five percent in one frame", () => {
    const system = createSnowflakeSystem({ random: createRandom(99) });
    const dimensions = { width: 1920, height: 1080 };
    let flakes = system.initialize(dimensions, "low");
    system.setQuality("high");

    const firstTarget = Math.ceil(311 * 0.05);
    const before = flakes.length;
    flakes = system.update(flakes, dimensions, 1);
    expect(flakes.length - before).toBeLessThanOrEqual(firstTarget);

    for (let frame = 0; frame < 80; frame += 1) {
      flakes = system.update(flakes, dimensions, 1);
    }
    expect(flakes).toHaveLength(311);
    expect(
      flakes.filter((flake) => flake.opticalClass === "foreground"),
    ).toHaveLength(14);
  });
});
