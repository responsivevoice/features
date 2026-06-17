/**
 * Scoped CSS for the article audio player's Shadow DOM. The string is injected
 * into a single `<style>` element inside the closed shadow root so host-site
 * rules cannot reach in and vice-versa. Ports the Tailwind look from the
 * reference (pill-shaped main player, pink paragraph highlight, purple hover,
 * circular SVG progress ring for the mini-player) into vanilla CSS.
 *
 * Colors are exposed as CSS custom properties on `:host` so they can be
 * overridden by site themes later without changing this file.
 */

export const STYLES = `
:host {
  --rv-bg: #ffffff;
  --rv-fg: #0f172a;
  --rv-muted: #64748b;
  --rv-accent: #ec4899;
  --rv-accent-soft: #fce7f3;
  --rv-hover: #f3e8ff;
  --rv-border: #e2e8f0;
  --rv-track: #e5e7eb;
  --rv-fill: #0f172a;
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: var(--rv-fg);
}

* { box-sizing: border-box; }

.rv-main {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  background: var(--rv-track);
  border-radius: 9999px;
  font-size: 0.875rem;
  max-width: 100%;
  min-width: 0;
}
.rv-main:has(.rv-brand) {
  padding-right: 1.125rem;
}
.rv-main:has(> .rv-progress:last-child) {
  padding-right: 0.95rem;
}

/* Layout: fill mode stretches the inner pill across its container. */
:host([data-rv-layout-mode='fill']) .rv-main {
  display: flex;
  width: 100%;
}

.rv-btn {
  background: var(--rv-fill);
  color: var(--rv-bg);
  border: none;
  border-radius: 9999px;
  width: 2.25rem;
  height: 2.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s;
}
.rv-btn:hover { filter: brightness(0.9); }
.rv-btn[disabled] { opacity: 0.5; cursor: not-allowed; }
.rv-btn svg { width: 1rem; height: 1rem; pointer-events: none; }
.rv-btn svg * { pointer-events: none; }

.rv-btn--ghost {
  background: transparent;
  color: var(--rv-fg);
  width: 1.75rem;
  height: 1.75rem;
}
.rv-btn--ghost:hover { background: rgba(15, 23, 42, 0.08); }
.rv-btn--ghost svg { width: 0.875rem; height: 0.875rem; pointer-events: none; }
.rv-btn--ghost svg * { pointer-events: none; }

.rv-speed {
  background: transparent;
  border: 1px solid transparent;
  color: var(--rv-fg);
  font: inherit;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  cursor: pointer;
  min-width: 2.75rem;
}
.rv-speed:hover { background: rgba(15, 23, 42, 0.08); }

.rv-progress {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
:host([data-rv-layout-mode='shrink']) .rv-progress {
  min-width: 8rem;
}
.rv-progress-track {
  flex: 1 1 auto;
  height: 0.25rem;
  background: rgba(15, 23, 42, 0.2);
  border-radius: 9999px;
  overflow: hidden;
}
.rv-progress-fill {
  height: 100%;
  width: 0%;
  background: var(--rv-fill);
  transition: width 0.15s linear;
}
.rv-time {
  font-variant-numeric: tabular-nums;
  font-size: 0.75rem;
  color: var(--rv-muted);
  white-space: nowrap;
}

.rv-brand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  flex: 0 0 auto;
  opacity: 0.85;
  transition: opacity 0.15s;
}
.rv-brand:hover { opacity: 1; }
.rv-brand svg { width: 100%; height: 100%; display: block; }
.rv-brand { color: var(--rv-fg); }
.rv-brand .disc,
.rv-brand .tri { fill: currentColor; }
.rv-brand .bars { fill: var(--rv-bg); }

/* ---- Mini-player ---- */
.rv-mini {
  position: fixed;
  background: var(--rv-bg);
  border: 1px solid var(--rv-border);
  border-radius: 9999px;
  padding: 0.375rem;
  box-shadow: 0 6px 24px rgba(15, 23, 42, 0.15);
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  z-index: 2147483000;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}
.rv-mini[data-position='top-left']     { top: 1rem;    left: 1rem; }
.rv-mini[data-position='top-right']    { top: 1rem;    right: 1rem; }
.rv-mini[data-position='bottom-left']  { bottom: 1rem; left: 1rem; }
.rv-mini[data-position='bottom-right'] { bottom: 1rem; right: 1rem; }
/* data-position='custom' uses inline top/right/bottom/left set by JS */
.rv-mini[data-visible='true'] {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

/* ---- Mini-player entrance/exit animation ----
 * Preset is projected onto :host via data-rv-mini-anim. Slide direction follows
 * data-rv-mini-edge (top/bottom), which the player derives from the resolved
 * position — so corner keywords and custom offsets are both direction-aware.
 * The slide travels its own height plus a margin so it reads as entering from
 * the docked edge. Hidden-state transforms are scoped with
 * :not([data-visible='true']) so the resting state keeps transform:none without
 * a specificity fight. Transitions live behind prefers-reduced-motion:
 * no-preference, so 'reduce' snaps instantly for every preset. 'none' has no
 * transition and no offset — an instant swap. */
:host([data-rv-mini-anim='slide']) .rv-mini[data-rv-mini-edge='top']:not([data-visible='true']) {
  transform: translateY(calc(-100% - 2.5rem));
}
:host([data-rv-mini-anim='slide']) .rv-mini[data-rv-mini-edge='bottom']:not([data-visible='true']) {
  transform: translateY(calc(100% + 2.5rem));
}
:host([data-rv-mini-anim='pop']) .rv-mini:not([data-visible='true']) {
  transform: scale(0.3);
}

@media (prefers-reduced-motion: no-preference) {
  /* Exit (hidden state): ease back toward the edge, then flip visibility. */
  :host([data-rv-mini-anim='fade']) .rv-mini,
  :host([data-rv-mini-anim='slide']) .rv-mini,
  :host([data-rv-mini-anim='pop']) .rv-mini {
    transition: opacity 0.3s ease, transform 0.35s ease-in, visibility 0s linear 0.35s;
  }
  /* Entrance (visible state): ease in from the edge. */
  :host([data-rv-mini-anim='fade']) .rv-mini[data-visible='true'],
  :host([data-rv-mini-anim='slide']) .rv-mini[data-visible='true'] {
    transition: opacity 0.3s ease, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), visibility 0s;
  }
  :host([data-rv-mini-anim='pop']) .rv-mini[data-visible='true'] {
    transition:
      opacity 0.25s ease,
      transform 0.55s cubic-bezier(0.34, 2.8, 0.5, 1),
      visibility 0s;
  }
}
.rv-mini-ring { position: relative; width: 2.5rem; height: 2.5rem; }
.rv-mini-ring > svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.rv-mini-ring .ring-bg { stroke: var(--rv-track); }
.rv-mini-ring .ring-fill {
  stroke: var(--rv-fill);
  stroke-dasharray: 113.1;  /* 2 * PI * r, r = 18 */
  stroke-dashoffset: 113.1;
  transition: stroke-dashoffset 0.15s linear;
}
.rv-mini-ring .ring-btn {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--rv-fill);
  padding: 0;
}
.rv-mini-ring .ring-btn svg { width: 1rem; height: 1rem; pointer-events: none; }
.rv-mini-ring .ring-btn svg * { pointer-events: none; }

.rv-mini-popup {
  position: absolute;
  background: var(--rv-fg);
  color: var(--rv-bg);
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
}
.rv-mini[data-position='bottom-left']  .rv-mini-popup { bottom: calc(100% + 0.5rem); left: 0; }
.rv-mini[data-position='bottom-right'] .rv-mini-popup { bottom: calc(100% + 0.5rem); right: 0; }
.rv-mini[data-position='top-left']     .rv-mini-popup { top: calc(100% + 0.5rem);    left: 0; }
.rv-mini[data-position='top-right']    .rv-mini-popup { top: calc(100% + 0.5rem);    right: 0; }
.rv-mini[data-position='custom']       .rv-mini-popup { bottom: calc(100% + 0.5rem); left: 0; }
.rv-mini:hover .rv-mini-popup { opacity: 1; }

/* ---- Mobile / narrow viewport adaptations ----
 * Below 640px the pill stretches to fill its container, gaps and
 * padding shrink, the time label wraps to a smaller line, and the
 * brand label is removed entirely. Below 480px the time label drops
 * out so the controls + progress bar always have room. */
@media (max-width: 640px) {
  .rv-main {
    display: flex;
    width: 100%;
    gap: 0.375rem;
    padding: 0.375rem 0.5rem;
  }
  .rv-btn { width: 2rem; height: 2rem; }
  .rv-btn--ghost { width: 1.5rem; height: 1.5rem; }
  .rv-speed { min-width: 2.25rem; padding: 0.25rem 0.375rem; }
  .rv-progress { min-width: 3rem; }
  .rv-time { font-size: 0.6875rem; }
}
@media (max-width: 480px) {
  .rv-time { display: none; }
}

/* ---- Paragraph highlight (hosted OUTSIDE the shadow root —
 * we style by class on the wrapper span directly in the host document) */
`;

