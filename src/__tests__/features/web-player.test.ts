import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebPlayerFeature } from '../../features/web-player';
import { resolveSlideEdge } from '../../features/web-player/ui';
import type { SpeakFn, SpeakHandle, SpeakParams } from '../../types';
import { makeConfig, makeVoice } from '../fixtures';

// jsdom doesn't ship IntersectionObserver; give it a no-op.
class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb;
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
  root = null;
  rootMargin = '';
  thresholds = [];
}

/**
 * Stateful fake engine modelled on how the real core handles `rv.speak()` /
 * `rv.cancel()`: speak enqueues an utterance, cancel terminates the active
 * utterance WITHOUT firing its `onend`, completeCurrent / errorCurrent
 * simulate natural completion or an engine error.
 *
 * This lets tests assert mid-utterance behaviour (cancel on pause/skip/jump)
 * the way it actually happens in a browser — not under the vi.fn() mocks'
 * false instantaneous timing.
 */
interface FakeEngine {
  speak: SpeakFn;
  utterances: Utterance[];
  cancelCount: number;
  pauseCount: number;
  resumeCount: number;
  current(): Utterance | null;
  completeCurrent(): void;
  errorCurrent(message?: string): void;
}

interface Utterance {
  text: string;
  voice?: string;
  params?: SpeakParams;
  cancelled: boolean;
  ended: boolean;
  paused: boolean;
}

function createFakeEngine(): FakeEngine {
  const engine: FakeEngine = {
    utterances: [],
    cancelCount: 0,
    pauseCount: 0,
    resumeCount: 0,
    current() {
      const u = engine.utterances[engine.utterances.length - 1];
      return u && !u.cancelled && !u.ended ? u : null;
    },
    completeCurrent() {
      const u = engine.current();
      if (!u) return;
      u.ended = true;
      u.params?.onend?.();
    },
    errorCurrent(message = 'engine error') {
      const u = engine.current();
      if (!u) return;
      u.ended = true;
      u.params?.onerror?.(new Error(message));
    },
    speak(text, voice, params): SpeakHandle {
      const utterance: Utterance = {
        text,
        voice,
        params,
        cancelled: false,
        ended: false,
        paused: false,
      };
      engine.utterances.push(utterance);
      // Real core fires `onstart` synchronously inside speak() before
      // returning the handle; we do the same so the feature's render
      // reflects speaking state immediately.
      queueMicrotask(() => {
        if (!utterance.cancelled && !utterance.ended) params?.onstart?.();
      });
      return {
        cancel() {
          if (utterance.ended) return;
          utterance.cancelled = true;
          engine.cancelCount += 1;
          // Cancellation does NOT fire onend — matching core's cancel(),
          // which nulls currentCallbacks before any further events fire.
        },
        pause() {
          if (utterance.ended || utterance.cancelled) return;
          utterance.paused = true;
          engine.pauseCount += 1;
          // Pause keeps the utterance alive; onend fires only when
          // completeCurrent() runs AFTER a resume.
        },
        resume() {
          if (utterance.ended || utterance.cancelled) return;
          utterance.paused = false;
          engine.resumeCount += 1;
        },
      };
    },
  };
  return engine;
}

