# Frisp Project Overview

Last updated: 2026-11-04.

Frisp is a browser-local image optimizer. Users import one image or a batch,
it decodes and processes pixels in the browser's codec workers, and exports
files or a ZIP from object URLs. There is no backend image-processing service and no upload
path.

## What Runs Where

- SvelteKit renders a client-only static SPA (`ssr = false`, prerendered with a
  `200.html` fallback).
- Svelte 5 components and `.svelte.ts` modules own editor UI, bulk UI, session
  state, history, and result caches.
- Framework-neutral TypeScript under `src/client/lazy-app/` owns the recipe,
  the lane choice, the pixel step order (`pipeline-core.ts`), filename safety,
  and bulk reducers.
- The codec worker (`src/worker/codec-worker.ts`, through Comlink) runs a whole
  encode in one call: it decodes the source itself, keeps it for the next call
  on the same file, runs rotate, resize, grain, palette, and the encoder, and
  transfers back the bytes and the decoded preview
  (`src/worker/pipeline-op.ts`). The main thread decodes nothing except SVG
  sources, which need the DOM to rasterize.
- WASM codec artifacts live under `codecs/`; committed source modules under
  `src/shared/codec-assets/` import them with Vite `?url` records.
- The service worker caches the app shell plus selected codec assets for offline
  reload after first load.

## Main Folders

- `src/routes/`: SvelteKit routes and app entry.
- `src/lib/`: Svelte editor/bulk UI, worker bridge, compression adapter,
  diagnostics, and service-worker registration.
- `src/lib/svg/`: the SVG vector-optimize lane. SVGO worker client, the
  deterministic auto-search with its multi-scale visual gate, SVG-to-ImageData
  rendering, and the optimize options/config. Loaded only via dynamic import so
  `svgo`/`fflate` stay out of the main bundle.
- `src/client/lazy-app/`: framework-neutral image pipeline, bulk engine, browser
  decode helpers, worker bridge runtime, and filename helpers.
- `src/features/`: codec and processor runtime modules.
- `src/shared/`: brand, stable shared contracts, codec asset records/modules,
  and worker-support helpers.
- `src/sw/`: service-worker cache-plan helpers and fixtures.
- `src/worker/`: the codec-worker entry, its pipeline ops, and the
  OffscreenCanvas helpers.
- `codecs/`: committed JS/WASM codec artifacts.
- `scripts/`: codec-wrapper patching, static-output audit, and hook install.
- `static/`: icons, fonts, headers, redirects, and static assets.

## Image Flow

1. `src/routes/+page.svelte` accepts picker, drag/drop, and paste imports.
2. Every image becomes the result of one `ImageRecipe`
   (`src/client/lazy-app/recipe.ts`): rotation, processors (resize, grain,
   palette), and an output (a raster encoder or SVG optimizer options).
   `recipeSignature` over it keys the editor's result cache and undo dedupe
   and the bulk output hashes, so both surfaces agree on "same result".
3. `EditorSession` owns single-image side state, saved settings, undo/redo,
   and the shared result cache. Each side converts to a recipe through
   `src/lib/editor/side-recipe.ts`. A third worker bridge decodes the rotated
   source frame for the Original side and the live grain preview, so that
   decode never queues behind an encode.
4. `src/lib/optimize-image.ts` runs one recipe on one source file and is
   the single dispatch point for three lanes, for the editor and bulk alike:
   - the pixel pipeline: one `optimize` call through
     `src/lib/sveltekit-worker-bridge.ts` to the codec worker, which decodes
     (`createImageBitmap` plus `OffscreenCanvas`, or a WASM decoder), runs
     `prepareFrame` and `encodeFrame`, and replies with transferred buffers;
   - the JPEG to JXL transcode, chosen inside the worker once it knows the
     decoded size: the JXL transcode flag is on, the source is a JPEG, and
     nothing changes pixels;
   - the SVG lane, for SVG output on an SVG source: `src/lib/svg/optimize.ts`
     runs SVGO in a lazy worker with a deterministic auto-search, gates each
     candidate on a multi-scale pixel diff, keeps the smaller of optimized vs
     original, and returns the SVG file plus raw/gzip sizes. It is reached
     only through a dynamic import. Raster outputs stay available for SVG
     sources: the main thread rasterizes the SVG (and draws a vector resize)
     and the worker receives those pixels.
5. Bulk keeps one shared recipe plus, per image, an optional own recipe; its
   runtime runs `optimizeImage` per job, and its focus view is an
   `EditorSession` that adopts a current bulk output instead of encoding again
   ([bulk-image-architecture.md](bulk-image-architecture.md)).
6. Output components render before/after comparison from object URLs.
7. Single-image export downloads a file; bulk export writes a client ZIP.

## Build And Runtime

`npm run sync` only patches Emscripten/wasm-bindgen wrapper copies into
`.svelte-kit/app-generated/codecs/**`. Feature metadata, codec asset records,
worker bridge metadata, and the codec worker are committed source.

Threading is enabled for AVIF, JPEG XL, and OxiPNG. Chromium and WebKit use the
multi-thread variants when SharedArrayBuffer support is available; single-thread
fallback remains intact. OxiPNG's pool is sized per worker: every core in the
editor, half the cores per slot in bulk, which runs two jobs at once.

The pixel step order lives once, in `src/client/lazy-app/pipeline-core.ts`,
with no DOM dependency. `tests/unit/node-pipeline.test.ts` bundles it for Node
and runs it in a `worker_thread` over the committed `*_node_*` codecs, which
keeps the headless boundary honest without shipping a CLI.

The production build uses SvelteKit adapter-static plus host headers for
COOP/COEP, immutable assets, and no-cache service-worker updates. `npm run check`
runs typecheck, build, and the static-output audit; `npm test` adds Vitest unit
and Playwright e2e coverage.
