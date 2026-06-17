import type { MiniPlayer } from '@responsivevoice/types';
import { ICONS } from './icons';
import { STYLES } from './styles';

/**
 * DOM handles returned by {@link buildShadowRoot}. Optional handles are
 * `null` when the corresponding control / surface is disabled by config —
 * the feature class uses presence checks rather than reaching through
 * potentially-missing references.
 */
export interface PlayerHandles {
  root: ShadowRoot;
  mainPlayer: HTMLElement;
  /** Always present — play/pause is mandatory. */
  playBtn: HTMLButtonElement;
  /** Present only when `controls.skip` is true. */
  skipBackBtn: HTMLButtonElement | null;
  /** Present only when `controls.skip` is true. */
  skipForwardBtn: HTMLButtonElement | null;
  /** Present only when `controls.speed` is true. */
  speedBtn: HTMLButtonElement | null;
  /** Present only when `controls.progress` is true. */
  progressFill: HTMLElement | null;
  /** Present only when `controls.time` is true. */
  timeLabel: HTMLElement | null;
  /** Present only when `miniPlayer.enabled` is true. */
  miniPlayer: HTMLElement | null;
  /** Present only when `miniPlayer.enabled` is true. */
  miniPlayBtn: HTMLButtonElement | null;
  /** Present only when `miniPlayer.enabled` is true. */
  miniRingFill: SVGCircleElement | null;
  /** Present only when `miniPlayer.enabled` is true. */
  miniPopupStatus: HTMLElement | null;
  /** Present only when `miniPlayer.enabled` is true. */
  miniPopupTime: HTMLElement | null;
}

/**
 * Configuration consumed by {@link buildShadowRoot} to decide which UI
 * elements to render. Mirrors the `controls` and `layout` schema groups.
 */
export interface BuildShadowRootOptions {
  controls: {
    progress: boolean;
    time: boolean;
    skip: boolean;
    speed: boolean;
    brand: boolean;
  };
  layout: {
    mode: 'shrink' | 'fill';
    display: 'inline' | 'block';
  };
  miniPlayer: MiniPlayer;
  /** True when theme is `'responsivevoice'` — render full brand mark; else neutral. */
  useBrandIcon: boolean;
}

/**
 * Builds the web player DOM inside a closed shadow root attached to `host`.
 * Caller owns the host and is responsible for removing it on cleanup.
 *
 * Each control is rendered conditionally based on `options.controls`. Mini
 * player surface is rendered conditionally based on `options.miniPlayer`.
 * Layout mode + display and the mini-player animation preset are projected
 * onto `:host` via `data-rv-layout-*` and `data-rv-mini-anim` attributes so
 * style rules can react via CSS without re-render.
 */
