import { describe, expect, it } from "vitest";
import { NUM_LAYERS } from "../domain/constants/tree-silhouette-constants.js";
import { createTreeSilhouetteSystem } from "./TreeSilhouetteSystem.js";

describe("TreeSilhouetteSystem profiles", () => {
  it("preserves Forest's seven-layer default", () => {
    expect(createTreeSilhouetteSystem().getLayerCount()).toBe(NUM_LAYERS);
  });

  it("uses the configured layer count for composed scenes", () => {
    const system = createTreeSilhouetteSystem({
      layerConfigs: [
        {
          columns: [0, 10],
          heightPresets: [0.2, 0.2],
          widthRange: [0.04, 0.06],
        },
      ],
    });

    expect(system.getLayerCount()).toBe(1);
  });
});
