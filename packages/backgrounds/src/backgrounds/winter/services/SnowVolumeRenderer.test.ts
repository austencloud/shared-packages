import { describe, expect, it } from "vitest";
import { DepthParallaxTracker } from "../../../core/services/DepthParallaxTracker.js";
import type { Snowflake } from "../domain/models/winter-models.js";
import { SnowVolumeRenderer } from "./SnowVolumeRenderer.js";
import { WinterCursorLightTracker } from "./WinterCursorLightTracker.js";

function createImageDouble(): HTMLImageElement {
  return {
    decoding: "auto",
    onload: null,
    onerror: null,
    src: "",
  } as unknown as HTMLImageElement;
}

function createContext(strokes: { count: number }): CanvasRenderingContext2D {
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
    restore: () => undefined,
    rotate: () => undefined,
    save: () => undefined,
    scale: () => undefined,
    stroke: () => {
      strokes.count += 1;
    },
    translate: () => undefined,
  } as unknown as CanvasRenderingContext2D;
}

function createForegroundFlake(): Snowflake {
  return {
    x: 100,
    y: 100,
    speed: 1,
    size: 8,
    sway: 0,
    opacity: 0.5,
    shape: {} as Path2D,
    color: "#fff",
    rotation: 0,
    rotationSpeed: 0,
    sparkle: 0,
    sparklePhase: 0,
    depth: 0.9,
    windVelocityX: 0,
    windVelocityY: 0,
    opticalClass: "foreground",
    opticalVariant: 8,
    opticalFocus: 0.66,
    opticalScale: 60,
    opticalAlpha: 1,
  };
}

describe("SnowVolumeRenderer atlas lifecycle", () => {
  it("does not request the atlas at low quality and requests it only once after upgrade", () => {
    let requests = 0;
    const renderer = new SnowVolumeRenderer(
      new DepthParallaxTracker(),
      new WinterCursorLightTracker(),
      {
        createImage: () => {
          requests += 1;
          return createImageDouble();
        },
      },
    );

    renderer.initialize("low");
    expect(requests).toBe(0);
    expect(renderer.getStats().atlasStatus).toBe("idle");

    renderer.setQuality("medium");
    renderer.setQuality("high");
    expect(requests).toBe(1);
    expect(renderer.getStats().atlasRequests).toBe(1);
  });

  it("keeps procedural foreground visible after an atlas failure", () => {
    const image = createImageDouble();
    const renderer = new SnowVolumeRenderer(
      new DepthParallaxTracker(),
      new WinterCursorLightTracker(),
      { createImage: () => image },
    );
    renderer.initialize("medium");
    image.onerror?.(new Event("error"));

    const strokes = { count: 0 };
    renderer.draw(
      [createForegroundFlake()],
      { powder: [], crystal: [], foreground: [0] },
      createContext(strokes),
      { width: 400, height: 300 },
    );

    expect(renderer.getStats().atlasStatus).toBe("failed");
    expect(strokes.count).toBe(1);
  });
});
