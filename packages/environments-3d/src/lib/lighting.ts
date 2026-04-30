import { BackgroundType } from '@austencloud/backgrounds';
import type { LightingConfig } from '@austencloud/scene-3d';

const NIGHT_BACKGROUNDS: ReadonlySet<BackgroundType> = new Set([
  BackgroundType.NIGHT_SKY,
  BackgroundType.FIREFLY_FOREST,
  BackgroundType.DEEP_OCEAN,
  BackgroundType.EMBER_GLOW,
]);

export function isNightEnvironment(backgroundType: BackgroundType): boolean {
  return NIGHT_BACKGROUNDS.has(backgroundType);
}

export function getEnvironmentLighting(backgroundType: BackgroundType): LightingConfig {
  const isNight = isNightEnvironment(backgroundType);
  return {
    ambientIntensity: isNight ? 0.2 : 0.6,
    ambientColor: isNight ? '#4466aa' : '#ffffff',
    mainLightIntensity: isNight ? 0.35 : 0.8,
    mainLightColor: isNight ? '#6688cc' : '#ffffff',
    isNightEnvironment: isNight,
  };
}
