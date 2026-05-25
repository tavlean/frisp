# Sqush

Sqush is a practical image optimization web app derived from [Squoosh]. It is focused on maintainability, bulk image optimization workflows, and a smaller set of modern web image formats.

Website: [sqush.app](https://sqush.app)

## Project docs

- [Agent guide](AGENTS.md)
- [Project overview](docs/overview.md)
- [Build and runtime map](docs/build-and-runtime.md)
- [Browser support policy](docs/browser-support.md)
- [Bulk image architecture](docs/bulk-image-architecture.md)
- [Codec provenance](docs/codec-provenance.md)
- [Dependency modernization](docs/dependency-modernization.md)
- [Manual QA checklist](docs/manual-qa.md)
- [Progress dashboard](docs/progress-dashboard.md)
- [Road map](docs/road-map.md)
- [Cleanup todo](docs/todo.md)
- [Issue list](docs/issue-list.md)
- [Upstream PR notes](docs/upstream-pr-notes.md)
- [Maintenance status](docs/maintenance-status.md)

# Privacy

Sqush does not send your image to a server. Image compression runs locally in your browser.

Sqush does not include the inherited Google Analytics integration from upstream Squoosh.

## Local-first contract

The core product promise is local image optimization. A working build must keep these guarantees:

- image files are decoded, processed, encoded, previewed, and exported in the browser;
- no upload or application server is required for optimization;
- a production build can reload the app shell offline after the service worker has installed;
- single-image import, WebP export, resize, saved side settings, and downloads remain dependable while bulk foundations are added.

Treat regressions in single-image optimization, offline behavior, or export reliability as release blockers.

# Developing

Use the Node version in [.nvmrc](.nvmrc). The package metadata expects Node `>=24.12.0 <25` and npm `>=11`.

1. Install Node dependencies:
   ```sh
   npm install
   ```
1. Build the app:
   ```sh
   npm run build
   ```
1. Start the development server:
   ```sh
   npm run dev
   ```

Useful maintenance commands:

```sh
npm run check
npm test
npm run audit
npm run dashboard
npm run smoke:browser
npm run test:unit
npm run typecheck
npm run format:check
```

Run `npm run build` before `npm run typecheck` on a fresh checkout so generated feature files exist.

## Verification guide

Use `npm run check` as the normal local gate. It runs formatting, production build, build-output smoke, helper tests, and TypeScript checks in the correct order.

Use `npm run smoke:browser` when touching runtime image behavior: import/export, object URLs, resize/processing/encoding, service-worker/offline behavior, saved settings, output previews, or anything users experience in the editor. It builds the production app and drives the current browser smoke flow through Chromium.

Use `npm run audit` after dependency changes. The project currently expects `npm audit --audit-level=low` to stay clean.

## Progress dashboard

Run:

```sh
npm run dashboard
```

The command prints the local dashboard URL, usually `http://localhost:4177`. If the dashboard is already running, the command reports that URL instead of crashing. Keep both [docs/progress-dashboard.html](docs/progress-dashboard.html) and [docs/progress-dashboard.md](docs/progress-dashboard.md) honest after meaningful checkpoints.

The top dashboard cards show rough planning progress. When a checkpoint changes a top-card percentage, show only that checkpoint's green delta next to the changed card and remove stale deltas from other top cards.

## Bulk and Svelte boundaries

Bulk image optimization should continue through framework-neutral models, helpers, tests, and architecture notes until the production UI design has been discussed. Do not add production bulk UI in routine cleanup commits.

Svelte/SvelteKit migration work should start from tested framework-neutral modules and small prototypes. Do not rewrite the current production UI just to migrate frameworks.

# Attribution

Sqush is derived from GoogleChromeLabs' Squoosh project and continues under the Apache 2.0 license.

# Contributing

Contributions should follow the [contribute guide](/CONTRIBUTING.md) until this fork has its own project-specific guide.

[squoosh]: https://github.com/GoogleChromeLabs/squoosh
