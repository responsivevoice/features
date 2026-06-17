import type { WebsiteFeatures, WebsiteVoice } from '@responsivevoice/types';
import type { Feature, SpeakFn } from './types';

/**
 * Registers and orchestrates dashboard {@link Feature} plugins. Features are
 * registered once, then activated together with a resolved website config +
 * speak function; calling `activate()` again cleans up the previous batch
 * before starting the new one, so re-config is idempotent.
 */
export class FeatureManager {
  private features: Feature[] = [];
  private activated = false;

  /** Register a feature plugin. Safe to call before or after `activate()`. */
  register(feature: Feature): void {
    this.features.push(feature);
  }

  /**
   * Initialize every registered feature with the given website config. If a
   * previous activation is still live, cleans it up first.
   */
  activate(config: WebsiteFeatures, speak: SpeakFn, voice: WebsiteVoice, apiKey?: string): void {
    // Clean up any previously activated features
    if (this.activated) {
      this.cleanup();
    }

    for (const feature of this.features) {
      feature.init(config, speak, voice, apiKey);
    }
    this.activated = true;
  }

  /** Tear down every currently-active feature (event listeners, timers, etc.). */
  cleanup(): void {
    for (const feature of this.features) {
      if (feature.active) {
        feature.cleanup();
      }
    }
    this.activated = false;
  }

  /** Names of features currently reporting `active === true`. */
  getActiveFeatures(): string[] {
    return this.features.filter((f) => f.active).map((f) => f.name);
  }

  /**
   * Returns the registered feature with the given name, or `undefined` if
   * none is registered. Useful for callers that need to invoke feature-
   * specific public methods (e.g. `webPlayer.mount(...)`).
   */
  get<T extends Feature = Feature>(name: string): T | undefined {
    return this.features.find((f) => f.name === name) as T | undefined;
  }

  /** Whether `activate()` has been called (and not yet cleaned up). */
  isActivated(): boolean {
    return this.activated;
  }
}
