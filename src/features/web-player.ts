import type {
  VoiceSelector,
  WebPlayerFeature as WebPlayerConfig,
  WebsiteFeatures,
  WebsiteVoice,
} from '@responsivevoice/types';
import type { Feature, SpeakFn } from '../types';
import { isPrerendering } from '../utils/prerender-detection';
import { WebPlayerInstance } from './web-player/instance';
import { HOST_DOCUMENT_STYLES } from './web-player/styles';

const HOST_STYLE_ID = 'rv-web-player-host-styles';

/**
 * Handle returned by {@link WebPlayerFeature.mount}. Caller invokes
 * `unmount()` when the mounted element is removed from the DOM, or to
 * tear the player down imperatively.
 */
export interface WebPlayerMountHandle {
  /** Tear down this mounted instance. Idempotent. */
  unmount(): void;
}

/**
 * Partial-override shape for {@link WebPlayerFeature.mount}. Top-level
 * fields are optional and the three grouped sets (`controls`, `navigation`,
 * `layout`) accept partial leaves so `{ controls: { brand: false } }` keeps
 * the rest of `controls` from the init config.
 */
export type WebPlayerMountOverrides = Omit<
  Partial<WebPlayerConfig>,
  'controls' | 'navigation' | 'layout'
> & {
  controls?: Partial<WebPlayerConfig['controls']>;
  navigation?: Partial<WebPlayerConfig['navigation']>;
  layout?: Partial<WebPlayerConfig['layout']>;
};

/**
 * Web player orchestrator. Discovers articles matching `selector` at init
 * time and binds an independent {@link WebPlayerInstance} to each one.
 * Exposes {@link mount} for runtime mounts on dynamically-added elements
 * (SPAs, lazy-loaded sections).
 *
 * Coordinates single-active-narrator behaviour: when one instance starts
 * speaking, it calls back via the constructor-injected `onActivate` so the
 * orchestrator can preempt every other live instance.
 */
export class WebPlayerFeature implements Feature {
  /** {@inheritDoc Feature.name} */
  readonly name = 'webPlayer';
  private _active = false;

  private instances: WebPlayerInstance[] = [];
  private speak: SpeakFn | null = null;
  private voice: WebsiteVoice | null = null;
  private resolvedConfig: WebPlayerConfig | null = null;

  /** {@inheritDoc Feature.active} */
  get active() {
    return this._active;
  }

  /** {@inheritDoc Feature.init} */
  init(config: WebsiteFeatures, speak: SpeakFn, voice: WebsiteVoice): void {
    if (!config.webPlayer.enabled) return;
    if (isPrerendering()) return;

    this.speak = speak;
    this.voice = voice;
    this.resolvedConfig = config.webPlayer;

    const articles = filterTopLevel(
      Array.from(document.querySelectorAll<HTMLElement>(config.webPlayer.selector))
    );
    if (articles.length === 0) return;

    this.injectHostStyles();

    for (const article of articles) {
      const instance = this.createInstance(article, config.webPlayer);
      if (instance.mount()) {
        this.instances.push(instance);
      }
    }

    this._active = this.instances.length > 0;
  }

  /** {@inheritDoc Feature.cleanup} */
  cleanup(): void {
    for (const inst of this.instances.splice(0)) inst.cleanup();
    this.removeHostStyles();
    this.speak = null;
    this.voice = null;
    this.resolvedConfig = null;
    this._active = false;
  }

  /**
   * Imperatively mount a player on a dynamically-added element. Used by
   * SPAs and any case where the target element wasn't in the DOM at
   * `rv.init()` time.
   *
   * `overrides` accepts the same shape as the init `webPlayer` config;
   * leaf-merged over the init config (missing fields fall through to init
   * defaults). Returns a handle whose `unmount()` tears this instance down.
   *
   * No-op when the feature isn't active (init not called or `enabled: false`)
   * or when the target element can't be resolved.
   */
  mount(
    selectorOrElement: string | HTMLElement,
    overrides?: WebPlayerMountOverrides
  ): WebPlayerMountHandle | null {
    if (!this.speak || !this.voice || !this.resolvedConfig) return null;

    const element = resolveElement(selectorOrElement);
    if (!element) return null;

    // Skip if the element is already mounted.
    if (this.instances.some((i) => i.ownsArticle(element))) return null;

    const merged = mergeConfig(this.resolvedConfig, overrides);
    const instance = this.createInstance(element, merged);
    if (!instance.mount()) return null;

    this.instances.push(instance);
    if (!this._active) {
      this.injectHostStyles();
      this._active = true;
    }

    return {
      unmount: () => {
        const idx = this.instances.indexOf(instance);
        if (idx >= 0) this.instances.splice(idx, 1);
        instance.cleanup();
        if (this.instances.length === 0) {
          this.removeHostStyles();
          this._active = false;
        }
      },
    };
  }

