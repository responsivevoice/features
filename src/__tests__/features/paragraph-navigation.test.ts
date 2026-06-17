import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ParagraphNavigationFeature } from '../../features/paragraph-navigation';
import type { SpeakFn } from '../../types';
import { makeConfig, makeVoice } from '../fixtures';

describe('ParagraphNavigationFeature', () => {
  let feature: ParagraphNavigationFeature;
  let speak: SpeakFn;

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    feature = new ParagraphNavigationFeature();
    speak = vi.fn();
  });

  afterEach(() => {
    feature.cleanup();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function pressCtrl(key: 'ArrowDown' | 'ArrowUp'): void {
    document.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key }));
  }

  it('does not speak <style> content inside a paragraph', () => {
    document.body.innerHTML = '<p><style>.x{float:right}</style></p><p>Real prose.</p>';
    feature.init(makeConfig({ paragraphNavigation: { enabled: true } }), speak, makeVoice());

    pressCtrl('ArrowDown'); // index 0 → the <style> paragraph
    pressCtrl('ArrowDown'); // index 1 → real prose

    const spoken = (speak as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]).join(' ');
    expect(spoken).toContain('Real prose');
    expect(spoken).not.toContain('float');
  });
});
