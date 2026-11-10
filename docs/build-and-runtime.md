# Build And Runtime Map

Last updated: 2026-11-10.

The production app lives on `main` at the repo root, built with SvelteKit and
Vite as a static SPA. The retired Preact/Rollup app is preserved only on the
`preact` branch (tag `preact-final`); the old `svelte` branch is gone.

## Commands

`npm run dev` starts the SvelteKit dev server.

`npm run build` runs:

1. `npm run sync`
2. `vite build`

`npm run check` runs:

1. `npm run typecheck` (`npm run sync`, `svelte-kit sync`,
   `svelte-check --tsconfig ./tsconfig.json --fail-on-warnings`, then
   `tsc -p tsconfig.service-worker.json` for the service worker, which is its
   own TypeScript project because it needs WebWorker types, then
   `tsc -p tests/tsconfig.json` for the tests and the three root config files)
2. `vite build`
3. `npm run audit:static-output`

`npm run preview` serves the generated `build/` folder with Vite preview.

## SvelteKit Config

- `src/routes/+layout.ts` exports `ssr = false` and `prerender = true`.
- SvelteKit 3: there is no `svelte.config.js`. The config is passed to the
  `sveltekit()` plugin in `vite.config.ts`: `@sveltejs/adapter-static` with
  `fallback: '404.html'` as its only option, `compilerOptions.discloseVersion:
  false`, and `version.pollInterval: 0`, which turns off the hourly poll of
  `_app/version.json`. There is no `vitePreprocess()`. SvelteKit still fetches
  `_app/version.json` each time the tab regains focus or becomes visible. When
  that turns `updated.current` true, `src/routes/+page.svelte` calls
  `checkForServiceWorkerUpdate()`, so the service worker's update prompt
  (below) appears sooner.
- Hosting fallback (since 2026-11-10): `wrangler.jsonc` sets
  `not_found_handling: "404-page"`, so an unknown URL gets `404.html` with
  status 404. That file is the adapter's fallback shell, which uses absolute
  asset paths, so it boots at any depth and renders the root
  `src/routes/+error.svelte` (`tests/e2e/not-found.spec.ts`). Before, the host
  served `index.html` (relative paths) for every unknown URL: a nested unknown
  URL loaded a blank page and every path answered 200. Verified on
  2026-11-10 with `wrangler dev` and on a Cloudflare preview version
  (`wrangler versions upload`, which does not touch production): `/` answers
  200; `/nope`, `/a/b/c`, `/lab` and `/diagnostics` answer 404 with absolute
  asset paths.
- Service-worker auto-registration is disabled so `src/lib/service-worker-registration.ts`
  can handle dev cleanup and production registration explicitly.
- Imports resolve through the `imports` field of `package.json` (Node subpath
  imports): `#lib/*`, `#client/*`, `#features/*`, `#shared/*`, `#sw/*`,
  `#worker-shared/*`, `#codecs/*`, and `#app-generated/*` (now only patched
  codec wrappers). Node, Vite, TypeScript and Vitest all read that field, so
  there is no alias map, no `resolve.alias` and no TypeScript `paths`.
  Specifiers carry the real file extension, because subpath imports do no
  extension or index lookup. SvelteKit 3's deprecated `alias` option and the
  old `$lib` are not used (moved 2026-11-10).
- `tsconfig.json` extends `$app/tsconfig` (generated into `node_modules/$app/`),
  not `.svelte-kit/tsconfig.json`.
- `src/service-worker.ts` reads its lists from `$app/manifest`, `$app/env` and
  `$app/paths` (`$service-worker` is gone in SvelteKit 3). It drops
  `static/_headers` from the precache itself, since the old
  `serviceWorker.files` config filter no longer exists.

## Runtime Source And Patched Wrappers

Former generated runtime modules are committed source now:

- `src/client/lazy-app/feature-meta/`: encoder/processor/preprocessor
  metadata.
- `src/worker/codec-worker.ts`: Comlink worker entry. It builds the codec
  runtimes and exposes three ops from `src/worker/pipeline-op.ts`:
  `optimize` (decode or reuse the source, run the recipe, encode, optionally
  decode the output back), `prepare` (the rotated source frame for a
  main-thread view), and `decodeOutput`. Every reply buffer is transferred.
- `src/lib/sveltekit-worker-bridge.ts`: the three op names, the codec URL
  groups sent with each op, and the per-bridge OxiPNG thread count.
- `src/shared/codec-asset-records.json`: the logical codec-asset record source
  of truth (logical key, codec, role, variant, relative path, cache class).
- `src/shared/codec-assets/`: Vite `?url` imports plus app, precache, and
  service-worker record selections derived from the JSON records. The
  service-worker module remains curated so it avoids `?worker` imports and
  sub-inline-limit assets like rotate WASM and `*_mt.worker.js` pthread stubs.

