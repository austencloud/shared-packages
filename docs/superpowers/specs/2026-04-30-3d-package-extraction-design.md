# 3D Package Extraction Design

**Date:** 2026-04-30
**Status:** Approved
**Scope:** Extract TKA platform's 3D scene system into three shared packages

## Overview

Extract generic 3D rendering infrastructure from `tka-platform/src/lib/shared/3d/` into shared packages consumable by both TKA Composer and juggle-log (and future apps). TKA keeps its flow-arts animation pipeline internally. Juggling animation gets its own package bridging siteswap-engine and juggling-physics into the shared renderer.

## Package Ecosystem

```
@austencloud/shared-packages
├── theme/              (EXISTS)
├── backgrounds/        (EXISTS)
├── siteswap-engine/    (EXISTS)
├── juggling-physics/   (EXISTS)
├── scene-3d/           (NEW — Package 3a)
├── environments-3d/    (NEW — Package 3b)
└── juggling-3d/        (NEW — Package 3c)
```

### Dependency Graph

```
scene-3d ←─── environments-3d
    ↑              ↑
    │         backgrounds (BackgroundType enum)
    │
juggling-3d
    ↑
juggling-physics
    ↑
siteswap-engine
```

Note: `theme` and `backgrounds` are consumed by the apps (TKA, juggle-log), not directly by scene-3d. Scene-3d accepts generic config; the app maps theme/background state into that config.

### Consumers

- **TKA Composer:** `scene-3d` + `environments-3d` (keeps SequenceConverter + flow-arts pipeline internally)
- **Juggle-log:** `scene-3d` + `environments-3d` + `juggling-3d` + `siteswap-engine` + `juggling-physics`

---

## Package 3a: `@austencloud/scene-3d`

Core 3D rendering infrastructure. Avatar system, prop rendering, effects, scene primitives, camera.

### Peer Dependencies

```json
{
  "peerDependencies": {
    "three": ">=0.170.0",
    "@threlte/core": ">=8.0.0",
    "@threlte/extras": ">=9.0.0",
    "svelte": ">=5.0.0"
  }
}
```

### Extracted from TKA: Services (TypeScript)

**Avatar services (per-avatar factory pattern via `createAvatarServices()`):**

| Service | Source | TKA Coupling |
|---------|--------|--------------|
| `AvatarSkeletonBuilder` | GLTF loading, bone scaling, rig setup | None — pure Three.js |
| `AvatarAnimator` | IK post-process, animation blending | None |
| `IKSolver` | 2-bone arm IK | None |
| `ElbowPoleComputer` | Elbow pole target calculation | None |
| `ClavicleRaiser` | Shoulder raise for overhead poses | None |
| `SpineTwister` | Spine twist toward prop target | None |
| `LocomotionAnimator` | Walk/idle/jump clip playback | None |
| `AnimationStateMachine` | Locomotion state transitions | None |
| `FootPlanter` | Foot pinning during contact phases | None |
| `HingeConstrainedLegIKSolver` | Specialized leg IK | None |
| `RootMotionExtractor` | Hips displacement → world delta | None |
| `ClipBasedTurnAnimator` | Turn clip sampling | None |
| `FingerAnimator` | Grip pose application | Uses local `GripPose` enum |
| `CollisionDetector` | Prop/body ray-cast collision | None |
| `ContactCurveCache` | Contact phase curve caching | None |

**Camera services:**

| Service | Source |
|---------|--------|
| `CameraMovementController` | Camera animation/transitions |
| Camera transitions, types | Type definitions |

**Utility services:**

| Service | Source |
|---------|--------|
| `QualityTierDetector` | GPU capability detection |
| `DynamicLightManager` | Per-effect lighting |
| `TrailRenderer3D` | Imperative trail geometry |
| `PerformerSynchronizer` | Multi-avatar sync |

### Extracted from TKA: Svelte Components

**Avatar:**
- `Avatar3D.svelte` — Production GLTF avatar with IK + procedural fallback
- `IKFigure3D.svelte` — Procedural stick-figure fallback (pure geometry + 2-bone IK)
- `LimbSegment.svelte` — Limb geometry primitive

**Scene:**
- `Scene3D.svelte` — Camera, lighting, post-processing shell (generalized config interface)
- `OrbitControls.svelte` — Camera controller
- `ManualRaycaster.svelte` — Click/drag detection

**Props:**
- `Prop3D.svelte` — Dispatcher (GLTF → procedural fallback)
- `GltfProp3D.svelte` — GLTF prop loader with recoloring
- `Staff3D.svelte` — Procedural staff geometry
- `Club3D.svelte` — Procedural club geometry
- `Ball3D.svelte` — Procedural ball geometry
- `Fan3D.svelte`, `Hoop3D.svelte`, `Poi3D.svelte`, `Sword3D.svelte`, `Torch3D.svelte` — Other props
- `Buugeng3D.svelte`, `Chicken3D.svelte`, `Doublestar3D.svelte`, `Eightrings3D.svelte`, `Guitar3D.svelte`, `Triquetra3D.svelte`, `Triad3D.svelte` — Specialty props

