import { describe, expect, it } from "vitest";
import type { QualityLevel } from "../../../core/domain/types.js";
import { AutumnSceneryRenderer } from "./AutumnSceneryRenderer.js";

describe("AutumnSceneryRenderer quality tiers", () => {
  it.each<QualityLevel>([
    "high",
    "medium",
    "low",
    "minimal",
    "ultra-minimal",
  ])(
    "uses the authored matte at %s quality",
    (quality) => {
      const renderer = new AutumnSceneryRenderer(quality);

      expect(renderer.getExpectedArtCount()).toBe(1);
    },
  );
});
