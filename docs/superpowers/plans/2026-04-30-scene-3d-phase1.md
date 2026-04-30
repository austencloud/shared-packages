# scene-3d Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `@austencloud/scene-3d` package with avatar system, juggling props (ball/club), and scene shell — minimum viable for `juggling-3d` (Phase 4) to consume.

**Architecture:** Svelte component library built with `@sveltejs/package`. Services are pure TypeScript (Three.js). Components are Threlte/Svelte 5. Consumers provide animation data (hand positions as Vector3); this package renders the avatar + props + scene.

**Tech Stack:** TypeScript, Svelte 5, @threlte/core 8, @threlte/extras 9, Three.js 0.182, @sveltejs/package, vitest

---

## File Structure

```
packages/scene-3d/
├── package.json
├── tsconfig.json
├── svelte.config.js
├── vite.config.ts
├── src/
│   ├── index.ts                          (barrel exports)
│   ├── lib/
│   │   ├── domain/
│   │   │   ├── types.ts                  (PropState, SceneConfig, AvatarProps)
│   │   │   └── GripPose.ts               (GripType enum, GripPose, FingerChains)
│   │   ├── services/
│   │   │   ├── contracts/
│   │   │   │   ├── IAvatarSkeletonBuilder.ts
│   │   │   │   └── IIKSolver.ts
│   │   │   ├── AvatarSkeletonBuilder.ts
│   │   │   ├── IKSolver.ts
│   │   │   ├── AvatarAnimator.ts
│   │   │   ├── ElbowPoleComputer.ts
│   │   │   ├── ClavicleRaiser.ts
│   │   │   ├── SpineTwister.ts
│   │   │   ├── FingerAnimator.ts
│   │   │   └── AvatarServicesFactory.ts
│   │   ├── components/
│   │   │   ├── Scene3D.svelte
│   │   │   ├── Avatar3D.svelte
│   │   │   ├── IKFigure3D.svelte
│   │   │   ├── LimbSegment.svelte
│   │   │   ├── OrbitControls.svelte
│   │   │   └── props/
│   │   │       ├── Prop3DProps.ts
│   │   │       ├── Ball3D.svelte
│   │   │       └── Club3D.svelte
│   │   └── utils/
│   │       └── prop3d-transforms.ts
│   └── ambient.d.ts
└── tests/
    ├── services.test.ts
    └── domain.test.ts
```

---

### Task 1: Package Scaffolding

**Files:**
- Create: `packages/scene-3d/package.json`
- Create: `packages/scene-3d/tsconfig.json`
- Create: `packages/scene-3d/svelte.config.js`
- Create: `packages/scene-3d/vite.config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@austencloud/scene-3d",
  "version": "0.1.0",
  "description": "Shared 3D scene infrastructure — avatar, IK, props, scene shell. Threlte + Three.js.",
  "type": "module",
  "svelte": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "svelte": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist", "!dist/**/*.test.*"],
  "scripts": {
    "build": "svelte-package -i src",
    "prepublishOnly": "npm run build",
    "check": "svelte-check --tsconfig ./tsconfig.json",
    "test": "vitest run"
  },
  "peerDependencies": {
    "three": ">=0.170.0",
    "@threlte/core": ">=8.0.0",
    "@threlte/extras": ">=9.0.0",
    "svelte": ">=5.0.0"
  },
  "devDependencies": {
    "@sveltejs/package": "^2.0.0",
    "@types/three": "^0.170.0",
    "svelte": "^5.0.0",
    "svelte-check": "^4.0.0",
    "three": "^0.182.0",
    "@threlte/core": "^8.0.0",
    "@threlte/extras": "^9.0.0",
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
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src"],
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

- [ ] **Step 5: Install dependencies**

Run: `cd E:/shared-packages/packages/scene-3d && pnpm install`
Expected: Clean install, resolves all peer deps from workspace

- [ ] **Step 6: Commit**

```bash
git add packages/scene-3d/package.json packages/scene-3d/tsconfig.json packages/scene-3d/svelte.config.js packages/scene-3d/vite.config.ts
git commit -m "chore(scene-3d): scaffold package with svelte-package build"
```

---

### Task 2: Domain Types

**Files:**
- Create: `packages/scene-3d/src/lib/domain/types.ts`
- Create: `packages/scene-3d/src/lib/domain/GripPose.ts`
- Test: `packages/scene-3d/tests/domain.test.ts`

- [ ] **Step 1: Write domain types test**

```typescript
import { describe, it, expect } from 'vitest';
import { GripType, mirrorQuaternion, FINGER_BONES } from '../src/lib/domain/GripPose';

