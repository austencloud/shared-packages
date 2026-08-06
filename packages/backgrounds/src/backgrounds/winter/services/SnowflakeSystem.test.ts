import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createSnowflakeSystem } from "./SnowflakeSystem.js";

class Path2DStub {
  moveTo(): void {}
  lineTo(): void {}
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
      expect(flake.y).toBeGreaterThanOrEqual(-30);
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
    const context = {
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      strokeStyle: "",
      lineWidth: 1,
      beginPath: () => undefined,
      lineTo: () => undefined,
      moveTo: () => undefined,
      save: () => undefined,
      restore: () => undefined,
      rotate: () => undefined,
      stroke: () => undefined,
      translate: (x: number, y: number) => translations.push({ x, y }),
    } as unknown as CanvasRenderingContext2D;

    system.setPointer(dimensions.width, dimensions.height / 2, true, "mouse");
    for (let frame = 0; frame < 120; frame++) {
      flakes = system.update(flakes, dimensions, 1);
    }
    system.draw(flakes, context, dimensions);

    expect(system.getParallaxStats().enabled).toBe(true);
    expect(system.getCursorLightStats().enabled).toBe(true);
    expect(translations[0]?.x).toBeLessThan(flakes[0]?.x ?? 0);

    translations.length = 0;
    system.setPointer(300, 400, true, "touch");
    system.draw(flakes, context, dimensions);

    expect(system.getParallaxStats().enabled).toBe(false);
    expect(system.getCursorLightStats().enabled).toBe(false);
    expect(translations[0]?.x).toBeCloseTo(flakes[0]?.x ?? 0, 8);
    expect(translations[0]?.y).toBeCloseTo(flakes[0]?.y ?? 0, 8);
  });
});
