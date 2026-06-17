/**
 * Shared test fixtures for @responsivevoice/features tests.
 *
 * Built on top of `DEFAULT_WEBSITE_FEATURES` exported by @responsivevoice/types
 * so fixture defaults cannot drift from the schema defaults.
 */

import type { WebsiteFeatures, WebsiteVoice } from '@responsivevoice/types';
import { DEFAULT_WEBSITE_FEATURES } from '@responsivevoice/types';

export function makeConfig(overrides: Partial<WebsiteFeatures> = {}): WebsiteFeatures {
  return {
    ...DEFAULT_WEBSITE_FEATURES,
    ...overrides,
  };
}

export function makeVoice(): WebsiteVoice {
  return { name: 'UK English Female', pitch: 1, rate: 1, volume: 1 };
}
