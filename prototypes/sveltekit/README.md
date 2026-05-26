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
  image, valid `RIFF`/`WEBP` output, QOI `qoif` output from the promoted
  `qoiEncode` worker method, AVIF `ftyp` output plus a 3x3 AVIF decode
  round trip from the promoted `avifEncode` worker method, a 3x3 AVIF fixture
  decode from the promoted `avifDecode` worker method, a 3x3 WebP decode round
  trip from the promoted `webpDecode` worker method, a 3x3 QOI decode round
  trip from the promoted `qoiDecode` worker method, JPEG XL `ff 0a` output plus
  a 3x3 decode round trip from the promoted `jxlEncode`/`jxlDecode` worker
  methods, MozJPEG `ff d8 ff` output from the promoted `mozjpegEncode` worker
  method, and export metadata.
- Runtime service-worker verification in Chrome showed the page controlled by
  the prototype service worker after reload, with Cache Storage covering app
  entry/start/route assets, the generated WebP features-worker, baseline WebP
  WASM, and SIMD WebP WASM.
- The WebP pipeline probe now runs through Sqush's shared Comlink worker-bridge
  runtime with a generated WebP-first SvelteKit/Vite module-worker entry,
  proving the first replacement seam for the production Rollup `omt:` worker
  bridge.
- The WebP pipeline probe now imports the production `decodeSourceImage`,
  `preprocessImage`, `processImage`, and `compressImage` helpers from
  `src/client/lazy-app/image-pipeline`. Production encoder clients expose
  runtime-only `client/runtime` modules, and generated
  `feature-meta/encoders` combines shared metadata with those runtimes without
  importing Preact option components or the production Rollup `omt:` worker
  entry.
- The same probe now imports production `processBulkImageJob` from
  `src/client/lazy-app/bulk/processor` and runs it with the generated SvelteKit
  worker bridge, proving the bulk processor boundary can use the same
  framework-neutral image pipeline worker shape without importing the production
  Rollup worker adapter.
- The prototype sync step now emits generated WebP codec asset metadata. The
  service worker and SvelteKit worker bridge both consume that generated WebP
  WASM URL manifest instead of a handwritten local helper.
- The prototype sync step now also emits a logical codec asset manifest with
  typed records for every active generated WASM URL. App code, the SvelteKit
  worker bridge, and the service-worker cache plan consume URLs derived from
  that manifest instead of maintaining separate loose URL lists. The generated
  service-worker path imports a precache-only manifest so runtime-only assets do
  not get inlined into the service-worker bundle.
- The prototype sync step now emits generated rotate WASM asset metadata. The
  generated SvelteKit features worker imports the shared rotate runtime with a
  canonical Vite `?url` WASM asset passed through the worker bridge, proving
  the first replacement shape for production `url:` codec references without
  changing the current Rollup adapter.
- The WebP pipeline probe now runs rotate through the generated worker before
  resize and encode. Browser verification produced a valid `RIFF`/`WEBP`
  payload with `rotate=90` in the stage log and Cache Storage covering the
  canonical rotate WASM fetched by the worker.
- The prototype sync step now emits a generated service-worker cache plan that
  uses the same `{ main, deps }` entry shape as production `entry-data:` records,
  but fills it with SvelteKit/Vite worker URLs and generated WebP WASM deps.
  The prototype service-worker asset list consumes that generated plan through
  the shared production `src/sw/cache-plan.ts` helper.
- The prototype service-worker registration now uses the shared production
  `sw-bridge` runtime helper with the SvelteKit-emitted `/service-worker.js`
  URL, proving the `service-worker:` replacement shape for registration without
  changing the current Rollup adapter.
- The prototype sync step now emits a generated worker-surface manifest. The
  SvelteKit worker bridge consumes its ready method-name list, while the same
  generated file records the worker methods still blocked by codec asset URL,
  thread-support alias, or stricter worker type work.
- `avifDecode` has been promoted through that generated worker surface. The
  prototype now generates an AVIF decoder WASM URL manifest, passes it through
  the SvelteKit worker bridge, verifies a local AVIF fixture decode from the
  existing AVIF worker decoder, and confirms service-worker cache coverage for
  the AVIF decoder WASM asset.
