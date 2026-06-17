import type { WebsiteFeatures, WebsiteVoice } from '@responsivevoice/types';
import type { Feature, SpeakFn } from '../types';
import { hoverIntent } from '../utils/hover-intent';
import { readableText } from '../utils/readable-text';

/**
 * Speaks link text when the pointer hovers long enough to register hover intent. Uses a short dwell timer to avoid firing on incidental cursor movement.
 */
export class SpeakLinksFeature implements Feature {
  /** {@inheritDoc Feature.name} */
  readonly name = 'speakLinks';
  private _active = false;
  private cleanupFns: (() => void)[] = [];
  private observer: MutationObserver | null = null;

  /** {@inheritDoc Feature.active} */
  get active() {
    return this._active;
  }

  /** {@inheritDoc Feature.init} */
  init(config: WebsiteFeatures, speak: SpeakFn, voice: WebsiteVoice): void {
    if (!config.speakLinks.enabled) return;
    this._active = true;

    const attachToLink = (link: Element) => {
      const cleanup = hoverIntent(link, {
        sensitivity: 7,
        interval: 100,
        timeout: 0,
        onOver: (el) => {
          const text = readableText(el);
          if (text) {
            speak(text, voice.name, { pitch: voice.pitch, rate: voice.rate, volume: voice.volume });
          }
        },
        onOut: () => {},
      });
      this.cleanupFns.push(cleanup);
    };

    // Attach to existing links
    document.querySelectorAll('a').forEach(attachToLink);

    // Watch for dynamically added links
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLAnchorElement) {
            attachToLink(node);
          } else if (node instanceof Element) {
            node.querySelectorAll('a').forEach(attachToLink);
          }
        }
      }
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  /** {@inheritDoc Feature.cleanup} */
  cleanup(): void {
    for (const fn of this.cleanupFns) fn();
    this.cleanupFns = [];
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this._active = false;
  }
}
