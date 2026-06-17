import type { WebsiteFeatures, WebsiteVoice } from '@responsivevoice/types';
import type { Feature, SpeakFn } from '../types';
import { readableText } from '../utils/readable-text';

/**
 * Provides keyboard navigation across paragraphs with speech feedback on the focused block.
 */
export class ParagraphNavigationFeature implements Feature {
  /** {@inheritDoc Feature.name} */
  readonly name = 'paragraphNavigation';
  private _active = false;
  private handler: ((e: KeyboardEvent) => void) | null = null;
  private currentIndex = -1;

  /** {@inheritDoc Feature.active} */
  get active() {
    return this._active;
  }

  /** {@inheritDoc Feature.init} */
  init(config: WebsiteFeatures, speak: SpeakFn, voice: WebsiteVoice): void {
    if (!config.paragraphNavigation.enabled) return;
    this._active = true;

    this.handler = (e: KeyboardEvent) => {
      // Only handle Ctrl+ArrowUp/ArrowDown for paragraph navigation (matches legacy)
      if (!e.ctrlKey) return;
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

      e.preventDefault();
      const paragraphs = document.querySelectorAll('p');
      if (paragraphs.length === 0) return;

      if (e.key === 'ArrowDown') {
        this.currentIndex = Math.min(this.currentIndex + 1, paragraphs.length - 1);
      } else {
        this.currentIndex = Math.max(this.currentIndex - 1, 0);
      }

      const paragraph = paragraphs[this.currentIndex];
      paragraph.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const text = readableText(paragraph);
      if (text) {
        speak(text, voice.name, { pitch: voice.pitch, rate: voice.rate, volume: voice.volume });
      }
    };

    document.addEventListener('keydown', this.handler);
  }

  /** {@inheritDoc Feature.cleanup} */
  cleanup(): void {
    if (this.handler) {
      document.removeEventListener('keydown', this.handler);
      this.handler = null;
    }
    this.currentIndex = -1;
    this._active = false;
  }
}
