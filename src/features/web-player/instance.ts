import { getEstimatedTimeLengthWithRate } from '@responsivevoice/text';
import type { WebPlayerFeature as WebPlayerConfig } from '@responsivevoice/types';
import type { SpeakFn, SpeakHandle } from '../../types';
import { readableText } from '../../utils/readable-text';
import type { ResolvedWebPlayerVoice } from '../web-player';
import { ICONS } from './icons';
import { applyTheme, clearTheme, resolveTheme } from './themes';
import { buildShadowRoot, type PlayerHandles, RING_CIRCUMFERENCE, setButtonIcon } from './ui';

const SPEED_PRESETS = [
  0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2, 2.5, 3,
] as const;
const DEFAULT_SPEED_INDEX = 5; // 1×
const ENGINE_RATE_MIN = 0.1;
const ENGINE_RATE_MAX = 1.5;

/**
 * Single mounted player attached to one article element. Owns its own DOM
 * (host + shadow root + paragraph wrappers) and playback state, and reports
 * activations back to its orchestrator so sibling instances can be reset.
 */
export class WebPlayerInstance {
  private host: HTMLElement | null = null;
  private handles: PlayerHandles | null = null;
  private observer: IntersectionObserver | null = null;
  private paragraphs: HTMLElement[] = [];
  private durations: number[] = [];

  private currentIndex = 0;
  private playing = false;
  private speaking = false;
  private paused = false;
  private complete = false;
  private speedIndex = DEFAULT_SPEED_INDEX;

  private currentHandle: SpeakHandle | null = null;
  private rafHandle: number | null = null;
  private startedAt = 0;
  private completedMs = 0;
  private totalMs = 0;

  private cleanupFns: (() => void)[] = [];
  private destroyed = false;

  /**
   * Tracks the most recent IntersectionObserver visibility for the host.
   * `true` until the observer says otherwise — the host is initially in the
   * DOM where the publisher placed it, so we assume visible until proven
   * otherwise. Used so play-state changes can update mini visibility without
   * waiting for the next intersection event.
   */
  private hostVisible = true;

  constructor(
    private readonly article: HTMLElement,
    private readonly config: WebPlayerConfig,
    private readonly speak: SpeakFn,
    private readonly voice: ResolvedWebPlayerVoice,
    /** Called when this instance starts speaking — orchestrator preempts siblings. */
    private readonly onActivate: () => void
  ) {}

  /**
   * Mounts the player DOM into the page. Returns `true` on successful mount,
   * `false` when there are no narratable paragraphs to bind to (caller should
   * discard the instance).
   */
  mount(): boolean {
    const { paragraphSelector, position, theme, controls, navigation, layout, miniPlayer } =
      this.config;

    const rawParagraphs = Array.from(
      this.article.querySelectorAll<HTMLElement>(paragraphSelector)
    ).filter((p) => {
      if (p.closest('[data-rv-skip]')) return false;
      return readableText(p, this.config.sanitize).length > 0;
    });
    if (rawParagraphs.length === 0) return false;

    this.paragraphs = rawParagraphs.map((el, i) => this.wrapParagraph(el, i, navigation));
    this.recomputeDurations();

    const tokens = resolveTheme(theme);
    applyTheme(this.article, tokens);
    this.cleanupFns.push(() => clearTheme(this.article));

    this.host = document.createElement('div');
    this.host.setAttribute('data-rv-web-player', '');
    applyTheme(this.host, tokens);
    this.mountHost(position);

    const useBrandIcon = theme === 'responsivevoice';
    this.handles = buildShadowRoot(this.host, { controls, layout, miniPlayer, useBrandIcon });
    this.wireHandles();
    if (miniPlayer.enabled) this.observeMainPlayer();
    this.render();
    return true;
  }

  /** Full teardown: cancel speech, remove DOM, unwrap paragraphs. */
  cleanup(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.cancelCurrent();

    for (const fn of this.cleanupFns.splice(0)) {
      try {
        fn();
      } catch {
        // Don't let one failing teardown block the rest.
      }
    }

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    for (const p of this.paragraphs) this.unwrapParagraph(p);
    this.paragraphs = [];
    this.durations = [];

    if (this.host?.parentNode) this.host.parentNode.removeChild(this.host);
    this.host = null;
    this.handles = null;
  }

