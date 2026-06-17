import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeakLinksFeature } from '../../features/speak-links';
import type { SpeakFn } from '../../types';
import { makeConfig, makeVoice } from '../fixtures';

describe('SpeakLinksFeature', () => {
  let feature: SpeakLinksFeature;
  let speak: SpeakFn;

  beforeEach(() => {
    vi.useFakeTimers();
    feature = new SpeakLinksFeature();
    speak = vi.fn();
  });

  afterEach(() => {
    feature.cleanup();
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('does not speak aria-hidden icon noise inside a link', () => {
    document.body.innerHTML = '<a href="/x"><svg><title>icon</title></svg>Real link text</a>';
    feature.init(makeConfig({ speakLinks: { enabled: true } }), speak, makeVoice());

    const link = document.querySelector('a') as HTMLAnchorElement;
    link.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(150);

    const spoken = (speak as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]).join(' ');
    expect(spoken).toContain('Real link text');
    expect(spoken).not.toContain('icon');
  });
});