- `avifEncode` has been promoted through the same generated worker surface for
  a forced single-thread runtime path. The production worker now accepts an
  injectable thread-support probe while preserving the default threaded-capable
  path, the prototype generates an AVIF encoder WASM URL manifest, verifies
  AVIF `ftyp` output plus an `avifDecode` round trip, and confirms
  service-worker cache coverage for the single-thread AVIF encoder WASM asset.
  The prototype now imports generated patched AVIF encoder/decoder wrapper
  copies through shared AVIF runtime seams, so static output emits one canonical
  AVIF decoder WASM asset, one canonical single-thread AVIF encoder WASM asset,
  and no AVIF threaded worker-helper assets. Production migration still needs a
  separate threaded-runtime proof or a build split for the threaded AVIF path.
- `webpDecode` has been promoted through that generated worker surface. The
  prototype now generates a WebP decoder WASM URL alongside the encoder WASM
  URLs, passes it through the SvelteKit worker bridge, verifies a WebP decode
  round trip from the existing WebP worker decoder, and confirms
  service-worker cache coverage for the decoder WASM asset.
- `qoiEncode` and `qoiDecode` have been promoted through that generated worker
  surface. The prototype now generates QOI encoder and decoder WASM URL
  manifests, passes them through the SvelteKit worker bridge, verifies a `qoif`
  output plus 3x3 QOI decode round trip from the existing QOI worker modules,
  and confirms service-worker cache coverage for both QOI WASM assets. The
  prototype now imports generated patched QOI wrapper copies through injectable
  QOI encode/decode runtimes, so static output emits one canonical QOI encoder
  WASM asset and one canonical QOI decoder WASM asset.
- `jxlEncode` and `jxlDecode` have been promoted through the same generated
  worker surface for a forced single-thread runtime path. The production JPEG XL
  encoder now keeps its lazy threaded-capable adapter while exposing an
  injectable runtime factory, the prototype generates JPEG XL encoder and
  decoder WASM URL manifests, verifies JPEG XL `ff 0a` output plus a decode
  round trip, and confirms service-worker cache coverage for both JPEG XL WASM
  assets. The prototype imports generated patched JPEG XL encoder/decoder
  wrapper copies through shared JPEG XL runtime seams, so static output emits
  one canonical JPEG XL encoder WASM asset, one canonical JPEG XL decoder WASM
  asset, and no JPEG XL threaded worker-helper assets. Production migration
  still needs a separate threaded-runtime proof or a build split for the
  threaded JPEG XL path.
- `mozjpegEncode` has been promoted through the same generated worker surface.
  The prototype now generates a MozJPEG encoder WASM URL manifest, passes it
  through the SvelteKit worker bridge, verifies JPEG `ff d8 ff` output from the
  existing MozJPEG worker module, and confirms service-worker cache coverage for
  the MozJPEG WASM asset. The prototype now imports a generated patched MozJPEG
  wrapper copy through an injectable MozJPEG runtime, so static output emits one
  canonical MozJPEG encoder WASM asset. MozJPEG shared metadata now exposes
  local runtime constants instead of importing declaration-only codec values.
- `quantize` has been promoted through the same generated worker surface. The
  prototype now generates an ImageQuant WASM URL manifest, passes it through the
  SvelteKit worker bridge, verifies a reduced-color ImageData result from the
  existing quantize worker module, and confirms service-worker cache coverage
  for the ImageQuant WASM asset. The prototype now imports a generated patched
  ImageQuant wrapper copy through an injectable quantize runtime, so static
  output emits one canonical ImageQuant WASM asset.
- Worker `resize` has been promoted through the same generated worker surface.
  The prototype now generates resize and HQX WASM URL manifests, passes them
  through the SvelteKit worker bridge, verifies a 2x2 ImageData result from the
  existing resize worker module, and confirms service-worker cache coverage for
  both wasm-bindgen assets. The prototype now imports generated patched
  resize/HQX wasm-bindgen wrapper copies through an injectable resize runtime,
  so static output emits one canonical resize WASM asset and one canonical HQX
  WASM asset.
- `oxipngEncode` has been promoted through the same generated worker surface for
  the single-thread runtime path. The prototype now resolves the
  `worker-shared` alias through SvelteKit, generates an OxiPNG WASM URL
  manifest, passes it through the SvelteKit worker bridge, verifies PNG
  `89 50 4e 47` output from the existing OxiPNG worker module, and confirms
  service-worker cache coverage for the single-thread OxiPNG WASM asset. The
  prototype imports a generated patched single-thread wasm-bindgen wrapper copy
  through the shared OxiPNG runtime seam, so static output emits one canonical
  OxiPNG WASM asset and no parallel OxiPNG worker-helper assets.

## Readiness verdict

SvelteKit static output is viable for Sqush's local-first single-image optimizer
architecture, but the production app is not ready for a direct migration yet.

