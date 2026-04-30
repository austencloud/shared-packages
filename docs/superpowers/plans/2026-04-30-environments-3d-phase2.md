# environments-3d Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `@austencloud/environments-3d` package that maps `BackgroundType` enum values from `@austencloud/backgrounds` into themed 3D Threlte environment scenes with lighting, particles, and ground planes.

**Architecture:** Svelte component library (same pattern as scene-3d). Internal primitives (SkyGradient, GroundPlane, FallingParticles) are composed by 6 scene components. An `Environment3D.svelte` switcher maps BackgroundType → scene. Lighting presets and asset URL resolution are pure TypeScript utilities with full test coverage.

**Tech Stack:** TypeScript, Svelte 5, @threlte/core 8, Three.js 0.182, @sveltejs/package, vitest

---

## File Structure

```
packages/environments-3d/
├── package.json
├── tsconfig.json
├── svelte.config.js
├── vite.config.ts
├── src/
│   ├── index.ts                              (barrel exports)
│   └── lib/
│       ├── types.ts                          (EnvironmentConfig, ParticleConfig, etc.)
│       ├── lighting.ts                       (isNightEnvironment, getEnvironmentLighting)
│       ├── asset-resolver.ts                 (resolveAssetUrl)
│       ├── configs/
│       │   └── scene-configs.ts              (baked defaults per BackgroundType)
│       ├── primitives/
│       │   ├── SkyGradient.svelte            (hemisphere with gradient shader)
│       │   ├── GroundPlane.svelte            (flat mesh with configurable color/material)
│       │   └── FallingParticles.svelte       (instanced points with drift animation)
│       ├── scenes/
│       │   ├── OceanScene.svelte             (sandy floor, rising bubbles, blue sky)
│       │   ├── EmberScene.svelte             (volcanic ground, rising embers, dark sky)
│       │   ├── CherryBlossomScene.svelte     (twilight, falling petals, grass ground)
│       │   ├── CosmicScene.svelte            (star field, dark sky, optional asteroid)
│       │   ├── ForestScene.svelte            (autumn/firefly variants, optional GLB)
│       │   └── WinterScene.svelte            (snow, frozen ground, optional GLB)
│       └── Environment3D.svelte              (BackgroundType → scene switcher)
└── tests/
    ├── lighting.test.ts
    └── asset-resolver.test.ts
```

---

### Task 1: Package Scaffolding

**Files:**
- Create: `packages/environments-3d/package.json`
- Create: `packages/environments-3d/tsconfig.json`
- Create: `packages/environments-3d/svelte.config.js`
- Create: `packages/environments-3d/vite.config.ts`
- Create: `packages/environments-3d/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@austencloud/environments-3d",
  "version": "0.1.0",
  "description": "Themed 3D environment scenes matching @austencloud/backgrounds types. Threlte + Three.js.",
  "type": "module",
  "svelte": "./src/index.ts",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "svelte": "./src/index.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "src"],
  "scripts": {
    "build": "svelte-package -i src -o dist",
    "dev": "svelte-package -i src -o dist --watch",
    "check": "svelte-check --tsconfig ./tsconfig.json",
    "clean": "rimraf dist",
    "test": "vitest run"
  },
  "peerDependencies": {
    "@austencloud/scene-3d": ">=0.1.0",
    "@austencloud/backgrounds": ">=0.1.0",
    "three": ">=0.170.0",
    "@threlte/core": ">=8.0.0",
    "svelte": ">=5.0.0"
  },
  "devDependencies": {
    "@austencloud/scene-3d": "workspace:*",
    "@austencloud/backgrounds": "workspace:*",
    "@sveltejs/package": "^2.3.0",
    "@sveltejs/vite-plugin-svelte": "^5.0.0",
    "@types/three": "^0.170.0",
    "rimraf": "^5.0.0",
    "svelte": "^5.0.0",
    "svelte-check": "^4.0.0",
    "three": "^0.182.0",
    "@threlte/core": "^8.0.0",
    "typescript": "^5.0.0",
    "vitest": "^3.0.0"
  },
  "author": "Austen Cloud <austencloud@gmail.com>",
  "license": "MIT"
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["svelte"]
  },
  "include": ["src/**/*", "src/**/*.svelte"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 3: Create svelte.config.js**

```javascript
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
};
```

- [ ] **Step 4: Create vite.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte({ hot: false })],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Create placeholder src/index.ts**

```typescript
export {};
```

- [ ] **Step 6: Install dependencies**

Run: `cd E:/shared-packages && pnpm install`
Expected: lockfile updated, node_modules linked

- [ ] **Step 7: Verify build**

Run: `cd E:/shared-packages/packages/environments-3d && pnpm run build`
Expected: `src -> dist` with empty index

- [ ] **Step 8: Commit**

```bash
git add packages/environments-3d/package.json packages/environments-3d/tsconfig.json packages/environments-3d/svelte.config.js packages/environments-3d/vite.config.ts packages/environments-3d/src/index.ts
git commit -m "feat(environments-3d): scaffold package"
```

---

### Task 2: Types, Lighting, and Asset Resolver

**Files:**
- Create: `packages/environments-3d/src/lib/types.ts`
- Create: `packages/environments-3d/src/lib/lighting.ts`
- Create: `packages/environments-3d/src/lib/asset-resolver.ts`
- Create: `packages/environments-3d/tests/lighting.test.ts`
- Create: `packages/environments-3d/tests/asset-resolver.test.ts`

- [ ] **Step 1: Write lighting tests**

```typescript
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
```

- [ ] **Step 2: Write asset-resolver tests**

```typescript
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd E:/shared-packages/packages/environments-3d && pnpm test`
Expected: FAIL — modules not found

- [ ] **Step 4: Create types.ts**

```typescript
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
```

- [ ] **Step 5: Create lighting.ts**

```typescript
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
```

- [ ] **Step 6: Create asset-resolver.ts**

```typescript
import type { EnvironmentConfig } from './types.js';

