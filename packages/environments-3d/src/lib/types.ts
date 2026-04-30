import type { BackgroundType } from '@austencloud/backgrounds';
import type { LightingConfig } from '@austencloud/scene-3d';

export interface EnvironmentConfig {
  assetBaseUrl?: string;
}

export interface EnvironmentProps {
  backgroundType: BackgroundType;
  assetBaseUrl?: string;
  variant?: string;
  onProgress?: (loaded: number, total: number) => void;
  onReady?: () => void;
}

export interface ParticleConfig {
  count: number;
  size: number;
  color: string | string[];
  speed: number;
  direction: [number, number, number];
  spread: number;
  opacity: number;
  areaSize: [number, number, number];
  drift?: number;
  twinkle?: boolean;
}

export interface GroundConfig {
  color: string;
  size: number;
  roughness?: number;
  metalness?: number;
  yPosition?: number;
}

export interface SkyConfig {
  topColor: string;
  bottomColor: string;
  radius?: number;
}

export interface ScenePreset {
  sky: SkyConfig;
  ground: GroundConfig;
  particles: ParticleConfig;
  lighting: LightingConfig;
}
