import type { WebsiteFeatures, WebsiteVoice } from '@responsivevoice/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFeatureManager } from '../factory';
import { FeatureManager } from '../manager';
import type { Feature, SpeakFn } from '../types';
import { makeConfig, makeVoice } from './fixtures';

class MockFeature implements Feature {
  readonly name: string;
  private _active = false;
  initCalls: Array<{ config: WebsiteFeatures; voice: WebsiteVoice }> = [];
  cleanupCalls = 0;

  constructor(
    name: string,
    private shouldActivate = true
  ) {
    this.name = name;
  }

  get active() {
    return this._active;
  }

  init(config: WebsiteFeatures, _speak: SpeakFn, voice: WebsiteVoice): void {
    this.initCalls.push({ config, voice });
    if (this.shouldActivate) {
      this._active = true;
    }
  }

  cleanup(): void {
    this.cleanupCalls++;
    this._active = false;
  }
}

describe('FeatureManager', () => {
  let manager: FeatureManager;
  let speak: SpeakFn;

  beforeEach(() => {
    manager = new FeatureManager();
    speak = vi.fn();
  });

  it('registers features', () => {
    const f1 = new MockFeature('test1');
    const f2 = new MockFeature('test2');
    manager.register(f1);
    manager.register(f2);

    // Not yet activated
    expect(manager.isActivated()).toBe(false);
    expect(manager.getActiveFeatures()).toEqual([]);
  });

  it('activates all registered features with config', () => {
    const f1 = new MockFeature('test1');
    const f2 = new MockFeature('test2');
    manager.register(f1);
    manager.register(f2);

    const config = makeConfig();
    const voice = makeVoice();
    manager.activate(config, speak, voice);

    expect(manager.isActivated()).toBe(true);
    expect(f1.initCalls).toHaveLength(1);
    expect(f1.initCalls[0].config).toBe(config);
    expect(f1.initCalls[0].voice).toBe(voice);
    expect(f2.initCalls).toHaveLength(1);
  });

  it('returns only active feature names', () => {
    const f1 = new MockFeature('active-one', true);
    const f2 = new MockFeature('inactive-one', false);
    const f3 = new MockFeature('active-two', true);
    manager.register(f1);
    manager.register(f2);
    manager.register(f3);

    manager.activate(makeConfig(), speak, makeVoice());

    expect(manager.getActiveFeatures()).toEqual(['active-one', 'active-two']);
  });

  it('cleans up active features', () => {
    const f1 = new MockFeature('test1', true);
    const f2 = new MockFeature('test2', false);
    manager.register(f1);
    manager.register(f2);

    manager.activate(makeConfig(), speak, makeVoice());
    expect(f1.active).toBe(true);
    expect(f2.active).toBe(false);

    manager.cleanup();

    expect(f1.cleanupCalls).toBe(1);
    // Inactive feature should not have cleanup called
    expect(f2.cleanupCalls).toBe(0);
    expect(manager.isActivated()).toBe(false);
  });

  it('cleans up previous features before re-activation', () => {
    const f1 = new MockFeature('test1');
    manager.register(f1);

    manager.activate(makeConfig(), speak, makeVoice());
    expect(f1.initCalls).toHaveLength(1);
    expect(f1.cleanupCalls).toBe(0);

    // Re-activate
    manager.activate(makeConfig(), speak, makeVoice());
    expect(f1.cleanupCalls).toBe(1);
    expect(f1.initCalls).toHaveLength(2);
  });

  it('createFeatureManager registers all 8 built-in features', () => {
    const featureManager = createFeatureManager();
    const config = makeConfig({
      welcomeMessage: { enabled: true, text: 'Hello' },
      speakSelectedText: { enabled: true },
      speakLinks: { enabled: true },
      speakInactivity: { enabled: true, text: 'Still there?' },
      speakEndPage: { enabled: true, text: 'End of page' },
      exitIntent: { enabled: true, text: 'Leaving?' },
      accessibilityNavigation: { enabled: true },
      paragraphNavigation: { enabled: true },
    });

    featureManager.activate(config, speak, makeVoice());
    const active = featureManager.getActiveFeatures();

    expect(active).toContain('welcomeMessage');
    expect(active).toContain('speakSelectedText');
    expect(active).toContain('speakLinks');
    expect(active).toContain('speakInactivity');
    expect(active).toContain('speakEndPage');
    expect(active).toContain('exitIntent');
    expect(active).toContain('accessibilityNavigation');
    expect(active).toContain('paragraphNavigation');
    expect(active).toHaveLength(8);

    featureManager.cleanup();
  });
});
