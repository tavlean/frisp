# SvelteKit prototype handoff

Last updated: 2026-05-25.

## Purpose

Create a small, disposable technical prototype that answers whether Sqush can
move from the current Rollup/Preact stack toward SvelteKit without weakening the
core product promise:

- image optimization stays local;
- no server upload path is introduced;
- offline/service-worker behavior remains viable;
- workers and WASM assets can be built and served reliably;
- existing framework-neutral helpers can be reused from a SvelteKit app.

This is not a production UI migration and not the bulk UI implementation.

## Recommended branch/worktree

Use Codex Desktop's **New Worktree** option from the existing
`code/sveltekit-prototype` branch. Keep `main` stable. The prototype branch may
add temporary dependencies, configuration, and scaffolding that would be too
noisy for the production app until proven.

## Prototype scope

Start with `prototypes/sveltekit/`.

The first milestone should prove:

1. Svelte 5/SvelteKit static output builds.
2. A Svelte route can import existing plain TypeScript helpers from the repo.
3. Bulk/session helpers can create and summarize a metadata-only batch.
4. The prototype can include a service-worker path or document what blocks it.
5. The prototype can explain how current worker/WASM codec assets would be
   handled before any real migration.

Use SvelteKit as the target. Do not broaden the spike to any non-SvelteKit
build path unless SvelteKit produces a concrete blocker that is documented with
a minimal reproduction.

Current npm versions checked on 2026-05-25:

- `svelte`: `5.55.9`
- `@sveltejs/kit`: `2.61.1`
- `@sveltejs/adapter-static`: `3.0.10`
- `@sveltejs/vite-plugin-svelte`: `7.1.2`
- `vite`: `8.0.14`
- `svelte-check`: `4.4.8`

Svelte MCP docs checked on 2026-05-25:

- `kit/project-types`
- `kit/adapter-static`
- `kit/service-workers`
- `kit/$service-worker`
- `kit/page-options`
- `kit/configuration`
- `kit/$app-environment`
- `kit/state-management`
- `kit/building-your-app`
- `kit/performance`
- `svelte/what-are-runes`
- `svelte/$state`
- `svelte/$derived`
- `svelte/$effect`
- `svelte/$props`
- `svelte/best-practices`
- `svelte/testing`
- `svelte/typescript`
- `svelte/v5-migration-guide`

Important SvelteKit/Svelte 5 guidance for this spike:

- Prefer `@sveltejs/adapter-static` and static output.
- Use SvelteKit's service-worker support and `$service-worker` manifest for
  built assets, static files, prerendered paths, and versioned cache names.
- Use `$app/environment` for browser/dev/build-time checks when needed.
- Keep browser-only APIs behind browser-only execution paths.
- Use Svelte 5 runes: `$state` for local mutable UI state, `$derived` for pure
  computed values, `$effect` only for real side effects, and `$props` for
  component inputs.
- Avoid `$effect` for state relationships that can be derived.
- Keep large binary payloads such as `File`, `Blob`, `ImageData`, workers, WASM
  modules, and object URLs out of deep reactive state unless there is a measured
  reason.
- Use keyed `{#each}` blocks for image jobs and stable job identity.
- Use `svelte-check` and the Svelte MCP autofixer before finalizing Svelte files.

Avoid:

- production bulk UI;
- replacing the current app shell;
- deleting or moving codecs;
- changing current Rollup build behavior;
- adding server-side image processing.

## Useful context files

Read these before working:

- `docs/phase-1-readiness-audit.md`
- `docs/svelte-migration-context.md`
- `docs/bulk-image-architecture.md`
- `docs/progress-dashboard.md`
- `docs/maintenance-status.md`
- `AGENTS.md`

## Current recommendation

The SvelteKit prototype is now the active engineering spike. It should answer
the build/platform question before production migration work begins.

If it succeeds, merge back lessons and small reusable config/docs first. Do not
merge a full UI rewrite by default.

