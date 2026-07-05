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
  `app-generated` modules.

## Generated Runtime Files

`scripts/sync-sveltekit-app.mjs` writes generated files under
`.svelte-kit/app-generated/`. The important generated groups are:

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
  decodable AVIF/WebP WASM decoders);
- activate: delete old Frisp caches and claim clients;
- fetch: serve known assets cache-first (runtime-caching misses, so a
  non-precached variant still ends up cached after first use — a
  mis-detection costs one online network trip, never a broken codec),
  otherwise network-first with cache fallback;
- message: on `{ type: 'SKIP_WAITING' }` from the page, call `skipWaiting()`
  to promote this build past the waiting state (the update prompt, below).

Update flow — prompt, don't hijack (so a deploy reaches users instead of
pinning them to the first build they cached — every asset, including the
prerendered HTML, is served cache-first, so without this an old worker keeps
control indefinitely):

- A new build installs into the **waiting** state (the active controller blocks
  auto-activation — install deliberately does *not* call `skipWaiting()`).
- Registration (`sw-bridge/runtime.ts`) watches for that waiting worker —
  whether it installs during this visit (`updatefound` → `installed`) or was
  already waiting from a previous visit (`registration.waiting`) — and fires
  `onUpdateReady`. `+page.svelte` surfaces it as a persistent (`timeout: null`)
  snackbar: "A new version of Frisp is available — Refresh".
- Clicking **Refresh** calls `applyServiceWorkerUpdate()`, which posts
  `SKIP_WAITING` to the waiting worker. It activates, `clients.claim()` swaps
  the controller, and a one-time `controllerchange` listener reloads the tab
  onto the new build (guarded by `container.controller` so a first-time
  visitor's initial `clients.claim()` doesn't cause a spurious refresh).
- `updateViaCache: 'none'` (register option) forces the browser to revalidate
  `service-worker.js` against the network on every check, and `static/_headers`
  marks `/service-worker.js` `Cache-Control: no-cache` — together a stale copy
  in Cloudflare's edge or the browser HTTP cache can't hide a deploy.

**Cloudflare zone setting (one-time, not in the repo):** the `_headers`
`Cache-Control` rules only take effect if the zone's **Browser Cache TTL** is
set to **"Respect Existing Headers"** (Caching → Configuration). The default
(4 h) silently overrides *every* origin `Cache-Control`, which both pins the
worker behind a 4 h cache and caps the content-hashed `/_app/immutable/*` assets
at 4 h instead of the year-long `immutable` cache `_headers` grants them. Leave
Pages **Build cache** (Beta) off — it caches build *outputs* between CI builds
and can resurface stale-artifact confusion given the codec/`$service-worker`
codegen; it has no effect on what users are served.

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
`SharedArrayBuffer` — is set via the `presk-cross-origin-isolation` Vite plugin in
`vite.config.ts` (dev + preview) and `static/_headers` (host). Full record:
[threading-enablement.md](threading-enablement.md).

**Dev-server caveat (`vite dev`):** the Emscripten pthread workers
(`*_mt.worker.js`) are **classic** workers and must be served byte-for-byte. Vite's
dev transform otherwise injects an ESM `/@vite/client` import into them (illegal in
a classic worker), so the thread pool never engages and threaded encodes stall
(~50× slower) — dev-only, since a `vite build` emits them as raw hashed assets. The
`presk-raw-threaded-codec-workers` plugin in `vite.config.ts` serves
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
- `npm run format:check` — the read-only CI check, split into its own GitHub
  Actions job on 2026-07-01.

There is a **code-only pre-commit hook** again as of 2026-07-01
(`7b16e0ce`): `simple-git-hooks` installs `pre-commit: npx lint-staged` via the
npm `prepare` script (`scripts/install-git-hooks.mjs`), and lint-staged runs
`prettier --write` only on staged `*.{js,css,json,ts,tsx,svelte}` files. The
2026-06-02 Husky hook removal still stands historically (the old hook rewrote
Markdown and interrupted commits), but the current hook deliberately excludes
`*.md`.

`*.md` is intentionally excluded from every Prettier path — the hook, `format`,
and `format:check`. Prettier's Markdown formatter reflows prose and mangles
hand-written docs, so format Markdown by hand. See [STATUS.md](STATUS.md).
