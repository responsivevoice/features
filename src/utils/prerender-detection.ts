/**
 * Detects if the page is being pre-rendered (e.g. by Google, headless browsers).
 * Features should not activate during pre-rendering.
 */
export function isPrerendering(): boolean {
  if (typeof document === 'undefined') return false;

  // Standard prerender API
  if ('prerendering' in document && (document as Record<string, unknown>).prerendering) return true;

  // Older spec
  if (document.visibilityState === 'hidden') return true;

  // Common bot user agents
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('prerender') || ua.includes('googlebot') || ua.includes('headlesschrome')) {
      return true;
    }
  }

  return false;
}