## Autonomous next-task queue

Use this queue when continuing the prototype for longer autonomous runs. Work in
order, keep each checkpoint meaningful, and stop only when a task is proven,
blocked with a concrete reproduction, or a safer next task is clearly documented.

### 1. WebP single-image pipeline probe

Status: proven for a narrow WebP path.

The prototype now has a diagnostic SvelteKit path that starts from a locally
generated PNG `File`, uses existing local helper primitives for encode-to-source,
mime sniffing, browser decode, resize processing, output naming, percent change,
settings resolution, and settings hashing, then encodes through the existing
WebP worker module in a SvelteKit-built worker. Runtime browser verification
produced a real `RIFF`/`WEBP` output and export metadata.

Do not treat this as proof that the full current app shell is drop-in.
`src/client/lazy-app/image-pipeline.ts` now has a proven WebP prototype path for
decode, preprocess, process, and compression through the generated SvelteKit
worker bridge and encode-only metadata map, but `bulk/processor.ts` and the
wider app surface still cross production worker, UI option, and Rollup-only
virtual import boundaries. The next task should keep turning those remaining
boundaries into reusable migration seams instead of broadening the prototype
into production UI.

### 2. Reusable migration seams

Status: started.

The first behavior-preserving shared-source seam is in place:
`src/client/lazy-app/abort.ts` owns abort helpers, and
`src/client/lazy-app/image-decode.ts` owns browser decode/mime helpers. The broad
`util` module keeps re-exports for compatibility, production image-pipeline code
imports the narrow modules directly, and the SvelteKit prototype no longer needs
to import browser decode helpers through `util`.

If the pipeline probe needs tiny shared helpers, extract them from Preact code
only when the change is behavior-preserving and covered by checks. Prefer
framework-neutral helper modules over Svelte-specific or Preact-specific glue.
Do not broaden into production UI work.

The next seam is now partially proven for encoding: generated
`feature-meta/encoders` combines shared encoder metadata with runtime-only
encoder modules, while the existing generated `feature-meta` index keeps the
Preact option entries. `src/client/lazy-app/image-pipeline.ts` imports that
encode-only map and no longer imports the production Rollup `omt:` worker entry
for its worker type. The SvelteKit prototype imports the production
`decodeSourceImage`, `preprocessImage`, `processImage`, and `compressImage`
helpers for its WebP probe without importing Preact option components.

### 3. Prototype offline proof

Status: proven for the prototype shell, WebP probe assets, and the first
generated rotate WASM seam.

The prototype registers its emitted `service-worker.js` in production builds.
The static audit now confirms cache-manifest coverage for app entry/start/route
assets, page CSS, service-worker-imported codec workers, baseline WebP WASM,
SIMD WebP WASM, and emitted rotate WASM. Runtime Chrome verification confirmed
the page becomes service-worker controlled after reload and Cache Storage
contains the app shell, generated WebP features-worker, baseline WebP WASM, SIMD
WebP WASM, top-level rotate WASM, and the worker-local rotate WASM fetched by the
generated worker.

One important finding: SvelteKit's build manifest and the explicit codec asset
manifest can both contain the same WebP WASM URLs. Passing duplicates to
`cache.addAll` makes the service-worker install fail and the worker become
redundant, so the prototype de-dupes the install list with `Set`.

Extend `audit:static-output` and browser checks as new codec surfaces are added.
If the available browser surface cannot expose service workers, document that
limitation and add the strongest static/runtime proxy check available.

### 4. Codec asset duplication

Status: documented blocker.

Static output currently emits three baseline WebP WASM files and three SIMD
WebP WASM files:

- top-level SvelteKit assets from the app's explicit WebP asset probe import;
- app-worker-local assets from the app's Emscripten encoder worker graph;
- service-worker-worker-local assets from importing worker URLs in the
  service-worker graph.