  /**
   * Reset UI to idle without tearing down. Called by the orchestrator when a
   * sibling instance starts speaking. The cancelled utterance's `onend` is
   * already swallowed by core (per-utterance identity), so this exists only
   * to clear our own UI flags.
   */
  preempt(): void {
    if (this.destroyed) return;
    this.cancelCurrent();
    this.playing = false;
    this.paused = false;
    this.speaking = false;
    this.complete = false;
    this.completedMs = 0;
    this.currentIndex = 0;
    this.render();
  }

  /** Has this instance already torn down? Orchestrator uses this to filter live entries. */
  get isDestroyed(): boolean {
    return this.destroyed;
  }

  /** True if this instance is bound to the given article element. */
  ownsArticle(element: HTMLElement): boolean {
    return this.article === element;
  }

  /**
   * Called from any callback that fires after mount when the host has been
   * detached from the DOM. Idempotent; safe to call repeatedly.
   */
  private selfDestruct(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelCurrent();
    for (const fn of this.cleanupFns.splice(0)) {
      try {
        fn();
      } catch {
        // ignore
      }
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    // Don't touch DOM — host is already detached. Don't unwrap paragraphs
    // either — they may have been removed along with the host.
    this.handles = null;
  }

  /** Returns true if the host has been detached; runs selfDestruct if so. */
  private isAlive(): boolean {
    if (this.destroyed) return false;
    if (this.host && !this.host.isConnected) {
      this.selfDestruct();
      return false;
    }
    return true;
  }

  // --- DOM helpers -------------------------------------------------------

  private mountHost(position: WebPlayerConfig['position']): void {
    if (!this.host) return;
    if (typeof position === 'string') {
      this.mountHostKeyword(position);
      return;
    }
    const target = document.querySelector(position.target);
    if (!target) {
      console.warn(
        `[ResponsiveVoice] web-player: position.target "${position.target}" did not match any element; falling back to "before".`
      );
      this.mountHostKeyword('before');
      return;
    }
    this.mountHostAtTarget(target, position.at);
  }

  private mountHostKeyword(position: 'inline' | 'before' | 'after'): void {
    if (!this.host) return;
    if (position === 'before') {
      this.article.parentNode?.insertBefore(this.host, this.article);
    } else if (position === 'after') {
      this.article.parentNode?.insertBefore(this.host, this.article.nextSibling);
    } else {
      this.article.insertBefore(this.host, this.article.firstChild);
    }
  }

  private mountHostAtTarget(target: Element, at: 'inside' | 'before' | 'after'): void {
    if (!this.host) return;
    if (at === 'before') {
      target.parentNode?.insertBefore(this.host, target);
    } else if (at === 'after') {
      target.parentNode?.insertBefore(this.host, target.nextSibling);
    } else {
      target.insertBefore(this.host, target.firstChild);
    }
  }

  private wrapParagraph(
    el: HTMLElement,
    index: number,
    nav: WebPlayerConfig['navigation']
  ): HTMLElement {
    if (!nav.paragraphHighlight && !nav.paragraphClick) {
      // Both nav modes off — paragraphs stay as inert text. We still keep the
      // element reference so speakCurrent() can read its textContent.
      return el;
    }

    el.setAttribute('data-rv-player-para', String(index));

    if (nav.paragraphHighlight) {
      el.setAttribute('data-rv-active', 'false');
    }

    if (nav.paragraphClick) {
      el.setAttribute('data-rv-clickable', 'true');
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `Play from paragraph ${index + 1}`);

      const onClick = (e: Event) => {
        e.stopPropagation();
        if (!this.isAlive()) return;
        this.jumpTo(index);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        if (!this.isAlive()) return;
        this.jumpTo(index);
      };
      el.addEventListener('click', onClick);
      el.addEventListener('keydown', onKey);
      this.cleanupFns.push(() => el.removeEventListener('click', onClick));
      this.cleanupFns.push(() => el.removeEventListener('keydown', onKey));
    }

    return el;
  }

