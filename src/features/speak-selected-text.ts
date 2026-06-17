import type { WebsiteFeatures, WebsiteVoice } from '@responsivevoice/types';
import type { Feature, SpeakFn } from '../types';

/**
 * Listens for text selection on the page and speaks the highlighted text. Activates on `mouseup` selection events.
 */
export class SpeakSelectedTextFeature implements Feature {
  /** {@inheritDoc Feature.name} */
  readonly name = 'speakSelectedText';
  private _active = false;
  private handler: (() => void) | null = null;

  /** {@inheritDoc Feature.active} */
  get active() {
    return this._active;
  }

  /** {@inheritDoc Feature.init} */
  init(config: WebsiteFeatures, speak: SpeakFn, voice: WebsiteVoice): void {
    if (!config.speakSelectedText.enabled) return;
    this._active = true;

    this.handler = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (text && text.length > 0) {
        speak(text, voice.name, { pitch: voice.pitch, rate: voice.rate, volume: voice.volume });
      }
    };

    document.addEventListener('mouseup', this.handler);
  }

  /** {@inheritDoc Feature.cleanup} */
  cleanup(): void {
    if (this.handler) {
      document.removeEventListener('mouseup', this.handler);
      this.handler = null;
    }
    this._active = false;
  }
}
