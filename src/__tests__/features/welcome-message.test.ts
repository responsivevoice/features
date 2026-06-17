import { djb2Hash } from '@responsivevoice/text';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WelcomeMessageFeature } from '../../features/welcome-message';
import type { SpeakFn } from '../../types';
import { makeConfig, makeVoice } from '../fixtures';

const TEST_API_KEY = 'test-api-key-123';
const storageKey = `rv_welcomed_${djb2Hash(TEST_API_KEY)}`;

describe('WelcomeMessageFeature', () => {
  let feature: WelcomeMessageFeature;
  let speak: SpeakFn;

  beforeEach(() => {
    feature = new WelcomeMessageFeature();
    speak = vi.fn();
    vi.useFakeTimers();
    sessionStorage.clear();
  });

  afterEach(() => {
    feature.cleanup();
    vi.useRealTimers();
  });

  it('does not activate when disabled', () => {
    const config = makeConfig({ welcomeMessage: { enabled: false, text: 'Hello' } });
    feature.init(config, speak, makeVoice(), TEST_API_KEY);
    expect(feature.active).toBe(false);
  });

  it('does not activate when text is null', () => {
    const config = makeConfig({ welcomeMessage: { enabled: true, text: null } });
    feature.init(config, speak, makeVoice(), TEST_API_KEY);
    expect(feature.active).toBe(false);
  });

  it('activates and speaks message after delay', () => {
    const config = makeConfig({ welcomeMessage: { enabled: true, text: 'Welcome!' } });
    const voice = makeVoice();
    feature.init(config, speak, voice, TEST_API_KEY);

    expect(feature.active).toBe(true);
    expect(speak).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);

    expect(speak).toHaveBeenCalledWith('Welcome!', 'UK English Female', {
      pitch: 1,
      rate: 1,
      volume: 1,
    });
  });

  it('suppresses when same text was already spoken this session', () => {
    // Store the text hash as if it was already spoken
    sessionStorage.setItem(storageKey, djb2Hash('Hello'));

    const config = makeConfig({
      welcomeMessage: { enabled: true, text: 'Hello' },
      welcomeMessageOnce: true,
    });
    feature.init(config, speak, makeVoice(), TEST_API_KEY);

    expect(feature.active).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(speak).not.toHaveBeenCalled();
  });

  it('stores text hash in sessionStorage when welcomeMessageOnce is true', () => {
    const text = 'Hello once';
    const config = makeConfig({
      welcomeMessage: { enabled: true, text },
      welcomeMessageOnce: true,
    });
    feature.init(config, speak, makeVoice(), TEST_API_KEY);

    vi.advanceTimersByTime(500);
    expect(speak).toHaveBeenCalled();
    expect(sessionStorage.getItem(storageKey)).toBe(djb2Hash(text));
  });

  it('plays again when text changes even if welcomeMessageOnce is true', () => {
    // First play with original text
    const config1 = makeConfig({
      welcomeMessage: { enabled: true, text: 'Hello v1' },
      welcomeMessageOnce: true,
    });
    feature.init(config1, speak, makeVoice(), TEST_API_KEY);
    vi.advanceTimersByTime(500);
    expect(speak).toHaveBeenCalledTimes(1);
    feature.cleanup();

    // Text changed — should play again
    const feature2 = new WelcomeMessageFeature();
    const config2 = makeConfig({
      welcomeMessage: { enabled: true, text: 'Hello v2' },
      welcomeMessageOnce: true,
    });
    feature2.init(config2, speak, makeVoice(), TEST_API_KEY);
    vi.advanceTimersByTime(500);
    expect(speak).toHaveBeenCalledTimes(2);
    feature2.cleanup();
  });

  it('cleans up session key when welcomeMessageOnce is disabled', () => {
    // Simulate a previous session where once was enabled
    sessionStorage.setItem(storageKey, djb2Hash('Hello'));

    const config = makeConfig({
      welcomeMessage: { enabled: true, text: 'Hello' },
      welcomeMessageOnce: false,
    });
    feature.init(config, speak, makeVoice(), TEST_API_KEY);

    // Key should be removed
    expect(sessionStorage.getItem(storageKey)).toBeNull();

    // Should still play
    vi.advanceTimersByTime(500);
    expect(speak).toHaveBeenCalled();
  });

  it('scopes sessionStorage by API key', () => {
    // Speak once for key A
    const config = makeConfig({
      welcomeMessage: { enabled: true, text: 'Hello' },
      welcomeMessageOnce: true,
    });
    feature.init(config, speak, makeVoice(), 'key-A');
    vi.advanceTimersByTime(500);
    expect(speak).toHaveBeenCalledTimes(1);
    feature.cleanup();

    // Key B should still play
    const feature2 = new WelcomeMessageFeature();
    feature2.init(config, speak, makeVoice(), 'key-B');
    vi.advanceTimersByTime(500);
    expect(speak).toHaveBeenCalledTimes(2);
    feature2.cleanup();

    // Key A should NOT play again
    const feature3 = new WelcomeMessageFeature();
    feature3.init(config, speak, makeVoice(), 'key-A');
    expect(feature3.active).toBe(false);
    feature3.cleanup();
  });

  it('picks random message from pipe-separated text', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const config = makeConfig({
      welcomeMessage: { enabled: true, text: 'msg1|msg2|msg3' },
    });
    feature.init(config, speak, makeVoice(), TEST_API_KEY);
    vi.advanceTimersByTime(500);

    // With Math.random() = 0.99, floor(0.99 * 3) = 2, so "msg3"
    expect(speak).toHaveBeenCalledWith('msg3', 'UK English Female', {
      pitch: 1,
      rate: 1,
      volume: 1,
    });
  });

  it('cleans up timer', () => {
    const config = makeConfig({ welcomeMessage: { enabled: true, text: 'Hello' } });
    feature.init(config, speak, makeVoice(), TEST_API_KEY);
    expect(feature.active).toBe(true);

    feature.cleanup();
    expect(feature.active).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(speak).not.toHaveBeenCalled();
  });
});
