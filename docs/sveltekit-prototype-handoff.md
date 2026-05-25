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

Do not treat this as proof that the full current image pipeline is drop-in.
`src/client/lazy-app/image-pipeline.ts` and `bulk/processor.ts` still pull the
full generated encoder map, production worker bridge, Preact option entries, and
Rollup-only virtual import schemes. The next task should turn the successful
primitive imports into a reusable migration seam instead of broadening the
prototype into production UI.

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

### 3. Prototype offline proof

Status: proven for the prototype shell and WebP probe assets.

The prototype registers its emitted `service-worker.js` in production builds.
The static audit now confirms cache-manifest coverage for app entry/start/route
assets, page CSS, service-worker-imported codec workers, baseline WebP WASM, and
SIMD WebP WASM. Runtime Chrome verification confirmed the page becomes
service-worker controlled after reload and Cache Storage contains the app shell,
pipeline worker, baseline WebP WASM, and SIMD WebP WASM.

One important finding: SvelteKit's build manifest and the explicit codec asset
manifest can both contain the same WebP WASM URLs. Passing duplicates to
`cache.addAll` makes the service-worker install fail and the worker become
redundant, so the prototype de-dupes the install list with `Set`.

Extend `audit:static-output` and browser checks to confirm app shell, worker
assets, baseline WebP WASM, SIMD WebP WASM, and generated codec asset
references are cache-covered. If the available browser surface cannot expose
service workers, document that limitation and add the strongest static/runtime
proxy check available.

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

This is not yet production-migration-ready. A direct full image-pipeline import
is still blocked by production Rollup virtual imports (`omt:`, `url:`,
`entry-data:`, `service-worker:`), Preact option components in generated
feature metadata, and Emscripten codec wrappers that embed worker-local WASM
asset URLs. Those are concrete migration tasks, not evidence that SvelteKit
static output is the wrong target.

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
  metadata module and reintroducing the known AVIF/MozJPEG/QOI/WP2 blockers.

Next seam: replace the first Rollup virtual import assumption with a narrow
adapter or generated-file boundary, starting with the worker bridge (`omt:`)
because the SvelteKit prototype already proved Vite module workers can run the
WebP encoder path.

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
  `createWorkerBridgeRuntime(['webpEncode'], createWorker)` with a module
  worker URL, and the WebP pipeline probe now encodes through that shared bridge
  runtime instead of a bespoke `postMessage` wrapper.
- Runtime Chrome verification confirmed the controlled SvelteKit page still
  renders the bridge-factory WebP pipeline probe with `RIFF`/`WEBP`, caches the
  app shell and top-level baseline/SIMD WebP WASM assets, and does not add
  worker-local WASM URLs to Cache Storage.

Next worker seam: re-attempt a narrow real pipeline import through the
SvelteKit-facing adapter and document the next concrete blocker, likely
remaining full encoder-map or asset URL coupling.

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