/**
 * Styles that must live in the host document because they target paragraph
 * wrapper `<span>` elements we inject into the article tree — those elements
 * are outside the shadow root. Injected once per feature activation into
 * `document.head`.
 */
export const HOST_DOCUMENT_STYLES = `
/* Margin around the player can be overridden via the --rv-player-margin
 * custom property. Default is a moderate vertical rhythm that keeps the
 * player from gluing to surrounding content; inline mode drops it so the
 * player flows with text. */
[data-rv-web-player] {
  display: block;
  max-width: 100%;
  margin: var(--rv-player-margin, 1rem 0);
}
[data-rv-web-player][data-rv-layout-display='inline'] {
  display: inline-block;
  margin: var(--rv-player-margin, 0);
}
[data-rv-player-para] {
  transition: background-color 0.15s;
  border-radius: 0.25rem;
  padding: 0 0.125rem;
}
[data-rv-player-para][data-rv-clickable='true'] {
  cursor: pointer;
}
[data-rv-player-para][data-rv-clickable='true']:hover {
  background-color: var(--rv-hover, #f3e8ff);
}
[data-rv-player-para][data-rv-active='true'] {
  background-color: var(--rv-accent-soft, #fce7f3);
}
@media (max-width: 640px) {
  [data-rv-web-player][data-rv-layout-mode='fill'] {
    width: 100%;
  }
}
`;
