/**
 * Dashboard feature plugins for ResponsiveVoice. Provides the `FeatureManager`
 * lifecycle manager plus nine speech features: welcome message, speak-
 * selected-text, speak-links, paragraph and tab navigation, inactivity
 * message, end-of-page message, exit intent, and web player.
 * Consumed primarily by `@responsivevoice/core`, which re-exports the full
 * surface.
 *
 * @packageDocumentation
 */

export { createFeatureManager } from './factory';
export { EndOfPageMessageFeature } from './features/end-of-page-message';
export { ExitIntentFeature } from './features/exit-intent';
export { InactivityMessageFeature } from './features/inactivity-message';
export { ParagraphNavigationFeature } from './features/paragraph-navigation';
export { SpeakLinksFeature } from './features/speak-links';
export { SpeakSelectedTextFeature } from './features/speak-selected-text';
export { TabNavigationFeature } from './features/tab-navigation';
export {
  WebPlayerFeature,
  type WebPlayerMountHandle,
  type WebPlayerMountOverrides,
} from './features/web-player';
// Re-export individual features for advanced usage
export { WelcomeMessageFeature } from './features/welcome-message';
export { FeatureManager } from './manager';
export type { Feature, SpeakFn, SpeakHandle, SpeakParams } from './types';
