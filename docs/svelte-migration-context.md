# Svelte migration context

This document records the Svelte and SvelteKit migration guidance for Sqush. It is based on a Svelte MCP documentation pass on 2026-05-24.

Use this as alignment before doing work that affects a future Svelte migration, even if the current task is still in the Preact app.

## Main principle

Do not migrate the UI just to migrate it. Sqush is valuable because local image optimization works reliably: import, decode, process, encode, preview, export, and offline use must remain dependable.

The Svelte migration should make the app easier to maintain and extend without weakening the proven single-image optimizer. Bulk image optimization is the first major product milestone, but it should reuse the same reliable processing path.

## Recommended target

The likely target is Svelte 5 with SvelteKit using static output, or a Svelte 5 plus Vite app if SvelteKit routing is not useful.

SvelteKit is still a good candidate because it supports:

- static site generation with `adapter-static`;
- single-page app output when needed;
- automatic service-worker registration;
- a documented offline app path;
- built-in project structure, testing, and deployment conventions.

For Sqush, any SvelteKit setup must stay browser-first and static. Image processing should continue to happen locally in the browser through workers and WASM, not through a server route.

## Migration shape

1. Keep the current Preact app stable until the Svelte version proves the same optimizer behavior.
2. Continue extracting framework-neutral TypeScript helpers from Preact components.
3. Keep bulk session, settings merge, export naming, MIME sniffing, saved settings, and processing orchestration independent of any UI framework.
4. Build a small Svelte prototype around imported pure modules before replacing production UI.
5. Port one vertical slice at a time: import, selected image state, options, encode result, export.
6. Run browser smoke tests before switching production routing or service-worker behavior.

Avoid a direct component-by-component translation if it carries old assumptions forward. Use the migration as a chance to simplify state and ownership.

## Svelte 5 rules to follow

Use the Svelte 5 runes model for new Svelte code:

- `$state` for local reactive state.
- `$derived` for computed values such as effective settings, selected job, output summaries, override badges, and export readiness.
- `$effect` only for side effects such as workers, object URLs, canvas, browser storage, timers, or third-party APIs.
- `$props` instead of `export let`.
- callback props and normal event attributes like `onclick` instead of `createEventDispatcher` and `on:click`.
- snippets and `{@render ...}` instead of legacy slots for reusable UI regions.
- keyed `{#each ...}` blocks for image jobs and thumbnails so job identity stays stable.
- `createContext` for typed editor or bulk-session context when prop drilling becomes awkward.

Do not use `$effect` to synchronize state that can be represented as `$derived`. This matters for bulk settings because global settings, per-image overrides, and effective settings are pure relationships.

## Large data and performance

Bulk image work involves large objects: `File`, `Blob`, `ImageData`, object URLs, encoded buffers, thumbnails, workers, and WASM module outputs. Do not put all of that into deeply reactive state by default.

Recommended pattern:

- keep reactive state focused on IDs, status, settings, sizes, errors, and selected job;
- keep binary data and long-lived browser objects outside deep proxies where possible;
- use `$state.raw` or normal module-local data for large immutable arrays or objects;
- use stable job IDs and keyed lists;
- revoke object URLs when jobs or previews are removed;
- keep concurrency limits in framework-neutral code.

Svelte's deep state proxies are useful for normal UI state, but large image payloads should be handled deliberately.

## SvelteKit cautions

If SvelteKit is used:

- prefer `adapter-static` and prerendered/static output unless a concrete server need appears;
- keep browser-only APIs behind browser-only execution paths;
- use `$app/environment` for `browser`, `dev`, and build-time checks when needed;
- remember that `$effect` only runs in the browser, not during server rendering;
- do not touch `window`, `document`, `localStorage`, `ImageData`, workers, or canvas during server execution;
- preserve service-worker and offline behavior before removing the current custom build path;
- avoid SPA-only output unless routing needs it, because SvelteKit warns that SPA mode can hurt startup, SEO, and no-JavaScript behavior.

