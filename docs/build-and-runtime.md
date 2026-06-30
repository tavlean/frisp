# Build And Runtime Map

This branch uses SvelteKit and Vite at the repo root. The old Rollup build has
been removed from the `svelte` branch.

## Commands

`npm run dev` starts the SvelteKit dev server.

`npm run build` runs:

1. `npm run sync`
2. `vite build`

`npm run check` runs:

1. `prettier --check`
2. `npm run sync`
3. `svelte-kit sync`
4. `svelte-check --tsconfig ./tsconfig.json`
5. `npm run build`
6. `npm run audit:static-output`

`npm run preview` serves the generated `build/` folder with Vite preview.

## SvelteKit Config

- `src/routes/+layout.ts` exports `ssr = false` and `prerender = true`.
- `svelte.config.js` uses `@sveltejs/adapter-static` with `fallback: '200.html'`.
- Service-worker auto-registration is disabled so `src/lib/service-worker-registration.ts`
  can handle dev cleanup and production registration explicitly.
- `vite.config.ts` and `svelte.config.js` define aliases for `client`,
  `features`, `shared`, `sw`, `codecs`, `worker-shared`, and generated
  `sqush-generated` modules.

## Generated Runtime Files

`scripts/sync-sveltekit-app.mjs` writes generated files under
`.svelte-kit/sqush-generated/`. The important generated groups are:

- `feature-meta/`: encoder/processor/preprocessor metadata.
- `features-worker/webp.ts`: generated Comlink worker entry covering active
  codecs and processors.
