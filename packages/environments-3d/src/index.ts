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