**Effects:**
- `Trail3D.svelte`, `TrailRenderer.svelte`, `RibbonTrail3D.svelte` — Trail system
- `SparkleEmitter.svelte`, `FireEmitter.svelte` — Particle emitters
- `BubbleEmitter3D.svelte`, `PetalEmitter3D.svelte` — Particle emitters
- `BloomEffect.svelte`, `BloomBillboard3D.svelte` — Bloom/halation
- `MotionBlur.svelte`, `SpeedLines.svelte`, `GhostStaff3D.svelte` — Motion effects
- `Led3D.svelte`, `SmokeRenderer3D.svelte`, `WaterEmitter3D.svelte` — Material effects
- `VolumetricFireComponent.svelte` — Volumetric fire
- `ElectricityArc.svelte` — Energy effect
- `EffectOrchestrator3D.svelte` — Effect routing coordinator
- `EffectsLayer.svelte` — Effect mounting layer

**Scene Primitives:**
- `SkyGradient.svelte` — Gradient-shaded sky dome
- `GroundPlane.svelte` — Colored ground plane
- `TexturedGroundPlane.svelte` — PBR-textured ground plane
- `FallingParticles.svelte` — GPU particle emitter (leaves, snow, petals, embers, stars, bubbles, fireflies, dust, smoke, steam)

### Extracted from TKA: Domain Types

- `PropState3D`, `PropState2D` — Prop position/rotation containers
- `GripPose`, `GripType` — Hand grip enums
- `CameraChoreography`, `CameraKeyframe`, `CameraState`, `CameraStateSnapshot` — Camera types
- `Formation`, `FormationPreset` — Multi-avatar formation
- `QualityTier` enum and per-tier configs
- `TipPositionData3D`, `PropTipPositions3D` — Effect position data
- `TrailPoint`, `PropPositionHistory` — Trail state types

### Key Abstraction: Generic Config Interface

TKA's Scene3D currently uses hardcoded enums (`Plane`, `GridMode`). Extracted version uses generic config:

```typescript
export interface SceneConfig {
  lighting?: {
    ambientIntensity?: number;
    ambientColor?: string;
    mainLightIntensity?: number;
    mainLightColor?: string;
    isNightEnvironment?: boolean;
  };
  camera?: {
    mode?: 'orbit' | 'first-person';
    preset?: 'front' | 'top' | 'side' | 'perspective';
    position?: [number, number, number];
    target?: [number, number, number];
    fov?: number;
    near?: number;
    far?: number;
  };
  postProcessing?: {
    bloomEnabled?: boolean;
    bloomIntensity?: number;
    bloomThreshold?: number;
    bloomRadius?: number;
  };
  grid?: {
    visible?: boolean;
    size?: number;
    divisions?: number;
  };
}
```

TKA wraps this with its domain-specific mapping (Plane enum → grid config). Juggle-log uses it directly.

### Key Abstraction: Avatar Prop Interface

Avatar3D accepts prop positions as Three.js `Vector3` targets for IK. The animation pipeline that computes those positions is the consumer's responsibility:

- **TKA:** SequenceConverter → MotionConfig3D → PropStateInterpolator → `Vector3`
- **Juggling:** JIFAnimator → `frame.hands[i].position` → `Vector3`

```typescript
export interface AvatarProps {
  avatarModelUrl?: string;
  blueHandTarget?: Vector3 | null;
  redHandTarget?: Vector3 | null;
  blueGripPose?: GripPose;
  redGripPose?: GripPose;
  enableLocomotion?: boolean;
  visible?: boolean;
}
```

### What stays in TKA

- `SequenceConverter` — imports from 5+ TKA modules (MotionType, Orientation, StepData, SequenceData, MotionData, LOCATION_ANGLES)
- `PropStateInterpolator` — depends on TKA enums + animation-engine state
- `MotionCalculator` — depends on TKA MotionType, RotationDirection enums
- `OrientationMapper` — depends on TKA Orientation enum
- `PlaneCoordinateMapper` — depends on TKA grid/pictograph enums
- `Viewer3DCanvas.svelte` — TKA puppet-mode orchestration, performer manager
- `Viewer3DScene.svelte` — TKA sequence playback, prop type resolution
- `PerformerRig.svelte` — TKA plane modes, grid modes, performer model
- `DraggablePerformer.svelte` — Multi-avatar manipulation
- `DuetOrchestrator.svelte`, `DuetPersister` — Duet management
- `Offline3DExporter` — Video export (compose feature)
- All control panels and settings UI
- Procedural terrain engine (orthogonal system)
- `Stage3D.svelte`, `SeatedAudience3D.svelte`, `StageTerrain.svelte` — TKA-specific stage composition