- `worker-bridge/meta.ts`: method names and worker API type.
- `worker-surface/ready.ts`: ready and intentionally blocked worker methods.
- `codec-assets/`: Vite URL imports and logical codec asset manifests,
  including `codec-assets/service-worker.ts` — the curated record list the
  service worker variant-selects from. It deliberately excludes `?worker`
  imports (they would make the SW build re-emit duplicate worker chunks) and
  sub-inline-limit assets like the rotate WASM and the `*_mt.worker.js`
  pthread stubs (the SW build ignores the app's `assetsInlineLimit` and would
  inline them as unusable `data:` URLs; they precache with the app shell via
  `$service-worker`'s `build` list instead).
- `codecs/`: patched wrapper copies that avoid duplicate WASM emissions.

(The old `service-worker/cache-plan.ts` generated module is gone — replaced by
`codec-assets/service-worker.ts` above; `npm run sync` removes stale copies.)

Generated files are ignored and can be deleted; `npm run sync` recreates them.

## Service Worker

`src/service-worker.ts` imports `{ build, files, prerendered, version }` from
`$service-worker` plus the curated codec-asset records from
`src/lib/service-worker-codec-assets.ts` (a re-export of the generated
`codec-assets/service-worker.ts`).

Behavior (variant-aware precache, 2026-06-10 — first-visit payload
14.3 MB → ~6.8 MB):

- install: feature-detect what this browser will actually run — WASM threads
  and SIMD via `wasm-feature-detect`, native AVIF/WebP decode via tiny
  `createImageBitmap` probes — then precache the app shell (everything in
  `build` minus codec variants and diagnostics probe workers, plus static
  files and prerendered paths) and only the codec variants selected by
  `selectCodecPrecacheUrls()` in `src/sw/cache-plan.ts` (e.g. threads+SIMD
  Chromium gets `avif_enc_mt` + `jxl_enc_mt_simd` + `webp_enc_simd` +
  oxipng-MT and skips the single-thread/baseline builds and the natively
  decodable AVIF/WebP WASM decoders), then `skipWaiting()` so a
  freshly-deployed worker activates without waiting for every tab to close;
- activate: delete old Sqush caches and claim clients;
- fetch: serve known assets cache-first (runtime-caching misses, so a
  non-precached variant still ends up cached after first use — a
  mis-detection costs one online network trip, never a broken codec),
  otherwise network-first with cache fallback.

Auto-update flow (so a deploy reaches users instead of pinning them to the
first build they cached — every asset, including the prerendered HTML, is
served cache-first, so without this an old worker keeps control indefinitely):

- `skipWaiting()` (install) + `clients.claim()` (activate) hand control to the
  new build as soon as it installs, rather than parking it in the waiting state.
- Registration (`sw-bridge/runtime.ts`) uses `updateViaCache: 'none'` so the
  browser always revalidates `service-worker.js` against the network, and a
  one-time `controllerchange` listener reloads an already-controlled tab when
  the new worker takes over (guarded by `container.controller` so first-time
  visitors don't get a spurious refresh — the running document otherwise keeps
  referencing the previous build's hashed chunks, now purged from the cache).
- `static/_headers` marks `/service-worker.js` `Cache-Control: no-cache` so a
  stale copy in Cloudflare's edge or the browser HTTP cache can't hide a deploy.

`version` (hence `cacheName`) defaults to SvelteKit's build timestamp, so the
worker bytes change every build and the update check always fires.

Known approximation: nested-worker support (the Safari 16 gap) can't be
probed from SW scope, so such a browser precaches `_mt` builds it won't use;
the single-thread fallback loads on demand.

Production preview is required for realistic service-worker testing. Note
`vite preview` (sirv) snapshots the file list at startup — after a rebuild,
restart the preview server or new hashed filenames 404.

## Codec Assets

Codec JS/WASM artifacts are committed under `codecs/`. Do not edit or delete
them during ordinary migration cleanup. The SvelteKit generator imports these
assets through Vite `?url` modules and passes explicit URLs into worker runtimes
or Emscripten `locateFile`.

`npm run audit:static-output` verifies the build emits one physical WASM copy
per logical asset, that the service worker references the expected assets and
carries the variant-aware precache machinery, and that the service-worker
build emits **no** duplicate worker chunks of its own (top-level
`assets/*.js`).

**Multithreading is enabled** (2026-06-03): the generator
(`sync-sveltekit-app.mjs`) emits the threaded variants and real thread detection,
so AVIF / JXL (Emscripten pthreads) and oxipng (wasm-bindgen-rayon) engage
multi-core, with single-thread fallback intact. The data contract
(`src/shared/codec-assets.ts`) carries the `multi-thread` / `worker-helper` /
`threaded-only` records, and `audit:static-output` asserts the threaded helper
assets are now present. Cross-origin isolation (COOP/COEP) — required for
`SharedArrayBuffer` — is set via the `sqush-cross-origin-isolation` Vite plugin in
`vite.config.ts` (dev + preview) and `static/_headers` (host). Full record:
[threading-enablement.md](threading-enablement.md).

**Dev-server caveat (`vite dev`):** the Emscripten pthread workers
(`*_mt.worker.js`) are **classic** workers and must be served byte-for-byte. Vite's
dev transform otherwise injects an ESM `/@vite/client` import into them (illegal in
a classic worker), so the thread pool never engages and threaded encodes stall
(~50× slower) — dev-only, since a `vite build` emits them as raw hashed assets. The
`sqush-raw-threaded-codec-workers` plugin in `vite.config.ts` serves
`codecs/**/*_mt(_simd)?.worker.js` raw in dev to fix this (`configureServer`-only;
prod build unaffected). Details in
[threading-enablement.md](threading-enablement.md).

## Tests

- `npm run check` — static gate (format, svelte-check, build, asset audit).
- `npm run test:e2e` — Playwright browser regression (`tests/e2e/`): boots the
  production preview, asserts cross-origin isolation, encodes through every
  codec asserting valid output magic bytes, and tests SW offline reload. The
  webServer builds + previews automatically. **Run after any codec/build change.**
- `npm test` runs both.
- `npm run bench` / `npm run bench:compare` — codec benchmark (`benchmarks/`):
  per-codec output size + encode time + reliability, with a before/after diff to
  gate codec upgrades and produce performance numbers. See `benchmarks/README.md`.

## Formatting

Prettier is the formatter (`.prettierrc.json`). Run it manually:

- `npm run format` — write fixes across `**/*.{js,css,json,ts,tsx,svelte}`.
- `npm run format:check` — the read-only check that `npm run check` runs first.

There is intentionally **no pre-commit hook**. Husky/lint-staged were removed on
2026-06-02 (solo project; the auto-`prettier --write` interrupted commits and
reflowed Markdown). `*.md` is intentionally excluded from the Prettier globs —
Prettier's Markdown formatter reflows prose and mangles hand-written docs, so
format Markdown by hand. See [STATUS.md](STATUS.md).
