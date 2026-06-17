<p align="center">
  <img src="https://cdn.responsivevoice.org/assets/logo-128.svg" width="128" height="128" alt="ResponsiveVoice logo">
</p>

<h1 align="center">@responsivevoice/features</h1>

<p align="center">
  <a href="https://github.com/responsivevoice/features/actions/workflows/ci.yml"><img src="https://github.com/responsivevoice/features/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
</p>

<p align="center">
  Dashboard feature plugins for ResponsiveVoice — welcome messages, speak links, accessibility navigation, and more.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@responsivevoice/features"><img src="https://img.shields.io/npm/v/@responsivevoice/features.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@responsivevoice/features"><img src="https://img.shields.io/npm/dm/@responsivevoice/features.svg" alt="npm downloads"></a>
  <a href="https://github.com/responsivevoice/features"><img src="https://img.shields.io/badge/GitHub-features-181717?logo=github&logoColor=white" alt="GitHub"></a>
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
</p>

---

> **Internal package** — published as a dependency of [`@responsivevoice/core`](https://github.com/responsivevoice/core), which re-exports these features. You usually do not install this directly.

## Installation

```bash
npm install @responsivevoice/features
```

## Usage

```typescript
import { createFeatureManager } from '@responsivevoice/features';

const manager = createFeatureManager();

// `speak` is your TTS function; `features` and `voice` come from your
// ResponsiveVoice website config.
manager.activate(features, speak, voice);

// Later — remove every listener the features installed.
manager.cleanup();
```

## Features

| Feature                      | Description                                                |
| ---------------------------- | ---------------------------------------------------------- |
| `WelcomeMessageFeature`      | Speaks a welcome message on page load                      |
| `SpeakSelectedTextFeature`   | Speaks highlighted text                                    |
| `SpeakLinksFeature`          | Speaks link text on hover                                  |
| `ParagraphNavigationFeature` | Keyboard paragraph navigation with speech                  |
| `TabNavigationFeature`       | Keyboard tab navigation with speech                        |
| `InactivityMessageFeature`   | Speaks after a period of inactivity                        |
| `EndOfPageMessageFeature`    | Speaks when user reaches bottom of page                    |
| `ExitIntentFeature`          | Speaks when user moves to leave page                       |
| `WebPlayerFeature`           | Inline audio player with controls and paragraph navigation |

## API

| Export                 | Description                           |
| ---------------------- | ------------------------------------- |
| `createFeatureManager` | Factory with default feature set      |
| `FeatureManager`       | Lifecycle manager for feature plugins |

Individual feature classes are also exported for advanced usage.

## License

MIT

---

**Other language SDKs:** [Python](https://github.com/responsivevoice/sdk-python) · [Go](https://github.com/responsivevoice/sdk-go) · [PHP](https://github.com/responsivevoice/sdk-php) · [Java](https://github.com/responsivevoice/sdk-java)