Removing explicit WebP WASM URLs from `codecAssetUrls` avoids duplicate
`cache.addAll` install-list entries while keeping top-level WebP WASM covered by
SvelteKit's build manifest. The prototype now passes those top-level WASM URLs
from the app module into the WebP probe workers and exposes them through an
Emscripten `locateFile` hook before initializing the encoder module. Runtime
Chrome verification showed the controlled page still encodes WebP, Cache Storage
contains the top-level baseline and SIMD WASM assets, and no worker-local WASM
URLs are runtime-cached.

This does not remove physical duplicates, because the Emscripten-generated WebP
JS still contains `new URL("webp_enc*.wasm", import.meta.url)` references, and
Vite emits those assets separately for each worker graph.

Production migration implication: make codec JS and service-worker manifests
share one generated asset URL per WASM file, or patch/regenerate codec wrappers
so WASM URLs are externalized instead of embedded as worker-local
`new URL(..., import.meta.url)` references.

For tiny WASM files, Vite's default asset inlining can hide a codec asset inside
the JS bundle. The prototype now disables WASM inlining so emitted files and
service-worker coverage remain visible. It also keeps service-worker codec
assets in a narrow module that avoids importing the generated rotate manifest
from the service-worker graph; the app's SvelteKit build manifest already
pre-caches the top-level rotate WASM, and runtime caching covers the worker-local
rotate WASM after first use.

### 5. Readiness verdict

Status: ready for a platform decision.

Verdict: SvelteKit static output can safely carry Sqush's local-first
single-image optimizer architecture if the migration is done as a build/runtime
port with explicit seams, not as a direct app-shell import. The prototype proves
the important platform pieces: static output, Svelte 5 state, shared bulk/session
helper imports, generated WebP shared metadata, browser-only image helper reuse,
Vite module workers, real WebP WASM encoding, service-worker registration,
offline cache coverage for the app shell and WebP probe assets, and runtime
`locateFile` control over which WebP WASM URLs are cached.

This is not yet production-migration-ready. The WebP single-image helper path in
the production image pipeline is now importable from SvelteKit, including
decode, preprocess, process, and compression, but a broader direct app import is
still blocked by remaining production Rollup virtual imports (`omt:`, broader
`url:`, `entry-data:`, `service-worker:`), UI option entries outside that seam,
and Emscripten codec wrappers that embed worker-local WASM asset URLs. The
rotate seam proves the likely `url:` replacement shape for a small WASM
preprocessor: split the production Rollup adapter from a reusable runtime that
accepts a generated Vite `?url` asset. Those are concrete migration tasks, not
evidence that SvelteKit static output is the wrong target.

Safest next engineering track:

1. Split generated codec metadata into framework-neutral shared metadata and UI
   option entries.
2. Replace Rollup virtual imports with Vite/SvelteKit-compatible worker, URL,
   entry-data, and service-worker asset seams.
3. Externalize or generate canonical codec WASM asset URLs so app code,
   workers, and service-worker manifests agree on one runtime URL per WASM file.
4. Only after those seams exist, build a minimal SvelteKit single-image editor
   slice around real user-selected files and compare import, decode, process,
   encode, preview, export, and offline behavior against the current Preact app.

Migration-seams progress on `code/sveltekit-migration-seams`:

- The production `feature-plugin` now emits
  `src/client/lazy-app/feature-meta/shared.ts` as a generated shared-only
  metadata module. It contains encoder metadata, encoder/processor/preprocessor
  state types, default processor state, and default preprocessor state without
  importing encoder client entries or Preact option components.
- The existing generated `feature-meta/index.ts` remains the compatibility layer
  for the Preact app shell. It re-exports shared types/defaults and builds the
  full encoder map by adding the existing encoder client entries.
- Pure or mostly framework-neutral production helpers that only need metadata
  now import from `feature-meta/shared`, including bulk settings/processor
  helpers and saved-settings/side-state/work-plan/editor-state helpers.