describe('GripPose domain', () => {
  it('GripType enum has all grip types', () => {
    expect(GripType.IDLE).toBe('idle');
    expect(GripType.SQUARE).toBe('square');
    expect(GripType.RELEASE).toBe('release');
  });

  it('mirrorQuaternion negates Y and Z', () => {
    const q: [number, number, number, number] = [0.1, 0.2, 0.3, 0.9];
    const mirrored = mirrorQuaternion(q);
    expect(mirrored).toEqual([0.1, -0.2, -0.3, 0.9]);
  });

  it('FINGER_BONES has 15 entries', () => {
    expect(FINGER_BONES.length).toBe(15);
    expect(FINGER_BONES[0]).toBe('Thumb1');
    expect(FINGER_BONES[14]).toBe('Pinky3');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd E:/shared-packages/packages/scene-3d && pnpm test`
Expected: FAIL — module not found

- [ ] **Step 3: Create GripPose.ts**

Copy from `E:/tka-platform/src/lib/shared/3d/domain/models/GripPose.ts` — it has zero TKA imports (only `import type { Bone } from "three"`). Copy verbatim.

```typescript
import type { Bone } from 'three';

export enum GripType {
  IDLE = 'idle',
  SQUARE = 'square',
  PENCIL = 'pencil',
  CRADLE = 'cradle',
  OPEN_PALM = 'open_palm',
  RELEASE = 'release',
}

export const FINGER_BONES = [
  'Thumb1', 'Thumb2', 'Thumb3',
  'Index1', 'Index2', 'Index3',
  'Middle1', 'Middle2', 'Middle3',
  'Ring1', 'Ring2', 'Ring3',
  'Pinky1', 'Pinky2', 'Pinky3',
] as const;

export type FingerBoneName = (typeof FINGER_BONES)[number];

export interface GripPose {
  readonly name: string;
  readonly type: GripType;
  readonly rotations: readonly [number, number, number, number][];
}

export interface FingerChains {
  left: Map<FingerBoneName, Bone>;
  right: Map<FingerBoneName, Bone>;
}

export function mirrorQuaternion(
  q: [number, number, number, number],
): [number, number, number, number] {
  return [q[0], -q[1], -q[2], q[3]];
}
```

- [ ] **Step 4: Create types.ts**

This is the generalized prop/scene/avatar interface (NOT TKA's PropState3D which depends on Plane enum):

```typescript
import type { Vector3, Quaternion } from 'three';
import type { GripType } from './GripPose';

export interface PropState {
  position: Vector3;
  rotation: Quaternion;
  gripType?: GripType;
}

export interface SceneConfig {
  lighting?: LightingConfig;
  camera?: CameraConfig;
  postProcessing?: PostProcessingConfig;
  grid?: GridConfig;
}

export interface LightingConfig {
  ambientIntensity?: number;
  ambientColor?: string;
  mainLightIntensity?: number;
  mainLightColor?: string;
  mainLightPosition?: [number, number, number];
  isNightEnvironment?: boolean;
}

export interface CameraConfig {
  mode?: 'orbit' | 'first-person';
  preset?: 'front' | 'top' | 'side' | 'perspective';
  position?: [number, number, number];
  target?: [number, number, number];
  fov?: number;
  near?: number;
  far?: number;
}

export interface PostProcessingConfig {
  bloomEnabled?: boolean;
  bloomIntensity?: number;
  bloomThreshold?: number;
  bloomRadius?: number;
}

export interface GridConfig {
  visible?: boolean;
  size?: number;
  divisions?: number;
  color?: string;
}

export interface AvatarProps {
  avatarModelUrl?: string;
  leftHandTarget?: Vector3 | null;
  rightHandTarget?: Vector3 | null;
  leftGripType?: GripType;
  rightGripType?: GripType;
  enableLocomotion?: boolean;
  visible?: boolean;
}

export const PROP_COLORS = {
  blue: { main: '#3b82f6', dark: '#1d4ed8', light: '#60a5fa' },
  red: { main: '#ef4444', dark: '#b91c1c', light: '#f87171' },
} as const;

export type PropColor = 'blue' | 'red';
```

- [ ] **Step 5: Run tests**

Run: `cd E:/shared-packages/packages/scene-3d && pnpm test`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/scene-3d/src/lib/domain/ packages/scene-3d/tests/domain.test.ts
git commit -m "feat(scene-3d): add domain types — PropState, SceneConfig, GripPose"
```

---

### Task 3: IK Solver Service

**Files:**
- Create: `packages/scene-3d/src/lib/services/contracts/IAvatarSkeletonBuilder.ts`
- Create: `packages/scene-3d/src/lib/services/contracts/IIKSolver.ts`
- Create: `packages/scene-3d/src/lib/services/IKSolver.ts`
- Test: `packages/scene-3d/tests/services.test.ts`

- [ ] **Step 1: Copy service contracts from TKA**

Copy these files verbatim (they have zero TKA imports — only Three.js types):
- `E:/tka-platform/src/lib/shared/3d/services/contracts/IAvatarSkeletonBuilder.ts` → `src/lib/services/contracts/IAvatarSkeletonBuilder.ts`
- `E:/tka-platform/src/lib/shared/3d/services/contracts/IIKSolver.ts` → `src/lib/services/contracts/IIKSolver.ts`

Update the import path in IIKSolver.ts: change `import type { BoneChain } from "./IAvatarSkeletonBuilder"` to `import type { BoneChain } from './IAvatarSkeletonBuilder.js'`.

- [ ] **Step 2: Copy IKSolver implementation**

Copy `E:/tka-platform/src/lib/shared/3d/services/implementations/IKSolver.ts` → `src/lib/services/IKSolver.ts`

Update imports to local paths. This service depends only on Three.js and the contracts (no TKA imports).

- [ ] **Step 3: Write IK test**

```typescript
import { describe, it, expect } from 'vitest';
import { Vector3, Bone } from 'three';

describe('IKSolver', () => {
  it('exists and can be imported', async () => {
    const { IKSolver } = await import('../src/lib/services/IKSolver');
    const solver = new IKSolver();
    expect(solver).toBeDefined();
  });
});
```

Note: Full IK tests require a bone chain (Three.js Bone hierarchy). The TKA test suite covers this in integration. For scene-3d, verify the build compiles and the class instantiates. Full integration testing happens when Avatar3D wires everything together.

- [ ] **Step 4: Run test**

Run: `cd E:/shared-packages/packages/scene-3d && pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/scene-3d/src/lib/services/
git commit -m "feat(scene-3d): extract IKSolver and service contracts from TKA"
```

---

### Task 4: Avatar Services (Skeleton, Animator, Support Services)

**Files:**
- Create: `packages/scene-3d/src/lib/services/AvatarSkeletonBuilder.ts`
- Create: `packages/scene-3d/src/lib/services/AvatarAnimator.ts`
- Create: `packages/scene-3d/src/lib/services/ElbowPoleComputer.ts`
- Create: `packages/scene-3d/src/lib/services/ClavicleRaiser.ts`
- Create: `packages/scene-3d/src/lib/services/SpineTwister.ts`
- Create: `packages/scene-3d/src/lib/services/FingerAnimator.ts`
- Create: `packages/scene-3d/src/lib/services/AvatarServicesFactory.ts`

- [ ] **Step 1: Copy avatar services from TKA**

All these files have zero TKA imports — only Three.js and local contracts. Copy each from `E:/tka-platform/src/lib/shared/3d/services/implementations/` to `src/lib/services/`:

- `AvatarSkeletonBuilder.ts`
- `AvatarAnimator.ts`
- `ElbowPoleComputer.ts`
- `ClavicleRaiser.ts`
- `SpineTwister.ts`
- `FingerAnimator.ts`
- `AvatarServicesFactory.ts`

- [ ] **Step 2: Update all import paths**

Each file needs imports updated from TKA relative paths to local paths. Pattern:
- `from "../contracts/IAvatarSkeletonBuilder"` → `from './contracts/IAvatarSkeletonBuilder.js'`
- `from "../../domain/models/GripPose"` → `from '../domain/GripPose.js'`
- `from "./IKSolver"` → `from './IKSolver.js'`

Do NOT change any implementation logic. Only update import paths.

- [ ] **Step 3: Write factory test**

```typescript
import { describe, it, expect } from 'vitest';

describe('AvatarServicesFactory', () => {
  it('creates services with locomotion disabled', async () => {
    const { createAvatarServices } = await import('../src/lib/services/AvatarServicesFactory');
    const services = createAvatarServices({
      enableLocomotion: false,
      enableRootMotion: false,
      enableFootPlanting: false,
    });
    expect(services.skeleton).toBeDefined();
    expect(services.ikSolver).toBeDefined();
    expect(services.animator).toBeDefined();
    expect(services.locomotion).toBeDefined();
    expect(services.fingers).toBeDefined();
    expect(services.stateMachine).toBeNull();
    expect(services.footPlanter).toBeNull();
  });

  it('creates services with locomotion enabled', async () => {
    const { createAvatarServices } = await import('../src/lib/services/AvatarServicesFactory');
    const services = createAvatarServices({
      enableLocomotion: true,
      enableRootMotion: true,
      enableFootPlanting: true,
    });
    expect(services.stateMachine).toBeDefined();
    expect(services.footPlanter).toBeDefined();
    expect(services.legIKSolver).toBeDefined();
    expect(services.turnAnimator).toBeDefined();
    expect(services.rootMotionExtractor).toBeDefined();
  });
});
```

- [ ] **Step 4: Copy remaining locomotion services**

If `createAvatarServices` references these, copy them too:
- `LocomotionAnimator.ts`
- `AnimationStateMachine.ts`
- `FootPlanter.ts`
- `HingeConstrainedLegIKSolver.ts`
- `ContactCurveCache.ts`
- `ClipBasedTurnAnimator.ts`
- `RootMotionExtractor.ts`

Same pattern: copy, update imports, no logic changes.

- [ ] **Step 5: Run tests**

Run: `cd E:/shared-packages/packages/scene-3d && pnpm test`
Expected: PASS (all factory tests green)

- [ ] **Step 6: Commit**

```bash
git add packages/scene-3d/src/lib/services/
git commit -m "feat(scene-3d): extract avatar services factory and all support services"
```

---

### Task 5: Prop Transform Utils and Ball3D Component

**Files:**
- Create: `packages/scene-3d/src/lib/utils/prop3d-transforms.ts`
- Create: `packages/scene-3d/src/lib/components/props/Prop3DProps.ts`
- Create: `packages/scene-3d/src/lib/components/props/Ball3D.svelte`

- [ ] **Step 1: Create prop3d-transforms.ts**

Simplified version for the shared package — computes Euler rotation from a Quaternion (PropState already has world rotation):

```typescript
import { Euler, Quaternion } from 'three';
import type { PropState } from '../domain/types.js';

export function computePropRotation(propState: PropState): [number, number, number] {
  const euler = new Euler().setFromQuaternion(propState.rotation);
  return [euler.x, euler.y, euler.z];
}
```

- [ ] **Step 2: Create Prop3DProps.ts**

```typescript
import type { PropState, PropColor } from '../../domain/types.js';

export interface Prop3DProps {
  propState: PropState;
  color: PropColor;
  visible?: boolean;
  scale?: number;
}
```

- [ ] **Step 3: Create Ball3D.svelte**

```svelte
<script lang="ts">
  import { T } from '@threlte/core';
  import type { Prop3DProps } from './Prop3DProps.js';
  import { PROP_COLORS } from '../../domain/types.js';
  import { computePropRotation } from '../../utils/prop3d-transforms.js';

  let {
    propState,
    color,
    visible = true,
    scale = 1,
  }: Prop3DProps = $props();

  const palette = $derived(PROP_COLORS[color]);
  const radius = $derived(0.04 * scale);
  const rotation = $derived(computePropRotation(propState));
</script>

{#if visible}
  <T.Group
    position.x={propState.position.x}
    position.y={propState.position.y}
    position.z={propState.position.z}
    rotation.x={rotation[0]}
    rotation.y={rotation[1]}
    rotation.z={rotation[2]}
  >
    <T.Mesh>
      <T.SphereGeometry args={[radius, 32, 32]} />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.1}
        metalness={0.3}
        opacity={0.85}
        transparent
      />
    </T.Mesh>
  </T.Group>
{/if}
```

- [ ] **Step 4: Verify build compiles**

Run: `cd E:/shared-packages/packages/scene-3d && pnpm run check`
Expected: No errors (svelte-check validates Svelte component types)

- [ ] **Step 5: Commit**

```bash
git add packages/scene-3d/src/lib/utils/ packages/scene-3d/src/lib/components/props/
git commit -m "feat(scene-3d): add Ball3D prop component with transform utils"
```

---

### Task 6: Club3D Component

**Files:**
- Create: `packages/scene-3d/src/lib/components/props/Club3D.svelte`

- [ ] **Step 1: Create Club3D.svelte**

Procedural club geometry: tapered body, rounded knob, handle.

```svelte
<script lang="ts">
  import { T } from '@threlte/core';
  import type { Prop3DProps } from './Prop3DProps.js';
  import { PROP_COLORS } from '../../domain/types.js';
  import { computePropRotation } from '../../utils/prop3d-transforms.js';

  let {
    propState,
    color,
    visible = true,
    scale = 1,
  }: Prop3DProps = $props();

  const palette = $derived(PROP_COLORS[color]);
  const rotation = $derived(computePropRotation(propState));

  const bodyLength = $derived(0.4 * scale);
  const bodyRadius = $derived(0.03 * scale);
  const knobRadius = $derived(0.045 * scale);
  const handleRadius = $derived(0.015 * scale);
  const handleLength = $derived(0.12 * scale);
</script>

{#if visible}
  <T.Group
    position.x={propState.position.x}
    position.y={propState.position.y}
    position.z={propState.position.z}
    rotation.x={rotation[0]}
    rotation.y={rotation[1]}
    rotation.z={rotation[2]}
  >
    <!-- Club body (tapered cylinder) -->
    <T.Mesh position.y={handleLength / 2}>
      <T.CylinderGeometry args={[bodyRadius * 0.6, bodyRadius, bodyLength, 16]} />
      <T.MeshStandardMaterial color={palette.main} roughness={0.4} metalness={0.1} />
    </T.Mesh>

    <!-- Knob (top) -->
    <T.Mesh position.y={handleLength / 2 + bodyLength / 2}>
      <T.SphereGeometry args={[knobRadius, 16, 16]} />
      <T.MeshStandardMaterial color={palette.main} roughness={0.3} metalness={0.2} />
    </T.Mesh>

    <!-- Handle (bottom) -->
    <T.Mesh position.y={-handleLength / 2}>
      <T.CylinderGeometry args={[handleRadius, handleRadius, handleLength, 12]} />
      <T.MeshStandardMaterial color={palette.dark} roughness={0.6} metalness={0.0} />
    </T.Mesh>
  </T.Group>
{/if}
```

- [ ] **Step 2: Verify build**

Run: `cd E:/shared-packages/packages/scene-3d && pnpm run check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/scene-3d/src/lib/components/props/Club3D.svelte
git commit -m "feat(scene-3d): add Club3D procedural prop component"
```

---

### Task 7: Scene3D Shell Component

**Files:**
- Create: `packages/scene-3d/src/lib/components/Scene3D.svelte`
- Create: `packages/scene-3d/src/lib/components/OrbitControls.svelte`

- [ ] **Step 1: Create OrbitControls.svelte**

Thin wrapper around Three.js OrbitControls via Threlte:

```svelte
<script lang="ts">
  import { useThrelte, useTask } from '@threlte/core';
  import { OrbitControls as ThreeOrbitControls } from 'three/addons/controls/OrbitControls.js';
  import { onMount, onDestroy } from 'svelte';

  let {
    target = [0, 1, 0],
    enableDamping = true,
    dampingFactor = 0.05,
    minDistance = 1,
    maxDistance = 20,
    maxPolarAngle = Math.PI * 0.85,
  }: {
    target?: [number, number, number];
    enableDamping?: boolean;
    dampingFactor?: number;
    minDistance?: number;
    maxDistance?: number;
    maxPolarAngle?: number;
  } = $props();

  const { camera, renderer } = useThrelte();
  let controls: ThreeOrbitControls | null = null;

  onMount(() => {
    const canvas = renderer.domElement;
    controls = new ThreeOrbitControls(camera.current, canvas);
    controls.enableDamping = enableDamping;
    controls.dampingFactor = dampingFactor;
    controls.minDistance = minDistance;
    controls.maxDistance = maxDistance;
    controls.maxPolarAngle = maxPolarAngle;
    controls.target.set(...target);
  });

  useTask(() => {
    controls?.update();
  });

  onDestroy(() => {
    controls?.dispose();
  });
</script>
```

- [ ] **Step 2: Create Scene3D.svelte**

```svelte
<script lang="ts">
  import { Canvas, T } from '@threlte/core';
  import OrbitControls from './OrbitControls.svelte';
  import type { SceneConfig } from '../domain/types.js';
  import type { Snippet } from 'svelte';

  let {
    config = {},
    children,
  }: {
    config?: SceneConfig;
    children?: Snippet;
  } = $props();

  const lighting = $derived(config.lighting ?? {});
  const camera = $derived(config.camera ?? {});
  const grid = $derived(config.grid ?? {});

  const ambientIntensity = $derived(lighting.ambientIntensity ?? 0.6);
  const ambientColor = $derived(lighting.ambientColor ?? '#ffffff');
  const mainLightIntensity = $derived(lighting.mainLightIntensity ?? 0.8);
  const mainLightColor = $derived(lighting.mainLightColor ?? '#ffffff');
  const mainLightPos = $derived(lighting.mainLightPosition ?? [5, 10, 5]);

  const cameraPos = $derived(camera.position ?? [0, 1.5, 4]);
  const cameraTarget = $derived(camera.target ?? [0, 1, 0]);
  const fov = $derived(camera.fov ?? 50);
  const near = $derived(camera.near ?? 0.1);
  const far = $derived(camera.far ?? 100);
</script>

<Canvas>
  <T.PerspectiveCamera
    makeDefault
    position={cameraPos}
    {fov}
    {near}
    {far}
  />

  <OrbitControls target={cameraTarget} />

  <T.AmbientLight intensity={ambientIntensity} color={ambientColor} />
  <T.DirectionalLight
    intensity={mainLightIntensity}
    color={mainLightColor}
    position={mainLightPos}
    castShadow
  />

  {#if grid.visible}
    <T.GridHelper args={[grid.size ?? 10, grid.divisions ?? 10, grid.color ?? '#444444', '#222222']} />
  {/if}

  {@render children?.()}
</Canvas>
```

- [ ] **Step 3: Verify build**

Run: `cd E:/shared-packages/packages/scene-3d && pnpm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/scene-3d/src/lib/components/Scene3D.svelte packages/scene-3d/src/lib/components/OrbitControls.svelte
git commit -m "feat(scene-3d): add Scene3D shell with orbit camera and configurable lighting"
```

---

### Task 8: IKFigure3D (Procedural Fallback Avatar)

**Files:**
- Create: `packages/scene-3d/src/lib/components/IKFigure3D.svelte`
- Create: `packages/scene-3d/src/lib/components/LimbSegment.svelte`

- [ ] **Step 1: Create LimbSegment.svelte**

```svelte
<script lang="ts">
  import { T } from '@threlte/core';
  import { Vector3 } from 'three';

  let {
    from,
    to,
    radius = 0.02,
    color = '#cccccc',
  }: {
    from: [number, number, number];
    to: [number, number, number];
    radius?: number;
    color?: string;
  } = $props();

  const midpoint = $derived([
    (from[0] + to[0]) / 2,
    (from[1] + to[1]) / 2,
    (from[2] + to[2]) / 2,
  ] as [number, number, number]);

  const length = $derived(
    new Vector3(...from).distanceTo(new Vector3(...to))
  );

  const direction = $derived(() => {
    const dir = new Vector3(...to).sub(new Vector3(...from)).normalize();
    return dir;
  });
</script>

<T.Mesh position={midpoint} lookAt={to}>
  <T.CylinderGeometry args={[radius, radius, length, 8]} />
  <T.MeshStandardMaterial {color} roughness={0.6} />
</T.Mesh>
```

- [ ] **Step 2: Create IKFigure3D.svelte**

Simplified procedural figure driven by hand target positions. Uses the IKSolver from services for arm positioning.

```svelte
<script lang="ts">
  import { T } from '@threlte/core';
  import type { Vector3 } from 'three';
  import type { AvatarProps } from '../domain/types.js';

  let {
    leftHandTarget = null,
    rightHandTarget = null,
    visible = true,
  }: AvatarProps = $props();

  const HEAD_Y = 1.7;
  const SHOULDER_Y = 1.45;
  const HIP_Y = 0.95;
  const SHOULDER_SPAN = 0.35;

  const leftShoulder: [number, number, number] = [-SHOULDER_SPAN / 2, SHOULDER_Y, 0];
  const rightShoulder: [number, number, number] = [SHOULDER_SPAN / 2, SHOULDER_Y, 0];

  const leftHand = $derived<[number, number, number]>(
    leftHandTarget
      ? [leftHandTarget.x, leftHandTarget.y, leftHandTarget.z]
      : [-0.3, 1.0, 0.2]
  );
  const rightHand = $derived<[number, number, number]>(
    rightHandTarget
      ? [rightHandTarget.x, rightHandTarget.y, rightHandTarget.z]
      : [0.3, 1.0, 0.2]
  );
</script>

{#if visible}
  <T.Group>
    <!-- Head -->
    <T.Mesh position.y={HEAD_Y}>
      <T.SphereGeometry args={[0.1, 16, 16]} />
      <T.MeshStandardMaterial color="#deb887" roughness={0.7} />
    </T.Mesh>

    <!-- Torso (cylinder) -->
    <T.Mesh position.y={(SHOULDER_Y + HIP_Y) / 2}>
      <T.CylinderGeometry args={[0.12, 0.15, SHOULDER_Y - HIP_Y, 8]} />
      <T.MeshStandardMaterial color="#4a5568" roughness={0.8} />
    </T.Mesh>

    <!-- Left arm (shoulder → hand, simplified as single line) -->
    <T.Mesh position={[
      (leftShoulder[0] + leftHand[0]) / 2,
      (leftShoulder[1] + leftHand[1]) / 2,
      (leftShoulder[2] + leftHand[2]) / 2,
    ]}>
      <T.SphereGeometry args={[0.02, 8, 8]} />
      <T.MeshStandardMaterial color="#deb887" />
    </T.Mesh>

    <!-- Right arm -->
    <T.Mesh position={[
      (rightShoulder[0] + rightHand[0]) / 2,
      (rightShoulder[1] + rightHand[1]) / 2,
      (rightShoulder[2] + rightHand[2]) / 2,
    ]}>
      <T.SphereGeometry args={[0.02, 8, 8]} />
      <T.MeshStandardMaterial color="#deb887" />
    </T.Mesh>

    <!-- Hand spheres -->
    <T.Mesh position={leftHand}>
      <T.SphereGeometry args={[0.03, 8, 8]} />
      <T.MeshStandardMaterial color="#deb887" />
    </T.Mesh>
    <T.Mesh position={rightHand}>
      <T.SphereGeometry args={[0.03, 8, 8]} />
      <T.MeshStandardMaterial color="#deb887" />
    </T.Mesh>

    <!-- Legs (static pose) -->
    <T.Mesh position={[-0.08, HIP_Y / 2, 0]}>
      <T.CylinderGeometry args={[0.04, 0.04, HIP_Y, 8]} />
      <T.MeshStandardMaterial color="#2d3748" roughness={0.8} />
    </T.Mesh>
    <T.Mesh position={[0.08, HIP_Y / 2, 0]}>
      <T.CylinderGeometry args={[0.04, 0.04, HIP_Y, 8]} />
      <T.MeshStandardMaterial color="#2d3748" roughness={0.8} />
    </T.Mesh>
  </T.Group>
{/if}
```

- [ ] **Step 3: Verify build**

Run: `cd E:/shared-packages/packages/scene-3d && pnpm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/scene-3d/src/lib/components/IKFigure3D.svelte packages/scene-3d/src/lib/components/LimbSegment.svelte
git commit -m "feat(scene-3d): add IKFigure3D procedural fallback avatar"
```

---

### Task 9: Avatar3D Component (GLTF + IK)

**Files:**
- Create: `packages/scene-3d/src/lib/components/Avatar3D.svelte`

- [ ] **Step 1: Create Avatar3D.svelte**

Simplified version of TKA's Avatar3D — loads GLTF, runs arm IK toward hand targets. Falls back to IKFigure3D if GLTF fails.

```svelte
<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { useGltf } from '@threlte/extras';
  import type { Vector3 } from 'three';
  import { createAvatarServices } from '../services/AvatarServicesFactory.js';
  import IKFigure3D from './IKFigure3D.svelte';
  import type { AvatarProps } from '../domain/types.js';

  let {
    avatarModelUrl,
    leftHandTarget = null,
    rightHandTarget = null,
    leftGripType,
    rightGripType,
    enableLocomotion = false,
    visible = true,
  }: AvatarProps = $props();

  const services = createAvatarServices({
    enableLocomotion,
    enableRootMotion: false,
    enableFootPlanting: false,
  });

  let modelLoaded = $state(false);
  let useFallback = $state(!avatarModelUrl);

  // Load GLTF if URL provided
  $effect(() => {
    if (!avatarModelUrl) {
      useFallback = true;
      return;
    }
    services.skeleton.loadModel(avatarModelUrl)
      .then(() => {
        modelLoaded = true;
        useFallback = false;
      })
      .catch(() => {
        useFallback = true;
      });
  });

  // IK update each frame
  useTask(() => {
    if (!modelLoaded) return;

    const leftChain = services.skeleton.getLeftArmChain();
    const rightChain = services.skeleton.getRightArmChain();

    if (leftHandTarget && leftChain) {
      services.ikSolver.solveAndApply(leftChain, {
        position: leftHandTarget,
        weight: 1,
      });
    }

    if (rightHandTarget && rightChain) {
      services.ikSolver.solveAndApply(rightChain, {
        position: rightHandTarget,
        weight: 1,
      });
    }

    services.skeleton.updateMatrices();
  });
</script>

{#if visible}
  {#if useFallback}
    <IKFigure3D {leftHandTarget} {rightHandTarget} {visible} />
  {:else if modelLoaded}
    {@const root = services.skeleton.getRoot()}
    {#if root}
      <T is={root} />
    {/if}
  {/if}
{/if}
```

- [ ] **Step 2: Verify build**

Run: `cd E:/shared-packages/packages/scene-3d && pnpm run check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/scene-3d/src/lib/components/Avatar3D.svelte
git commit -m "feat(scene-3d): add Avatar3D component with GLTF loading and IK"
```

---

### Task 10: Barrel Exports and Final Build

**Files:**
- Create: `packages/scene-3d/src/index.ts`

- [ ] **Step 1: Create barrel export**

```typescript
// Domain types
export type { PropState, SceneConfig, LightingConfig, CameraConfig, PostProcessingConfig, GridConfig, AvatarProps, PropColor } from './lib/domain/types.js';
export { PROP_COLORS } from './lib/domain/types.js';
export { GripType, FINGER_BONES, mirrorQuaternion } from './lib/domain/GripPose.js';
export type { GripPose, FingerChains, FingerBoneName } from './lib/domain/GripPose.js';

// Services
export { createAvatarServices } from './lib/services/AvatarServicesFactory.js';
export type { AvatarServices, AvatarServicesOptions } from './lib/services/AvatarServicesFactory.js';
export type { IAvatarSkeletonBuilder, BoneName, BoneChain, SkeletonState } from './lib/services/contracts/IAvatarSkeletonBuilder.js';
export type { IIKSolver, IKTarget, IKSolution, IKAlgorithm, JointConstraints } from './lib/services/contracts/IIKSolver.js';

// Components (Svelte)
export { default as Scene3D } from './lib/components/Scene3D.svelte';
export { default as Avatar3D } from './lib/components/Avatar3D.svelte';
export { default as IKFigure3D } from './lib/components/IKFigure3D.svelte';
export { default as OrbitControls } from './lib/components/OrbitControls.svelte';
export { default as Ball3D } from './lib/components/props/Ball3D.svelte';
export { default as Club3D } from './lib/components/props/Club3D.svelte';

// Utils
export { computePropRotation } from './lib/utils/prop3d-transforms.js';
```

- [ ] **Step 2: Run full build**

Run: `cd E:/shared-packages/packages/scene-3d && pnpm run build`
Expected: svelte-package compiles successfully, dist/ populated

- [ ] **Step 3: Run all tests**

Run: `cd E:/shared-packages/packages/scene-3d && pnpm test`
Expected: All tests pass

- [ ] **Step 4: Verify package exports**

Run: `cd E:/shared-packages/packages/scene-3d && node -e "import('./dist/index.js').then(m => console.log(Object.keys(m)))"`
Expected: Lists all exported symbols

- [ ] **Step 5: Commit**

```bash
git add packages/scene-3d/src/index.ts
git commit -m "feat(scene-3d): add barrel exports — package ready for consumers"
```

---

### Task 11: ATTRIBUTION.md

**Files:**
- Create: `packages/scene-3d/ATTRIBUTION.md`

- [ ] **Step 1: Create attribution**

```markdown
# Attribution — @austencloud/scene-3d

## Original Source

This package extracts generic 3D rendering infrastructure from
[TKA Composer](https://github.com/austencloud/tka-sequence-constructor)
by Austen Cloud. The avatar system, IK solver, prop rendering, and scene
composition were originally built for the TKA platform's 3D viewer.

## Technical References

### Inverse Kinematics
- **Fundamentals of Computer Graphics** (Marschner & Shirley) — analytical 2-bone IK via law of cosines
- Standard Mixamo/humanoid bone conventions for skeleton mapping

### Three.js / Threlte
- [Three.js](https://threejs.org/) (MIT) — 3D rendering engine
- [Threlte](https://threlte.xyz/) (MIT) — Svelte bindings for Three.js

### Prop Geometry
- Juggling prop dimensions from standard IJA equipment specifications
- Club proportions based on Renegade/PX3 standard club measurements
```

- [ ] **Step 2: Commit**

```bash
git add packages/scene-3d/ATTRIBUTION.md
git commit -m "docs(scene-3d): add attribution for extracted 3D infrastructure"
```

---

## Verification Checklist

After all tasks complete, verify:

1. `pnpm test` in `packages/scene-3d/` — all pass
2. `pnpm run build` — clean output in `dist/`
3. `pnpm run check` — svelte-check reports no errors
4. Package exports all symbols listed in index.ts
5. No TKA-specific imports remain (grep for `$lib/`, `tka`, `pictograph`, `compose`)

---

## What This Plan Does NOT Cover (Future Phases)

- **Effects system** (trails, particles, bloom) — Phase 1b
- **Environments** (ForestScene, WinterScene) — Phase 2
- **TKA migration** to consume this package — Phase 3
- **juggling-3d** (SiteswapViewer, JugglingScene) — Phase 4
- **juggle-log integration** — Phase 5
- **All specialty props** (Staff3D, Fan3D, Hoop3D, etc.) — Phase 1b
- **Locomotion integration** in Avatar3D — Phase 1b (factory already supports it)
- **Scene primitives** (SkyGradient, GroundPlane, FallingParticles) — Phase 2 (environments need them)
