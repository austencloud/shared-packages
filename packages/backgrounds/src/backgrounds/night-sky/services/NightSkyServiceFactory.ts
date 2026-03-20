/**
 * Night Sky Service Factory
 *
 * Creates and caches all Night Sky-specific services including
 * the calculation service and all UFO sub-services.
 */

import type { INightSkyCalculationService } from "./contracts/INightSkyCalculationService.js";
import type { IUFORenderer } from "./contracts/IUFORenderer.js";
import type { IUFOParticleRenderer } from "./contracts/IUFOParticleRenderer.js";
import type { IUFOMoodManager } from "./contracts/IUFOMoodManager.js";
import type { IUFOStarScanner } from "./contracts/IUFOStarScanner.js";
import type { IUFOInteractionHandler } from "./contracts/IUFOInteractionHandler.js";
import type { IUFOBehaviorRunner } from "./contracts/IUFOBehaviorRunner.js";
import type { IUFOEntranceAnimator } from "./contracts/IUFOEntranceAnimator.js";
import type { IUFOExitAnimator } from "./contracts/IUFOExitAnimator.js";
import type { IUFOMovementController } from "./contracts/IUFOMovementController.js";
import type { IUFODecisionMaker } from "./contracts/IUFODecisionMaker.js";
import type { IUFOFactory } from "./contracts/IUFOFactory.js";

import { NightSkyCalculationService } from "./implementations/NightSkyCalculationService.js";
import { UFORenderer } from "./implementations/UFORenderer.js";
import { UFOParticleRenderer } from "./implementations/UFOParticleRenderer.js";
import { UFOMoodManager } from "./implementations/UFOMoodManager.js";
import { UFOStarScanner } from "./implementations/UFOStarScanner.js";
import { UFOInteractionHandler } from "./implementations/UFOInteractionHandler.js";
import { UFOBehaviorRunner } from "./implementations/UFOBehaviorRunner.js";
import { UFOEntranceAnimator } from "./implementations/UFOEntranceAnimator.js";
import { UFOExitAnimator } from "./implementations/UFOExitAnimator.js";
import { UFOMovementController } from "./implementations/UFOMovementController.js";
import { UFODecisionMaker } from "./implementations/UFODecisionMaker.js";
import { UFOFactory } from "./implementations/UFOFactory.js";

/**
 * Container for all Night Sky services
 */
export interface NightSkyServices {
  calculationService: INightSkyCalculationService;
  ufoRenderer: IUFORenderer;
  ufoParticleRenderer: IUFOParticleRenderer;
  ufoMoodManager: IUFOMoodManager;
  ufoStarScanner: IUFOStarScanner;
  ufoInteractionHandler: IUFOInteractionHandler;
  ufoBehaviorRunner: IUFOBehaviorRunner;
  ufoEntranceAnimator: IUFOEntranceAnimator;
  ufoExitAnimator: IUFOExitAnimator;
  ufoMovementController: IUFOMovementController;
  ufoDecisionMaker: IUFODecisionMaker;
  ufoFactory: IUFOFactory;
}

// Cached services
let cachedServices: NightSkyServices | null = null;

/**
 * Get or create all Night Sky services
 */
export function getNightSkyServices(): NightSkyServices {
  if (!cachedServices) {
    // Create calculation service first (needed by other services)
    const calculationService = new NightSkyCalculationService();

    // Create UFO services
    const ufoRenderer = new UFORenderer();
    const ufoParticleRenderer = new UFOParticleRenderer();
    const ufoMoodManager = new UFOMoodManager();
    const ufoStarScanner = new UFOStarScanner();
    const ufoInteractionHandler = new UFOInteractionHandler();
    const ufoEntranceAnimator = new UFOEntranceAnimator();
    const ufoExitAnimator = new UFOExitAnimator();
    const ufoMovementController = new UFOMovementController();
    const ufoDecisionMaker = new UFODecisionMaker();
    const ufoBehaviorRunner = new UFOBehaviorRunner();
    const ufoFactory = new UFOFactory(calculationService);

    cachedServices = {
      calculationService,
      ufoRenderer,
      ufoParticleRenderer,
      ufoMoodManager,
      ufoStarScanner,
      ufoInteractionHandler,
      ufoBehaviorRunner,
      ufoEntranceAnimator,
      ufoExitAnimator,
      ufoMovementController,
      ufoDecisionMaker,
      ufoFactory,
    };
  }

  return cachedServices;
}

/**
 * Reset cached services (for testing)
 */
export function resetNightSkyServices(): void {
  cachedServices = null;
}