The prototype has proven the platform path that matters most: a static SvelteKit
app can consume shared Sqush helpers, generate Svelte-safe WebP/MozJPEG
metadata, run existing WebP/AVIF/QOI/JPEG XL/MozJPEG WASM encoding,
AVIF/WebP/QOI/JPEG XL WASM decoding, single-thread OxiPNG WASM encoding,
ImageQuant quantization, worker resize, and rotate preprocessing in Vite-built
module workers, register an offline service worker, cache the app shell and
codec probe assets, and keep runtime WASM lookup pointed at generated asset
URLs.

The remaining blockers are migration seams, not a SvelteKit blocker:

- generated feature metadata now has a proven encode-only runtime map, but the
  remaining processor/preprocessor and UI option entry splits still need the
  same treatment before a full app-shell import is safe;
- Rollup virtual imports (`omt:`, broader `url:`, `entry-data:`,
  `service-worker:`) need Vite/SvelteKit equivalents; the generated rotate seam
  proves the first narrow `url:` replacement pattern, and the generated
  service-worker cache plan proves the first `entry-data:` replacement pattern,
  and the shared registration helper proves the `service-worker:` replacement
  pattern;
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
- Full generated encoder metadata now has an encode-only import path that avoids
  Preact option components. AVIF and the legacy/deprioritized WebP 2 shared
  metadata no longer import declaration-only codec enum exports as runtime
  values; they expose local metadata constants so Vite can consume the shared
  metadata surface without making WebP 2 an active prototype target.
- The prototype also sets `verbatimModuleSyntax: false` because the current
  WebP metadata re-exports `EncodeOptions` without `export type`.
- SvelteKit/Vite can emit a browser module worker and real committed WebP WASM
  asset using native `new URL(..., import.meta.url)` and `?url` imports.
- SvelteKit/Vite can emit the small rotate WASM as a file when WASM inlining is
  disabled. This matters because the default Vite inline limit otherwise turns
  tiny WASM imports into `data:` URLs, which hides the asset from explicit
  service-worker cache evidence.
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
  through generated `{ main, deps }` cache records and add them to the
  service-worker cache list explicitly. The generated cache records now use the
  shared `src/sw/cache-plan.ts` helper, matching the production `entry-data:`
  shape while using Vite worker and WASM URLs. The top-level WebP and rotate
  WASM URLs are also covered by SvelteKit's build manifest because the app
  imports those assets. The combined build and codec manifests are still
  de-duped before `cache.addAll` as a guardrail, because an earlier
  explicit-WASM version produced duplicate install-list URLs and made the
  service-worker install become redundant. Importing a worker URL from the
  service-worker build emits a second worker file, so the prototype also
  runtime-caches non-manifest GETs to cover the app worker after first load. A
  production migration should prefer a generated manifest that gives both the
  app and service worker the same worker asset URL.
- Importing WebP WASM assets explicitly for service-worker coverage while also
  importing the existing Emscripten modules originally emitted duplicate encoder
  and decoder WASM files. The prototype now splits WebP encode/decode into
  injectable runtimes and generates patched WebP wrapper copies under
  `.svelte-kit/sqush-generated/` with the Emscripten fallback
  `new URL("webp_*.wasm", import.meta.url)` references removed. The app module,
  generated worker, and service worker now share the top-level WebP WASM URLs,
  and the static-output audit expects one baseline encoder, one SIMD encoder,
  and one decoder WebP WASM file. This proves the post-generation wrapper patch
  shape without editing committed codec artifacts.
- The production single-image pipeline helper import is now proven from
  SvelteKit for the WebP path: decode, preprocess, process, and compress all
  come from `src/client/lazy-app/image-pipeline.ts`. The broader app-shell
  import is still blocked where it crosses production-only Rollup virtual
  imports outside this seam: `omt:`, `url:`, `entry-data:`, `service-worker:`,
  and generated `feature-meta` entries that merge metadata with Preact option
  components.
- The production bulk processor import is now proven from SvelteKit for the
  same WebP path. `processBulkImageJob` accepts the structural
  `ImagePipelineWorkerBridge` type, so it no longer needs the production Rollup
  worker adapter type at its import boundary.
- The first `url:` seam is now proven for rotate: production keeps
  `src/features/preprocessors/rotate/worker/rotate.ts` as the Rollup adapter,
  while shared rotate logic lives in a runtime factory that accepts an injected
  WASM URL. The prototype generator supplies that URL from a generated Vite
  `?url` manifest through the SvelteKit worker bridge, so the worker no longer
  emits a second physical rotate WASM asset.
