import { describe, expect, it } from "vitest";
import type { QualityLevel } from "../../../core/domain/types.js";
import { AutumnSceneryRenderer } from "./AutumnSceneryRenderer.js";

describe("AutumnSceneryRenderer quality tiers", () => {
  it.each<QualityLevel>(["high", "medium", "low"])(
    "keeps the multiplane scene at %s quality",
    (quality) => {
      const renderer = new AutumnSceneryRenderer(quality);

      expect(renderer.getExpectedArtCount()).toBe(3);
    },
  );

  it.each<QualityLevel>(["minimal", "ultra-minimal"])(
    "uses the flat fallback at %s quality",
    (quality) => {
      const renderer = new AutumnSceneryRenderer(quality);

      expect(renderer.getExpectedArtCount()).toBe(1);
    },
  );
});
