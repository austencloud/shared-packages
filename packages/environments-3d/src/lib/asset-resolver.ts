import type { EnvironmentConfig } from './types.js';

export const DEFAULT_ASSET_BASE = 'https://assets.austencloud.com/3d';

export function resolveAssetUrl(path: string, config?: EnvironmentConfig): string {
  const base = (config?.assetBaseUrl ?? DEFAULT_ASSET_BASE).replace(/\/$/, '');
  return `${base}/${path}`;
}