- The SvelteKit prototype generator now mirrors that path shape by emitting
  WebP-only `feature-meta/shared.ts` and `feature-meta/index.ts` files under
  `.svelte-kit/sqush-generated/`. This keeps the prototype on the narrow WebP
  metadata proof instead of falling through to the full production shared
  metadata module and reintroducing the known AVIF/MozJPEG/WP2 blockers.
- The production rotate preprocessor worker now has a reusable runtime factory
  that accepts a WASM URL, while the production `rotate.ts` remains the Rollup
  `url:` adapter. The SvelteKit prototype generator emits a Vite `?url` rotate
  WASM manifest and wires it into the generated WebP-first features worker.
- The prototype pipeline now exercises that generated worker `rotate` method
  before resize/WebP encode. Runtime Chrome verification produced valid
  `RIFF`/`WEBP` output with the `rotate=90` stage visible and Cache Storage
  covering both the top-level rotate WASM and the worker-local rotate WASM.
- `src/sw/cache-plan.ts` now owns the framework-neutral service-worker cache
  planning logic for Rollup `entry-data:` records shaped as `{ main, deps }`.
  Production `src/sw/to-cache.ts` still imports Rollup virtual modules at the
  boundary, but initial-cache and feature-detected codec-cache selection now run
  through a reusable helper with focused tests.
- The SvelteKit prototype generator now emits
  `.svelte-kit/sqush-generated/service-worker/cache-plan.ts`, which mirrors the
  same `{ main, deps }` shape with Vite worker URLs and generated WebP WASM URL
  deps. The prototype service-worker asset list consumes that generated plan,
  proving the first replacement shape for production `entry-data:` cache
  records without changing current production offline behavior.
- `src/client/lazy-app/sw-bridge/runtime.ts` now owns the framework-neutral
  service-worker registration/update/share-target bridge. Production
  `src/client/lazy-app/sw-bridge/index.ts` keeps the Rollup `service-worker:`
  URL import as a tiny adapter, while the SvelteKit prototype calls the same
  registration helper with its emitted `/service-worker.js` URL from
  `prototypes/sveltekit/src/lib/service-worker-registration.ts`.

Next seam: broaden the generated Vite-facing worker/cache surface only as each
codec's URL, thread-support, and type blockers are resolved. The remaining
Rollup virtual assumptions are now smaller: non-WebP `url:` codec assets,
thread-support aliases, and production codec wrappers that still embed
worker-local WASM URLs.

Worker-bridge seam progress:

- `src/client/lazy-app/worker-bridge/runtime.ts` now owns the reusable Comlink
  bridge runtime and accepts explicit method names plus a `createWorker`
  function.
- `src/client/lazy-app/worker-bridge/bridge.ts` adapts that runtime to the
  production generated `methodNames` list.
- `src/client/lazy-app/worker-bridge/index.ts` is now the Rollup adapter that
  imports the current `omt:` worker URL and passes `() => new Worker(workerURL)`
  into the shared bridge factory.
- Root `npm run check` and `npm run smoke:browser` passed after the split,
  including real WebP output, resize processing, saved-settings import, and
  offline app-shell reload.
- The SvelteKit prototype now has a WebP-only Vite adapter at
  `prototypes/sveltekit/src/lib/sveltekit-worker-bridge.ts`. It uses
  generated SvelteKit worker metadata and a generated WebP-first module worker
  URL, and the WebP pipeline probe now encodes through that shared bridge
  runtime instead of a bespoke or handwritten worker entry.
- Runtime Chrome verification confirmed the controlled SvelteKit page still
  renders the bridge-factory WebP pipeline probe with `RIFF`/`WEBP`, caches the
  app shell and top-level baseline/SIMD WebP WASM assets, and does not add
  worker-local WASM URLs to Cache Storage.
- `src/features/encoders/webP/client/runtime.ts` and
  `src/features/processors/resize/client/runtime.ts` now expose the WebP encode
  and resize runtime helpers without importing Preact option controls.
