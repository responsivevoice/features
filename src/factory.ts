import { EndOfPageMessageFeature } from './features/end-of-page-message';
import { ExitIntentFeature } from './features/exit-intent';
import { InactivityMessageFeature } from './features/inactivity-message';
import { ParagraphNavigationFeature } from './features/paragraph-navigation';
import { SpeakLinksFeature } from './features/speak-links';
import { SpeakSelectedTextFeature } from './features/speak-selected-text';
import { TabNavigationFeature } from './features/tab-navigation';
import { WebPlayerFeature } from './features/web-player';
import { WelcomeMessageFeature } from './features/welcome-message';
import { FeatureManager } from './manager';

/**
 * Creates a FeatureManager with all 9 built-in dashboard features registered.
 */
export function createFeatureManager(): FeatureManager {
  const manager = new FeatureManager();
  manager.register(new WelcomeMessageFeature());
  manager.register(new SpeakSelectedTextFeature());
  manager.register(new SpeakLinksFeature());
  manager.register(new InactivityMessageFeature());
  manager.register(new EndOfPageMessageFeature());
  manager.register(new ExitIntentFeature());
  manager.register(new TabNavigationFeature());
  manager.register(new ParagraphNavigationFeature());
  manager.register(new WebPlayerFeature());
  return manager;
}
