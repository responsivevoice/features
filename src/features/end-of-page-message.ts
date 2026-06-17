import type { WebsiteFeatures, WebsiteVoice } from '@responsivevoice/types';
import type { SpeakFn } from '../types';
import { pickRandomMessage } from '../utils/random-message';
import { SpeakOnceFeature } from './base-speak-once';

/**
 * Speaks a configured message when the user scrolls to (or near) the bottom of the page. Extends `SpeakOnceFeature`.
 */
export class EndOfPageMessageFeature extends SpeakOnceFeature {
  /** {@inheritDoc Feature.name} */
  readonly name = 'speakEndPage';
  private handler: (() => void) | null = null;

  /** {@inheritDoc Feature.init} */
  init(config: WebsiteFeatures, speak: SpeakFn, voice: WebsiteVoice): void {
    if (!config.speakEndPage.enabled || !config.speakEndPage.text) return;
    this._active = true;

    this.handler = () => {
      if (this.spoken) return;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;

      // Trigger when user is within 50px of the bottom
      if (scrollTop + clientHeight >= scrollHeight - 50) {
        const text = pickRandomMessage(config.speakEndPage.text);
        if (text) {
          speak(text, voice.name, { pitch: voice.pitch, rate: voice.rate, volume: voice.volume });
          this.spoken = true;
        }
      }
    };

    window.addEventListener('scroll', this.handler, { passive: true });
  }

  /** {@inheritDoc Feature.cleanup} */
  cleanup(): void {
    if (this.handler) {
      window.removeEventListener('scroll', this.handler);
      this.handler = null;
    }
    this.spoken = false;
    this._active = false;
  }
}
