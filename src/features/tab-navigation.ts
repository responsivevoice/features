import type { WebsiteFeatures, WebsiteVoice } from '@responsivevoice/types';
import type { Feature, SpeakFn } from '../types';

/**
 * Provides keyboard tab navigation with speech feedback on focused elements — the accessibility navigation mode.
 */
export class TabNavigationFeature implements Feature {
  /** {@inheritDoc Feature.name} */
  readonly name = 'accessibilityNavigation';
  private _active = false;
  private handler: ((e: KeyboardEvent) => void) | null = null;

  /** {@inheritDoc Feature.active} */
  get active() {
    return this._active;
  }

  /** {@inheritDoc Feature.init} */
  init(config: WebsiteFeatures, speak: SpeakFn, voice: WebsiteVoice): void {
    if (!config.accessibilityNavigation.enabled) return;
    this._active = true;

    this.handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      // After Tab, the focused element changes on next tick
      setTimeout(() => {
        const focused = document.activeElement;
        if (!focused || focused === document.body) return;

        const text = this.getAccessibleText(focused);
        if (text) {
          speak(text, voice.name, { pitch: voice.pitch, rate: voice.rate, volume: voice.volume });
        }
      }, 50);
    };

    document.addEventListener('keydown', this.handler);
  }

  private getAccessibleText(el: Element): string {
    const tag = el.tagName.toLowerCase();
    const content = (el as HTMLElement).textContent?.trim() || '';

    if (tag === 'a') return content ? `Link to ${content}` : '';
    if (tag === 'button') return content ? `${content} button` : '';
    if (tag === 'textarea' || (tag === 'input' && (el as HTMLInputElement).type !== 'hidden')) {
      const placeholder = (el as HTMLInputElement).placeholder || '';
      return placeholder ? `Text Input ${placeholder}` : 'Text Input';
    }

    return (
      content ||
      (el as HTMLInputElement).value ||
      el.getAttribute('aria-label') ||
      el.getAttribute('title') ||
      ''
    );
  }

  /** {@inheritDoc Feature.cleanup} */
  cleanup(): void {
    if (this.handler) {
      document.removeEventListener('keydown', this.handler);
      this.handler = null;
    }
    this._active = false;
  }
}
