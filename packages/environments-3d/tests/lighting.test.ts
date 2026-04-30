import { describe, it, expect } from 'vitest';
import { isNightEnvironment, getEnvironmentLighting } from '../src/lib/lighting.js';
import { BackgroundType } from '@austencloud/backgrounds';

describe('isNightEnvironment', () => {
  it('returns true for night-themed backgrounds', () => {
    expect(isNightEnvironment(BackgroundType.NIGHT_SKY)).toBe(true);
    expect(isNightEnvironment(BackgroundType.FIREFLY_FOREST)).toBe(true);
    expect(isNightEnvironment(BackgroundType.DEEP_OCEAN)).toBe(true);
  });

  it('returns false for day-themed backgrounds', () => {
    expect(isNightEnvironment(BackgroundType.SNOWFALL)).toBe(false);
    expect(isNightEnvironment(BackgroundType.CHERRY_BLOSSOM)).toBe(false);
    expect(isNightEnvironment(BackgroundType.AUTUMN_DRIFT)).toBe(false);
  });
});

describe('getEnvironmentLighting', () => {
  it('returns dim lighting for night environments', () => {
    const lighting = getEnvironmentLighting(BackgroundType.NIGHT_SKY);
    expect(lighting.ambientIntensity).toBe(0.2);
    expect(lighting.isNightEnvironment).toBe(true);
  });

  it('returns bright lighting for day environments', () => {
    const lighting = getEnvironmentLighting(BackgroundType.SNOWFALL);
    expect(lighting.ambientIntensity).toBe(0.6);
    expect(lighting.isNightEnvironment).toBe(false);
  });

  it('returns a complete LightingConfig', () => {
    const lighting = getEnvironmentLighting(BackgroundType.EMBER_GLOW);
    expect(lighting).toHaveProperty('ambientIntensity');
    expect(lighting).toHaveProperty('ambientColor');
    expect(lighting).toHaveProperty('mainLightIntensity');
    expect(lighting).toHaveProperty('mainLightColor');
    expect(lighting).toHaveProperty('isNightEnvironment');
  });
});