export const DEFAULT_ASSET_BASE = 'https://assets.austencloud.com/3d';

export function resolveAssetUrl(path: string, config?: EnvironmentConfig): string {
  const base = (config?.assetBaseUrl ?? DEFAULT_ASSET_BASE).replace(/\/$/, '');
  return `${base}/${path}`;
}
```

- [ ] **Step 7: Run tests**

Run: `cd E:/shared-packages/packages/environments-3d && pnpm test`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add packages/environments-3d/src/lib/types.ts packages/environments-3d/src/lib/lighting.ts packages/environments-3d/src/lib/asset-resolver.ts packages/environments-3d/tests/lighting.test.ts packages/environments-3d/tests/asset-resolver.test.ts
git commit -m "feat(environments-3d): types, lighting presets, asset resolver"
```

---

### Task 3: Scene Configs

**Files:**
- Create: `packages/environments-3d/src/lib/configs/scene-configs.ts`
- Create: `packages/environments-3d/tests/scene-configs.test.ts`

- [ ] **Step 1: Write test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd E:/shared-packages/packages/environments-3d && pnpm test`
Expected: FAIL — module not found

- [ ] **Step 3: Create scene-configs.ts**

```typescript
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
      direction: [0, 1, 0],
      spread: 0.2,
      opacity: 0.6,
      areaSize: [8, 6, 8],
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
      direction: [0, 1, 0],
      spread: 0.3,
      opacity: 0.8,
      areaSize: [10, 8, 10],
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
      direction: [0, -1, 0],
      spread: 0.5,
      opacity: 0.7,
      areaSize: [10, 6, 10],
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
      direction: [0, 0, 0],
      spread: 0,
      opacity: 0.9,
      areaSize: [20, 15, 20],
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
      direction: [0, 0.5, 0],
      spread: 0.8,
      opacity: 0.9,
      areaSize: [8, 4, 8],
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
      direction: [0, -1, 0],
      spread: 0.6,
      opacity: 0.8,
      areaSize: [10, 6, 10],
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
      direction: [0, -1, 0],
      spread: 0.3,
      opacity: 0.85,
      areaSize: [12, 8, 12],
      drift: 0.2,
    },
    lighting: getEnvironmentLighting(BackgroundType.SNOWFALL),
  }],
]);

export const SUPPORTED_3D_BACKGROUNDS: readonly BackgroundType[] = [...PRESETS.keys()];

