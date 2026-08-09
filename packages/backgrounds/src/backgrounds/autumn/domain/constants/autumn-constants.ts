// Autumn Background Constants
// All tuning parameters for the autumn leaf particle system

export const AUTUMN_PARTICLE_COUNTS = {
  high: 24,
  medium: 18,
  low: 12,
  minimal: 8,
  "ultra-minimal": 4,
} as const;

export const AUTUMN_DENSITY_MULTIPLIERS = {
  sparse: 0.35,
  normal: 1,
  dense: 1.35,
  storm: 1.8,
} as const;

export const AUTUMN_PHYSICS = {
  // Base falling speed (faster than cherry blossom's 0.2 for heavier feel)
  baseSpeed: 0.24,
  speedVariance: 0.38,
  // Horizontal drift
  baseDrift: 0.08,
  driftVariance: 0.13,
  // Rotation (faster than cherry blossom for tumbling effect)
  rotationSpeed: { min: 0.012, max: 0.038 },
  // Secondary rotation axis for 3D tumble
  tumbleSpeed: { min: 0.01, max: 0.032 },
  // Size affects speed (larger = slower)
  sizeSpeedFactor: 0.6,
  // Spiral descent chance
  spiralChance: 0.14,
  spiralSpeed: 0.022,
  spiralRadius: 0.24,
} as const;

export const AUTUMN_WIND = {
  // Frames between gusts
  gustIntervalMin: 180,
  gustIntervalMax: 360,
  // Gust duration in frames
  gustDurationMin: 50,
  gustDurationMax: 100,
  // Gust strength (horizontal acceleration)
  gustStrengthMin: 0.4,
  gustStrengthMax: 1.2,
  // Decay rate per frame
  gustDecay: 0.02,
} as const;

export const AUTUMN_WIND_PRESETS = {
  calm: {
    ambientStrength: 0.025,
    gustIntervalMin: 480,
    gustIntervalMax: 720,
    gustDurationMin: 90,
    gustDurationMax: 130,
    gustStrengthMin: 0.18,
    gustStrengthMax: 0.34,
  },
  breezy: {
    ambientStrength: 0.09,
    gustIntervalMin: 250,
    gustIntervalMax: 430,
    gustDurationMin: 75,
    gustDurationMax: 115,
    gustStrengthMin: 0.36,
    gustStrengthMax: 0.72,
  },
  windy: {
    ambientStrength: 0.2,
    gustIntervalMin: 155,
    gustIntervalMax: 280,
    gustDurationMin: 70,
    gustDurationMax: 110,
    gustStrengthMin: 0.68,
    gustStrengthMax: 1.08,
  },
  gusty: {
    ambientStrength: 0.13,
    gustIntervalMin: 90,
    gustIntervalMax: 175,
    gustDurationMin: 60,
    gustDurationMax: 100,
    gustStrengthMin: 0.95,
    gustStrengthMax: 1.5,
  },
} as const;

export const AUTUMN_COLORS = {
  golds: ["#f0a848", "#d98a35", "#c7782f", "#b66927"],
  oranges: ["#c9652a", "#ad4f22", "#e07a2d", "#8a3f20"],
  reds: ["#873522", "#6f2b20", "#a84426", "#5a261e"],
  browns: ["#654027", "#51311f", "#7a4929", "#3a2418"],
  greens: ["#4b4328", "#3d3928"],
} as const;

export const AUTUMN_LEAF_SIZES = {
  maple: { min: 10, max: 18 },
  curved: { min: 9, max: 17 },
  oak: { min: 10, max: 18 },
  rounded: { min: 8, max: 15 },
  double: { min: 11, max: 19 },
  nature: { min: 9, max: 17 },
} as const;

export const AUTUMN_LEAF_DISTRIBUTION = {
  maple: 0.12,
  curved: 0.28,
  oak: 0.24,
  rounded: 0.22,
  double: 0.05,
  nature: 0.09,
} as const;