- `src/client/lazy-app/image-pipeline.ts` now provides a SvelteKit-importable
  single-image helper surface for decode, preprocess, process, and WebP
  compression. The SvelteKit probe calls those production helpers through the
  generated encode-only metadata/runtime map plus the SvelteKit worker bridge.
- The SvelteKit prototype sync step now emits
  `.svelte-kit/sqush-generated/codec-assets/webp.ts` as the canonical WebP
  encoder WASM URL manifest. The service-worker asset list and
  `SvelteKitWorkerBridge` both consume those generated URLs, so the app, worker
  bridge, and cache manifest agree on the top-level WebP WASM asset URLs.
- The SvelteKit prototype sync step now emits
  `.svelte-kit/sqush-generated/worker-surface/ready.ts`. The generated worker
  bridge metadata imports its ready method-name list, and the same file records
  blocked worker methods with their current codec asset, thread-support, or type
  blockers.
- `qoiEncode` and `qoiDecode` have moved from blocked to ready in that generated
  worker-surface manifest. The prototype now generates
  `.svelte-kit/sqush-generated/codec-assets/qoi.ts`, passes the QOI encoder and
  decoder WASM URLs through the SvelteKit worker bridge, verifies a `qoif`
  output plus 3x3 QOI decode round trip in the runtime pipeline probe, and
  audits service-worker cache coverage for both QOI WASM assets.
- `mozjpegEncode` has moved from blocked to ready in the generated
  worker-surface manifest. The prototype now generates
  `.svelte-kit/sqush-generated/codec-assets/mozjpeg.ts`, passes the MozJPEG
  encoder WASM URL through the SvelteKit worker bridge, verifies JPEG
  `ff d8 ff` output in the runtime pipeline probe, and audits service-worker
  cache coverage for the MozJPEG WASM asset. The shared MozJPEG metadata now
  exposes local numeric color-space constants instead of importing a
  declaration-only codec enum as a runtime value.
- `quantize` has moved from blocked to ready in the generated worker-surface
  manifest. The prototype now generates
  `.svelte-kit/sqush-generated/codec-assets/imagequant.ts`, passes the
  ImageQuant WASM URL through the SvelteKit worker bridge, verifies a
  reduced-color ImageData result in the runtime pipeline probe, and audits
  service-worker cache coverage for the ImageQuant WASM asset. The production
  quantize worker now returns an ImageData-compatible `Uint8ClampedArray`
  instance under stricter SvelteKit TypeScript settings.
- Worker `resize` has moved from blocked to ready in the generated
  worker-surface manifest. The prototype now generates
  `.svelte-kit/sqush-generated/codec-assets/resize.ts`, passes resize and HQX
  WASM URLs through the SvelteKit worker bridge, verifies a 2x2 ImageData result
  in the runtime pipeline probe, and audits service-worker cache coverage for
  both wasm-bindgen assets. The production resize worker keeps its default
  Rollup-compatible initialization path while accepting optional injected WASM
  URLs for Vite/SvelteKit.
- `oxipngEncode` has moved from blocked to ready for the single-thread runtime
  path in the generated worker-surface manifest. The prototype now resolves the
  `worker-shared` alias through SvelteKit, generates
  `.svelte-kit/sqush-generated/codec-assets/oxipng.ts`, passes the OxiPNG WASM
  URL through the SvelteKit worker bridge, verifies PNG `89 50 4e 47` output in
  the runtime pipeline probe, and audits service-worker cache coverage for the
  single-thread OxiPNG WASM asset. Importing the OxiPNG module still emits the
  parallel wasm-bindgen helper and parallel WASM assets, but the prototype does
  not enable or cache that threaded runtime path yet.

Next worker seam: pick another blocked method from the generated worker-surface
manifest, resolve only that method's asset URL, thread-support alias, or worker
type blocker, and then move it into the ready list with prototype verification.

