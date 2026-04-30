import { describe, it, expect } from 'vitest';
import { resolveAssetUrl, DEFAULT_ASSET_BASE } from '../src/lib/asset-resolver.js';

describe('resolveAssetUrl', () => {
  it('uses default base URL when no config provided', () => {
    const url = resolveAssetUrl('forest/tree.glb');
    expect(url).toBe(`${DEFAULT_ASSET_BASE}/forest/tree.glb`);
  });

  it('uses custom base URL from config', () => {
    const url = resolveAssetUrl('forest/tree.glb', { assetBaseUrl: 'https://custom.cdn.com/assets' });
    expect(url).toBe('https://custom.cdn.com/assets/forest/tree.glb');
  });

  it('handles trailing slash in base URL', () => {
    const url = resolveAssetUrl('rock.glb', { assetBaseUrl: 'https://cdn.com/' });
    expect(url).toBe('https://cdn.com/rock.glb');
  });
});