  private unwrapParagraph(el: HTMLElement): void {
    el.removeAttribute('data-rv-player-para');
    el.removeAttribute('data-rv-active');
    el.removeAttribute('data-rv-clickable');
    el.removeAttribute('tabindex');
    el.removeAttribute('role');
    el.removeAttribute('aria-label');
  }

  private wireHandles(): void {
    const h = this.handles;
    if (!h) return;

    const onPlayClick = () => {
      if (!this.isAlive()) return;
      this.togglePlay();
    };
    h.playBtn.addEventListener('click', onPlayClick);
    this.cleanupFns.push(() => h.playBtn.removeEventListener('click', onPlayClick));

    if (h.miniPlayBtn) {
      const btn = h.miniPlayBtn;
      const onMiniClick = () => {
        if (!this.isAlive()) return;
        this.togglePlay();
      };
      btn.addEventListener('click', onMiniClick);
      this.cleanupFns.push(() => btn.removeEventListener('click', onMiniClick));
    }

    if (h.speedBtn) {
      const btn = h.speedBtn;
      const onSpeedClick = () => {
        if (!this.isAlive()) return;
        this.cycleSpeed();
      };
      btn.addEventListener('click', onSpeedClick);
      this.cleanupFns.push(() => btn.removeEventListener('click', onSpeedClick));
    }

    if (h.skipBackBtn) {
      const btn = h.skipBackBtn;
      const onBack = () => {
        if (!this.isAlive()) return;
        this.skipBack();
      };
      btn.addEventListener('click', onBack);
      this.cleanupFns.push(() => btn.removeEventListener('click', onBack));
    }

    if (h.skipForwardBtn) {
      const btn = h.skipForwardBtn;
      const onForward = () => {
        if (!this.isAlive()) return;
        this.skipForward();
      };
      btn.addEventListener('click', onForward);
      this.cleanupFns.push(() => btn.removeEventListener('click', onForward));
    }
  }

  private observeMainPlayer(): void {
    if (!this.host || typeof IntersectionObserver === 'undefined') return;
    this.observer = new IntersectionObserver(
      (entries) => {
        if (!this.isAlive()) return;
        for (const entry of entries) {
          this.hostVisible = entry.isIntersecting;
        }
        this.updateMiniVisibility();
      },
      { threshold: 0 }
    );
    this.observer.observe(this.host);
  }

  /**
   * Updates the mini-player's data-visible attribute from the current
   * play/intersection state. Call after any state change that should affect
   * mini visibility — play-state transitions, intersection events, preempts.
   */
  private updateMiniVisibility(): void {
    if (!this.handles?.miniPlayer) return;
    // Mini surfaces only during active narration — once playback ends, the
    // mini dismounts so completed players don't leave a leftover floating
    // control behind.
    const showMini = !this.hostVisible && (this.playing || this.speaking) && !this.complete;
    this.handles.miniPlayer.setAttribute('data-visible', showMini ? 'true' : 'false');
  }

  // --- Playback state machine --------------------------------------------

  private togglePlay(): void {
    if (this.complete) {
      this.replay();
      return;
    }
    if (this.paused) {
      // Resume the suspended utterance in place — continues from the exact
      // word where it was paused rather than restarting the paragraph.
      this.resumeEngine();
      this.render();
      return;
    }
    if (this.speaking) {
      this.pauseEngine();
      this.render();
      return;
    }
    // Start: was stopped (either fresh or after a cancel).
    this.playing = true;
    this.onActivate();
    this.speakCurrent();
    this.render();
  }

  private pauseEngine(): void {
    if (!this.currentHandle) return;
    this.paused = true;
    this.stopProgressLoop();
    try {
      this.currentHandle.pause();
    } catch {
      this.cancelCurrent();
    }
  }

  private resumeEngine(): void {
    if (!this.currentHandle) {
      this.paused = false;
      this.playing = true;
      this.speakCurrent();
      return;
    }
    this.paused = false;
    this.startProgressLoop();
    try {
      this.currentHandle.resume();
    } catch {
      this.cancelCurrent();
      if (this.playing) this.speakCurrent();
    }
  }

  private replay(): void {
    this.cancelCurrent();
    this.complete = false;
    this.completedMs = 0;
    this.currentIndex = 0;
    this.playing = true;
    this.onActivate();
    this.speakCurrent();
    this.render();
  }

