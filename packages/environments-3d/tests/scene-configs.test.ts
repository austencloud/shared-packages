import { describe, it, expect } from 'vitest';
import { getScenePreset, SUPPORTED_3D_BACKGROUNDS } from '../src/lib/configs/scene-configs.js';
import { BackgroundType } from '@austencloud/backgrounds';

describe('getScenePreset', () => {
  it('returns preset for supported backgrounds', () => {
    const preset = getScenePreset(BackgroundType.DEEP_OCEAN);
    expect(preset).not.toBeNull();
    expect(preset!.sky.topColor).toBeDefined();
    expect(preset!.ground.color).toBeDefined();
    expect(preset!.particles.count).toBeGreaterThan(0);
  });

  it('returns null for unsupported backgrounds', () => {
    expect(getScenePreset(BackgroundType.SOLID_COLOR)).toBeNull();
    expect(getScenePreset(BackgroundType.LINEAR_GRADIENT)).toBeNull();
    expect(getScenePreset(BackgroundType.PRIDE)).toBeNull();
  });

  it('exports list of supported 3D backgrounds', () => {
    expect(SUPPORTED_3D_BACKGROUNDS).toContain(BackgroundType.DEEP_OCEAN);
    expect(SUPPORTED_3D_BACKGROUNDS).toContain(BackgroundType.SNOWFALL);
    expect(SUPPORTED_3D_BACKGROUNDS).not.toContain(BackgroundType.SOLID_COLOR);
  });
});