export function getScenePreset(backgroundType: BackgroundType): ScenePreset | null {
  return PRESETS.get(backgroundType) ?? null;
}
```

- [ ] **Step 4: Run tests**

Run: `cd E:/shared-packages/packages/environments-3d && pnpm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/environments-3d/src/lib/configs/scene-configs.ts packages/environments-3d/tests/scene-configs.test.ts
git commit -m "feat(environments-3d): scene presets for all 7 background types"
```

---

### Task 4: SkyGradient Primitive

**Files:**
- Create: `packages/environments-3d/src/lib/primitives/SkyGradient.svelte`

- [ ] **Step 1: Create SkyGradient.svelte**

A large inverted sphere with a vertical gradient shader (top color at north pole, bottom color at equator/south).

```svelte
<script lang="ts">
  import { T } from '@threlte/core';
  import * as THREE from 'three';
  import type { SkyConfig } from '../types.js';

  let {
    config,
  }: {
    config: SkyConfig;
  } = $props();

  const radius = $derived(config.radius ?? 50);

  const material = $derived(new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(config.topColor) },
      bottomColor: { value: new THREE.Color(config.bottomColor) },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y * 0.5 + 0.5;
        gl_FragColor = vec4(mix(bottomColor, topColor, h), 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  }));
</script>

<T.Mesh material={material}>
  <T.SphereGeometry args={[radius, 32, 16]} />
</T.Mesh>
```

- [ ] **Step 2: Verify build**

Run: `cd E:/shared-packages/packages/environments-3d && pnpm run build`
Expected: Compiles without error

- [ ] **Step 3: Commit**

```bash
git add packages/environments-3d/src/lib/primitives/SkyGradient.svelte
git commit -m "feat(environments-3d): SkyGradient primitive — gradient hemisphere"
```

---

### Task 5: GroundPlane Primitive

**Files:**
- Create: `packages/environments-3d/src/lib/primitives/GroundPlane.svelte`

- [ ] **Step 1: Create GroundPlane.svelte**

```svelte
<script lang="ts">
  import { T } from '@threlte/core';
  import type { GroundConfig } from '../types.js';

  let {
    config,
  }: {
    config: GroundConfig;
  } = $props();

  const yPos = $derived(config.yPosition ?? 0);
  const roughness = $derived(config.roughness ?? 0.8);
  const metalness = $derived(config.metalness ?? 0);
</script>

<T.Mesh rotation.x={-Math.PI / 2} position.y={yPos} receiveShadow>
  <T.PlaneGeometry args={[config.size, config.size]} />
  <T.MeshStandardMaterial
    color={config.color}
    {roughness}
    {metalness}
  />
