import { djb2Hash } from '@responsivevoice/text';
import type { WebsiteFeatures, WebsiteVoice } from '@responsivevoice/types';
import type { Feature, SpeakFn } from '../types';
import { isPrerendering } from '../utils/prerender-detection';
import { pickRandomMessage } from '../utils/random-message';

const STORAGE_PREFIX = 'rv_welcomed_';

/**
 * Speaks a configured welcome message shortly after page load. Respects the `welcomeMessageOnce` flag via sessionStorage (keyed by API key hash) so repeat visits stay silent for the same text.
 */
export class WelcomeMessageFeature implements Feature {
  /** {@inheritDoc Feature.name} */
  readonly name = 'welcomeMessage';
  private _active = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** {@inheritDoc Feature.active} */
  get active() {
    return this._active;
  }

  /** {@inheritDoc Feature.init} */
  init(config: WebsiteFeatures, speak: SpeakFn, voice: WebsiteVoice, apiKey?: string): void {
    if (!config.welcomeMessage.enabled || !config.welcomeMessage.text) return;
    if (isPrerendering()) return;

    const storageKey = `${STORAGE_PREFIX}${djb2Hash(apiKey ?? 'default')}`;
    const textHash = djb2Hash(config.welcomeMessage.text);

    if (!config.welcomeMessageOnce) {
      // Option disabled — clean up any stale session key
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // sessionStorage unavailable
      }
    } else {
      // "Speak once per session" — skip if same text was already spoken
      try {
        if (sessionStorage.getItem(storageKey) === textHash) return;
      } catch {
        // sessionStorage unavailable — allow playback
      }
    }

    this._active = true;

    // Delay slightly to let the page settle
    this.timer = setTimeout(() => {
      const text = pickRandomMessage(config.welcomeMessage.text);
      if (text) {
        speak(text, voice.name, { pitch: voice.pitch, rate: voice.rate, volume: voice.volume });
        if (config.welcomeMessageOnce) {
          try {
            sessionStorage.setItem(storageKey, textHash);
          } catch {
            // sessionStorage unavailable
          }
        }
      }
    }, 500);
  }

  /** {@inheritDoc Feature.cleanup} */
  cleanup(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this._active = false;
  }
}
