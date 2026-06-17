/**
 * Color tokens that drive the web-player's appearance. Applied as CSS
 * custom properties on the player's shadow host element and on the article
 * container (so paragraph-highlight styles inherit them too).
 *
 * @public
 */
export interface ThemeTokens {
  /** Pill background. */
  bg: string;
  /** Primary foreground / play button face. */
  fg: string;
  /** Secondary text (timecode, brand label). */
  muted: string;
  /** Active paragraph highlight. */
  accent: string;
  /** Active paragraph background tint. */
  accentSoft: string;
  /** Paragraph hover tint. */
  hover: string;
  /** Mini-player border. */
  border: string;
  /** Progress track unfilled segment. */
  track: string;
  /** Progress track fill / mini-ring stroke. */
  fill: string;
}

/**
 * Built-in theme presets. `neutral` is the slate/pink default that mirrors
 * the original Tailwind reference. `responsivevoice` uses the brand purple
 * (#7A57EE) seen at app.responsivevoice.org.
 *
 * @public
 */
export const THEME_PRESETS: Record<string, ThemeTokens> = {
  neutral: {
    bg: '#ffffff',
    fg: '#0f172a',
    muted: '#64748b',
    accent: '#ec4899',
    accentSoft: '#fce7f3',
    hover: '#f3e8ff',
    border: '#e2e8f0',
    track: '#e5e7eb',
    fill: '#0f172a',
  },
  responsivevoice: {
    bg: '#ffffff',
    fg: '#1f1147',
    muted: '#6b6890',
    accent: '#7a57ee',
    accentSoft: '#ebe3fc',
    hover: '#f4eefe',
    border: '#d8cdf4',
    track: '#e8e3f5',
    fill: '#7a57ee',
  },
};

/** Theme input accepted by the feature config. */
export type ThemeInput = string | Partial<ThemeTokens>;

/**
 * Resolve a theme input to a complete token record. Accepts a preset name
 * (`'neutral'` / `'responsivevoice'`) or a partial token object that is
 * merged over the `neutral` baseline. Unknown preset names fall back to
 * `neutral` rather than throwing — defensive on a value that may originate
 * from a website config the feature can't validate.
 */
export function resolveTheme(input: ThemeInput | undefined): ThemeTokens {
  if (typeof input === 'string') {
    return THEME_PRESETS[input] ?? THEME_PRESETS.neutral;
  }
  if (input && typeof input === 'object') {
    return { ...THEME_PRESETS.neutral, ...input };
  }
  return THEME_PRESETS.neutral;
}

const TOKEN_TO_VAR: Record<keyof ThemeTokens, string> = {
  bg: '--rv-bg',
  fg: '--rv-fg',
  muted: '--rv-muted',
  accent: '--rv-accent',
  accentSoft: '--rv-accent-soft',
  hover: '--rv-hover',
  border: '--rv-border',
  track: '--rv-track',
  fill: '--rv-fill',
};

/** Apply a resolved theme to an element via inline CSS custom properties. */
export function applyTheme(el: HTMLElement, tokens: ThemeTokens): void {
  for (const key of Object.keys(TOKEN_TO_VAR) as (keyof ThemeTokens)[]) {
    el.style.setProperty(TOKEN_TO_VAR[key], tokens[key]);
  }
}

/** Remove the theme custom properties applied by {@link applyTheme}. */
export function clearTheme(el: HTMLElement): void {
  for (const cssVar of Object.values(TOKEN_TO_VAR)) {
    el.style.removeProperty(cssVar);
  }
}
