import { describe, expect, it } from 'vitest';
import { readableText } from '../../utils/readable-text';

/** Builds a detached element from an HTML string for extraction tests. */
function el(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

describe('readableText', () => {
  describe('non-rendered content (Tier 1)', () => {
    it('drops <style> content', () => {
      const node = el('<p>Visible<style>.x{color:red}</style></p>');
      expect(readableText(node)).toBe('Visible');
    });

    it('drops <script> content', () => {
      const node = el('<p>Visible<script>var a = getVoices();</script></p>');
      expect(readableText(node)).toBe('Visible');
    });

    it('drops <noscript> and <template> content', () => {
      const node = el('<p>Visible<noscript>fallback</noscript><template>tpl</template></p>');
      expect(readableText(node)).toBe('Visible');
    });
  });

  describe('interactive controls (Tier 2)', () => {
    it('drops button, select, textarea, input labels/values', () => {
      const node = el(
        '<p>Read me<button>Click</button><select><option>One</option></select>' +
          '<textarea>typed</textarea><input value="v"></p>'
      );
      expect(readableText(node)).toBe('Read me');
    });

    it('collapses a paragraph whose only content is a button to empty', () => {
      const node = el('<p><button><a href="/">YES</a></button></p>');
      expect(readableText(node)).toBe('');
    });
  });

  describe('embedded media (Tier 3)', () => {
    it('drops svg, iframe, and other embedded nodes', () => {
      const node = el(
        '<p>Caption<svg><title>chart</title><desc>noise</desc></svg><iframe>frame</iframe></p>'
      );
      expect(readableText(node)).toBe('Caption');
    });
  });

  describe('hidden semantics (Tier 4)', () => {
    it('drops [hidden], [aria-hidden="true"], and [data-rv-skip] descendants', () => {
      const node = el(
        '<p>Shown<span hidden>h</span>' +
          '<span aria-hidden="true">a</span>' +
          '<span data-rv-skip>s</span></p>'
      );
      expect(readableText(node)).toBe('Shown');
    });
  });

  describe('preserved content', () => {
    it('keeps code, pre, and anchor text', () => {
      const node = el('<p>See <code>npm i</code> in <a href="/x">the docs</a></p>');
      expect(readableText(node)).toBe('See npm i in the docs');
    });
  });

  describe('whitespace normalization', () => {
    it('collapses internal whitespace runs and non-breaking spaces', () => {
      const node = el('<p>one\n   two  three</p>');
      expect(readableText(node)).toBe('one two three');
    });
  });

  describe('options', () => {
    it('returns raw collapsed text when enabled is false', () => {
      const node = el('<p>Visible<style>.x{color:red}</style></p>');
      expect(readableText(node, { enabled: false })).toBe('Visible.x{color:red}');
    });

    it('strips additional exclude selectors composed with the built-in list', () => {
      const node = el('<p>Body<aside class="ad">promo</aside></p>');
      expect(readableText(node, { exclude: ['.ad'] })).toBe('Body');
    });
  });
});
