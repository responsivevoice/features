import type { VoiceSelectorInput, WebsiteFeatures, WebsiteVoice } from '@responsivevoice/types';

/**
 * Handle returned by {@link SpeakFn}. Lets features control the active
 * utterance (pause / resume / cancel) without needing a direct reference to
 * the core client.
 *
 * Use `pause` / `resume` for "stop and continue from this exact point" —
 * implemented via `speechSynthesis.pause()` / `resume()`, which reliably
 * suspend the engine mid-word. Use `cancel` when abandoning the current
 * utterance entirely (e.g. to jump to a different paragraph); that routes
 * through `speechSynthesis.cancel()`, which is more aggressive but is the
 * right move when followed immediately by a fresh `speak()` call.
 */
export interface SpeakHandle {
  /** Abort the active utterance and clear the queue. Does NOT fire `onend`. */
  cancel(): void;
  /**
   * Suspend the active utterance in place. The engine keeps the utterance
   * alive; {@link SpeakHandle.resume} will continue from the same word.
   */
  pause(): void;
  /** Resume a paused utterance from the word it was suspended on. */
  resume(): void;
}

/**
 * A speak function injected by core — features don't depend on core directly.
 * This avoids the circular dependency `core` → `features` → `core`.
 *
 * Returns a {@link SpeakHandle} the caller can use to cancel mid-utterance.
 * Features that only need "fire and forget" playback may ignore the return.
 */
export type SpeakFn = (
  text: string,
  voice?: VoiceSelectorInput,
  params?: SpeakParams
) => SpeakHandle;

/**
 * Minimal parameter shape accepted by the injected {@link SpeakFn}. Matches
 * the subset of `SpeakParams` from `@responsivevoice/types` that feature
 * plugins actually need — keeping this local avoids a circular dependency
 * on the full core type.
 */
export interface SpeakParams {
  /** Speech pitch (0–2 scale, 1 = normal). */
  pitch?: number;
  /** Speech rate (0.1–1.5 scale, 1 = normal). */
  rate?: number;
  /** Speech volume (0–1 scale). */
  volume?: number;
  /** Called when playback starts. */
  onstart?: () => void;
  /** Called when playback finishes naturally. */
  onend?: () => void;
  /** Called on engine errors. */
  onerror?: (error: Error) => void;
}

/**
 * Feature plugin interface. Each dashboard feature implements this.
 */
export interface Feature {
  /** Unique feature name matching the WebsiteFeatures key */
  readonly name: string;
  /** Whether this feature is currently active */
  readonly active: boolean;
  /** Initialize and activate the feature */
  init(config: WebsiteFeatures, speak: SpeakFn, voice: WebsiteVoice, apiKey?: string): void;
  /** Tear down the feature (remove event listeners, timers, etc.) */
  cleanup(): void;
}