- The first `entry-data:` seam is now proven for service-worker cache planning:
  production still resolves real Rollup entries at the boundary, but the cache
  planning logic accepts plain `{ main, deps }` records that SvelteKit can
  generate from Vite worker and asset URL imports.
- The first `service-worker:` seam is now proven for registration: production
  keeps the Rollup URL adapter in `sw-bridge/index.ts`, while shared
  registration/update/share-target behavior lives in `sw-bridge/runtime.ts` and
  the prototype provides the SvelteKit service-worker URL explicitly.
- The current prototype pipeline imports production single-image helpers from
  `src/client/lazy-app/image-pipeline.ts` and the production bulk job processor
  from `src/client/lazy-app/bulk/processor.ts`, but it intentionally does not
  import the wider app shell. A reusable migration seam should keep splitting
  injectable codec workers, UI option controls, and Rollup virtual modules
  before attempting a drop-in app-shell import.
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
  behavior-preservingly while keeping existing imports compatible. The current
  prototype also proves WebP encode, resize, and an injected single-image
  pipeline surface can be split from Preact option controls.
- Replace the production `omt:` worker bridge with Vite worker imports. The
  prototype now proves the shared bridge runtime can be reused with a WebP-only
  SvelteKit module-worker adapter, but the full generated `features-worker`
  surface still needs incremental broadening.
- Generate the Vite-facing worker entry incrementally from an explicit ready
  surface. The current generated manifest enables `webpEncode`, single-thread
  `avifEncode`, `rotate`, QOI encode/decode, single-thread `jxlEncode` plus
  `jxlDecode`, `mozjpegEncode`, `quantize`, worker `resize`, and single-thread
  `oxipngEncode`; full production parity is blocked by threaded WASM runtime
  headers/nested-worker behavior for AVIF, JPEG XL, and OxiPNG, remaining
  `url:` WASM imports, stricter
  worker `ArrayBufferLike` types, and remaining codec asset URLs.
- Do not spend more prototype effort on WebP 2. It remains filtered from the
  generated SvelteKit worker surface because it is not currently a serious
  product target and may be removed later unless the codec becomes relevant.
- Replace production `url:` codec references with reusable runtimes plus
  generated Vite `?url` asset manifests, following the rotate preprocessor seam
  before broadening to the remaining codec surfaces.
- Replace `entry-data:` service-worker cache generation with `$service-worker`
  for the SvelteKit app shell plus generated `{ main, deps }` cache records for
  lazy/feature-detected workers and WASM assets, following the prototype
  `sqush-generated/service-worker/cache-plan.ts` proof.
- Resolve codec WASM duplication before production migration. The prototype now
  proves the WebP and QOI encoder/decoder shapes, MozJPEG encoder shape,
  ImageQuant processor shape, and resize/HQX processor shape with generated
  patched wrapper copies and injectable runtimes, while runtime loading still
  flows through generated manifest URLs and `locateFile` or explicit
  wasm-bindgen init URLs. Production still needs a decision between an
  equivalent post-generation transform, a codec rebuild option, or a checked-in
  wrapper patch before this is broadened.
- Keep the logical codec asset manifest as the next asset-seam shape. The
  manifest should stay the single owner of codec WASM URLs, while app code,
  worker bridge calls, and service-worker cache plans derive their URL lists
  from its records. Keep service-worker imports limited to precacheable records
  so tiny runtime assets cannot reappear as `data:` URLs in the install cache.

## Branch and merge guidance

- Keep this prototype disposable. Its app scaffold, generated manifests,
  diagnostic route UI, package dependencies, static-output audit scripts, and
  browser proof scaffolding should not merge to `main` by default.
- Merge or cherry-pick only production-safe seams from
  `code/sveltekit-migration-seams` after root checks and production smoke
  coverage confirm the current Preact/Rollup app still behaves the same.
- Use a separate follow-up branch for the next focused risk: threaded
  AVIF/JPEG XL/OxiPNG runtime proof, canonical codec worker/WASM asset URLs, or
  the minimal SvelteKit single-image slice after those risks are understood.
- The minimal SvelteKit slice should prove one real user-selected file through
  import, decode, process, encode, preview, export, and offline behavior. Start
  with WebP, add AVIF next, keep JPEG XL advanced, and leave WebP 2 out of
  scope.

## Non-goals

- No production UI migration.
- No bulk UI implementation.
- No codec deletion or movement.
- No server-side image processing.
