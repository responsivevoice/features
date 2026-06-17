/**
 * Vanilla JS hover-intent detection (no jQuery dependency).
 * Triggers callback only when mouse moves slowly over an element,
 * distinguishing intentional hover from accidental pass-over.
 */
interface HoverIntentOptions {
  sensitivity?: number; // pixels — must move less than this to trigger
  interval?: number; // ms — polling interval
  timeout?: number; // ms — delay before onOut fires
  onOver: (el: Element) => void;
  onOut: (el: Element) => void;
}

export function hoverIntent(element: Element, options: HoverIntentOptions): () => void {
  const sensitivity = options.sensitivity ?? 7;
  const interval = options.interval ?? 100;
  const timeoutMs = options.timeout ?? 0;

  let x = 0;
  let y = 0;
  let pX = 0;
  let pY = 0;
  let isHovered = false;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let outTimer: ReturnType<typeof setTimeout> | null = null;

  function trackMouse(e: MouseEvent) {
    x = e.clientX;
    y = e.clientY;
  }

  function compare() {
    pollTimer = null;
    if (Math.abs(pX - x) + Math.abs(pY - y) < sensitivity) {
      isHovered = true;
      options.onOver(element);
    } else {
      pX = x;
      pY = y;
      pollTimer = setTimeout(compare, interval);
    }
  }

  function handleEnter(e: Event) {
    const me = e as MouseEvent;
    if (outTimer) {
      clearTimeout(outTimer);
      outTimer = null;
    }
    pX = me.clientX;
    pY = me.clientY;
    if (!isHovered) {
      pollTimer = setTimeout(compare, interval);
    }
  }

  function handleLeave() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    if (isHovered) {
      outTimer = setTimeout(() => {
        isHovered = false;
        options.onOut(element);
      }, timeoutMs);
    }
  }

  element.addEventListener('mouseenter', handleEnter);
  element.addEventListener('mouseleave', handleLeave);
  document.addEventListener('mousemove', trackMouse);

  // Return cleanup function
  return () => {
    element.removeEventListener('mouseenter', handleEnter);
    element.removeEventListener('mouseleave', handleLeave);
    document.removeEventListener('mousemove', trackMouse);
    if (pollTimer) clearTimeout(pollTimer);
    if (outTimer) clearTimeout(outTimer);
  };
}