  private skipBack(): void {
    this.jumpTo(Math.max(0, this.currentIndex - 1));
  }

  private skipForward(): void {
    this.jumpTo(Math.min(this.paragraphs.length - 1, this.currentIndex + 1));
  }

  private jumpTo(index: number): void {
    const target = Math.max(0, Math.min(this.paragraphs.length - 1, index));
    this.cancelCurrent();
    this.currentIndex = target;
    this.completedMs = this.durations.slice(0, target).reduce((a, b) => a + b, 0);
    this.complete = false;
    if (this.playing) {
      this.onActivate();
      this.speakCurrent();
    }
    this.render();
  }

  private cycleSpeed(): void {
    this.speedIndex = (this.speedIndex + 1) % SPEED_PRESETS.length;
    this.recomputeDurations();
    this.completedMs = this.durations.slice(0, this.currentIndex).reduce((a, b) => a + b, 0);

    if (this.speaking) {
      this.cancelCurrent();
      if (this.playing) this.speakCurrent();
    }

    this.render();
  }

  private speakCurrent(): void {
    const el = this.paragraphs[this.currentIndex];
    const text = el ? readableText(el, this.config.sanitize) : '';
    if (!text) {
      this.onCompleted();
      return;
    }
    this.speaking = true;
    this.startedAt = performance.now();
    this.startProgressLoop();
    this.currentHandle = this.speak(text, this.voice.selector, {
      rate: this.clampedEngineRate(),
      pitch: this.voice.pitch,
      volume: this.voice.volume,
      onstart: () => {
        if (!this.isAlive()) return;
        this.render();
      },
      onend: () => {
        if (!this.isAlive()) return;
        this.onCompleted();
      },
      onerror: () => {
        if (!this.isAlive()) return;
        this.handleError();
      },
    });
  }

  private cancelCurrent(): void {
    if (this.currentHandle) {
      try {
        this.currentHandle.cancel();
      } catch {
        // Defensive: a broken handle shouldn't break cleanup flow.
      }
      this.currentHandle = null;
    }
    this.speaking = false;
    this.paused = false;
    this.stopProgressLoop();
  }

  private onCompleted(): void {
    this.speaking = false;
    this.currentHandle = null;
    this.completedMs += this.durations[this.currentIndex] ?? 0;
    this.stopProgressLoop();

    if (this.currentIndex < this.paragraphs.length - 1) {
      this.currentIndex += 1;
      if (this.playing) this.speakCurrent();
      this.render();
      return;
    }

    if (this.playing) {
      this.playing = false;
      this.complete = true;
    }
    this.render();
  }

  private handleError(): void {
    this.speaking = false;
    this.playing = false;
    this.currentHandle = null;
    this.stopProgressLoop();
    this.render();
  }

  private recomputeDurations(): void {
    this.durations = this.paragraphs.map((p) =>
      getEstimatedTimeLengthWithRate(readableText(p, this.config.sanitize), this.currentRate())
    );
    this.totalMs = this.durations.reduce((a, b) => a + b, 0);
  }

  // --- Progress animation ------------------------------------------------

  private startProgressLoop(): void {
    this.stopProgressLoop();
    const tick = () => {
      if (!this.isAlive()) return;
      this.render();
      if (this.speaking) this.rafHandle = requestAnimationFrame(tick);
    };
    this.rafHandle = requestAnimationFrame(tick);
  }

