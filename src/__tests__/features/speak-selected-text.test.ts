import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeakSelectedTextFeature } from '../../features/speak-selected-text';
import type { SpeakFn } from '../../types';
import { makeConfig, makeVoice } from '../fixtures';

describe('SpeakSelectedTextFeature', () => {
  let feature: SpeakSelectedTextFeature;
  let speak: SpeakFn;

  beforeEach(() => {
    feature = new SpeakSelectedTextFeature();
    speak = vi.fn();
  });

  afterEach(() => {
    feature.cleanup();
  });

  it('does not activate when disabled', () => {
    const config = makeConfig({ speakSelectedText: { enabled: false } });
    feature.init(config, speak, makeVoice());
    expect(feature.active).toBe(false);
  });

  it('adds mouseup listener when enabled', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const config = makeConfig({ speakSelectedText: { enabled: true } });
    feature.init(config, speak, makeVoice());

    expect(feature.active).toBe(true);
    expect(addSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
  });

  it('speaks selected text on mouseup', () => {
    const config = makeConfig({ speakSelectedText: { enabled: true } });
    feature.init(config, speak, makeVoice());

    // Mock window.getSelection
    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => 'Selected text here',
    } as Selection);

    document.dispatchEvent(new MouseEvent('mouseup'));

    expect(speak).toHaveBeenCalledWith('Selected text here', 'UK English Female', {
      pitch: 1,
      rate: 1,
      volume: 1,
    });
  });

  it.each([
    { label: 'empty', selection: '' },
    { label: 'only whitespace', selection: '   \n  ' },
  ])('does not speak when selection is $label', ({ selection }) => {
    const config = makeConfig({ speakSelectedText: { enabled: true } });
    feature.init(config, speak, makeVoice());

    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => selection,
    } as Selection);

    document.dispatchEvent(new MouseEvent('mouseup'));

    expect(speak).not.toHaveBeenCalled();
  });

  it('cleans up event listener', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const config = makeConfig({ speakSelectedText: { enabled: true } });
    feature.init(config, speak, makeVoice());

    feature.cleanup();

    expect(feature.active).toBe(false);
    expect(removeSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
  });
});
