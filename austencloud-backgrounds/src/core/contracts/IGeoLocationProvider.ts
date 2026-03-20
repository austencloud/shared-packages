/**
 * Geo Location Provider Interface
 *
 * Provides geographic coordinates for location-dependent features
 * like moon phase calculations based on user's latitude.
 *
 * Consumers can provide their own implementation or use the default
 * which assumes northern hemisphere (45° latitude).
 */

export interface IGeoLocationProvider {
  getCoordinates(): Promise<{ latitude: number; longitude: number } | null>;
  isAvailable(): boolean;
}

/**
 * Default geo location provider that returns a reasonable default
 * for northern hemisphere users (roughly central US/Europe latitude).
 */
export class DefaultGeoLocationProvider implements IGeoLocationProvider {
  async getCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
    // Return a default northern hemisphere latitude for moon calculations
    // This is roughly the latitude of central US/Europe
    return { latitude: 45, longitude: -90 };
  }

  isAvailable(): boolean {
    return true;
  }
}
