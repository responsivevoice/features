import type { WebsiteFeatures, WebsiteVoice } from '@responsivevoice/types';
import type { Feature, SpeakFn } from '../types';
import { pickRandomMessage } from '../utils/random-message';

/**
 * Speaks a configured message when the pointer moves toward the top of the viewport — a signal the user may be about to leave the page.
 */
export class ExitIntentFeature implements Feature {
  /** {@inheritDoc Feature.name} */
  readonly name = 'exitIntent';
  private _active = false;
  private handler: ((e: MouseEvent) => void) | null = null;
  private spoken = false;

  /** {@inheritDoc Feature.active} */
  get active() {
    return this._active;
  }

  /** {@inheritDoc Feature.init} */
  init(config: WebsiteFeatures, speak: SpeakFn, voice: WebsiteVoice): void {
    if (!config.exitIntent.enabled || !config.exitIntent.text) return;
    this._active = true;

    this.handler = (e: MouseEvent) => {
      if (this.spoken) return;
      // Exit intent: mouse moves to the top of the viewport (leaving the page)
      if (e.clientY <= 0) {
        const text = pickRandomMessage(config.exitIntent.text);
        if (text) {
          speak(text, voice.name, { pitch: voice.pitch, rate: voice.rate, volume: voice.volume });
          this.spoken = true;
        }
      }
    };

    document.addEventListener('mouseout', this.handler as EventListener);
  }

  /** {@inheritDoc Feature.cleanup} */
  cleanup(): void {
    if (this.handler) {
      document.removeEventListener('mouseout', this.handler as EventListener);
      this.handler = null;
    }
    this.spoken = false;
    this._active = false;
  }
}
