/**
 * Service Factory
 *
 * Creates default service instances for background systems.
 * This eliminates the need for external DI containers while still
 * allowing consumers to inject custom implementations if desired.
 */

import type { IBackgroundRenderingService } from "../contracts/IBackgroundRenderingService.js";
import type { IBackgroundConfigurationService } from "../contracts/IBackgroundConfigurationService.js";
import type { IGeoLocationProvider } from "../contracts/IGeoLocationProvider.js";
import { BackgroundRenderingService } from "./BackgroundRenderingService.js";
import { BackgroundConfigurationService } from "./BackgroundConfigurationService.js";
import { DefaultGeoLocationProvider } from "../contracts/IGeoLocationProvider.js";

/**
 * Cached service instances (singleton per package instance)
 */
let cachedRenderingService: IBackgroundRenderingService | null = null;
let cachedConfigurationService: IBackgroundConfigurationService | null = null;
let cachedGeoLocationProvider: IGeoLocationProvider | null = null;

/**
 * Get or create the background rendering service
 */
export function getRenderingService(): IBackgroundRenderingService {
  if (!cachedRenderingService) {
    cachedRenderingService = new BackgroundRenderingService();
  }
  return cachedRenderingService;
}

/**
 * Get or create the background configuration service
 */
export function getConfigurationService(): IBackgroundConfigurationService {
  if (!cachedConfigurationService) {
    cachedConfigurationService = new BackgroundConfigurationService();
  }
  return cachedConfigurationService;
}

/**
 * Get or create the geo location provider
 */
export function getGeoLocationProvider(): IGeoLocationProvider {
  if (!cachedGeoLocationProvider) {
    cachedGeoLocationProvider = new DefaultGeoLocationProvider();
  }
  return cachedGeoLocationProvider;
}

/**
 * Set a custom geo location provider
 */
export function setGeoLocationProvider(provider: IGeoLocationProvider): void {
  cachedGeoLocationProvider = provider;
}

/**
 * Set a custom rendering service
 */
export function setRenderingService(service: IBackgroundRenderingService): void {
  cachedRenderingService = service;
}

/**
 * Set a custom configuration service
 */
export function setConfigurationService(service: IBackgroundConfigurationService): void {
  cachedConfigurationService = service;
}

/**
 * Reset all cached services (useful for testing)
 */
export function resetServices(): void {
  cachedRenderingService = null;
  cachedConfigurationService = null;
  cachedGeoLocationProvider = null;
}
