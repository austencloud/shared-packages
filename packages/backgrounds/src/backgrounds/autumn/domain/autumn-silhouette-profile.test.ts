import { describe, expect, it } from "vitest";
import {
  AUTUMN_TREE_LAYER_CONFIGS,
  AUTUMN_TREE_STYLE,
} from "./autumn-silhouette-profile.js";

describe("autumn silhouette profile", () => {
  it("keeps every prominent layer away from the working center", () => {
    const prominentColumns = AUTUMN_TREE_LAYER_CONFIGS.slice(1).flatMap(
      (layer) => layer.columns,
    );

    expect(
      prominentColumns.every((column) => column <= 2.1 || column >= 7.9),
    ).toBe(true);
  });

  it("uses fewer, quieter depth layers than Forest", () => {
    expect(AUTUMN_TREE_LAYER_CONFIGS).toHaveLength(5);
    expect(AUTUMN_TREE_LAYER_CONFIGS[4]?.columns).toHaveLength(2);
    expect(AUTUMN_TREE_STYLE.rimOpacity[1]).toBeLessThan(0.1);
  });
});
