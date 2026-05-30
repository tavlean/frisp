# Sqush — Vite/SvelteKit migration plan (plumbing-first)

Last updated: 2026-05-31. Author: Claude (UI/architecture colleague pass).

> **Read this first if you're a fresh session.** This is the working plan for
> moving Sqush from the inherited Preact + Rollup app to an all-in Svelte 5 +
> SvelteKit + Vite app, **without changing what the user sees** until parity is
> reached. It is self-contained: it carries the context you need so you don't
> have to re-derive it. Pair it with [STATUS.md](STATUS.md) (current state) and
> [HANDOFF-2026-05-30.md](HANDOFF-2026-05-30.md).

---

## 0. The decision that's already made

The user has **committed to going all-in on Vite/SvelteKit**, and to doing the
**plumbing first** (workers, codec assets, offline) so the new app can stand on
its own before the visible UI is rebuilt. Confirmed: no functionality or runtime
performance is lost by leaving Rollup — Vite builds the same codecs/workers/SW;
the only genuine open risk is multi-threaded codecs (see §7). Rollup stays alive
on `main` only as a safety net until the SvelteKit app reaches parity, then it
is deleted.

Guiding promise (the user's words): _"If somebody goes to this new version, they
see no difference. Everything is the same, only the backend changed — now it's
ready for improvement."_ Parity before innovation. Keep every feature/codec for
now; prune only with evidence later.

---

## 1. The three-layer mental model (orient here)

1. **UI (the skin)** — buttons, before/after slider, drag-drop, controls. The
   ONLY layer that knows about Preact or Svelte. This is what we're rebuilding.
2. **Engine (the brain)** — plain TypeScript: decode → preprocess → resize →
   encode; bulk session/queue logic. **Framework-agnostic.** Already extracted
   (~67 modules incl. the 16-module bulk engine in `src/client/lazy-app/bulk/`).
   We REUSE this, we don't rewrite it.
3. **Codecs (the muscle)** — ~80 committed WebAssembly artifacts under `codecs/`
   compiled from upstream libs (libwebp, libavif/libaom, libjxl, mozjpeg,
   oxipng, …). **Self-contained, no runtime/network dependency.** We do NOT
   touch these. See [codec-provenance.md](codec-provenance.md).

The whole migration = **repaint layer 1 in Svelte + move the plumbing that
connects 1→2→3 from Rollup to Vite.** Layers 2 and 3 are already portable; the
single-image slice proved it (engine called from Svelte, encoded WebP/AVIF/JXL).

---

## 2. Current state (verified 2026-05-31)

- **Branches (two — clean):** `main` (Preact+Rollup, untouched production) and
  **`svelte`** (the migration trunk — engine seams + codec-asset strategy +
  runnable single-image compressor + all docs; worktree at `../Sqush-svelte`).
  The old `code/sveltekit-{codec-assets,migration-seams,prototype,single-image-slice}`
  branches were all collapsed into `svelte` and deleted (each verified fully
  contained first — nothing lost).
- **Repo hygiene done:** `upstream` (GoogleChromeLabs) remote removed (~113
  stale branches gone; all commits preserved in `main`'s ancestry). `SquooshPlus`
  symlink and the orphaned codex worktree removed.
- **The SvelteKit app lives in `prototypes/sveltekit/`** (Svelte 5.55, SvelteKit
  2.61, Vite 8, adapter-static). It currently has:
  - `src/routes/+page.svelte` — runnable single-image compressor (drop → WebP/
    AVIF/JXL → preview, %, download). Browser-verified.
  - `src/routes/diagnostics/+page.svelte` — the original probe page.
  - `src/lib/compress.ts` — adapter: File + settings → engine helpers → bridge.
  - `src/lib/sveltekit-worker-bridge.ts` — the SvelteKit codec worker bridge
    (decode/encode for webp/avif/jxl/qoi/mozjpeg/oxipng + resize/quantize/rotate).
  - `scripts/sync-sqush-prototype.mjs` — generates `.svelte-kit/sqush-generated/*`
    codec-asset URL records + feature-meta + patched Emscripten wrappers.
  - `scripts/audit-static-output.mjs` — verifies one physical WASM per logical
    asset (no accidental duplicates).
- **Verified working:** single-image encode for WebP/AVIF/JXL in-browser via
  Vite dev + workers; quality slider re-encodes live; offline SW registers;
  `npm run check`/`build` pass.

---

## 3. Target architecture (what we're building toward)

A **client-only SPA** (SvelteKit docs explicitly cite "a complex application
like a photo editor" as the SPA case). Concretely:

- **`adapter-static` with `fallback: '200.html'`**, **`ssr = false`** in the
  root `+layout.ts`. The app is pure CSR — no server, deployable to any static
  host (matches the local-first, no-upload promise).
- **Native SvelteKit service worker** (`src/service-worker.ts`) using the
  `$service-worker` module (`build`, `files`, `version`) for app-shell caching,
  PLUS the generated codec precache records for the WASM. This REPLACES Squoosh's
  hand-rolled `src/sw/` + `entry-data:` cache plan.
- **Engine reused as-is** via path aliases (already configured in
  `vite.config.ts` / `svelte.config.js`: `client`, `features`, `shared`,
  `sqush-generated`, etc.).
- **Reactive state in `.svelte.ts` modules** (runes), provided via Svelte
  `context` — not global mutable singletons. Idiomatic, testable, and the right
  home for the bulk-session store.

### Where the app should live

Today it's `prototypes/sveltekit/`. **Recommendation:** keep building there
through parity (avoids churn + keeps the proven config), then in the flip phase
(§Phase 7) promote it to the repo root (or `/app`) and delete the Preact tree.
Don't rename mid-migration — it invalidates the worktree/aliases for no benefit.

---

## 4. Svelte 5 / SvelteKit 2 conventions to follow (best practices)

Grounded in the official docs (fetched 2026-05-31). Apply these everywhere:

- **Runes, not stores.** `$state` for mutable state, `$derived` for computed
  view-models. Reserve `$effect` for genuine side-effects only: object-URL
  create/revoke, worker calls, service-worker registration, canvas draws. **Do
  NOT use `$effect` to sync one piece of state into another** — use `$derived`
  (the autofixer flags this; it's the #1 Svelte 5 smell).
- **Shared reactive logic → `.svelte.ts` modules.** Export a reactive **class**
  (e.g. `BulkSessionStore`) or read/write functions — never export a reassigned
  `$state` let directly. Provide app-wide instances via `setContext`/`getContext`
  in `+layout.svelte`, retrieve with `getContext` in children. (Avoids prop
  drilling and shared-singleton gotchas.)
- **Loading/error UI via `<svelte:boundary>`** with `pending` and `failed`
  snippets where it fits (e.g. wrapping an async encode result), instead of
  hand-rolled `status: 'idle'|'working'|'error'` flags. Optional but cleaner;
  use judgement — the current compressor's explicit flags are fine too.
- **Event props, not `on:` directives.** `onclick={...}`, `onchange={...}`
  (Svelte 5 style — already used in the compressor).
- **`$props()` with destructuring** for component inputs; `$bindable()` for
  two-way-bound custom controls (the option inputs will want this).
- **SPA page options at the root**: `export const ssr = false` and
  `export const prerender = true` in `src/routes/+layout.ts`.
- **Service worker**: import `{ build, files, version }` from `$service-worker`;
  cache `[...build, ...files, ...codecPrecacheUrls]`; delete old caches on
  `activate`; network-first-fallback-to-cache on `fetch`. Register with
  `{ type: dev ? 'module' : 'classic' }`.
- **Use the Svelte MCP** (`list-sections` → `get-documentation`, and
  `svelte-autofixer` on every `.svelte`/`.svelte.ts` you write) before finalizing
  components. Re-run the autofixer after edits until clean.

---

## 5. The plan — phases (plumbing-first)

Work on the `svelte` trunk, or cut a short per-phase branch off it
(`svelte-plumbing`, then `svelte-editor`, then `svelte-bulk`) and merge back.
Keep `main` (Preact) working at all times. Each phase
ends green: `npm run check` + `npm run build` in `prototypes/sveltekit`, plus a
browser check for anything touching runtime/worker/codec/SW behavior.

Per-phase verification uses the Claude Preview MCP (`.claude/launch.json` server
name `sqush-prototype`). **Gotcha:** reload to a clean state before injecting a
test file; inject a REAL image that exists (demos in
`src/shared/prerendered-app/Intro/imgs/demos/`) and check `fetch r.ok` — a 404
becomes a fake ~1 KB "file" and the app correctly shows "Couldn't decode image".

---

### Phase 1 — Codec-asset strategy: make it production-grade

**Goal:** the generated codec-asset URL records + wrapper patching are robust,
documented, and audited — not a prototype-only sync hack.

- Review `scripts/sync-sqush-prototype.mjs` and `src/shared/codec-assets.ts`
  against [sveltekit-codec-asset-strategy.md](sveltekit-codec-asset-strategy.md).
- Ensure `npm run build` emits exactly one physical `.wasm` per logical asset
  (run `npm run audit:static-output`); no worker-local duplicates.
- Confirm the generator is deterministic and re-runnable (`npm run sync`).
- **Acceptance:** `audit:static-output` passes; build output has no duplicate
  WASM; records are consumed by app + worker + (later) SW from one source.

### Phase 2 — Worker-bridge parity (all active codecs through one path)

**Goal:** every active codec works through the generated worker surface, not just
WebP. Today the generated `encoderMap`/`features-worker` is **WebP-only**;
AVIF/JXL/etc. only work via direct `bridge.*Encode` calls.

- Widen the generated **active worker surface** (the sync generator + active
  method set) to include avif, jxl, mozjpeg, oxipng, qoi, and the browser
  encoders/decoders — everything except blocked wp2.
- Once the generated `encoderMap` covers all formats, simplify
  `src/lib/compress.ts` to drive `processBulkImageJob` /
  `imagePipeline.compressImage` for ALL formats (single path shared with bulk),
  removing the per-format `switch` workaround.
- **Acceptance:** each encoder round-trips in-browser; decoders handle their
  inputs; single-image path and the bulk engine call the same `compressImage`.

### Phase 3 — Service worker / offline (SvelteKit-native)

**Goal:** replace the inherited service worker with the SvelteKit-native one,
caching app shell + codec WASM.

- Add `src/service-worker.ts` using `$service-worker` (`build`, `files`,
  `version`) + the generated **precache** codec records (only `cache:
'precache'` assets; keep runtime-only/threaded assets out of the install set).
- Remove reliance on `src/sw/` `entry-data:`/`service-worker:` Rollup virtual
  imports for the SvelteKit app (they stay on `main` for Preact).
- **Acceptance:** load app → go offline → reload → app still works and a
  controlled encode still runs; Cache Storage contains the canonical WebP/AVIF/
  JXL (and other active) assets.

### Phase 4 — App shell, routing, SPA config

**Goal:** the SvelteKit app is a proper SPA shell with the right routes.

- Root `src/routes/+layout.ts`: `export const ssr = false; export const
prerender = true;`. Confirm `adapter-static` `fallback: '200.html'`.
- Routes: `/` (the editor entry — drop zone + editor), keep `/diagnostics`.
  Decide whether the intro/marketing screen is a separate prerendered route.
- Add a `+layout.svelte` that sets up shared context (theme, and later the bulk
  store).
- **Acceptance:** `npm run build` produces a static SPA; deep links work via
  fallback; no SSR/browser-global errors.

### Phase 5 — Single-image editor parity (the real Squoosh editor)

**Goal:** rebuild the actual editor UI in Svelte at visual + functional parity
with the current Preact app. This is the big UI phase.

- Two-up **before/after view with the draggable slider** + pinch/zoom/pan
  (port behavior from the Preact `Output`/pinch-zoom; reuse extracted state
  modules under `src/client/lazy-app/Compress/*`).
- **Encoder select + per-encoder option panels.** Each codec exposes different
  options (quality, effort, speed, lossless, subsample, …) defined in
  `src/features/**/shared/meta.ts`. Build Svelte option components driven by that
  metadata (this is the "UI option entries" piece the exit-audit left open).
  Use `$bindable` for the controls.
- Resize / quantize / rotate controls; saved-settings; download with correct
  filename (`getOutputFileName`).
- Keep the current Squoosh look (colors, layout). Gradual restyle comes later.
- **Acceptance:** a user cannot tell the Svelte single-image editor from the
  Preact one, feature-for-feature; all active codecs selectable and working.

### Phase 6 — Bulk UI (the headline feature)

**Goal:** the bulk-edit interface, built on the existing 16-module bulk engine
(`src/client/lazy-app/bulk/`). The engine already does sessions, queue,
concurrency, per-image overrides, snapshots, export — this phase is the skin.

- Multi-file import (picker + drag-drop of many).
- Bottom **image strip**: thumbnail, name, status, % reduction, override badge.
- Global settings panel; selecting an image opens it in the main editor; editing
  a setting while one image is selected creates a per-image **override**
  (highlight overridden controls; "reset to global").
- Batch processing with small concurrency, progress, cancel/retry, per-image
  errors (don't fail the whole batch).
- Bulk **export** (individual downloads first; ZIP later).
- Reactive bulk store in `bulk-session.svelte.ts`, provided via context;
  `$derived` view-models for strip/summary; `$effect` only for object-URL
  lifecycle.
- **Acceptance:** import many → process with global settings → override one →
  reprocess only affected → export all. Matches
  [bulk-image-architecture.md](bulk-image-architecture.md).

### Phase 7 — The flip (SvelteKit becomes production)

**Goal:** retire Preact + Rollup; SvelteKit is the app.

- Tag the pre-flip state (e.g. `pre-svelte-flip`) for safety.
- Promote `prototypes/sveltekit/` to the repo root (or `/app`); rewire
  `package.json` scripts to the SvelteKit/Vite build; update deploy.
- Delete the Preact tree (`src/client/**` UI components), the Rollup config, and
  the custom `lib/` build tooling **once nothing references them**.
- Keep the engine (`src/client/lazy-app/**` logic, `src/features/**`,
  `codecs/**`, `src/shared/**`).
- **Acceptance:** `main` serves the SvelteKit SPA; production build is Vite;
  Preact/Rollup gone; all features + codecs intact; users see no difference.

---

## 6. Parallel/optional track — threaded codecs (defer if it stalls)

Multi-threaded AVIF/JXL/OxiPNG need **cross-origin isolation** (COOP/COEP
headers: `Cross-Origin-Opener-Policy: same-origin`,
`Cross-Origin-Embedder-Policy: require-corp`) + nested-worker + SW-cache proof.
Static hosts must send these headers (or use a SW header-shim). **Single-thread
works without any of this and is the baseline** — ship parity on single-thread
first; treat threaded as a perf enhancement on its own branch.

---

## 7. Known gotchas (carry these forward)

- **Generated files aren't committed.** `src/client/lazy-app/feature-meta/*`,
  `worker-bridge/{surface,active-meta,meta}.ts`, `src/features-worker/active.ts`
  are generated by `lib/feature-plugin.js` (root Rollup build). A fresh worktree
  lacks them → root `tsc`/svelte-check shows "Cannot find module
  '../feature-meta/shared'". Not a bug. The SvelteKit app generates its own under
  `.svelte-kit/sqush-generated/` via `npm run sync`.
- **Root deps must be installed** for the prototype's `comlink` (and other
  `src/` imports) to type-resolve: run `npm install` at the repo root too, not
  just in `prototypes/sveltekit`.
- **Don't touch `codecs/`** without the full provenance/build/SW/browser checks
  in [codec-provenance.md](codec-provenance.md). Keep all codecs for now.
- **Preview-MCP verify ritual:** reload first; inject a real existing image;
  check `fetch r.ok`. (A reused dev server keeps prior state; the file input is
  absent once an image is loaded.)
- **wp2 (WebP 2) stays blocked** across the active surface unless product
  direction changes.

## 8. Open decisions for the user (not blockers)

- App home after the flip: repo root vs `/app`.
- Intro screen: keep as-is, or redesign as a separate prerendered route.
- Threaded codecs: pursue, or accept single-thread for v1.
- Codec pruning: deferred — keep everything until there's usage evidence.

## 9. Quick reference

```sh
# run the SvelteKit app
cd prototypes/sveltekit && npm install && npm run dev   # http://localhost:5173
npm run check        # svelte-check
npm run build        # vite build + adapter-static
npm run sync         # regenerate codec-asset + feature-meta modules
npm run audit:static-output   # verify one physical wasm per logical asset
# root (for engine type-resolution)
cd <repo root> && npm install
```

Key files: `prototypes/sveltekit/src/routes/+page.svelte` (editor entry),
`src/lib/compress.ts` (adapter), `src/lib/sveltekit-worker-bridge.ts` (codec
bridge), `scripts/sync-sqush-prototype.mjs` (generator),
`vite.config.ts` / `svelte.config.js` (aliases + adapter).

Engine: `src/client/lazy-app/image-pipeline.ts`, `src/client/lazy-app/bulk/*`,
`src/features/**` (codec workers + option metadata), `codecs/**` (WASM).

Docs to read: [STATUS.md](STATUS.md),
[sveltekit-codec-asset-strategy.md](sveltekit-codec-asset-strategy.md),
[sveltekit-migration-seams-review.md](sveltekit-migration-seams-review.md),
[bulk-image-architecture.md](bulk-image-architecture.md),
[codec-provenance.md](codec-provenance.md), [road-map.md](road-map.md).