  private stopProgressLoop(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  // --- Rendering ---------------------------------------------------------

  private render(): void {
    if (!this.handles) return;
    const playedMs = this.renderProgress();
    this.renderHighlights();
    this.renderControls(playedMs);
    this.updateMiniVisibility();
  }

  private renderHighlights(): void {
    if (!this.config.navigation.paragraphHighlight) return;
    const activeIdx = this.currentIndex;
    const isActive = this.speaking || this.playing;
    for (let i = 0; i < this.paragraphs.length; i++) {
      this.paragraphs[i]?.setAttribute(
        'data-rv-active',
        i === activeIdx && isActive ? 'true' : 'false'
      );
    }
  }

  private renderProgress(): number {
    const h = this.handles;
    if (!h) return 0;
    const elapsed = this.currentParagraphElapsed();
    const currentMs = Math.min(elapsed, this.durations[this.currentIndex] ?? 0);
    const playedMs = this.complete ? this.totalMs : this.completedMs + currentMs;
    const fraction = this.totalMs > 0 ? Math.min(1, playedMs / this.totalMs) : 0;

    if (h.progressFill) h.progressFill.style.width = `${fraction * 100}%`;
    if (h.miniRingFill) {
      // Inline style — `setAttribute('stroke-dashoffset', ...)` is overridden by the class rule for SVG presentation attributes.
      h.miniRingFill.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - fraction));
    }
    if (h.timeLabel) h.timeLabel.textContent = `${fmtMs(playedMs)} / ${fmtMs(this.totalMs)}`;
    return playedMs;
  }

  private renderControls(playedMs: number): void {
    const h = this.handles;
    if (!h) return;
    this.renderSpeed(h);
    this.renderPlayButtons(h);
    this.renderSkipButtons(h);
    this.renderMiniPopup(h, playedMs);
  }

  private renderSpeed(h: PlayerHandles): void {
    if (!h.speedBtn) return;
    const activeSpeed = SPEED_PRESETS[this.speedIndex] ?? 1;
    h.speedBtn.textContent = formatSpeedLabel(activeSpeed);
    h.speedBtn.setAttribute('aria-label', `Playback speed ${activeSpeed}×, click to change`);
  }

  private renderPlayButtons(h: PlayerHandles): void {
    const { icon, label } = PLAY_BUTTON_STATE[this.playButtonMode()];
    setButtonIcon(h.playBtn, icon);
    h.playBtn.setAttribute('aria-label', label);
    if (h.miniPlayBtn) {
      setButtonIcon(h.miniPlayBtn, icon);
      h.miniPlayBtn.setAttribute('aria-label', label);
    }
  }

  private renderSkipButtons(h: PlayerHandles): void {
    const atFirst = this.currentIndex === 0;
    const atLast = this.currentIndex === this.paragraphs.length - 1;
    if (h.skipBackBtn) {
      h.skipBackBtn.toggleAttribute('disabled', atFirst);
      h.skipBackBtn.setAttribute(
        'aria-label',
        atFirst ? 'Previous paragraph (at start)' : 'Previous paragraph'
      );
    }
    if (h.skipForwardBtn) {
      h.skipForwardBtn.toggleAttribute('disabled', atLast);
      h.skipForwardBtn.setAttribute(
        'aria-label',
        atLast ? 'Next paragraph (at end)' : 'Next paragraph'
      );
    }
  }

  private renderMiniPopup(h: PlayerHandles, playedMs: number): void {
    if (h.miniPopupStatus) h.miniPopupStatus.textContent = this.statusLabel();
    if (h.miniPopupTime) h.miniPopupTime.textContent = ` · ${fmtMs(playedMs)}`;
  }

  private playButtonMode(): 'play' | 'pause' | 'replay' {
    if (this.complete) return 'replay';
    if (this.paused) return 'play';
    if (this.speaking || this.playing) return 'pause';
    return 'play';
  }

  private statusLabel(): string {
    if (this.complete) return 'Completed';
    if (this.paused) return 'Paused';
    if (this.speaking || this.playing) return 'Playing';
    return 'Paused';
  }

  private currentParagraphElapsed(): number {
    if (!this.speaking) return 0;
    return performance.now() - this.startedAt;
  }

  private currentRate(): number {
    const voiceRate = this.voice.rate ?? 1;
    const speed = SPEED_PRESETS[this.speedIndex] ?? 1;
    return voiceRate * speed;
  }

  private clampedEngineRate(): number {
    const r = this.currentRate();
    return Math.max(ENGINE_RATE_MIN, Math.min(ENGINE_RATE_MAX, r));
  }
}

const PLAY_BUTTON_STATE: Record<'play' | 'pause' | 'replay', { icon: string; label: string }> = {
  play: { icon: ICONS.play, label: 'Play article' },
  pause: { icon: ICONS.pause, label: 'Pause narration' },
  replay: { icon: ICONS.replay, label: 'Replay from the start' },
};

function fmtMs(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatSpeedLabel(speed: number): string {
  return `${speed}×`;
}
