import type { WebsiteFeatures, WebsiteVoice } from '@responsivevoice/types';
import type { SpeakFn } from '../types';
import { pickRandomMessage } from '../utils/random-message';
import { SpeakOnceFeature } from './base-speak-once';

const INACTIVITY_TIMEOUT = 30000;

/**
 * Speaks a configured message after a period of user inactivity on the page. Extends `SpeakOnceFeature` for per-page-load idempotency.
 */
export class InactivityMessageFeature extends SpeakOnceFeature {
  /** {@inheritDoc Feature.name} */
  readonly name = 'speakInactivity';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private resetHandler: (() => void) | null = null;

  /** {@inheritDoc Feature.init} */
  init(config: WebsiteFeatures, speak: SpeakFn, voice: WebsiteVoice): void {
    if (!config.speakInactivity.enabled || !config.speakInactivity.text) return;
    this._active = true;

    const speakMessage = () => {
      if (this.spoken) return;
      const text = pickRandomMessage(config.speakInactivity.text);
      if (text) {
        speak(text, voice.name, { pitch: voice.pitch, rate: voice.rate, volume: voice.volume });
        this.spoken = true;
      }
    };

    const resetTimer = () => {
      if (this.timer) clearTimeout(this.timer);
      if (!this.spoken) {
        this.timer = setTimeout(speakMessage, INACTIVITY_TIMEOUT);
      }
    };

    this.resetHandler = resetTimer;
    document.addEventListener('mousemove', resetTimer);
    document.addEventListener('keydown', resetTimer);
    document.addEventListener('scroll', resetTimer);
    document.addEventListener('click', resetTimer);

    // Start the initial timer
    resetTimer();
  }

  /** {@inheritDoc Feature.cleanup} */
  cleanup(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.resetHandler) {
      document.removeEventListener('mousemove', this.resetHandler);
      document.removeEventListener('keydown', this.resetHandler);
      document.removeEventListener('scroll', this.resetHandler);
      document.removeEventListener('click', this.resetHandler);
      this.resetHandler = null;
    }
    this.spoken = false;
    this._active = false;
  }
}
