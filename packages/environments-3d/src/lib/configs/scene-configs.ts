import { BackgroundType } from '@austencloud/backgrounds';
import type { ScenePreset } from '../types.js';
import { getEnvironmentLighting } from '../lighting.js';

const PRESETS: ReadonlyMap<BackgroundType, ScenePreset> = new Map([
  [BackgroundType.DEEP_OCEAN, {
    sky: { topColor: '#001133', bottomColor: '#003366' },
    ground: { color: '#c2a060', size: 20, roughness: 0.9 },
    particles: {
      count: 60,
      size: 0.04,
      color: '#88ccff',
      speed: 0.3,
      direction: [0, 1, 0] as [number, number, number],
      spread: 0.2,
      opacity: 0.6,
      areaSize: [8, 6, 8] as [number, number, number],
    },
    lighting: getEnvironmentLighting(BackgroundType.DEEP_OCEAN),
  }],
  [BackgroundType.EMBER_GLOW, {
    sky: { topColor: '#1a0500', bottomColor: '#330a00' },
    ground: { color: '#2a1a0a', size: 20, roughness: 1.0 },
    particles: {
      count: 80,
      size: 0.03,
      color: ['#ff4400', '#ff8800', '#ffcc00'],
      speed: 0.4,
      direction: [0, 1, 0] as [number, number, number],
      spread: 0.3,
      opacity: 0.8,
      areaSize: [10, 8, 10] as [number, number, number],
    },
    lighting: getEnvironmentLighting(BackgroundType.EMBER_GLOW),
  }],
  [BackgroundType.CHERRY_BLOSSOM, {
    sky: { topColor: '#2d1b4e', bottomColor: '#7b4a8e' },
    ground: { color: '#3d6b3d', size: 20, roughness: 0.85 },
    particles: {
      count: 100,
      size: 0.05,
      color: ['#ffb7c5', '#ff91a4', '#ffffff'],
      speed: 0.2,
      direction: [0, -1, 0] as [number, number, number],
      spread: 0.5,
      opacity: 0.7,
      areaSize: [10, 6, 10] as [number, number, number],
      drift: 0.3,
    },
    lighting: getEnvironmentLighting(BackgroundType.CHERRY_BLOSSOM),
  }],
  [BackgroundType.NIGHT_SKY, {
    sky: { topColor: '#000011', bottomColor: '#0a0a2a' },
    ground: { color: '#1a1a2e', size: 30, roughness: 0.7, metalness: 0.1 },
    particles: {
      count: 200,
      size: 0.02,
      color: '#ffffff',
      speed: 0.05,
      direction: [0, 0, 0] as [number, number, number],
      spread: 0,
      opacity: 0.9,
      areaSize: [20, 15, 20] as [number, number, number],
      twinkle: true,
    },
    lighting: getEnvironmentLighting(BackgroundType.NIGHT_SKY),
  }],
  [BackgroundType.FIREFLY_FOREST, {
    sky: { topColor: '#0a1a0a', bottomColor: '#1a3a1a' },
    ground: { color: '#2a3a1a', size: 20, roughness: 0.9 },
    particles: {
      count: 40,
      size: 0.03,
      color: ['#aaff44', '#88ff00'],
      speed: 0.1,
      direction: [0, 0.5, 0] as [number, number, number],
      spread: 0.8,
      opacity: 0.9,
      areaSize: [8, 4, 8] as [number, number, number],
      twinkle: true,
    },
    lighting: getEnvironmentLighting(BackgroundType.FIREFLY_FOREST),
  }],
  [BackgroundType.AUTUMN_DRIFT, {
    sky: { topColor: '#4a3520', bottomColor: '#c87533' },
    ground: { color: '#5a3a1a', size: 20, roughness: 0.9 },
    particles: {
      count: 60,
      size: 0.06,
      color: ['#cc5500', '#ff8800', '#aa3300', '#ffaa00'],
      speed: 0.25,
      direction: [0, -1, 0] as [number, number, number],
      spread: 0.6,
      opacity: 0.8,
      areaSize: [10, 6, 10] as [number, number, number],
      drift: 0.4,
    },
    lighting: getEnvironmentLighting(BackgroundType.AUTUMN_DRIFT),
  }],
  [BackgroundType.SNOWFALL, {
    sky: { topColor: '#667788', bottomColor: '#aabbcc' },
    ground: { color: '#e8e8f0', size: 20, roughness: 0.6, metalness: 0.05 },
    particles: {
      count: 150,
      size: 0.03,
      color: '#ffffff',
      speed: 0.3,
      direction: [0, -1, 0] as [number, number, number],
      spread: 0.3,
      opacity: 0.85,
      areaSize: [12, 8, 12] as [number, number, number],
      drift: 0.2,
    },
    lighting: getEnvironmentLighting(BackgroundType.SNOWFALL),
  }],
]);

export const SUPPORTED_3D_BACKGROUNDS: readonly BackgroundType[] = [...PRESETS.keys()];

export function getScenePreset(backgroundType: BackgroundType): ScenePreset | null {
  return PRESETS.get(backgroundType) ?? null;
}