</T.Mesh>
```

- [ ] **Step 2: Verify build**

Run: `cd E:/shared-packages/packages/environments-3d && pnpm run build`
Expected: Compiles without error

- [ ] **Step 3: Commit**

```bash
git add packages/environments-3d/src/lib/primitives/GroundPlane.svelte
git commit -m "feat(environments-3d): GroundPlane primitive"
```

---

### Task 6: FallingParticles Primitive

**Files:**
- Create: `packages/environments-3d/src/lib/primitives/FallingParticles.svelte`

- [ ] **Step 1: Create FallingParticles.svelte**

Uses Three.js Points with BufferGeometry. Particles drift in the configured direction, wrapping around when they exit the area. Supports multi-color via random assignment per particle.

```svelte
<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import * as THREE from 'three';
  import type { ParticleConfig } from '../types.js';

  let {
    config,
  }: {
    config: ParticleConfig;
  } = $props();

  const positions = new Float32Array(config.count * 3);
  const colors = new Float32Array(config.count * 3);
  const velocities = new Float32Array(config.count * 3);

  const colorArray = Array.isArray(config.color) ? config.color : [config.color];
  const halfArea: [number, number, number] = [
    config.areaSize[0] / 2,
    config.areaSize[1] / 2,
    config.areaSize[2] / 2,
  ];

  for (let i = 0; i < config.count; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * config.areaSize[0];
    positions[i3 + 1] = Math.random() * config.areaSize[1];
    positions[i3 + 2] = (Math.random() - 0.5) * config.areaSize[2];

    const c = new THREE.Color(colorArray[Math.floor(Math.random() * colorArray.length)]);
    colors[i3] = c.r;
    colors[i3 + 1] = c.g;
    colors[i3 + 2] = c.b;

    const drift = config.drift ?? 0;
    velocities[i3] = (Math.random() - 0.5) * drift * config.speed;
    velocities[i3 + 1] = config.direction[1] * config.speed * (0.8 + Math.random() * 0.4);
    velocities[i3 + 2] = (Math.random() - 0.5) * drift * config.speed;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: config.size,
    vertexColors: true,
    transparent: true,
    opacity: config.opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  useTask((delta) => {
    const posAttr = geometry.attributes['position'] as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;

    for (let i = 0; i < config.count; i++) {
      const i3 = i * 3;
      pos[i3] += velocities[i3] * delta;
      pos[i3 + 1] += velocities[i3 + 1] * delta;
      pos[i3 + 2] += velocities[i3 + 2] * delta;

      if (pos[i3 + 1] > halfArea[1]) pos[i3 + 1] = -halfArea[1];
      if (pos[i3 + 1] < -halfArea[1]) pos[i3 + 1] = halfArea[1];
      if (pos[i3] > halfArea[0]) pos[i3] = -halfArea[0];
      if (pos[i3] < -halfArea[0]) pos[i3] = halfArea[0];
      if (pos[i3 + 2] > halfArea[2]) pos[i3 + 2] = -halfArea[2];
      if (pos[i3 + 2] < -halfArea[2]) pos[i3 + 2] = halfArea[2];
    }

    posAttr.needsUpdate = true;
  });
</script>

<T.Points {geometry} {material} />
```

- [ ] **Step 2: Verify build**

Run: `cd E:/shared-packages/packages/environments-3d && pnpm run build`
Expected: Compiles without error

- [ ] **Step 3: Commit**

```bash
git add packages/environments-3d/src/lib/primitives/FallingParticles.svelte
git commit -m "feat(environments-3d): FallingParticles primitive — animated point cloud"
```

---

### Task 7: OceanScene, EmberScene, CherryBlossomScene

**Files:**
- Create: `packages/environments-3d/src/lib/scenes/OceanScene.svelte`
- Create: `packages/environments-3d/src/lib/scenes/EmberScene.svelte`
- Create: `packages/environments-3d/src/lib/scenes/CherryBlossomScene.svelte`

These three scenes are purely procedural (no GLB assets). Each composes from the three primitives with scene-specific configs.

- [ ] **Step 1: Create OceanScene.svelte**

```svelte
<script lang="ts">
  import { BackgroundType } from '@austencloud/backgrounds';
  import { getScenePreset } from '../configs/scene-configs.js';
  import SkyGradient from '../primitives/SkyGradient.svelte';
  import GroundPlane from '../primitives/GroundPlane.svelte';
  import FallingParticles from '../primitives/FallingParticles.svelte';

  const preset = getScenePreset(BackgroundType.DEEP_OCEAN)!;
</script>

<SkyGradient config={preset.sky} />
<GroundPlane config={preset.ground} />
<FallingParticles config={preset.particles} />
```

- [ ] **Step 2: Create EmberScene.svelte**

```svelte
<script lang="ts">
  import { BackgroundType } from '@austencloud/backgrounds';
  import { getScenePreset } from '../configs/scene-configs.js';
  import SkyGradient from '../primitives/SkyGradient.svelte';
  import GroundPlane from '../primitives/GroundPlane.svelte';
  import FallingParticles from '../primitives/FallingParticles.svelte';

  const preset = getScenePreset(BackgroundType.EMBER_GLOW)!;
</script>

<SkyGradient config={preset.sky} />
<GroundPlane config={preset.ground} />
<FallingParticles config={preset.particles} />
```

- [ ] **Step 3: Create CherryBlossomScene.svelte**

```svelte
<script lang="ts">
  import { BackgroundType } from '@austencloud/backgrounds';
  import { getScenePreset } from '../configs/scene-configs.js';
  import SkyGradient from '../primitives/SkyGradient.svelte';
  import GroundPlane from '../primitives/GroundPlane.svelte';
  import FallingParticles from '../primitives/FallingParticles.svelte';

  const preset = getScenePreset(BackgroundType.CHERRY_BLOSSOM)!;
</script>

<SkyGradient config={preset.sky} />
<GroundPlane config={preset.ground} />
<FallingParticles config={preset.particles} />
```

- [ ] **Step 4: Verify build**

Run: `cd E:/shared-packages/packages/environments-3d && pnpm run build`
Expected: Compiles without error

- [ ] **Step 5: Commit**

```bash
git add packages/environments-3d/src/lib/scenes/OceanScene.svelte packages/environments-3d/src/lib/scenes/EmberScene.svelte packages/environments-3d/src/lib/scenes/CherryBlossomScene.svelte
git commit -m "feat(environments-3d): Ocean, Ember, CherryBlossom scenes — procedural"
```

---

### Task 8: CosmicScene

**Files:**
- Create: `packages/environments-3d/src/lib/scenes/CosmicScene.svelte`

CosmicScene (maps to NIGHT_SKY) uses a star-field particle system with twinkle effect. No GLB for MVP.

- [ ] **Step 1: Create CosmicScene.svelte**

```svelte
<script lang="ts">
  import { BackgroundType } from '@austencloud/backgrounds';
  import { getScenePreset } from '../configs/scene-configs.js';
  import SkyGradient from '../primitives/SkyGradient.svelte';
  import GroundPlane from '../primitives/GroundPlane.svelte';
  import FallingParticles from '../primitives/FallingParticles.svelte';

  const preset = getScenePreset(BackgroundType.NIGHT_SKY)!;
</script>

<SkyGradient config={preset.sky} />
<GroundPlane config={preset.ground} />
<FallingParticles config={preset.particles} />
```

- [ ] **Step 2: Verify build**

Run: `cd E:/shared-packages/packages/environments-3d && pnpm run build`
Expected: Compiles without error

- [ ] **Step 3: Commit**

```bash
git add packages/environments-3d/src/lib/scenes/CosmicScene.svelte
git commit -m "feat(environments-3d): CosmicScene — star field"
```

---

### Task 9: ForestScene

**Files:**
- Create: `packages/environments-3d/src/lib/scenes/ForestScene.svelte`

ForestScene handles two variants: `'autumn'` (AUTUMN_DRIFT — falling leaves) and `'firefly'` (FIREFLY_FOREST — glowing fireflies). Defaults to the variant matching the BackgroundType.

- [ ] **Step 1: Create ForestScene.svelte**

```svelte
<script lang="ts">
  import { BackgroundType } from '@austencloud/backgrounds';
  import { getScenePreset } from '../configs/scene-configs.js';
  import SkyGradient from '../primitives/SkyGradient.svelte';
  import GroundPlane from '../primitives/GroundPlane.svelte';
  import FallingParticles from '../primitives/FallingParticles.svelte';

  let {
    variant = 'firefly',
  }: {
    variant?: 'firefly' | 'autumn';
  } = $props();

  const backgroundType = $derived(
    variant === 'autumn' ? BackgroundType.AUTUMN_DRIFT : BackgroundType.FIREFLY_FOREST
  );
  const preset = $derived(getScenePreset(backgroundType)!);
</script>

<SkyGradient config={preset.sky} />
<GroundPlane config={preset.ground} />
<FallingParticles config={preset.particles} />
```

- [ ] **Step 2: Verify build**

Run: `cd E:/shared-packages/packages/environments-3d && pnpm run build`
Expected: Compiles without error

- [ ] **Step 3: Commit**

```bash
git add packages/environments-3d/src/lib/scenes/ForestScene.svelte
git commit -m "feat(environments-3d): ForestScene — autumn/firefly variants"
```

---

### Task 10: WinterScene

**Files:**
- Create: `packages/environments-3d/src/lib/scenes/WinterScene.svelte`

WinterScene (maps to SNOWFALL) — falling snow particles, icy ground, gray sky.

- [ ] **Step 1: Create WinterScene.svelte**

```svelte
<script lang="ts">
  import { BackgroundType } from '@austencloud/backgrounds';
  import { getScenePreset } from '../configs/scene-configs.js';
  import SkyGradient from '../primitives/SkyGradient.svelte';
  import GroundPlane from '../primitives/GroundPlane.svelte';
  import FallingParticles from '../primitives/FallingParticles.svelte';

  const preset = getScenePreset(BackgroundType.SNOWFALL)!;
</script>

<SkyGradient config={preset.sky} />
<GroundPlane config={preset.ground} />
<FallingParticles config={preset.particles} />
```

- [ ] **Step 2: Verify build**

Run: `cd E:/shared-packages/packages/environments-3d && pnpm run build`
Expected: Compiles without error

- [ ] **Step 3: Commit**

```bash
git add packages/environments-3d/src/lib/scenes/WinterScene.svelte
git commit -m "feat(environments-3d): WinterScene — snowfall"
```

---

### Task 11: Environment3D Switcher

**Files:**
- Create: `packages/environments-3d/src/lib/Environment3D.svelte`

- [ ] **Step 1: Create Environment3D.svelte**

Maps BackgroundType to the correct scene component. Returns nothing for unsupported types (PRIDE, SOLID_COLOR, LINEAR_GRADIENT).

```svelte
<script lang="ts">
  import { BackgroundType } from '@austencloud/backgrounds';
  import type { EnvironmentProps } from './types.js';
  import OceanScene from './scenes/OceanScene.svelte';
  import EmberScene from './scenes/EmberScene.svelte';
  import CherryBlossomScene from './scenes/CherryBlossomScene.svelte';
  import CosmicScene from './scenes/CosmicScene.svelte';
  import ForestScene from './scenes/ForestScene.svelte';
  import WinterScene from './scenes/WinterScene.svelte';

  let {
    backgroundType,
    variant,
    onReady,
  }: EnvironmentProps = $props();

  $effect(() => {
    onReady?.();
  });
</script>

{#if backgroundType === BackgroundType.DEEP_OCEAN}
  <OceanScene />
{:else if backgroundType === BackgroundType.EMBER_GLOW}
  <EmberScene />
{:else if backgroundType === BackgroundType.CHERRY_BLOSSOM}
  <CherryBlossomScene />
{:else if backgroundType === BackgroundType.NIGHT_SKY}
  <CosmicScene />
{:else if backgroundType === BackgroundType.FIREFLY_FOREST}
  <ForestScene variant="firefly" />
{:else if backgroundType === BackgroundType.AUTUMN_DRIFT}
  <ForestScene variant="autumn" />
{:else if backgroundType === BackgroundType.SNOWFALL}
  <WinterScene />
{/if}
```

- [ ] **Step 2: Verify build**

Run: `cd E:/shared-packages/packages/environments-3d && pnpm run build`
Expected: Compiles without error

- [ ] **Step 3: Commit**

```bash
git add packages/environments-3d/src/lib/Environment3D.svelte
git commit -m "feat(environments-3d): Environment3D switcher — BackgroundType → scene"
```

---

### Task 12: Barrel Exports and Final Build

**Files:**
- Modify: `packages/environments-3d/src/index.ts`

- [ ] **Step 1: Write barrel exports**

```typescript
// Types
export type { EnvironmentProps, EnvironmentConfig, ParticleConfig, GroundConfig, SkyConfig, ScenePreset } from './lib/types.js';

// Utilities
export { isNightEnvironment, getEnvironmentLighting } from './lib/lighting.js';
export { resolveAssetUrl, DEFAULT_ASSET_BASE } from './lib/asset-resolver.js';
export { getScenePreset, SUPPORTED_3D_BACKGROUNDS } from './lib/configs/scene-configs.js';

// Components
export { default as Environment3D } from './lib/Environment3D.svelte';
export { default as OceanScene } from './lib/scenes/OceanScene.svelte';
export { default as EmberScene } from './lib/scenes/EmberScene.svelte';
export { default as CherryBlossomScene } from './lib/scenes/CherryBlossomScene.svelte';
export { default as CosmicScene } from './lib/scenes/CosmicScene.svelte';
export { default as ForestScene } from './lib/scenes/ForestScene.svelte';
export { default as WinterScene } from './lib/scenes/WinterScene.svelte';

// Primitives (for custom scene composition)
export { default as SkyGradient } from './lib/primitives/SkyGradient.svelte';
export { default as GroundPlane } from './lib/primitives/GroundPlane.svelte';
export { default as FallingParticles } from './lib/primitives/FallingParticles.svelte';
```

- [ ] **Step 2: Run all tests**

Run: `cd E:/shared-packages/packages/environments-3d && pnpm test`
Expected: All tests pass

- [ ] **Step 3: Run full build**

Run: `cd E:/shared-packages/packages/environments-3d && pnpm run build`
Expected: `src -> dist` completes successfully

- [ ] **Step 4: Run svelte-check**

Run: `cd E:/shared-packages/packages/environments-3d && pnpm run check`
Expected: 0 errors, 0 warnings

- [ ] **Step 5: Commit**

```bash
git add packages/environments-3d/src/index.ts
git commit -m "feat(environments-3d): barrel exports — package ready for consumers"
```

---

## Verification Checklist

After all tasks complete, verify:

1. `pnpm test` — all tests pass
2. `pnpm run build` — dist/ populated with all components + types
3. `pnpm run check` — zero errors
4. No imports from TKA or internal paths
5. `@austencloud/backgrounds` BackgroundType enum consumed correctly
6. `@austencloud/scene-3d` LightingConfig type used for lighting presets
