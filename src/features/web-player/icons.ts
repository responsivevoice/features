/**
 * Inline SVG markup for the article audio player controls. Replaces the
 * `lucide-react` icons in the reference design with zero-dependency strings
 * that can be embedded directly into the Shadow DOM.
 *
 * All icons are 24x24 with `currentColor` strokes so they inherit the button
 * text color. Use `viewBox` + `aria-hidden` on the outer SVG so screen readers
 * rely on the parent button's accessible name.
 */

const base =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

export const ICONS = {
  play: `<svg ${base}><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>`,
  pause:
    `<svg ${base}><rect x="6" y="5" width="4" height="14"></rect>` +
    `<rect x="14" y="5" width="4" height="14"></rect></svg>`,
  skipBack:
    `<svg ${base}><polygon points="19 20 9 12 19 4 19 20"></polygon>` +
    `<line x1="5" y1="5" x2="5" y2="19"></line></svg>`,
  skipForward:
    `<svg ${base}><polygon points="5 4 15 12 5 20 5 4"></polygon>` +
    `<line x1="19" y1="5" x2="19" y2="19"></line></svg>`,
  replay:
    `<svg ${base}><polyline points="1 4 1 10 7 10"></polyline>` +
    `<path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>`,
  /**
   * Brand mark — purple disc with white waveform bars. Fixed brand colors;
   * used when the theme is `'responsivevoice'`.
   */
  brand:
    `<svg viewBox="0 0 296 296" aria-label="ResponsiveVoice">` +
    `<g transform="matrix(1,0,0,1,-2,-2)">` +
    `<g transform="matrix(1.351598,0,0,1.351598,-29.086758,-22.328767)">` +
    `<g transform="matrix(-1.11537,-1.11537,0.948183,-0.948183,37.119922,318.730025)">` +
    `<path d="M43.5,45L68,94L19,94L43.5,45Z" fill="#7a57ee"/></g>` +
    `<circle cx="132.5" cy="127.5" r="109.5" fill="#7a57ee"/>` +
    `<path d="M142.455,187.158L142.455,67.843C142.455,62.336 138.005,57.887 132.5,57.887C126.994,57.887 122.544,62.336 122.544,67.843L122.544,187.158C122.544,192.664 126.994,197.113 132.5,197.113C138.005,197.113 142.455,192.664 142.455,187.158Z" fill="#fff"/>` +
    `<path d="M202.114,137.456L202.114,117.545C202.114,112.039 197.664,107.589 192.158,107.589C186.652,107.589 182.203,112.039 182.203,117.545L182.203,137.456C182.203,142.961 186.652,147.411 192.158,147.411C197.664,147.411 202.114,142.961 202.114,137.456Z" fill="#fff"/>` +
    `<path d="M62.886,117.545L62.886,137.456C62.886,142.961 67.336,147.411 72.842,147.411C78.348,147.411 82.798,142.961 82.798,137.456L82.798,117.545C82.798,112.039 78.348,107.589 72.842,107.589C67.336,107.589 62.886,112.039 62.886,117.545Z" fill="#fff"/>` +
    `<path d="M112.588,157.291L112.588,97.634C112.588,92.128 108.138,87.678 102.633,87.678C97.127,87.678 92.677,92.128 92.677,97.634L92.677,157.291C92.677,162.798 97.127,167.247 102.633,167.247C108.138,167.247 112.588,162.798 112.588,157.291Z" fill="#fff"/>` +
    `<path d="M172.247,157.291L172.247,97.634C172.247,92.128 167.797,87.678 162.291,87.678C156.785,87.678 152.336,92.128 152.336,97.634L152.336,157.291C152.336,162.798 156.785,167.247 162.291,167.247C167.797,167.247 172.247,162.798 172.247,157.291Z" fill="#fff"/>` +
    `</g></g></svg>`,
  /**
   * Neutral brand mark — same silhouette as `brand`, theme-driven colours.
   * Disc and tail triangle use `currentColor` (driven by
   * `.rv-brand { color: var(--rv-fg) }`); waveform bars use `var(--rv-bg)`.
   */
  brandNeutral:
    `<svg viewBox="0 0 296 296" aria-label="ResponsiveVoice">` +
    `<g transform="matrix(1,0,0,1,-2,-2)">` +
    `<g transform="matrix(1.351598,0,0,1.351598,-29.086758,-22.328767)">` +
    `<g transform="matrix(-1.11537,-1.11537,0.948183,-0.948183,37.119922,318.730025)">` +
    `<path class="tri" d="M43.5,45L68,94L19,94L43.5,45Z"/></g>` +
    `<circle class="disc" cx="132.5" cy="127.5" r="109.5"/>` +
    `<path class="bars" d="M142.455,187.158L142.455,67.843C142.455,62.336 138.005,57.887 132.5,57.887C126.994,57.887 122.544,62.336 122.544,67.843L122.544,187.158C122.544,192.664 126.994,197.113 132.5,197.113C138.005,197.113 142.455,192.664 142.455,187.158Z"/>` +
    `<path class="bars" d="M202.114,137.456L202.114,117.545C202.114,112.039 197.664,107.589 192.158,107.589C186.652,107.589 182.203,112.039 182.203,117.545L182.203,137.456C182.203,142.961 186.652,147.411 192.158,147.411C197.664,147.411 202.114,142.961 202.114,137.456Z"/>` +
    `<path class="bars" d="M62.886,117.545L62.886,137.456C62.886,142.961 67.336,147.411 72.842,147.411C78.348,147.411 82.798,142.961 82.798,137.456L82.798,117.545C82.798,112.039 78.348,107.589 72.842,107.589C67.336,107.589 62.886,112.039 62.886,117.545Z"/>` +
    `<path class="bars" d="M112.588,157.291L112.588,97.634C112.588,92.128 108.138,87.678 102.633,87.678C97.127,87.678 92.677,92.128 92.677,97.634L92.677,157.291C92.677,162.798 97.127,167.247 102.633,167.247C108.138,167.247 112.588,162.798 112.588,157.291Z"/>` +
    `<path class="bars" d="M172.247,157.291L172.247,97.634C172.247,92.128 167.797,87.678 162.291,87.678C156.785,87.678 152.336,92.128 152.336,97.634L152.336,157.291C152.336,162.798 156.785,167.247 162.291,167.247C167.797,167.247 172.247,162.798 172.247,157.291Z"/>` +
    `</g></g></svg>`,
};
