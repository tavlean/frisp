# Sqush SvelteKit prototype

This is a disposable technical prototype. It is not the production Sqush app and
not the bulk UI implementation.

The first milestone proves that a Svelte 5/SvelteKit static app can import
framework-neutral helpers from the existing Sqush source tree and build with a
service-worker entry point.

## Commands

```sh
npm install
npm run check
npm run build
npm run audit:static-output
npm audit --audit-level=low
```

## Current proof

- Uses Svelte 5 runes in `src/routes/+page.svelte`.
- Imports existing bulk helpers from `src/client/lazy-app/bulk`.
- Generates a SvelteKit prototype `client/lazy-app/feature-meta` module from
  existing WebP, processor, and preprocessor shared metadata before `check` and
  `build`.
- Imports a real committed WebP encoder WASM asset through a SvelteKit-built
  module worker.
- Encodes a synthetic 2x2 `ImageData` through the existing
  `src/features/encoders/webP/worker/webpEncode` module from a SvelteKit-built
  worker.
- Runs a WebP-only single-image pipeline probe from a locally generated PNG
  `File` through existing decode/canvas/process/export helpers and the existing
  WebP worker encoder.
- Builds with `@sveltejs/adapter-static`.
- Includes a prototype service worker using SvelteKit's `$service-worker`
  asset manifest, explicit codec asset references, and a de-duped install cache
  list.
- `npm run audit:static-output` verifies that static output includes the
  fallback page, service worker, module worker, WebP WASM asset, and
  service-worker cache coverage for the worker/WASM assets.
- Produces `build/index.html`, `build/200.html`, and
  `build/service-worker.js`.
- `npm audit --audit-level=low` is clean with a prototype-only `cookie`
  override.
- Local preview rendered in Chromium through `playwright-cli`; the page title
  and imported job list were visible. The worker/WASM probe reported the
  expected WebAssembly magic bytes, and the WebP encode probe produced a valid
  `RIFF`/`WEBP` payload.
- Local preview rendered in Chrome through Playwright with the WebP pipeline
  probe reporting a generated 155-byte PNG source, 4x4 decode, 3x3 processed
  image, 96-byte WebP output, `RIFF`/`WEBP` header, and export metadata.
- Runtime service-worker verification in Chrome showed the page controlled by
  the prototype service worker after reload, with Cache Storage covering app
  entry/start/route assets, the WebP pipeline worker, baseline WebP WASM, and
  SIMD WebP WASM.
- The WebP pipeline probe now runs through Sqush's shared Comlink worker-bridge
  runtime with a SvelteKit/Vite module-worker adapter, proving the first
  replacement seam for the production Rollup `omt:` worker bridge.

## Readiness verdict

SvelteKit static output is viable for Sqush's local-first single-image optimizer
architecture, but the production app is not ready for a direct migration yet.

The prototype has proven the platform path that matters most: a static SvelteKit
app can consume shared Sqush helpers, generate Svelte-safe WebP metadata, run
existing WebP WASM encoding in Vite-built module workers, register an offline
service worker, cache the app shell and WebP probe assets, and keep runtime WASM
lookup pointed at the top-level cached asset URLs.

The remaining blockers are migration seams, not a SvelteKit blocker:

- generated feature metadata must split framework-neutral codec data from Preact
  option entries;
- Rollup virtual imports (`omt:`, `url:`, `entry-data:`, `service-worker:`)
  need Vite/SvelteKit equivalents;
- codec WASM asset URLs need a canonical generated source or wrapper patch so
  app code, workers, and service-worker manifests agree on runtime URLs without
  physical duplication.

The next production-facing work should solve those seams before building a
minimal SvelteKit single-image editor slice with real user-selected files.

## Findings

- Pure bulk/session helpers can be consumed from a SvelteKit app today.
- Generated shared feature metadata can be produced for SvelteKit without
  committing generated files or importing Preact option components. The current
  proof intentionally starts with WebP, Sqush's first production codec target.
- Full generated encoder metadata is not drop-in yet. AVIF, MozJPEG, QOI, and
  WP2 shared metadata currently import declaration-only codec exports or
  ambient `const enum` values as runtime values, which SvelteKit/Vite rejects.
  Those modules need type-only exports or local metadata constants before a full
  image-pipeline import can pass.
- The prototype also sets `verbatimModuleSyntax: false` because the current
  WebP metadata re-exports `EncodeOptions` without `export type`.
- SvelteKit/Vite can emit a browser module worker and real committed WebP WASM
  asset using native `new URL(..., import.meta.url)` and `?url` imports.
- The existing WebP worker encode module can run inside a SvelteKit-built
  module worker and produce a valid WebP RIFF payload from synthetic
  `ImageData`.