`npm run sync` now runs `scripts/patch-codec-wrappers.mjs` only. It writes
patched Emscripten/wasm-bindgen wrapper copies under
`.svelte-kit/app-generated/codecs/**` so Vite does not emit duplicate
worker-local WASM assets. The `#app-generated/*` import points at that wrapper tree.

The patched wrapper files are ignored and can be deleted; `npm run sync`
recreates them. The committed runtime modules above are ordinary source files.

## The Worker Pipeline

Every raster encode is one `optimize` call (since 2026-11-04,
[project/specs/2026-11-04-worker-side-pipeline.md](project/specs/2026-11-04-worker-side-pipeline.md)):

- The request carries the source `File` (structured-cloned by reference, no
  byte copy), a source key from `src/lib/source-key.ts`, and the recipe. An SVG
  source sends pixels instead, rasterized on the main thread, and only when the
  worker answers `needs-source`.
- The worker keeps one decoded source (plus one rotation of it) per worker.
  The bridge terminates a worker on abort and after 60 s idle, which drops the
  cache; the next call decodes again. A slider drag that aborts mid-encode
  therefore pays a decode, not a structured clone.
- Decode inside the worker tries `createImageBitmap` plus `OffscreenCanvas`
  first, and the AVIF, WebP, or JXL WASM decoder when the browser refuses;
  QOI is always WASM.
- The reply transfers the encoded bytes and, when asked, the decoded preview.
  `tests/e2e/worker-pipeline.spec.ts` fails if the page posts any worker a
  frame-sized buffer without transferring it.
- Bridges take a `threads` option that sizes OxiPNG's pool for that worker;
  bulk passes `bulkThreadBudget` (half the cores per slot). AVIF and JXL fix
  their pthread counts at build time.

## Service Worker

`src/service-worker.ts` builds its `build`, `files` and `prerendered` lists from
`$app/manifest` (`immutable`, `assets`, `prerendered`), takes `version` from
`$app/env`, and imports the curated codec-asset records from
`src/lib/service-worker-codec-assets.ts` (a re-export of
`src/shared/codec-assets/service-worker.ts`).

Behavior (variant-aware precache, 2026-06-10 — first-visit payload
14.3 MB → ~6.8 MB):

- install: feature-detect what this browser will actually run — WASM threads
  and SIMD via `wasm-feature-detect`, native AVIF/WebP decode via tiny
  `createImageBitmap` probes — then precache the app shell and only the codec
  variants selected by
  `selectCodecPrecacheUrls()` in `src/sw/cache-plan.ts` (e.g. threads+SIMD
  Chromium gets `avif_enc_mt` + `jxl_enc_mt_simd` + `webp_enc_simd` +
  oxipng-MT and skips the single-thread/baseline builds and the natively
  decodable AVIF/WebP WASM decoders). The QOI and MozJPEG encoders are never
  precached: neither is a selectable output (MozJPEG left the picker on
  2026-11-04), so they stay runtime-cacheable only;
- install also fetches `/_app/worker-precache.json` and precaches every worker
  chunk it lists (codec worker, SVG optimizer worker, OxiPNG thread helper).
  SvelteKit's `immutable` list in `$app/manifest` does not reliably cover the
  chunks Vite emits for `new Worker(new URL(...))`: a chunk loaded from inside
  a worker (the OxiPNG thread helper) is never listed, and before 2026-11-04
  no worker was, so the codec WASM was cached but no worker could load it, and
  a first offline encode failed until an online encode had fetched the worker.
  With SvelteKit 3.1.1 and Vite 8.3.7 the codec worker and the SVG optimizer
  worker are listed, and the service worker dedupes them against this file.
  The `app-worker-precache-manifest` plugin in
  `vite.config.ts` writes the list at build time; a missing list (dev or partial
  build) degrades to runtime caching, never a failed install;
- the shell is everything in `build` except the codec variants and the
  diagnostics probe workers, plus the prerendered paths and every static file except the
  crawler-only ones (`robots.txt`, `sitemap.xml`, `social-card.png`: the app never
  requests them and the card alone is ~42 kB) and the manifest install icons
  (`icon-192.png`, `icon-512.png`: fetched by the browser only when the user
  installs the app). Everything excluded here stays in `assets`, so it still
  resolves cache-first on demand. `manifest.webmanifest` itself stays in the
  shell: it is a few hundred bytes and keeps the installed app's identity
  resolvable offline. These hand-written file lists are typed as `AssetPath`
  (from `$app/types`), so renaming a static file fails the typecheck;
- activate: delete old Frisp caches and claim clients;
- fetch: serve known assets cache-first, otherwise network-first with cache
  fallback. A network answer is returned at once; `fetchAndCache` writes a
  copy to the cache inside `event.waitUntil`, and only for a status 200
  response without `no-store`. A failed write (a full quota) no longer fails
  the request. Runtime caching means a non-precached variant still ends up
  cached after first use, so a mis-detection costs one online network trip,
  never a broken codec;
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
- Activating the new worker reloads every controlled tab, so since 2026-11-04
  clicking **Refresh** first asks the other open Frisp tabs over a
  `BroadcastChannel` (`'app:tabs'`, in `sw-bridge/runtime.ts`) whether they have
  images open. If one does, the prompt warns and offers **Refresh anyway**;
  otherwise it proceeds.