---

## Package 3b: `@austencloud/environments-3d`

Themed 3D environment scenes matching `@austencloud/backgrounds` types.

### Dependencies

```json
{
  "peerDependencies": {
    "@austencloud/scene-3d": ">=0.1.0",
    "@austencloud/backgrounds": ">=0.1.0",
    "three": ">=0.170.0",
    "@threlte/core": ">=8.0.0",
    "svelte": ">=5.0.0"
  }
}
```

### Structure

```
src/
├── index.ts
├── Environment3D.svelte        (BackgroundType → scene switcher)
├── types.ts                    (EnvironmentConfig, ScenePreset)
├── lighting.ts                 (isNightEnvironment, light intensity presets)
├── scenes/
│   ├── ForestScene.svelte      (autumn + firefly variants)
│   ├── WinterScene.svelte      (snow, frozen pond, moon)
│   ├── CosmicScene.svelte      (asteroid platform, drifting stars)
│   ├── OceanScene.svelte       (sandy floor, rising bubbles)
│   ├── EmberScene.svelte       (volcanic ground, rising embers)
│   └── CherryBlossomScene.svelte (twilight, falling petals)
└── configs/
    └── scene-configs.ts        (baked defaults per scene)
```

### Environment3D Interface

```typescript
export interface EnvironmentProps {
  backgroundType: BackgroundType;
  assetBaseUrl?: string;
  variant?: string;
  onProgress?: (loaded: number, total: number) => void;
  onReady?: () => void;
}
```

### Scene Composition

Each scene composes from `scene-3d` primitives:

| Scene | Primitives Used | GLB Assets |
|-------|----------------|------------|
| ForestScene | TexturedGroundPlane, FallingParticles (leaves/fireflies), SkyGradient | trees, rocks, bushes, tent, campfire |
| WinterScene | TexturedGroundPlane, FallingParticles (snow), SkyGradient | pines, rocks, logs, frozen pond |
| CosmicScene | SkyGradient, FallingParticles (stars) | asteroid platform |
| OceanScene | SkyGradient, GroundPlane, FallingParticles (bubbles) | none |
| EmberScene | SkyGradient, GroundPlane, FallingParticles (embers) | none |
| CherryBlossomScene | SkyGradient, GroundPlane, FallingParticles (petals) | none |

### Lighting Integration

```typescript
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

### Asset Loading

GLB asset URLs are not hardcoded. Asset base URL comes from config, defaulting to the existing R2 CDN:

```typescript
const DEFAULT_ASSET_BASE = 'https://assets.austencloud.com/3d';

function resolveAssetUrl(path: string, config?: EnvironmentConfig): string {
  const base = config?.assetBaseUrl ?? DEFAULT_ASSET_BASE;
  return `${base}/${path}`;
}
```

### What stays in TKA

- `EnvironmentSettingsPanel.svelte` (UI for picking backgrounds)
- Scene Lab debug sliders/controls
- `StageWorld.svelte` (procedural realm wrapper — orthogonal system)

---

## Package 3c: `@austencloud/juggling-3d`

Bridges siteswap-engine + juggling-physics into scene-3d Threlte components.

### Dependencies

```json
{
  "dependencies": {
    "@austencloud/siteswap-engine": "workspace:*",
    "@austencloud/juggling-physics": "workspace:*"
  },
  "peerDependencies": {
    "@austencloud/scene-3d": ">=0.1.0",
    "three": ">=0.170.0",
    "@threlte/core": ">=8.0.0",
    "svelte": ">=5.0.0"
  }
}
```

### Structure

```
src/
├── index.ts
├── JugglingScene.svelte        (top-level: JIF data → full animated scene)
├── JugglingAvatar.svelte       (Avatar3D + catch/throw IK driver)
├── JugglingProp.svelte         (ball/club/ring following trajectory)
├── JugglingHands.svelte        (hand position tracking from JIFAnimator)
├── SiteswapViewer.svelte       (drop-in: siteswap string → animated scene)
├── juggling-ik-driver.ts       (JIFAnimator hand positions → Avatar3D IK targets)
└── types.ts                    (JugglingSceneConfig, prop appearance, etc.)
```

### Data Flow

```
Siteswap string ("531", "<3p|3p>")
    │
    ▼
Siteswap.Parse(input).toJIF()              (siteswap-engine)
    │
    ▼
new JIFAnimator(jif, animConfig)           (juggling-physics)
    │
    ▼
requestAnimationFrame loop:
  frame = animator.sampleFrame(time)
    │
    ├── frame.props[i].position ──→ JugglingProp (renders Ball3D/Club3D from scene-3d)
    ├── frame.props[i].rotation ──→ JugglingProp rotation
    └── frame.hands[i].position ──→ JugglingAvatar IK targets (Avatar3D from scene-3d)