export function buildShadowRoot(host: HTMLElement, options: BuildShadowRootOptions): PlayerHandles {
  const { controls, layout, miniPlayer: miniPlayerConfig, useBrandIcon } = options;

  host.setAttribute('data-rv-layout-mode', layout.mode);
  host.setAttribute('data-rv-layout-display', layout.display);
  host.setAttribute('data-rv-mini-anim', miniPlayerConfig.animation);

  const root = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = STYLES;
  root.appendChild(style);

  const mainPlayer = el('div', {
    class: 'rv-main',
    role: 'region',
    'aria-label': 'Article player',
  });
  root.appendChild(mainPlayer);

  // Play/pause is mandatory — always rendered.
  const playBtn = buttonIcon(ICONS.play, 'Play article', 'rv-btn');
  mainPlayer.appendChild(playBtn);

  let speedBtn: HTMLButtonElement | null = null;
  if (controls.speed) {
    speedBtn = el('button', { class: 'rv-speed', type: 'button' }) as HTMLButtonElement;
    speedBtn.textContent = '1×';
    speedBtn.setAttribute('aria-label', 'Playback speed');
    mainPlayer.appendChild(speedBtn);
  }

  let skipBackBtn: HTMLButtonElement | null = null;
  let skipForwardBtn: HTMLButtonElement | null = null;
  if (controls.skip) {
    skipBackBtn = buttonIcon(ICONS.skipBack, 'Previous paragraph', 'rv-btn rv-btn--ghost');
    mainPlayer.appendChild(skipBackBtn);
  }

  let progressFill: HTMLElement | null = null;
  let timeLabel: HTMLElement | null = null;
  if (controls.progress) {
    // Progress + (optional) time live inside a flex-grow wrapper so the
    // bar can stretch to fill the available row space.
    const progress = el('div', { class: 'rv-progress' });
    const progressTrack = el('div', { class: 'rv-progress-track' });
    progressFill = el('div', { class: 'rv-progress-fill' });
    progressTrack.appendChild(progressFill);
    progress.appendChild(progressTrack);
    if (controls.time) {
      timeLabel = el('span', { class: 'rv-time' });
      timeLabel.textContent = '0:00 / 0:00';
      progress.appendChild(timeLabel);
    }
    mainPlayer.appendChild(progress);
  } else if (controls.time) {
    // Time without progress: render directly in the pill so it doesn't
    // inherit the progress wrapper's flex-grow + min-width and stretch
    // the player.
    timeLabel = el('span', { class: 'rv-time' });
    timeLabel.textContent = '0:00 / 0:00';
    mainPlayer.appendChild(timeLabel);
  }

  if (controls.skip) {
    skipForwardBtn = buttonIcon(ICONS.skipForward, 'Next paragraph', 'rv-btn rv-btn--ghost');
    mainPlayer.appendChild(skipForwardBtn);
  }

  if (controls.brand) {
    const brand = el('a', {
      class: 'rv-brand',
      href: 'https://responsivevoice.org',
      target: '_blank',
      rel: 'noopener',
      'aria-label': 'ResponsiveVoice',
    });
    brand.innerHTML = useBrandIcon ? ICONS.brand : ICONS.brandNeutral;
    mainPlayer.appendChild(brand);
  }

  let miniPlayer: HTMLElement | null = null;
  let miniPlayBtn: HTMLButtonElement | null = null;
  let miniRingFill: SVGCircleElement | null = null;
  let miniPopupStatus: HTMLElement | null = null;
  let miniPopupTime: HTMLElement | null = null;
  if (miniPlayerConfig.enabled) {
    miniPlayer = el('div', { class: 'rv-mini', 'data-visible': 'false' });
    // Append before applyMiniPosition: it measures the element's resolved
    // viewport position, which is only meaningful once it is in the document.
    root.appendChild(miniPlayer);
    applyMiniPosition(miniPlayer, miniPlayerConfig.position);

    const ringWrap = el('div', { class: 'rv-mini-ring' });
    const ringSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ringSvg.setAttribute('viewBox', '0 0 40 40');
    const ringBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    ringBg.setAttribute('class', 'ring-bg');
    ringBg.setAttribute('cx', '20');
    ringBg.setAttribute('cy', '20');
    ringBg.setAttribute('r', '18');
    ringBg.setAttribute('fill', 'none');
    ringBg.setAttribute('stroke-width', '3');
    ringSvg.appendChild(ringBg);
    miniRingFill = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'circle'
    ) as SVGCircleElement;
    miniRingFill.setAttribute('class', 'ring-fill');
    miniRingFill.setAttribute('cx', '20');
    miniRingFill.setAttribute('cy', '20');
    miniRingFill.setAttribute('r', '18');
    miniRingFill.setAttribute('fill', 'none');
    miniRingFill.setAttribute('stroke-width', '3');
    ringSvg.appendChild(miniRingFill);
    ringWrap.appendChild(ringSvg);

    miniPlayBtn = el('button', { class: 'ring-btn', type: 'button' }) as HTMLButtonElement;
    miniPlayBtn.setAttribute('aria-label', 'Play');
    miniPlayBtn.innerHTML = ICONS.play;
    ringWrap.appendChild(miniPlayBtn);
    miniPlayer.appendChild(ringWrap);

    const miniPopup = el('div', { class: 'rv-mini-popup' });
    miniPopupStatus = el('span');
    miniPopupStatus.textContent = 'Paused';
    miniPopupTime = el('span');
    miniPopupTime.textContent = ' · 0:00';
    miniPopup.appendChild(miniPopupStatus);
    miniPopup.appendChild(miniPopupTime);
    miniPlayer.appendChild(miniPopup);
  }

  return {
    root,
    mainPlayer,
    playBtn,
    skipBackBtn,
    skipForwardBtn,
    speedBtn,
    progressFill,
    timeLabel,
    miniPlayer,
    miniPlayBtn,
    miniRingFill,
    miniPopupStatus,
    miniPopupTime,
  };
}

function el(tag: string, attrs: Record<string, string> = {}): HTMLElement {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function buttonIcon(icon: string, label: string, className: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.setAttribute('type', 'button');
  btn.setAttribute('class', className);
  btn.setAttribute('aria-label', label);
  btn.innerHTML = icon;
  return btn;
}

/**
 * Updates an icon SVG inside a button without rebuilding the element.
 */
export function setButtonIcon(btn: HTMLButtonElement, icon: string): void {
  btn.innerHTML = icon;
}

/**
 * Picks the slide entry edge from a vertical position within the viewport: an
 * element whose center sits in the lower half enters from the bottom, otherwise
 * from the top.
 */
export function resolveSlideEdge(
  rectTop: number,
  rectHeight: number,
  viewportHeight: number
): 'top' | 'bottom' {
  return rectTop + rectHeight / 2 >= viewportHeight / 2 ? 'bottom' : 'top';
}

/**
 * Applies the mini-player position to an element. Corner keyword sets the
 * `data-position` attribute (CSS handles placement); offset object sets
 * `data-position="custom"` plus inline `top/right/bottom/left` styles. Either
 * form also sets `data-rv-mini-edge` (`top`/`bottom`) — the edge the slide
 * animation enters from. For offsets the edge is measured from the element's
 * resolved viewport position (read before the edge attribute applies any
 * transform); a no-layout environment falls back to the anchor token.
 */
function applyMiniPosition(element: HTMLElement, position: MiniPlayer['position']): void {
  if (typeof position === 'string') {
    element.setAttribute('data-position', position);
    element.setAttribute('data-rv-mini-edge', position.startsWith('top') ? 'top' : 'bottom');
    return;
  }
  element.setAttribute('data-position', 'custom');
  if (position.top !== undefined) element.style.top = position.top;
  if (position.right !== undefined) element.style.right = position.right;
  if (position.bottom !== undefined) element.style.bottom = position.bottom;
  if (position.left !== undefined) element.style.left = position.left;
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
  const edge =
    viewportHeight === 0 || (rect.width === 0 && rect.height === 0)
      ? position.top !== undefined
        ? 'top'
        : 'bottom'
      : resolveSlideEdge(rect.top, rect.height, viewportHeight);
  element.setAttribute('data-rv-mini-edge', edge);
}

/** Standard ring circumference — kept here so the feature can set dashoffset. */
export const RING_CIRCUMFERENCE = 2 * Math.PI * 18;
