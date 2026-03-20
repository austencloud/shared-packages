/**
 * Deep Ocean Service Factory
 *
 * Creates and caches all Deep Ocean-specific services including
 * physics, animation, and rendering subsystems with their
 * full dependency trees wired up correctly.
 */

// Orchestrator-level contracts
import type { IBubblePhysics } from "./contracts/IBubblePhysics.js";
import type { IParticleSystem } from "./contracts/IParticleSystem.js";
import type { ILightRayCalculator } from "./contracts/ILightRayCalculator.js";
import type { IFishAnimator } from "./contracts/IFishAnimator.js";
import type { IJellyfishAnimator } from "./contracts/IJellyfishAnimator.js";
import type { IGradientRenderer } from "./contracts/IGradientRenderer.js";
import type { ILightRayRenderer } from "./contracts/ILightRayRenderer.js";
import type { IBubbleRenderer } from "./contracts/IBubbleRenderer.js";
import type { IParticleRenderer } from "./contracts/IParticleRenderer.js";
import type { IFishRenderer } from "./contracts/IFishRenderer.js";
import type { IJellyfishRenderer } from "./contracts/IJellyfishRenderer.js";

// Implementations - physics & animation
import { BubblePhysics } from "./implementations/BubblePhysics.js";
import { ParticleSystem } from "./implementations/ParticleSystem.js";
import { LightRayCalculator } from "./implementations/LightRayCalculator.js";
import { FishAnimator } from "./implementations/FishAnimator.js";
import { JellyfishAnimator } from "./implementations/JellyfishAnimator.js";

// Implementations - renderers
import { GradientRenderer } from "./implementations/GradientRenderer.js";
import { LightRayRenderer } from "./implementations/LightRayRenderer.js";
import { BubbleRenderer } from "./implementations/BubbleRenderer.js";
import { ParticleRenderer } from "./implementations/ParticleRenderer.js";
import { FishRenderer } from "./implementations/FishRenderer.js";
import { JellyfishRenderer } from "./implementations/JellyfishRenderer.js";

// Implementations - fish sub-services
import { ColorCalculator } from "./implementations/ColorCalculator.js";
import { FishBodyRenderer } from "./implementations/FishBodyRenderer.js";
import { FishFaceRenderer } from "./implementations/FishFaceRenderer.js";
import { FishFinRenderer } from "./implementations/FishFinRenderer.js";
import { FishEffectRenderer } from "./implementations/FishEffectRenderer.js";
import { FishPatternRenderer } from "./implementations/FishPatternRenderer.js";
import { FishFactory } from "./implementations/FishFactory.js";
import { FishSpineController } from "./implementations/FishSpineController.js";
import { FishMovementController } from "./implementations/FishMovementController.js";
import { FishFlockingCalculator } from "./implementations/FishFlockingCalculator.js";
import { FishVisualUpdater } from "./implementations/FishVisualUpdater.js";

/**
 * Container for all Deep Ocean services
 */
export interface DeepOceanServices {
  bubblePhysics: IBubblePhysics;
  particleSystem: IParticleSystem;
  lightRayCalculator: ILightRayCalculator;
  fishAnimator: IFishAnimator;
  jellyfishAnimator: IJellyfishAnimator;
  gradientRenderer: IGradientRenderer;
  lightRayRenderer: ILightRayRenderer;
  bubbleRenderer: IBubbleRenderer;
  particleRenderer: IParticleRenderer;
  fishRenderer: IFishRenderer;
  jellyfishRenderer: IJellyfishRenderer;
}

// Cached services
let cachedServices: DeepOceanServices | null = null;

/**
 * Get or create all Deep Ocean services
 */
export function getDeepOceanServices(): DeepOceanServices {
  if (!cachedServices) {
    // === Physics & Animation (zero-arg or internally-defaulting) ===
    const bubblePhysics = new BubblePhysics();
    const particleSystem = new ParticleSystem();
    const lightRayCalculator = new LightRayCalculator();
    const jellyfishAnimator = new JellyfishAnimator();

    // === Fish animation sub-services (optional deps default internally) ===
    const fishFactory = new FishFactory();
    const fishSpineController = new FishSpineController();
    const fishMovementController = new FishMovementController();
    const fishFlockingCalculator = new FishFlockingCalculator();
    const fishVisualUpdater = new FishVisualUpdater();

    const fishAnimator = new FishAnimator(
      fishFactory,
      fishSpineController,
      fishMovementController,
      fishFlockingCalculator,
      fishVisualUpdater
    );

    // === Renderers (zero-arg) ===
    const gradientRenderer = new GradientRenderer();
    const lightRayRenderer = new LightRayRenderer();
    const bubbleRenderer = new BubbleRenderer();
    const particleRenderer = new ParticleRenderer();
    const jellyfishRenderer = new JellyfishRenderer();

    // === Fish renderer sub-services (need ColorCalculator) ===
    const colorCalculator = new ColorCalculator();
    const fishBodyRenderer = new FishBodyRenderer(colorCalculator);
    const fishFaceRenderer = new FishFaceRenderer(colorCalculator);
    const fishFinRenderer = new FishFinRenderer(colorCalculator);
    const fishEffectRenderer = new FishEffectRenderer(colorCalculator);
    const fishPatternRenderer = new FishPatternRenderer(
      colorCalculator,
      fishEffectRenderer,
      fishFinRenderer,
      fishFaceRenderer,
      fishBodyRenderer
    );

    const fishRenderer = new FishRenderer(
      fishEffectRenderer,
      fishFaceRenderer,
      fishFinRenderer,
      fishPatternRenderer,
      fishBodyRenderer
    );

    cachedServices = {
      bubblePhysics,
      particleSystem,
      lightRayCalculator,
      fishAnimator,
      jellyfishAnimator,
      gradientRenderer,
      lightRayRenderer,
      bubbleRenderer,
      particleRenderer,
      fishRenderer,
      jellyfishRenderer,
    };
  }

  return cachedServices;
}

/**
 * Reset cached services (for testing)
 */
export function resetDeepOceanServices(): void {
  cachedServices = null;
}