```

### SiteswapViewer — Drop-in Widget

```svelte
<script>
  import { SiteswapViewer } from '@austencloud/juggling-3d';
  import { BackgroundType } from '@austencloud/backgrounds';
</script>

<SiteswapViewer
  siteswap="531"
  environment={BackgroundType.FIREFLY_FOREST}
  beatsPerSecond={4}
  dwellRatio={0.5}
  autoPlay={true}
  propType="ball"
  propColors={['#ff0000', '#00ff00', '#0000ff']}
/>
```

### JugglingScene Props

```typescript
export interface JugglingSceneProps {
  jif: JIFData;
  config?: AnimationConfig;
  propType?: 'ball' | 'club' | 'ring';
  propColors?: string[];
  avatarModelUrl?: string;
  showTrails?: boolean;
  showGrid?: boolean;
  sceneConfig?: SceneConfig;
}
```

### Juggling IK Driver

New code mapping JIFAnimator output to Avatar3D inputs:

```typescript
export function createJugglingIKDriver(animator: JIFAnimator) {
  return {
    sample(time: number): JugglingIKFrame {
      const frame = animator.sampleFrame(time);
      return {
        jugglers: buildJugglerTargets(frame, animator),
        props: frame.props.map(p => ({
          position: new Vector3(p.position.x, p.position.y, p.position.z),
          rotation: toThreeQuaternion(p.rotation),
          color: p.color,
          type: p.type,
        })),
      };
    }
  };
}
```

Per juggler:
- `leftHandTarget: Vector3` — IK target for left arm
- `rightHandTarget: Vector3` — IK target for right arm
- `leftGripPose: GripPose` — open on throw, closed on catch/dwell
- `rightGripPose: GripPose` — same

### Multi-Juggler Support

JIFAnimator already handles multi-juggler JIF data. JugglingScene spawns one Avatar3D per juggler, positioned via `JugglerLayout`:

```typescript
for (const [i, layout] of jugglerLayouts.entries()) {
  // Position avatar at layout.position
  // Orient avatar toward layout.facing
  // Drive IK from frame.hands filtered by juggler index
}
```

Passing patterns like `<3p|3p>` automatically render two jugglers facing each other.

---

## Migration Path

### Phase 1: `scene-3d` (Package 3a)

1. Create package in `shared-packages/packages/scene-3d/`
2. Copy generic services + components from TKA's `src/lib/shared/3d/`
3. Generalize interfaces (remove TKA enum dependencies from Scene3D, Avatar3D)
4. Build + test
5. TKA continues using internal copies (no changes yet)

### Phase 2: `environments-3d` (Package 3b)

1. Create package in `shared-packages/packages/environments-3d/`
2. Move environment scenes from TKA, updating imports to use `scene-3d` primitives
3. Externalize GLB asset URLs via config
4. Build + test
5. Wire TKA to import from `@austencloud/environments-3d` instead of internal path
6. Delete TKA's internal environment copies

### Phase 3: TKA Migration

1. Wire TKA's `Viewer3DScene` to import Avatar3D, Prop3D, effects from `@austencloud/scene-3d`
2. TKA's flow-arts pipeline (SequenceConverter → PropStateInterpolator) stays internal, feeds positions to shared Avatar3D
3. Delete TKA's internal copies of extracted services/components
4. Verify TKA builds + runs correctly

### Phase 4: `juggling-3d` (Package 3c)

1. Create package in `shared-packages/packages/juggling-3d/`
2. Build JugglingScene, JugglingAvatar, JugglingProp, SiteswapViewer components
3. Build juggling-ik-driver bridge
4. Test with known siteswap patterns (cascade, shower, passing)
5. Wire into juggle-log

### Phase 5: Juggle-log Integration

1. Add `scene-3d`, `environments-3d`, `juggling-3d`, `siteswap-engine`, `juggling-physics` as dependencies
2. Create juggling viewer page with `SiteswapViewer` widget
3. Add environment selection (reuse `@austencloud/backgrounds` types)
4. Connect to juggle-log's pattern database for browsable animations

Each phase is independently shippable. TKA never breaks mid-migration.

---

## Attribution

This package ecosystem builds on:

- **TKA Composer** by Austen Cloud — original 3D scene system being extracted
- **Three.js** (MIT) — 3D rendering engine
- **Threlte** (MIT) — Svelte bindings for Three.js
- **universal-siteswap** by Adrian Goldwaser (MIT) — siteswap parsing in siteswap-engine
- **Textbook IK** (Marschner & Shirley) — law of cosines 2-link solver
- **JIF specification** by Christian Helbling (MIT) — juggling interchange format

See individual package ATTRIBUTION.md files for detailed credits.