- A narrow single-image WebP path can reuse existing local helpers from
  SvelteKit today: `canvasEncode`, `sniffMimeType`, `builtinDecode`,
  `builtinResize`, `getOutputFileName`, `getPercentChange`,
  `getEffectiveSettings`, and `settingsHash`. This proves the useful seam is
  shared source/decode/process/export primitives plus codec-specific workers,
  not the full current Preact app shell.
- The first reusable seam has been extracted from the broad production `util`
  module: abort helpers now live in `src/client/lazy-app/abort.ts`, and browser
  image decode/mime helpers now live in
  `src/client/lazy-app/image-decode.ts`. `util` keeps compatibility re-exports,
  while the SvelteKit prototype imports the narrow decode module directly.
- The WebP encode path needs the prototype to alias `wasm-feature-detect`
  because the imported production source lives outside the prototype package
  root and bare dependency resolution otherwise starts from the repo source
  tree.
- SvelteKit's `$service-worker` build manifest does not automatically include
  the nested worker/WASM assets. The viable path is to expose codec asset URLs
  from a shared module and add them to the service-worker cache list
  explicitly. The worker URLs are enough for the explicit codec manifest; the
  top-level WebP WASM URLs are already covered by SvelteKit's build manifest
  because the app imports the WebP asset probe. The combined build and codec
  manifests are still de-duped before `cache.addAll` as a guardrail, because an
  earlier explicit-WASM version produced duplicate install-list URLs and made
  the service-worker install become redundant. Importing a worker URL from the
  service-worker build emits a second worker file, so the prototype also
  runtime-caches non-manifest GETs to cover the app worker after first load. A
  production migration should prefer a generated manifest that gives both the
  app and service worker the same worker asset URL.
- Importing WebP WASM assets explicitly for service-worker coverage while also
  importing the existing Emscripten modules currently emits duplicate baseline
  and SIMD WASM files. The current build emits three copies of each WebP encoder
  WASM: one top-level SvelteKit asset, one app-worker-local asset, and one
  service-worker-imported-worker-local asset. The prototype passes the
  top-level WASM URLs from the app module into the WebP probe workers and
  exposes them through Emscripten `locateFile`, so runtime Chrome verification
  now shows the controlled page caching the top-level baseline and SIMD WASM
  URLs without adding worker-local WASM URLs to Cache Storage. This fixes the
  runtime cache target for the proof but not the physical output duplication,
  because Vite still sees the generated Emscripten
  `new URL("webp_enc*.wasm", import.meta.url)` references and emits
  worker-local assets per graph. This is acceptable for the disposable proof,
  but a production migration should make codec JS and service-worker manifests
  share one generated asset URL per WASM file or patch the generated codec
  wrappers to externalize WASM URLs.
- The full image-pipeline import is still blocked by production-only Rollup
  virtual imports and Preact client option entries: `omt:`, `url:`,
  `entry-data:`, `service-worker:`, and generated `feature-meta` entries that
  merge metadata with Preact option components.
- The current prototype pipeline intentionally does not import
  `src/client/lazy-app/image-pipeline.ts` or `bulk/processor.ts`; those modules
  still pull the full encoder map, production worker bridge, and Rollup-only
  import schemes. A reusable migration seam should split source/decode/process
  helper primitives and injectable codec workers from Preact option UI and
  Rollup virtual modules before attempting a drop-in import.
- This prototype uses `ssr = false` because the app is browser-local and relies
  on `File`. A production migration should revisit whether selected routes can
  prerender meaningful HTML without touching browser-only APIs.

## Migration implications

- Replace the production Rollup `feature-plugin` with a SvelteKit/Vite-aware
  generator. The first Svelte-safe split should keep shared metadata separate
  from UI option components so framework-neutral helpers can import types and
  defaults without pulling Preact into a Svelte build.
- Continue extracting small framework-neutral runtime seams from broad
  production modules. The initial decode/abort seam shows this can be done
  behavior-preservingly while keeping existing imports compatible.
- Replace the production `omt:` worker bridge with Vite worker imports. The
  prototype now proves the shared bridge runtime can be reused with a WebP-only
  SvelteKit module-worker adapter, but the full generated `features-worker`
  surface still needs a focused Vite-facing generated entry.
- Replace production `url:` codec references with Vite `?url` imports or
  `new URL(..., import.meta.url)` in codec-facing modules.
- Replace `entry-data:` service-worker cache generation with `$service-worker`
  for the SvelteKit app shell plus an explicit generated codec asset manifest
  for lazy/feature-detected workers and WASM assets.
- Resolve WebP WASM duplication before production migration. The likely paths
  are a generated Vite asset manifest consumed by both app and service worker,
  or codec wrapper changes that remove Emscripten's worker-local `new URL`
  references and accept externally supplied WASM URLs.

## Non-goals

- No production UI migration.
- No bulk UI implementation.
- No codec deletion or movement.
- No server-side image processing.
