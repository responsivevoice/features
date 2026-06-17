/**
 * Options for {@link readableText}.
 */
export interface ReadableTextOptions {
  /** When `false`, returns raw text with no node stripping. Default `true`. */
  enabled?: boolean;
  /** Additional CSS selectors to strip, composed with the built-in list. */
  exclude?: string[];
}

const NON_READABLE_SELECTOR = [
  'script',
  'style',
  'noscript',
  'template',
  'button',
  'select',
  'textarea',
  'input',
  'svg',
  'iframe',
  'object',
  'embed',
  'audio',
  'video',
  'canvas',
  '[hidden]',
  '[aria-hidden="true"]',
  '[data-rv-skip]',
].join(',');

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Extracts narratable text from an element, excluding non-rendered nodes
 * (`script`/`style`), interactive controls, embedded media, and explicitly
 * hidden content. Whitespace is collapsed to single spaces.
 */
export function readableText(el: Element, options?: ReadableTextOptions): string {
  if (options?.enabled === false) return collapse(el.textContent ?? '');

  const clone = el.cloneNode(true) as Element;
  const selector = options?.exclude?.length
    ? `${NON_READABLE_SELECTOR},${options.exclude.join(',')}`
    : NON_READABLE_SELECTOR;
  for (const node of clone.querySelectorAll(selector)) node.remove();
  return collapse(clone.textContent ?? '');
}
