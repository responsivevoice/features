import type { WebsiteFeatures, WebsiteVoice } from '@responsivevoice/types';
import type { Feature, SpeakFn } from '../types';

/**
 * Base class for features that speak once per page load.
 *
 * Owns the `_active`/`spoken` state and the `active` getter shared by all
 * speak-once features. Subclasses implement the transport-specific `init`
 * (scroll listener, activity timer, exit intent, etc.) and `cleanup`.
 *
 * @internal
 * Abstract base for `EndOfPageMessageFeature` and `InactivityMessageFeature`.
 * Consumers instantiate those concrete features, not this class directly.
 */
export abstract class SpeakOnceFeature implements Feature {
  abstract readonly name: string;
  protected _active = false;
  protected spoken = false;

  get active() {
    return this._active;
  }

  abstract init(config: WebsiteFeatures, speak: SpeakFn, voice: WebsiteVoice): void;
  abstract cleanup(): void;
}