- Accepting the update calls `applyServiceWorkerUpdate()`, which posts
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
and can resurface stale-artifact confusion given SvelteKit's service-worker manifest generation and codec wrapper patching; it has no effect on what users are served.

`version` (hence `cacheName`) is the 12-character commit hash when the git
tree is clean, and SvelteKit's build timestamp otherwise (`commitVersionName()`
in `vite.config.ts`). An identical rebuild of a clean commit therefore keeps
the cache name, and installs do not download the precache again; any build
with uncommitted changes still gets a new name.

Known approximation: nested-worker support (the Safari 16 gap) can't be
probed from SW scope, so such a browser precaches `_mt` builds it won't use;
the single-thread fallback loads on demand.

Production preview is required for realistic service-worker testing. Note
`vite preview` (sirv) snapshots the file list at startup — after a rebuild,
restart the preview server or new hashed filenames 404.

## Codec Assets

Codec JS/WASM artifacts are committed under `codecs/`. Do not edit or delete
them during ordinary migration cleanup. The committed codec-asset source modules
import these assets through Vite `?url` modules and pass explicit URLs into
worker runtimes or Emscripten `locateFile`.

`npm run audit:static-output` verifies the build emits one physical WASM copy
per logical asset, that the service worker references the expected assets and
carries the variant-aware precache machinery, and that the service-worker
build emits **no** duplicate worker chunks of its own (top-level
`assets/*.js`). It also fails if `_app/worker-precache.json` disagrees with the
app workers actually emitted, if the service worker does not read that list, or
if a diagnostics probe worker reaches the build: `/diagnostics` and its probes
are stripped from production by `app-strip-dev-only-routes`, like `/lab`, and
remain available under `npm run dev`. Since 2026-11-10 `/diagnostics` is not
prerendered either (`src/routes/diagnostics/+page.ts`), so nothing of it is
precached and the path answers 404 in production. The audit also asserts that
`404.html` exists, that the built `service-worker.js` parses as a classic
script (SvelteKit 3 builds it as a module, but the app registers it without
`type: 'module'`), and that the service worker precaches the prerendered root
page.

**Multithreading is enabled** (2026-06-03): the committed worker and codec-asset
modules wire the threaded variants and real thread detection, so AVIF / JXL
(Emscripten pthreads) and oxipng (wasm-bindgen-rayon) engage multi-core, with
single-thread fallback intact. The data contract
(`src/shared/codec-assets/`) carries the `multi-thread` / `worker-helper` /
`threaded-only` records, and `audit:static-output` asserts the threaded helper
assets are now present. Cross-origin isolation (COOP/COEP) — required for
`SharedArrayBuffer` — is set via the `app-cross-origin-isolation` Vite plugin in
`vite.config.ts` (dev + preview) and `static/_headers` (host). Full record:
[threading-enablement.md](threading-enablement.md).

**Dev-server caveat (`vite dev`):** the Emscripten pthread workers
(`*_mt.worker.js`) are **classic** workers and must be served byte-for-byte. Vite's
dev transform otherwise injects an ESM `/@vite/client` import into them (illegal in
a classic worker), so the thread pool never engages and threaded encodes stall
(~50× slower) — dev-only, since a `vite build` emits them as raw hashed assets. The
`app-raw-threaded-codec-workers` plugin in `vite.config.ts` serves
`codecs/**/*_mt(_simd)?.worker.js` raw in dev to fix this (`configureServer`-only;
prod build unaffected). Details in
[threading-enablement.md](threading-enablement.md).

## Tests

- `npm run check` — static gate (`typecheck`, production build, static-output audit).
- `npm run typecheck:fast` is the incremental svelte-check alone, for quick
  loops; `npm run typecheck:tests` checks the tests project alone.
- `npm run test:unit` is `vitest run` over `tests/unit/`. `svelte-kit sync` now
  runs from `prepare` (on install), not from this script.
- `npm run test:e2e` — Playwright browser regression (`tests/e2e/`): boots the
  production preview (port 4317, or `PLAYWRIGHT_PORT`), asserts cross-origin isolation, encodes through every
  codec asserting valid output magic bytes, and tests SW offline reload and a
  first offline encode (`export-contract.spec.ts`). Needs the Chromium headless
  shell installed (`npx playwright install chromium`). The
  webServer builds + previews automatically. **Run after any codec/build change.**
- `npm test` runs `check`, `test:unit`, and `test:e2e`.
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
hand-written docs, so format Markdown by hand. See [the project brief](project/brief.md).