// Real SVG leaf paths from UXWing (free commercial use, no attribution)
// Each path is normalized to roughly 100x100 units, centered at origin
export const AUTUMN_LEAF_PATHS = {
  // Classic 5-pointed maple leaf
  maple: {
    d: "M55.15,85.62c1.73,11.9-0.93,21.51-8.05,31.37c-1.6,2.21-3.29,3.99-5.25,5.89c-0.01-2.63-1.69-3.76-4.22-4.34C48.04,108.25,52.33,96.9,53.7,85.62h-2.36c-7.79-0.77-16.33,12.35-26.35,15.92c4.77-9.16-0.56-10.4-12.66-6.33c9.05-10.8,9.93-14.79,0-13.35c5.13-3.88,9.9-6.11,14.38-7.02c-9.33-2.97-17.63-7.97-24.64-15.57c13.16-0.48,9.93-9.37-2.05-22.76c15.93,8.01,24.33,9.02,21.73-0.17c4.71,3.18,10.75,9.27,17.11,16.09c-2.45-12.5-4.29-24.34-3.42-33.2C41.63,28.56,48.3,19.12,54.84,0c5.51,17.44,11.43,27.12,18.92,20.08c0.97,7.76-0.07,16.06-2.74,24.81l-0.17,6.67c6.21-6.7,12.31-13.03,17.22-15.44c-3.05,10.09,7.63,6.57,21.28,0.38c-12.92,14.44-13.94,22.06-2.57,22.59c-4.73,7.36-13.07,11.84-22.76,15.23c4.22,1.21,8.44,3.49,12.66,7.02c-8.73-0.72-6.9,5,0.25,14.2c-10.92-3.2-16.49-2.33-13.04,6C70.98,90.74,61.77,85.51,56.13,85.62H55.15L55.15,85.62z",
    viewBox: { width: 109.35, height: 122.88 },
  },
  // Elegant curved leaf with stem curl
  curved: {
    d: "M104.38,97.86c5.03,6.72,9.37,12.3,11.72,18.72c2.29,6.26,3.22,9.11-1.98,2.63c-4.84-6.04-9.36-11.91-15.98-17.48c-0.47,0.11-0.96,0.21-1.49,0.32C36.81,113.93-6.78,87.01,0.87,0c46.1,15.96,111.38,9.48,104.62,91.25C105.25,94.29,105.02,96.37,104.38,97.86L104.38,97.86zM88.32,84.78c-15.04-32.4-53.68-43.51-72.85-65.67C36.28,59.7,47.63,57.91,88.32,84.78L88.32,84.78L88.32,84.78z",
    viewBox: { width: 117.93, height: 122.88 },
  },
  // Multi-lobed oak-style leaf
  oak: {
    d: "M0.36,15.78c0.3,6.98,0.84,14.42,1.74,21.99l21.5,1.25L0.36,15.78L0.36,15.78zM120.96,113.47l-11.6-10.88c12.55-18.33,15.86-36.43,11.45-54.03c-3.26-9.99-9.58-17.97-17.83-24.33l-1.06,70.41l-5.18-5.09L69.34,8.35c-7.1-4.6-15.3-8.22-24.05-11.05l4.26,61.34l-5.18-5.09L37.16,2.16C23.82,0.6,10.93,0.14,0.18,0.17L0,0v8.84c38.3,38.3,75.14,75.14,112.8,112.8C119.93,126.02,124.49,117.75,120.96,113.47L120.96,113.47zM2.71,42.57c1.27,9.21,3.1,18.52,5.67,27.39l49.54,3.38L28.75,44.17L2.71,42.57L2.71,42.57zM9.87,74.82c2.87,8.74,6.53,16.92,11.18,23.99l61-1.34L63.09,78.51L9.87,74.82L9.87,74.82zM24.45,103.54c6.3,8.04,14.18,14.18,23.99,17.39c16.01,4.01,32.29,1.72,48.9-8.17L87.18,102.6L24.45,103.54L24.45,103.54z",
    viewBox: { width: 124.49, height: 126.02 },
  },
  // Simple rounded leaf (mirrored variant)
  rounded: {
    d: "M13.54,97.85c-5.05,6.71-9.37,12.31-11.71,18.72c-2.29,6.25-3.22,9.12,1.97,2.62c4.84-6.04,9.37-11.92,15.97-17.47c0.46,0.12,0.97,0.21,1.48,0.32C81.12,113.94,124.7,87.02,117.04,0C70.96,15.97,5.68,9.47,12.43,91.26C12.69,94.29,12.92,96.37,13.54,97.85L13.54,97.85L13.54,97.85zM27.72,86.1c15.65-33.71,55.85-45.26,75.79-68.3C81.91,59.92,64.23,61.99,27.72,86.1L27.72,86.1z",
    viewBox: { width: 124.7, height: 122.88 },
  },
  // Two overlapping leaves
  double: {
    d: "M59.07,110.77C110.92,105,139.6,71.12,112.44,0c-21.29,14.9-50.39,24.6-65,44.55C57,52.94,64.89,62.23,67.08,74.37c13.19-16.08,27.63-30.72,35.23-47-7.79,39.07-20,53.84-38.78,73.81a93.64,93.64,0,0,1-4.46,9.62Zm-14.9,4C4,105-15.18,76.09,14.27,24.75c23.8,22.92,65.79,37.48,38.39,85.86a27.08,27.08,0,0,1-1.83,2.93C45.9,89.62,26.21,70.69,20.43,50.61,21.77,83.42,31.23,93,45.88,114.86c-.57,0-1.14-.06-1.71-.13Z",
    viewBox: { width: 139.6, height: 114.86 },
  },
  // Flowing nature leaf silhouette
  nature: {
    d: "M73.65,8.87C88,4.52,103.43,2,118.16.08A3.92,3.92,0,0,1,122.27,6c-6.55,10.32-11.88,21.38-17.19,32.38C86.82,76.25,68.82,113.54,5,122a2.73,2.73,0,0,1-.51.07,3.9,3.9,0,0,1-4.18-3.63A119,119,0,0,1,7.53,68.18c5.68-15,14.58-28.66,26.7-39.08,11-9.42,24.68-15.77,39.42-20.23Z",
    viewBox: { width: 122.27, height: 122.07 },
  },
} as const;

export type LeafType = keyof typeof AUTUMN_LEAF_PATHS;

export const AUTUMN_OPACITY = {
  min: 0.34,
  max: 0.72,
  // Depth affects opacity (further = more transparent)
  depthFactor: 0.18,
} as const;

export const AUTUMN_BOUNDS = {
  // Respawn buffer outside viewport
  respawnBuffer: 30,
  // Horizontal wrap margin
  wrapMargin: 50,
} as const;

export const AUTUMN_BACKGROUND = {
  // Gradient stops for the dusk sky
  gradient: [
    { stop: 0, color: "#1a1520" }, // Deep purple-brown sky
    { stop: 0.3, color: "#2d1f28" }, // Warm purple
    { stop: 0.6, color: "#3d2a1f" }, // Amber-brown
    { stop: 1.0, color: "#2a1810" }, // Dark earth
  ],
} as const;