Full worker-surface blocker inventory:

- Importing the production `features-worker` surface directly from SvelteKit
  still pulls every codec worker, not just WebP. That reintroduces AVIF, WP2,
  JXL, and AVIF/JXL/WP2 decoder type/build issues before the prototype needs
  those codecs. QOI encode/decode, MozJPEG encode, single-thread OxiPNG encode,
  quantize, and worker resize now have narrow generated SvelteKit paths, but the
  broader production worker surface remains intentionally filtered.
- AVIF, JXL, and WP2 workers still need focused threaded-codec passes.
  `worker-shared/supports-wasm-threads` now has a SvelteKit alias shape, but the
  actual threaded WASM runtime still needs COOP/COEP, nested-worker, worker
  helper asset, and service-worker cache proof before those threaded paths can
  be considered production-ready.
- Rotate now has a proven split: production keeps the Rollup `url:` adapter,
  while the SvelteKit generated worker imports the shared rotate runtime with a
  generated Vite `?url` asset manifest.
- Resize now has a proven split: production keeps default wasm-bindgen
  initialization, while the SvelteKit generated worker passes resize/HQX WASM
  URLs from a generated Vite `?url` asset manifest.
- Importing the production generated `feature-meta/index.ts` from SvelteKit
  still pulls Preact `.tsx` encoder option entries. The production generator now
  emits `feature-meta/encoders.ts` as the SvelteKit-safe encode runtime map, and
  future seams should follow that pattern for any non-UI runtime surface that
  still depends on UI option entries.

Recommended next implementation step: use the generated worker-surface manifest
as the admission list for the next narrow method. The lowest-risk candidate is
the method whose blocker can be removed with a small asset-manifest or type
adapter change, without importing the full production `features-worker` surface.

### Verification expectations

- In `prototypes/sveltekit`: run `npm run check`, `npm run build`,
  `npm run audit:static-output`, and `npm audit --audit-level=low`.
- Run Svelte MCP autofixer for changed `.svelte` files.
- Run browser/render checks for runtime or service-worker behavior changes.
- Run root `npm run check` when touching shared production source.
- Commit meaningful checkpoints.
- Push when CI feedback is useful and check the CI result.

## Fresh-chat prompt

Use this short goal prompt in a new Codex chat. The goal text is intentionally
compact so it fits Codex Desktop's goal length limit; the detailed context lives
in the files it tells the new agent to read.

```text
Continue Sqush's SvelteKit 2 / Svelte 5 technical prototype until it can give a
clear migration-readiness answer for Sqush's local-first single-image optimizer.

Use Codex Desktop New Worktree from branch `code/sveltekit-prototype`.

Read first:
- AGENTS.md
- docs/sveltekit-prototype-handoff.md
- docs/svelte-migration-context.md
- docs/phase-1-readiness-audit.md
- docs/bulk-image-architecture.md
- docs/browser-support.md
- docs/codec-provenance.md
- prototypes/sveltekit/README.md

Prototype lives in `prototypes/sveltekit/`.

Constraints:
- Keep Sqush local/offline/serverless; no uploads or server image processing.
- Keep SvelteKit static output as the target unless there is a concrete blocker
  documented with a minimal reproduction.
- Do not implement production bulk UI.
- Do not start a full production migration.
- Do not replace the current Preact app shell.
- Do not delete/move codecs, generated metadata, workers, or WASM assets.
- Use Svelte MCP/docs when creating, editing, or analyzing Svelte code.
- Keep the prototype disposable and separated under `prototypes/sveltekit`.

Current prototype already proves SvelteKit static output, shared helpers,
generated WebP metadata, Vite workers/WASM, WebP pipeline encoding, and offline
cache coverage. Continue through the "Autonomous next-task queue" in
`docs/sveltekit-prototype-handoff.md`, committing meaningful checkpoints.

Verification: use the handoff's verification expectations. Push when CI feedback
is useful and check the CI result.
```
