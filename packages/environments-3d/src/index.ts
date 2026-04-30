// Scene components
export { default as ForestScene } from "./lib/scenes/ForestScene.svelte";
export { default as WinterScene } from "./lib/scenes/WinterScene.svelte";
export { default as CosmicScene } from "./lib/scenes/CosmicScene.svelte";
export { default as OceanScene } from "./lib/scenes/OceanScene.svelte";
export { default as EmberScene } from "./lib/scenes/EmberScene.svelte";
export { default as CherryBlossomScene } from "./lib/scenes/CherryBlossomScene.svelte";

// Switcher
export { default as Environment3D } from "./lib/components/Environment3D.svelte";

// Primitives
export { default as FallingParticles } from "./lib/primitives/FallingParticles.svelte";
export { default as SkyGradient } from "./lib/primitives/SkyGradient.svelte";
export { default as GroundPlane } from "./lib/primitives/GroundPlane.svelte";
export { default as TexturedGroundPlane } from "./lib/primitives/TexturedGroundPlane.svelte";

// Effects
export { default as VolumetricFireComponent } from "./lib/effects/volumetric-fire/VolumetricFireComponent.svelte";

// Domain enums
export type { ForestVariant, CosmicVariant } from "./lib/domain/enums/environment-enums";

// Domain models
export type {
	GroundPlaneConfig,
	SkyGradientConfig,
	FallingParticlesConfig,
	ForestSceneConfig as ForestSceneModelConfig,
	CosmicSceneConfig,
	ParticleType,
} from "./lib/domain/models/environment-models";

// Scene configs (with full defaults)
export type {
	ForestSceneConfig,
	WinterSceneConfig,
	FogConfig,
	TreeRingConfig,
	CampfireConfig,
	GroundConfig,
} from "./lib/domain/models/scene-configs";
export {
	createDefaultForestFireflyConfig,
	createDefaultForestAutumnConfig,
	createDefaultWinterConfig,
} from "./lib/domain/models/scene-configs";

// Context (for consumers that want loading progress)
export { setSceneFeatureContext, getSceneFeatureContext } from "./lib/context/scene-feature-context";
export type { SceneFeatureState } from "./lib/context/scene-feature-context";
