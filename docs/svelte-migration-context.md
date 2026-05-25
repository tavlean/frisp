# Svelte migration context

This document records the SvelteKit migration guidance for Sqush. It is based on
Svelte MCP documentation passes on 2026-05-24 and 2026-05-25.

Use this as alignment before doing work that affects the SvelteKit prototype or a
future production migration.

## Main principle

Do not migrate the UI just to migrate it. Sqush is valuable because local image optimization works reliably: import, decode, process, encode, preview, export, and offline use must remain dependable.

The Svelte migration should make the app easier to maintain and extend without weakening the proven single-image optimizer. Bulk image optimization is the first major product milestone, but it should reuse the same reliable processing path.

## Recommended target

The target is Svelte 5 with SvelteKit 2 using static output. Do not broaden the
prototype to any non-SvelteKit build path unless SvelteKit produces a concrete
blocker that is documented with a minimal reproduction.

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
4. Build a small SvelteKit prototype around imported pure modules before replacing production UI.
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

The detailed extraction inventory is intentionally not repeated here anymore.
Use [Maintenance status](maintenance-status.md) and the commit history when you
need the full record of Phase 1 helper extraction. For migration work, preserve
the pure boundaries around import, decode, preprocess, process, encode,
scheduling, saved settings, export naming, object URL cleanup, and bulk session
logic so the current optimizer remains testable before any production rewrite.

## Bulk feature alignment

The bulk backend helpers should stay easy for SvelteKit to consume later:

- prefer the helper barrel at `src/client/lazy-app/bulk/index.ts` when a SvelteKit prototype needs bulk session, queue, export, snapshot, settings, selected-detail, strip, and summary helpers together;
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
4. A SvelteKit prototype proves the same helper modules work without Preact.
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

- Keep SvelteKit static output as the prototype target and measure build complexity there first.
- Continue the first prototype under `prototypes/sveltekit/` on the `code/sveltekit-prototype` branch; do not turn it into a production migration by default.
- Continue migration seam work on `code/sveltekit-migration-seams`. The first
  seam is a generated `client/lazy-app/feature-meta/shared` module that keeps
  framework-neutral codec/processor/preprocessor metadata separate from the
  Preact encoder client entries exposed by the existing `feature-meta` index.
- The first production `url:` replacement shape is now proven for the rotate
  preprocessor: keep the current Rollup adapter in production, split reusable
  worker logic into a runtime that accepts a WASM URL, and let the SvelteKit
  prototype generator provide that URL from a Vite `?url` manifest.
- The first production `entry-data:` replacement shape is now proven for
  service-worker cache planning: keep Rollup virtual imports at the production
  boundary, move cache selection into a helper that accepts plain
  `{ main, deps }` records, and let the SvelteKit prototype generator provide
  those records from Vite worker and asset URL imports.
- The first production `service-worker:` replacement shape is now proven for
  registration: keep the Rollup URL adapter at the production boundary, move
  registration/update/share-target behavior into a helper that accepts an
  explicit service-worker URL, and let the SvelteKit prototype pass its emitted
  `/service-worker.js` URL.
- The first SvelteKit worker-surface admission shape is now generated: the
  prototype emits a ready method-name list for the shared worker bridge and a
  blocked-method inventory for codecs or worker methods that still need asset
  URL, thread-support alias, or type work before joining the Vite worker entry.
- QOI encode/decode are the first non-WebP codec methods promoted through that
  admission list. They use a generated QOI WASM asset manifest plus a type-only
  shared metadata export, while the full production worker surface remains
  filtered.
- MozJPEG encode is now promoted through the same admission list. It uses a
  generated MozJPEG WASM asset manifest plus local shared metadata constants
  instead of a runtime import from declaration-only codec types.
- Quantize is now promoted through the same admission list. It uses a generated
  ImageQuant WASM asset manifest and a narrow ImageData-compatible worker return
  fix, while the full production worker surface remains filtered.
- Worker resize is now promoted through the same admission list. It uses a
  generated resize/HQX WASM asset manifest and optional injected wasm-bindgen
  URLs, while the default production initialization path remains intact.
- Single-thread OxiPNG encode is now promoted through the same admission list.
  It uses a SvelteKit `worker-shared` alias, a generated OxiPNG WASM asset
  manifest, and optional injected wasm-bindgen URLs. The parallel OxiPNG helper
  and WASM assets still need a separate threaded-runtime proof before production
  migration.
- The first generated encoder metadata split is now proven. Production
  `feature-meta/encoders` imports runtime-only encoder modules and shared
  metadata without Preact option components, while the existing
  `feature-meta/index` remains the Preact option-entry surface. The SvelteKit
  prototype imports production `compressImage` for its WebP path through this
  encode-only map.
- Decide final codec surface before deleting codec code.
- Use [Phase 1 readiness audit](phase-1-readiness-audit.md) as the current rationale for starting a small technical prototype instead of continuing tiny Preact cleanup.
- Current browser support targets were reviewed on 2026-05-24. Re-check before production migration, but do not lower the modern evergreen baseline or remove WebAssembly, worker, service-worker, Canvas/ImageData, File/Blob, object URL, or dynamic import assumptions without measured evidence.