The app can still be a static/offline tool. SvelteKit does not require server-side image processing.

## What this migration can remove later

Only remove these after equivalent behavior is verified:

- Preact component state and `setState` patterns.
- Preact-specific option rendering.
- Custom CSS-module type generation if Svelte scoped styles replace it.
- Some custom Rollup plugins if Vite/SvelteKit handles workers, WASM, assets, prerendering, and service-worker output safely.
- Local event-dispatch patterns where callback props or typed context are simpler.

Do not remove these early:

- current WASM codecs and workers;
- service-worker/offline support;
- single-image editor behavior;
- existing smoke tests;
- codec files that are still referenced by generated metadata or cache lists.

Single-image editor work planning and current/latest job-state derivation are now partly extracted into `src/client/lazy-app/Compress/work-plan.ts`, display label/contain decisions and output/result render selectors live in `src/client/lazy-app/Compress/display-state.ts`, processor-state comparisons, enabled toggles, and option merges live in `src/client/lazy-app/Compress/processor-state.ts`, default source resize side updates, orientation resize side updates, and preprocessor-change state live in `src/client/lazy-app/Compress/source-state.ts`, side-copy URL behavior lives in `src/client/lazy-app/Compress/side-copy.ts`, default/saved side-state updates, side settings mutations, and side loading/result updates live in `src/client/lazy-app/Compress/side-state.ts`, saved settings storage/key/label/payload behavior lives in `src/client/lazy-app/Compress/saved-settings.ts`, SVG-aware source decode behavior lives in `src/client/lazy-app/image-pipeline.ts`, and document-title formatting lives in `src/client/lazy-app/Compress/document-title.ts`. Preserve those pure boundaries when changing decode/preprocess/process/encode scheduling so the current optimizer remains testable before any Svelte rewrite.

## Bulk feature alignment

The bulk backend helpers being created now should be easy for Svelte to consume later:

- prefer the helper barrel at `src/client/lazy-app/bulk/index.ts` when a Svelte prototype needs bulk session, queue, export, snapshot, settings, selected-detail, strip, and summary helpers together;
- sessions should be plain data;
- selectors should be pure functions;
- reducers/actions should not import Preact;
- job lists should expose stable IDs;
- per-image override detection should be derived, not effect-driven;
- export/session summaries should be pure and testable;
- browser resource cleanup should be explicit.

This lets a future Svelte UI show a strip of images, global settings, per-image overrides, and export readiness without duplicating business logic.

## Testing gates

Before production migration:

1. Current Preact app passes `npm run check`.
2. Browser smoke covers real import, WebP output, export link creation, and saved settings.
3. Pure helper tests cover bulk session transitions and export calculations.
4. A Svelte prototype proves the same helper modules work without Preact.
5. Service-worker/offline behavior is verified in the new build.
6. A real image can be imported, optimized, previewed, and exported in the Svelte build.

When Svelte components are added, use Svelte's recommended testing path: Vitest for extracted logic and component tests, Playwright for full user flows.

## Useful Svelte docs checked

- `cli/sv-migrate`
- `svelte/v5-migration-guide`
- `svelte/what-are-runes`
- `svelte/$state`
- `svelte/$derived`
- `svelte/$effect`
- `svelte/context`
- `svelte/testing`
- `kit/project-types`
- `kit/adapter-static`
- `kit/single-page-apps`
- `kit/service-workers`
- `kit/$app-environment`

## Open decisions

- Choose SvelteKit static output or Svelte plus Vite after a prototype measures build complexity.
- Decide whether the first Svelte prototype lives beside the current app or on a separate branch.
- Decide final codec surface before deleting codec code.
- Current browser support targets were reviewed on 2026-05-24. Re-check before production migration, but do not lower the modern evergreen baseline or remove WebAssembly, worker, service-worker, Canvas/ImageData, File/Blob, object URL, or dynamic import assumptions without measured evidence.