describe('WebPlayerFeature', () => {
  let feature: WebPlayerFeature;
  let engine: FakeEngine;

  const ENABLED_CONFIG = {
    webPlayer: {
      enabled: true,
      selector: 'article',
      paragraphSelector: 'p',
      position: 'before' as const,
      theme: 'neutral' as const,
      controls: {
        progress: true,
        time: true,
        skip: true,
        speed: true,
        brand: true,
      },
      navigation: {
        paragraphHighlight: true,
        paragraphClick: true,
      },
      layout: {
        mode: 'shrink' as const,
        display: 'block' as const,
      },
      miniPlayer: { enabled: true, position: 'bottom-left' as const, animation: 'slide' as const },
      sanitize: { enabled: true, exclude: [] as string[] },
    },
  };

  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

    // Production uses `attachShadow({ mode: 'closed' })`; patch so tests can
    // reach in without loosening the real code's isolation.
    const originalAttachShadow = Element.prototype.attachShadow;
    vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (
      this: Element,
      init: ShadowRootInit
    ) {
      const root = originalAttachShadow.call(this, init);
      (this as unknown as { __rvShadowRoot: ShadowRoot }).__rvShadowRoot = root;
      return root;
    });

    feature = new WebPlayerFeature();
    engine = createFakeEngine();

    const article = document.createElement('article');
    article.innerHTML = `
      <p>First paragraph of the article.</p>
      <p>Second paragraph with more content to narrate.</p>
      <div data-rv-skip><p>This is a pull quote and should not be read.</p></div>
      <p>Third and final paragraph.</p>
    `;
    document.body.appendChild(article);
  });

  afterEach(() => {
    feature.cleanup();
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // ---- Activation / wiring ------------------------------------------------

  it('does not activate when disabled', () => {
    feature.init(
      makeConfig({ webPlayer: { ...ENABLED_CONFIG.webPlayer, enabled: false } }),
      engine.speak,
      makeVoice()
    );
    expect(feature.active).toBe(false);
    expect(document.querySelector('[data-rv-web-player]')).toBeNull();
  });

  it('does not activate when no matching article', () => {
    document.body.innerHTML = '<div>no article here</div>';
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());
    expect(feature.active).toBe(false);
  });

  it('mounts host before the article and wraps narratable paragraphs', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());

    expect(feature.active).toBe(true);
    expect(document.querySelector('[data-rv-web-player]')).not.toBeNull();

    const wrapped = document.querySelectorAll('[data-rv-player-para]');
    expect(wrapped).toHaveLength(3); // pull-quote excluded
    expect(wrapped[0]?.textContent).toContain('First paragraph');
    expect(wrapped[2]?.textContent).toContain('Third and final');
  });

  it('excludes paragraphs under [data-rv-skip]', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());

    const wrappedTexts = Array.from(document.querySelectorAll('[data-rv-player-para]'))
      .map((n) => n.textContent ?? '')
      .join(' ');
    expect(wrappedTexts).not.toContain('pull quote');
  });

  it('does not narrate <style>, <script>, or control text inside matched paragraphs', () => {
    document.body.innerHTML = `
      <article>
        <p>Real prose paragraph.</p>
        <p><style>.poweredby{float:right;width:100px}</style></p>
        <p><script>var voicelist = responsiveVoice.getVoices();</script></p>
        <p><button><a href="/">YES, SHOW ME HOW!</a></button></p>
      </article>
    `;
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());

    clickPlay();
    for (let i = 0; i < 6; i++) engine.completeCurrent();

    const spoken = engine.utterances.map((u) => u.text).join(' ');
    expect(spoken).toContain('Real prose paragraph');
    expect(spoken).not.toContain('float:right');
    expect(spoken).not.toContain('getVoices');
    expect(spoken).not.toContain('SHOW ME HOW');

    const wrapped = document.querySelectorAll('[data-rv-player-para]');
    expect(wrapped).toHaveLength(1);
  });

  it('narrates raw text when sanitize.enabled is false', () => {
    document.body.innerHTML = `
      <article><p>Prose.<style>.x{float:right}</style></p></article>
    `;
    feature.init(
      makeConfig({
        webPlayer: { ...ENABLED_CONFIG.webPlayer, sanitize: { enabled: false, exclude: [] } },
      }),
      engine.speak,
      makeVoice()
    );

    clickPlay();
    for (let i = 0; i < 4; i++) engine.completeCurrent();

    const spoken = engine.utterances.map((u) => u.text).join(' ');
    expect(spoken).toContain('float:right');
  });

  it('strips additional sanitize.exclude selectors', () => {
    document.body.innerHTML = `
      <article><p>Keep this.<span class="ad">promo noise</span></p></article>
    `;
    feature.init(
      makeConfig({
        webPlayer: { ...ENABLED_CONFIG.webPlayer, sanitize: { enabled: true, exclude: ['.ad'] } },
      }),
      engine.speak,
      makeVoice()
    );

    clickPlay();
    const spoken = engine.utterances.map((u) => u.text).join(' ');
    expect(spoken).toContain('Keep this');
    expect(spoken).not.toContain('promo noise');
  });

  it('marks paragraph wrappers with role=button and keyboard tabindex', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());

    const wrapped = document.querySelectorAll<HTMLElement>('[data-rv-player-para]');
    for (const el of wrapped) {
      expect(el.getAttribute('role')).toBe('button');
      expect(el.getAttribute('tabindex')).toBe('0');
      expect(el.getAttribute('aria-label')).toMatch(/^Play from paragraph \d+$/);
    }
  });

  // ---- Play / pause / resume --------------------------------------------

  it('speaks the first paragraph with voice name + params when play is clicked', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());

    clickPlay();
    expect(engine.utterances).toHaveLength(1);
    const u = engine.utterances[0];
    expect(u?.text).toContain('First paragraph');
    expect(u?.voice).toBe('UK English Female');
    expect(u?.params).toMatchObject({ pitch: 1, volume: 1 });
    expect(typeof u?.params?.onstart).toBe('function');
    expect(typeof u?.params?.onend).toBe('function');
    expect(typeof u?.params?.onerror).toBe('function');
  });

  it('play button aria-label and icon transition Play → Pause → Replay across the full run', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());

    expect(playBtnLabel()).toBe('Play article');

    clickPlay();
    expect(playBtnLabel()).toBe('Pause narration');
    expect(miniBtnLabel()).toBe('Pause narration');

    // Complete all three paragraphs.
    engine.completeCurrent(); // heading/p1
    engine.completeCurrent(); // p2
    engine.completeCurrent(); // p3 (last) → complete

    expect(playBtnLabel()).toBe('Replay from the start');
    expect(miniBtnLabel()).toBe('Replay from the start');

    // Replay resets and plays again.
    clickPlay();
    expect(playBtnLabel()).toBe('Pause narration');
    expect(engine.utterances.length).toBeGreaterThanOrEqual(4);
    expect(engine.utterances[3]?.text).toContain('First paragraph');
  });

  it('pause suspends the in-flight utterance WITHOUT cancelling it', () => {
    // Web Speech API's cancel() is unreliable mid-word across browsers; pause
    // uses speechSynthesis.pause() which reliably freezes the engine in place.
    // The feature must call handle.pause() on pause, not handle.cancel().
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());
    clickPlay();
    expect(engine.utterances).toHaveLength(1);
    expect(engine.cancelCount).toBe(0);

    clickPlay(); // pause
    expect(engine.pauseCount).toBe(1);
    expect(engine.cancelCount).toBe(0); // critical: no cancel
    expect(engine.utterances[0]?.paused).toBe(true);
    expect(engine.utterances[0]?.cancelled).toBe(false);
    // Button now offers resume, labelled Play.
    expect(playBtnLabel()).toBe('Play article');
  });

  it('resume continues the same paragraph from where pause suspended it', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());
    clickPlay(); // utt 1 (first paragraph)
    clickPlay(); // pause — suspends utt 1

    expect(engine.utterances).toHaveLength(1);
    expect(engine.utterances[0]?.paused).toBe(true);

    clickPlay(); // resume

    // No new speak call — the original utterance was resumed, not restarted.
    expect(engine.utterances).toHaveLength(1);
    expect(engine.resumeCount).toBe(1);
    expect(engine.utterances[0]?.paused).toBe(false);
    expect(playBtnLabel()).toBe('Pause narration');
  });

  it('pause → skip-forward cancels the paused utterance and starts the next', () => {
    // Skip while paused is a different action from resume-and-skip: it needs
    // to abandon the paused utterance and begin a fresh one on the next
    // paragraph. That path must call handle.cancel(), not pause().
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());
    clickPlay();
    clickPlay(); // pause

    clickSkipForward();

    expect(engine.cancelCount).toBe(1);
    expect(engine.utterances).toHaveLength(2);
    expect(engine.utterances[1]?.text).toContain('Second paragraph');
    expect(engine.utterances[1]?.paused).toBe(false);
  });

  // ---- Natural advance (onend chain) ------------------------------------

  it('narrates every paragraph in order then stops after the last onend', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());
    clickPlay();

    const spokenTexts: string[] = [];
    for (let i = 0; i < 3; i++) {
      expect(engine.utterances.length).toBe(i + 1);
      spokenTexts.push(engine.utterances[i]?.text ?? '');
      // Highlight should be on the current paragraph.
      const wrapped = document.querySelectorAll('[data-rv-player-para]');
      expect(wrapped[i]?.getAttribute('data-rv-active')).toBe('true');
      engine.completeCurrent();
    }

    expect(spokenTexts[0]).toContain('First paragraph');
    expect(spokenTexts[1]).toContain('Second paragraph');
    expect(spokenTexts[2]).toContain('Third and final');

    // After final completion no fourth speak, no paragraph highlighted,
    // play button flipped to Replay.
    expect(engine.utterances).toHaveLength(3);
    expect(engine.cancelCount).toBe(0);
    const allFlags = Array.from(document.querySelectorAll('[data-rv-player-para]')).map((n) =>
      n.getAttribute('data-rv-active')
    );
    expect(allFlags.every((v) => v === 'false')).toBe(true);
    expect(playBtnLabel()).toBe('Replay from the start');
  });

  // ---- Skip forward / back ----------------------------------------------

  it('skip-forward cancels the current utterance and starts the next immediately', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());
    clickPlay();
    expect(engine.utterances).toHaveLength(1);

    clickSkipForward();

    expect(engine.cancelCount).toBe(1);
    expect(engine.utterances).toHaveLength(2);
    expect(engine.utterances[1]?.text).toContain('Second paragraph');
    // We didn't wait for onend — advance is mid-utterance.
    expect(engine.utterances[0]?.cancelled).toBe(true);
  });

  it('skip-back cancels the current utterance and starts the previous immediately', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());
    clickPlay();
    engine.completeCurrent(); // advance to paragraph 2
    expect(engine.utterances).toHaveLength(2);
    expect(engine.utterances[1]?.text).toContain('Second paragraph');

    clickSkipBack();

    expect(engine.cancelCount).toBe(1);
    expect(engine.utterances).toHaveLength(3);
    expect(engine.utterances[2]?.text).toContain('First paragraph');
  });

  it('skip-back at the first paragraph is a no-op with disabled attribute', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());
    clickPlay();
    // Already on paragraph 0 — skip-back should clamp.
    expect(skipBackBtn().hasAttribute('disabled')).toBe(true);
    clickSkipBack();
    // Cancel did happen (re-speaking the same paragraph) but index didn't move.
    expect(engine.utterances[engine.utterances.length - 1]?.text).toContain('First paragraph');
  });

  it('skip-forward at the last paragraph is disabled', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());
    clickPlay();
    engine.completeCurrent();
    engine.completeCurrent();
    // Now on last paragraph.
    expect(skipForwardBtn().hasAttribute('disabled')).toBe(true);
  });

  // ---- Click-to-jump ----------------------------------------------------

  it('clicking a paragraph cancels current and jumps to that paragraph', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());
    clickPlay();
    const wrapped = document.querySelectorAll<HTMLElement>('[data-rv-player-para]');
    const thirdParagraph = wrapped[2];
    expect(thirdParagraph).toBeDefined();
    thirdParagraph?.click();

    expect(engine.cancelCount).toBe(1);
    expect(engine.utterances[engine.utterances.length - 1]?.text).toContain('Third and final');
  });

  it('Enter key on a paragraph wrapper triggers jump', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());
    clickPlay();
    const secondParagraph = document.querySelectorAll<HTMLElement>('[data-rv-player-para]')[1];
    secondParagraph?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(engine.cancelCount).toBe(1);
    expect(engine.utterances[engine.utterances.length - 1]?.text).toContain('Second paragraph');
  });

  // ---- Speed -----------------------------------------------------------

  it('cycles speed presets and cancels-then-respeaks with the new rate mid-playback', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());
    clickPlay();
    expect(engine.utterances[0]?.params?.rate).toBe(1); // default 1×

    clickSpeed(); // 1× → 1.1×
    expect(engine.cancelCount).toBe(1);
    expect(engine.utterances.length).toBe(2);
    expect(engine.utterances[1]?.params?.rate).toBeCloseTo(1.1, 5);
  });

  it('clamps engine rate to 1.5 when cycled past the engine ceiling', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());
    // Default index 5 (1×), last index 14 (3×) → 9 cycles to reach 3×.
    for (let i = 0; i < 9; i++) clickSpeed();

    clickPlay();
    expect(engine.utterances[0]?.params?.rate).toBe(1.5);
  });

  // ---- Error path ------------------------------------------------------

  it('onerror stops playback and flips to play state', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());
    clickPlay();
    expect(playBtnLabel()).toBe('Pause narration');

    engine.errorCurrent();

    expect(playBtnLabel()).toBe('Play article');
    expect(engine.utterances).toHaveLength(1); // didn't advance
  });

  // ---- Cancel-swallow semantics ----------------------------------------

  it('rapid skip-forward does not double-advance past the intended paragraph', () => {
    // Preempt semantics: the feature relies on core's per-utterance identity
    // (see `responsivevoice-core.ts:setupEngineCallbacks`) to swallow
    // cancelled utterances' onend events. Without that guarantee, a stray
    // cancelled-onend would advance the cursor a second time and double-skip.
    //
    // This test drives the fake engine exactly the way core does: the engine
    // contract is that cancel() does NOT fire onend, so the only way the
    // feature's `onCompleted` runs is via `completeCurrent()` on a live
    // utterance. We verify that a cancel+fresh-speak cycle produces exactly
    // one utterance-advance, not two.
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());
    clickPlay();
    const u0 = engine.utterances[0];
    expect(u0).toBeDefined();

    clickSkipForward();
    expect(u0?.cancelled).toBe(true);
    expect(engine.utterances).toHaveLength(2);
    expect(engine.utterances[1]?.text).toContain('Second paragraph');
    expect(engine.utterances[1]?.cancelled).toBe(false);

    // Completing the new (second) utterance should advance once to
    // paragraph 3, producing utterance 3 — not further, because the
    // cancelled u0's onend never fires.
    engine.completeCurrent();
    expect(engine.utterances).toHaveLength(3);
  });

  // ---- Theming --------------------------------------------------------

  it('default theme applies neutral tokens to the host element and article', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());

    const host = document.querySelector<HTMLElement>('[data-rv-web-player]');
    const article = document.querySelector<HTMLElement>('article');
    expect(host?.style.getPropertyValue('--rv-accent')).toBe('#ec4899');
    expect(host?.style.getPropertyValue('--rv-fg')).toBe('#0f172a');
    expect(article?.style.getPropertyValue('--rv-accent-soft')).toBe('#fce7f3');
  });

  it("'responsivevoice' preset applies the brand purple", () => {
    feature.init(
      makeConfig({ webPlayer: { ...ENABLED_CONFIG.webPlayer, theme: 'responsivevoice' } }),
      engine.speak,
      makeVoice()
    );

    const host = document.querySelector<HTMLElement>('[data-rv-web-player]');
    expect(host?.style.getPropertyValue('--rv-accent')).toBe('#7a57ee');
    expect(host?.style.getPropertyValue('--rv-fill')).toBe('#7a57ee');
  });

  it('partial token override merges over the neutral baseline', () => {
    feature.init(
      makeConfig({
        webPlayer: { ...ENABLED_CONFIG.webPlayer, theme: { accent: '#ff0000', fill: '#00ff00' } },
      }),
      engine.speak,
      makeVoice()
    );

    const host = document.querySelector<HTMLElement>('[data-rv-web-player]');
    expect(host?.style.getPropertyValue('--rv-accent')).toBe('#ff0000');
    expect(host?.style.getPropertyValue('--rv-fill')).toBe('#00ff00');
    // Untouched tokens fall back to neutral defaults.
    expect(host?.style.getPropertyValue('--rv-bg')).toBe('#ffffff');
    expect(host?.style.getPropertyValue('--rv-fg')).toBe('#0f172a');
  });

  it('cleanup removes theme custom properties from the article element', () => {
    feature.init(
      makeConfig({ webPlayer: { ...ENABLED_CONFIG.webPlayer, theme: 'responsivevoice' } }),
      engine.speak,
      makeVoice()
    );

    const article = document.querySelector<HTMLElement>('article');
    expect(article?.style.getPropertyValue('--rv-accent')).toBe('#7a57ee');

    feature.cleanup();

    expect(article?.style.getPropertyValue('--rv-accent')).toBe('');
  });

  // ---- Toggles: controls --------------------------------------------

  it('controls.progress=false omits progress track + fill from the shadow DOM', () => {
    feature.init(
      makeConfig({
        webPlayer: {
          ...ENABLED_CONFIG.webPlayer,
          controls: { ...ENABLED_CONFIG.webPlayer.controls, progress: false },
        },
      }),
      engine.speak,
      makeVoice()
    );
    expect(shadowRoot().querySelector('.rv-progress-track')).toBeNull();
    expect(shadowRoot().querySelector('.rv-progress-fill')).toBeNull();
  });

  it('controls.time=false omits the time label', () => {
    feature.init(
      makeConfig({
        webPlayer: {
          ...ENABLED_CONFIG.webPlayer,
          controls: { ...ENABLED_CONFIG.webPlayer.controls, time: false },
        },
      }),
      engine.speak,
      makeVoice()
    );
    expect(shadowRoot().querySelector('.rv-time')).toBeNull();
  });

  it('controls.progress=false with time=true renders time as a direct child of .rv-main (no flex-grow wrapper)', () => {
    feature.init(
      makeConfig({
        webPlayer: {
          ...ENABLED_CONFIG.webPlayer,
          controls: { ...ENABLED_CONFIG.webPlayer.controls, progress: false },
        },
      }),
      engine.speak,
      makeVoice()
    );
    expect(shadowRoot().querySelector('.rv-progress')).toBeNull();
    const timeLabel = shadowRoot().querySelector('.rv-time');
    expect(timeLabel).not.toBeNull();
    expect(timeLabel?.parentElement?.classList.contains('rv-main')).toBe(true);
  });

  it('controls.progress=false AND controls.time=false omits the entire progress wrapper', () => {
    feature.init(
      makeConfig({
        webPlayer: {
          ...ENABLED_CONFIG.webPlayer,
          controls: {
            ...ENABLED_CONFIG.webPlayer.controls,
            progress: false,
            time: false,
          },
        },
      }),
      engine.speak,
      makeVoice()
    );
    expect(shadowRoot().querySelector('.rv-progress')).toBeNull();
  });

  it('controls.skip=false omits both skip-back and skip-forward buttons', () => {
    feature.init(
      makeConfig({
        webPlayer: {
          ...ENABLED_CONFIG.webPlayer,
          controls: { ...ENABLED_CONFIG.webPlayer.controls, skip: false },
        },
      }),
      engine.speak,
      makeVoice()
    );
    expect(shadowAll('.rv-main .rv-btn--ghost')).toHaveLength(0);
  });

  it('controls.speed=false omits the speed cycler', () => {
    feature.init(
      makeConfig({
        webPlayer: {
          ...ENABLED_CONFIG.webPlayer,
          controls: { ...ENABLED_CONFIG.webPlayer.controls, speed: false },
        },
      }),
      engine.speak,
      makeVoice()
    );
    expect(shadowRoot().querySelector('.rv-speed')).toBeNull();
  });

  it('controls.brand=false omits the brand glyph', () => {
    feature.init(
      makeConfig({
        webPlayer: {
          ...ENABLED_CONFIG.webPlayer,
          controls: { ...ENABLED_CONFIG.webPlayer.controls, brand: false },
        },
      }),
      engine.speak,
      makeVoice()
    );
    expect(shadowRoot().querySelector('.rv-brand')).toBeNull();
  });

  it('all controls off leaves only the play button in the pill', () => {
    feature.init(
      makeConfig({
        webPlayer: {
          ...ENABLED_CONFIG.webPlayer,
          controls: {
            progress: false,
            time: false,
            skip: false,
            speed: false,
            brand: false,
          },
        },
      }),
      engine.speak,
      makeVoice()
    );
    expect(shadowAll('.rv-main > *')).toHaveLength(1);
    expect(shadowRoot().querySelector('.rv-main > .rv-btn')).not.toBeNull();
  });

  // ---- Toggles: navigation ------------------------------------------

  it('navigation.paragraphHighlight=false skips data-rv-active toggling', () => {
    feature.init(
      makeConfig({
        webPlayer: {
          ...ENABLED_CONFIG.webPlayer,
          navigation: {
            ...ENABLED_CONFIG.webPlayer.navigation,
            paragraphHighlight: false,
          },
        },
      }),
      engine.speak,
      makeVoice()
    );
    clickPlay();
    const paragraphs = document.querySelectorAll('[data-rv-player-para]');
    for (const p of paragraphs) {
      expect(p.getAttribute('data-rv-active')).toBeNull();
    }
  });

  it('navigation.paragraphClick=false leaves paragraphs without listeners and without role/tabindex', () => {
    feature.init(
      makeConfig({
        webPlayer: {
          ...ENABLED_CONFIG.webPlayer,
          navigation: {
            ...ENABLED_CONFIG.webPlayer.navigation,
            paragraphClick: false,
          },
        },
      }),
      engine.speak,
      makeVoice()
    );
    const para = document.querySelector('[data-rv-player-para]') as HTMLElement;
    expect(para.getAttribute('role')).toBeNull();
    expect(para.getAttribute('tabindex')).toBeNull();
    expect(para.getAttribute('data-rv-clickable')).toBeNull();

    clickPlay();
    const callsBefore = engine.utterances.length;
    para.click();
    expect(engine.utterances.length).toBe(callsBefore);
  });

  it('navigation.{both}=false leaves paragraphs as inert text — no data-rv-player-para attribute', () => {
    feature.init(
      makeConfig({
        webPlayer: {
          ...ENABLED_CONFIG.webPlayer,
          navigation: {
            paragraphHighlight: false,
            paragraphClick: false,
          },
        },
      }),
      engine.speak,
      makeVoice()
    );
    expect(document.querySelectorAll('[data-rv-player-para]')).toHaveLength(0);
  });

  // ---- Toggles: layout ----------------------------------------------

  it('layout defaults project shrink + block onto the host element', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());
    const host = document.querySelector('[data-rv-web-player]');
    expect(host?.getAttribute('data-rv-layout-mode')).toBe('shrink');
    expect(host?.getAttribute('data-rv-layout-display')).toBe('block');
  });

  it('layout.mode=fill sets data-rv-layout-mode="fill" on host', () => {
    feature.init(
      makeConfig({
        webPlayer: {
          ...ENABLED_CONFIG.webPlayer,
          layout: { ...ENABLED_CONFIG.webPlayer.layout, mode: 'fill' },
        },
      }),
      engine.speak,
      makeVoice()
    );
    expect(
      document.querySelector('[data-rv-web-player]')?.getAttribute('data-rv-layout-mode')
    ).toBe('fill');
  });

  it('layout.display=inline sets data-rv-layout-display="inline" on host', () => {
    feature.init(
      makeConfig({
        webPlayer: {
          ...ENABLED_CONFIG.webPlayer,
          layout: { ...ENABLED_CONFIG.webPlayer.layout, display: 'inline' },
        },
      }),
      engine.speak,
      makeVoice()
    );
    expect(
      document.querySelector('[data-rv-web-player]')?.getAttribute('data-rv-layout-display')
    ).toBe('inline');
  });

  it('miniPlayer.enabled=false omits mini-player surface and skips the IntersectionObserver', () => {
    feature.init(
      makeConfig({
        webPlayer: {
          ...ENABLED_CONFIG.webPlayer,
          miniPlayer: {
            enabled: false,
            position: 'bottom-left' as const,
            animation: 'slide' as const,
          },
        },
      }),
      engine.speak,
      makeVoice()
    );
    expect(shadowRoot().querySelector('.rv-mini')).toBeNull();
  });

  it('mini-player default corner sets data-position="bottom-left"', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());
    const mini = shadowRoot().querySelector<HTMLElement>('.rv-mini');
    expect(mini?.getAttribute('data-position')).toBe('bottom-left');
    expect(mini?.getAttribute('data-rv-mini-edge')).toBe('bottom');
    expect(mini?.style.top).toBe('');
    expect(mini?.style.right).toBe('');
  });

  it('mini-player corner override applies the matching data-position attribute', () => {
    feature.init(
      makeConfig({
        webPlayer: {
          ...ENABLED_CONFIG.webPlayer,
          miniPlayer: {
            enabled: true,
            position: 'top-right' as const,
            animation: 'slide' as const,
          },
        },
      }),
      engine.speak,
      makeVoice()
    );
    const mini = shadowRoot().querySelector<HTMLElement>('.rv-mini');
    expect(mini?.getAttribute('data-position')).toBe('top-right');
    expect(mini?.getAttribute('data-rv-mini-edge')).toBe('top');
  });

  it('mini-player offset object applies inline styles and data-position="custom"', () => {
    feature.init(
      makeConfig({
        webPlayer: {
          ...ENABLED_CONFIG.webPlayer,
          miniPlayer: {
            enabled: true,
            position: { top: '80px', right: '20px' },
            animation: 'slide' as const,
          },
        },
      }),
      engine.speak,
      makeVoice()
    );
    const mini = shadowRoot().querySelector<HTMLElement>('.rv-mini');
    expect(mini?.getAttribute('data-position')).toBe('custom');
    expect(mini?.getAttribute('data-rv-mini-edge')).toBe('top');
    expect(mini?.style.top).toBe('80px');
    expect(mini?.style.right).toBe('20px');
    expect(mini?.style.bottom).toBe('');
    expect(mini?.style.left).toBe('');
  });

  // jsdom has no layout engine, so getBoundingClientRect returns zeros and the
  // custom-offset edge resolves via the no-layout fallback (anchor token). The
  // measured path is covered by the resolveSlideEdge unit tests below.
  it('custom offset falls back to the anchor token when layout is unavailable', () => {
    const cases = [
      { position: { top: '50%', right: '20px' } as const, edge: 'top' },
      { position: { bottom: '120px', left: '24px' } as const, edge: 'bottom' },
      { position: { left: '24px' } as const, edge: 'bottom' }, // no vertical anchor → bottom
    ];
    for (const { position, edge } of cases) {
      feature.cleanup();
      document.body.innerHTML = '';
      const article = document.createElement('article');
      article.innerHTML = '<p>Para.</p>';
      document.body.appendChild(article);
      feature.init(
        makeConfig({
          webPlayer: {
            ...ENABLED_CONFIG.webPlayer,
            miniPlayer: { enabled: true, position, animation: 'slide' as const },
          },
        }),
        engine.speak,
        makeVoice()
      );
      const mini = shadowRoot().querySelector<HTMLElement>('.rv-mini');
      expect(mini?.getAttribute('data-rv-mini-edge')).toBe(edge);
    }
  });

  // Exercises the measured path (jsdom has no layout, so getBoundingClientRect
  // is mocked). The mock reports zeros for a detached element — as real browsers
  // do — so this also guards that measurement happens after the element is
  // attached, not before.
  it('custom offset measures the attached element to pick the slide edge', () => {
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains('rv-mini') && this.isConnected) {
          return new DOMRect(20, 640, 120, 40); // center 660 of a 768px viewport → bottom
        }
        return new DOMRect(0, 0, 0, 0);
      });
    feature.init(
      makeConfig({
        webPlayer: {
          ...ENABLED_CONFIG.webPlayer,
          miniPlayer: {
            enabled: true,
            position: { top: '80%', right: '20px' },
            animation: 'slide' as const,
          },
        },
      }),
      engine.speak,
      makeVoice()
    );
    const mini = shadowRoot().querySelector<HTMLElement>('.rv-mini');
    expect(mini?.getAttribute('data-rv-mini-edge')).toBe('bottom');
    rectSpy.mockRestore();
  });

  describe('resolveSlideEdge', () => {
    const VIEWPORT = 800;
    it('enters from the bottom when the element center is in the lower half', () => {
      expect(resolveSlideEdge(640, 40, VIEWPORT)).toBe('bottom'); // top: 80%
      expect(resolveSlideEdge(700, 40, VIEWPORT)).toBe('bottom'); // bottom corner
    });
    it('enters from the top when the element center is in the upper half', () => {
      expect(resolveSlideEdge(80, 40, VIEWPORT)).toBe('top'); // top: 10%
      expect(resolveSlideEdge(16, 40, VIEWPORT)).toBe('top'); // top corner
    });
    it('treats an exactly centered element as bottom', () => {
      expect(resolveSlideEdge(380, 40, VIEWPORT)).toBe('bottom'); // center at 400
    });
  });

  it('mini-player default animation projects data-rv-mini-anim="slide" onto host', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());
    const host = document.querySelector('[data-rv-web-player]');
    expect(host?.getAttribute('data-rv-mini-anim')).toBe('slide');
  });

  it('mini-player animation override sets the matching data-rv-mini-anim attribute', () => {
    for (const animation of ['none', 'fade', 'pop'] as const) {
      feature.cleanup();
      document.body.innerHTML = '';
      const article = document.createElement('article');
      article.innerHTML = '<p>Para.</p>';
      document.body.appendChild(article);
      feature.init(
        makeConfig({
          webPlayer: {
            ...ENABLED_CONFIG.webPlayer,
            miniPlayer: { ...ENABLED_CONFIG.webPlayer.miniPlayer, animation },
          },
        }),
        engine.speak,
        makeVoice()
      );
      expect(
        document.querySelector('[data-rv-web-player]')?.getAttribute('data-rv-mini-anim')
      ).toBe(animation);
    }
  });

  // ---- Main-player position object form -----------------------------

  it('position keyword form keeps article-relative mounting (regression)', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());
    const article = document.querySelector('article');
    const host = document.querySelector('[data-rv-web-player]');
    expect(host?.nextElementSibling).toBe(article);
  });

  it('position object form mounts inside a custom target by default', () => {
    const slot = document.createElement('div');
    slot.id = 'player-slot';
    document.body.appendChild(slot);

    feature.init(
      makeConfig({
        webPlayer: {
          ...ENABLED_CONFIG.webPlayer,
          position: { target: '#player-slot', at: 'inside' as const },
        },
      }),
      engine.speak,
      makeVoice()
    );

    const host = document.querySelector('[data-rv-web-player]');
    expect(host?.parentElement?.id).toBe('player-slot');
    expect(slot.firstElementChild).toBe(host);
  });

  it('position object form with at="after" mounts as next sibling of the target', () => {
    const header = document.createElement('header');
    header.id = 'site-header';
    document.body.insertBefore(header, document.body.firstChild);

    feature.init(
      makeConfig({
        webPlayer: {
          ...ENABLED_CONFIG.webPlayer,
          position: { target: '#site-header', at: 'after' as const },
        },
      }),
      engine.speak,
      makeVoice()
    );

    const host = document.querySelector('[data-rv-web-player]');
    expect(host?.previousElementSibling).toBe(header);
  });

  it('position object form with missing target falls back to keyword "before" and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    feature.init(
      makeConfig({
        webPlayer: {
          ...ENABLED_CONFIG.webPlayer,
          position: { target: '#does-not-exist', at: 'inside' as const },
        },
      }),
      engine.speak,
      makeVoice()
    );

    const article = document.querySelector('article');
    const host = document.querySelector('[data-rv-web-player]');
    expect(host?.nextElementSibling).toBe(article);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('position.target "#does-not-exist" did not match')
    );

    warnSpy.mockRestore();
  });

  // ---- Multi-mount --------------------------------------------------

  it('mounts a player on each top-level matching element', () => {
    const second = document.createElement('article');
    second.innerHTML = '<p>Sidebar paragraph one.</p><p>Sidebar paragraph two.</p>';
    document.body.appendChild(second);

    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());

    const hosts = document.querySelectorAll('[data-rv-web-player]');
    expect(hosts).toHaveLength(2);
    expect(feature.active).toBe(true);
  });

  it('filters nested matching elements — only outer mounts', () => {
    document.body.innerHTML = '';
    const outer = document.createElement('article');
    outer.innerHTML = '<p>Outer paragraph.</p>';
    const inner = document.createElement('article');
    inner.innerHTML = '<p>Inner paragraph.</p>';
    outer.appendChild(inner);
    document.body.appendChild(outer);

    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());

    expect(document.querySelectorAll('[data-rv-web-player]')).toHaveLength(1);
  });

  it('preempts sibling instances when one starts speaking', () => {
    const second = document.createElement('article');
    second.innerHTML = '<p>Sidebar paragraph one.</p><p>Sidebar paragraph two.</p>';
    document.body.appendChild(second);

    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());

    const hosts = document.querySelectorAll<HTMLElement>('[data-rv-web-player]');
    const firstPlay = hostShadowRoot(hosts[0] as HTMLElement).querySelector<HTMLButtonElement>(
      '.rv-main > .rv-btn'
    );
    firstPlay?.click();
    expect(engine.utterances).toHaveLength(1);

    const secondPlay = hostShadowRoot(hosts[1] as HTMLElement).querySelector<HTMLButtonElement>(
      '.rv-main > .rv-btn'
    );
    secondPlay?.click();
    // Second instance starting calls speak again; the first instance was
    // preempted, its handle cancelled.
    expect(engine.utterances).toHaveLength(2);
    expect(engine.cancelCount).toBeGreaterThanOrEqual(1);
  });

  it('cleanup tears down all instances', () => {
    const second = document.createElement('article');
    second.innerHTML = '<p>Sidebar paragraph.</p>';
    document.body.appendChild(second);

    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());
    expect(document.querySelectorAll('[data-rv-web-player]')).toHaveLength(2);

    feature.cleanup();
    expect(document.querySelectorAll('[data-rv-web-player]')).toHaveLength(0);
    expect(feature.active).toBe(false);
  });

  // ---- Imperative mount() API --------------------------------------

  it('mount(element) attaches a player on a dynamically-added element', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());

    const dynamic = document.createElement('section');
    dynamic.id = 'dynamic-area';
    dynamic.innerHTML = '<p>Dynamic content paragraph.</p>';
    document.body.appendChild(dynamic);

    const handle = feature.mount(dynamic);
    expect(handle).not.toBeNull();
    expect(document.querySelectorAll('[data-rv-web-player]')).toHaveLength(2);
  });

  it('mount(selector) resolves the element from a CSS selector', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());

    const dynamic = document.createElement('section');
    dynamic.id = 'dynamic-area';
    dynamic.innerHTML = '<p>Dynamic content paragraph.</p>';
    document.body.appendChild(dynamic);

    const handle = feature.mount('#dynamic-area');
    expect(handle).not.toBeNull();
    expect(document.querySelectorAll('[data-rv-web-player]')).toHaveLength(2);
  });

  it('mount() returns null when the element cannot be resolved', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());
    expect(feature.mount('#does-not-exist')).toBeNull();
  });

  it('mount() returns null when the feature is not enabled / not init', () => {
    // No feature.init() call
    const dynamic = document.createElement('section');
    dynamic.innerHTML = '<p>Dynamic content paragraph.</p>';
    document.body.appendChild(dynamic);
    expect(feature.mount(dynamic)).toBeNull();
  });

  it('mount() with overrides leaf-merges over the init config', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());

    const dynamic = document.createElement('section');
    dynamic.id = 'dynamic-aside';
    dynamic.innerHTML = '<p>Dynamic content paragraph.</p>';
    document.body.appendChild(dynamic);

    feature.mount(dynamic, { controls: { brand: false } });

    const dynamicHost = document.querySelectorAll<HTMLElement>('[data-rv-web-player]')[1];
    expect(dynamicHost).toBeDefined();
    const root = hostShadowRoot(dynamicHost as HTMLElement);
    // Brand off → no .rv-brand inside the dynamic player's pill
    expect(root.querySelector('.rv-brand')).toBeNull();
    // Other controls remain on (init defaults via leaf-merge)
    expect(root.querySelector('.rv-speed')).not.toBeNull();
  });

  it('mount() handle.unmount() removes the dynamic instance and leaves siblings intact', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());

    const dynamic = document.createElement('section');
    dynamic.innerHTML = '<p>Dynamic content paragraph.</p>';
    document.body.appendChild(dynamic);

    const handle = feature.mount(dynamic);
    expect(document.querySelectorAll('[data-rv-web-player]')).toHaveLength(2);

    handle?.unmount();
    expect(document.querySelectorAll('[data-rv-web-player]')).toHaveLength(1);
    expect(feature.active).toBe(true); // init-time instance still alive
  });

  it('mount() refuses to double-mount on the same element', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());

    const dynamic = document.createElement('section');
    dynamic.innerHTML = '<p>Dynamic content paragraph.</p>';
    document.body.appendChild(dynamic);

    const first = feature.mount(dynamic);
    expect(first).not.toBeNull();
    const duplicate = feature.mount(dynamic);
    expect(duplicate).toBeNull();
    expect(document.querySelectorAll('[data-rv-web-player]')).toHaveLength(2);
  });

  // ---- Cleanup --------------------------------------------------------

  it('cleanup cancels in-flight speech, removes host, unwraps paragraphs', () => {
    feature.init(makeConfig(ENABLED_CONFIG), engine.speak, makeVoice());
    clickPlay();
    expect(document.querySelector('[data-rv-web-player]')).not.toBeNull();
    expect(document.querySelectorAll('[data-rv-player-para]')).toHaveLength(3);

    feature.cleanup();

    expect(feature.active).toBe(false);
    expect(engine.cancelCount).toBe(1);
    expect(document.querySelector('[data-rv-web-player]')).toBeNull();
    expect(document.querySelectorAll('[data-rv-player-para]')).toHaveLength(0);
  });

  // ============ helpers ============

  function clickPlay(): void {
    shadowButton('.rv-main > .rv-btn').click();
  }
  function clickSpeed(): void {
    shadowButton('.rv-speed').click();
  }
  function clickSkipForward(): void {
    skipForwardBtn().click();
  }
  function clickSkipBack(): void {
    skipBackBtn().click();
  }
  function skipBackBtn(): HTMLButtonElement {
    return shadowAll<HTMLButtonElement>('.rv-main .rv-btn--ghost')[0] as HTMLButtonElement;
  }
  function skipForwardBtn(): HTMLButtonElement {
    return shadowAll<HTMLButtonElement>('.rv-main .rv-btn--ghost')[1] as HTMLButtonElement;
  }
  function playBtnLabel(): string {
    return shadowButton('.rv-main > .rv-btn').getAttribute('aria-label') ?? '';
  }
  function miniBtnLabel(): string {
    return shadowButton('.rv-mini-ring .ring-btn').getAttribute('aria-label') ?? '';
  }
  function shadowButton(selector: string): HTMLButtonElement {
    const btn = shadowRoot().querySelector<HTMLButtonElement>(selector);
    if (!btn) throw new Error(`no button found for selector ${selector}`);
    return btn;
  }
  function shadowAll<T extends Element>(selector: string): T[] {
    return Array.from(shadowRoot().querySelectorAll<T>(selector));
  }
  function shadowRoot(): ShadowRoot {
    const host = document.querySelector<HTMLElement>('[data-rv-web-player]');
    if (!host) throw new Error('player host not mounted');
    return hostShadowRoot(host);
  }
  function hostShadowRoot(host: HTMLElement): ShadowRoot {
    const patched = host as unknown as { __rvShadowRoot?: ShadowRoot };
    if (!patched.__rvShadowRoot) throw new Error('shadow root not captured');
    return patched.__rvShadowRoot;
  }
});