  // --- Internal --------------------------------------------------------

  private createInstance(article: HTMLElement, config: WebPlayerConfig): WebPlayerInstance {
    if (!this.speak || !this.voice) {
      throw new Error('[WebPlayer] internal: createInstance called without speak/voice');
    }
    const resolvedVoice = resolveVoice(this.voice, config);
    let instance: WebPlayerInstance;
    instance = new WebPlayerInstance(article, config, this.speak, resolvedVoice, () => {
      this.handleActivate(instance);
    });
    return instance;
  }

  private handleActivate(active: WebPlayerInstance): void {
    // Drop any instances whose hosts have detached (opportunistic cleanup
    // catches them when their callbacks fire; this catches the rest).
    this.instances = this.instances.filter((i) => !i.isDestroyed);
    for (const inst of this.instances) {
      if (inst !== active) inst.preempt();
    }
  }

  private injectHostStyles(): void {
    if (document.getElementById(HOST_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = HOST_STYLE_ID;
    style.textContent = HOST_DOCUMENT_STYLES;
    document.head.appendChild(style);
  }

  private removeHostStyles(): void {
    const style = document.getElementById(HOST_STYLE_ID);
    if (style?.parentNode) style.parentNode.removeChild(style);
  }
}

/**
 * Drop any element that has an ancestor also in the result set. Avoids
 * double-mounting on nested matches (e.g. CMS templates with `<article>`
 * inside `<article>`). Publishers who specifically want nested mounts
 * write a more specific selector.
 */
function filterTopLevel(elements: HTMLElement[]): HTMLElement[] {
  return elements.filter(
    (candidate) => !elements.some((other) => other !== candidate && other.contains(candidate))
  );
}

function resolveElement(target: string | HTMLElement): HTMLElement | null {
  if (typeof target === 'string') {
    return document.querySelector<HTMLElement>(target);
  }
  return target instanceof HTMLElement ? target : null;
}

/**
 * Leaf-merge `overrides` over `base`. Top-level scalars (`voice`, `rate`,
 * `pitch`, `volume`, `theme`, etc.) are replaced when present in the
 * override; nested objects (`controls`, `navigation`, `layout`) are merged
 * at the leaf level so partial overrides like `{ controls: { brand: false } }`
 * keep the rest of the parent group from the base config.
 */
function mergeConfig(base: WebPlayerConfig, overrides?: WebPlayerMountOverrides): WebPlayerConfig {
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    controls: { ...base.controls, ...(overrides.controls ?? {}) },
    navigation: { ...base.navigation, ...(overrides.navigation ?? {}) },
    layout: { ...base.layout, ...(overrides.layout ?? {}) },
    theme: overrides.theme ?? base.theme,
  };
}

/**
 * Fully-resolved per-player voice produced by {@link resolveVoice}. After
 * merge with the website default, every field is guaranteed — the player
 * has a definite selector, pitch, rate, and volume.
 */
export interface ResolvedWebPlayerVoice {
  selector: VoiceSelector;
  pitch: number;
  rate: number;
  volume: number;
}

/**
 * Build the player's effective voice by leaf-merging the per-player flat
 * playback fields (`voice`, `pitch`, `rate`, `volume`) over the website-
 * level default voice profile. Each override field is independently
 * optional. When `voice` (the selector) is omitted, the website default's
 * voice name is promoted to a string-form selector — preserving the
 * website voice as the player's voice.
 */
function resolveVoice(
  websiteDefault: WebsiteVoice,
  config: WebPlayerConfig
): ResolvedWebPlayerVoice {
  return {
    selector: config.voice ?? websiteDefault.name,
    pitch: config.pitch ?? websiteDefault.pitch,
    rate: config.rate ?? websiteDefault.rate,
    volume: config.volume ?? websiteDefault.volume,
  };
}
