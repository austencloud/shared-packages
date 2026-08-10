import type {
  LayerConfig,
  PlacementConfig,
  TreeSilhouetteStyle,
  TreeTypeVisibility,
} from "../../forest/domain/models/tree-silhouette-models.js";

export const AUTUMN_TREE_LAYER_CONFIGS = [
  {
    columns: [0.5, 2, 4, 6, 8, 9.5],
    heightPresets: [0.11, 0.13, 0.12, 0.14, 0.12, 0.11],
    widthRange: [0.03, 0.045],
  },
  {
    columns: [0.6, 2.1, 7.9, 9.4],
    heightPresets: [0.18, 0.21, 0.2, 0.18],
    widthRange: [0.045, 0.06],
  },
  {
    columns: [0, 1.7, 8.3, 10],
    heightPresets: [0.28, 0.32, 0.3, 0.27],
    widthRange: [0.065, 0.085],
  },
  {
    columns: [-0.15, 9.65],
    heightPresets: [0.42, 0.44],
    widthRange: [0.09, 0.12],
  },
  {
    columns: [-0.5, 9.5],
    heightPresets: [0.58, 0.56],
    widthRange: [0.13, 0.16],
  },
] as const satisfies readonly LayerConfig[];

export const AUTUMN_TREE_STYLE: TreeSilhouetteStyle = {
  farSilhouette: { r: 69, g: 70, b: 67 },
  nearSilhouette: { r: 17, g: 13, b: 15 },
  rimLight: { r: 91, g: 67, b: 54 },
  farBaseRatio: 0.76,
  nearBaseRatio: 1.02,
  rimOpacity: [0.025, 0.07],
  rimBlur: [1, 2.5],
};

export const AUTUMN_TREE_VISIBILITY: TreeTypeVisibility = {
  pine: false,
  fir: false,
  spruce: false,
  oak: true,
  maple: true,
  poplar: true,
  willow: false,
  dead: true,
};

export const AUTUMN_TREE_PLACEMENT: PlacementConfig = {
  minSpacing: 0.055,
  crossLayerThreshold: 0.035,
  jitter: 0.08,
  heroStrength: 0,
};

export const AUTUMN_SKY_STOPS = [
  { stop: 0, color: "#24252b" },
  { stop: 0.46, color: "#343238" },
  { stop: 0.74, color: "#403936" },
  { stop: 1, color: "#1a1718" },
] as const;

export const AUTUMN_GROUND_STOPS = [
  { stop: 0, color: "rgba(42, 38, 35, 0.62)" },
  { stop: 0.4, color: "rgba(29, 25, 24, 0.86)" },
  { stop: 1, color: "#100e0f" },
] as const;
