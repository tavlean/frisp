# Sqush — Vite/SvelteKit migration plan (plumbing-first)

Last updated: 2026-05-31. Author: Claude (UI/architecture colleague pass).

> **Read [STATUS.md](STATUS.md) first** for the live current state, then this
> plan. This is the working plan for moving Sqush from the inherited Preact +
> Rollup app to an all-in Svelte 5 + SvelteKit + Vite app, **without changing
> what the user sees** until parity is reached. **Phases 1–5 are done**; the
> current focus is the §"Phase 5 polish backlog" before Phase 6.
> ([HANDOFF-2026-05-30.md](HANDOFF-2026-05-30.md) is an older point-in-time
> record, superseded by STATUS.)

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

## 2. Current state (2026-05-31)

> For the live, authoritative current state read [STATUS.md](STATUS.md). This
> section is the plan's own snapshot.

- **Phases 1–5 are DONE** (see each phase below). `prototypes/sveltekit/` is now
  a full **single-image editor at Squoosh parity**, not just a slice. Current
  focus is the **Phase 5 polish backlog** (§ below) before Phase 6.
- **Branches (two — clean):** `main` (Preact+Rollup, untouched production) and
  **`svelte`** (the migration trunk carrying Phases 1–5; worktree at
  `../Sqush-svelte`). Per-phase branches (`svelte-plumbing`, `svelte-editor`)
  were fast-forward-merged into `svelte` and deleted. Next would be
  `svelte-bulk` for Phase 6.
- **The SvelteKit app** (Svelte 5.55, SvelteKit 2.61, Vite 8, adapter-static)
  lives in `prototypes/sveltekit/`. Editor file map + how-to-run are in
  [STATUS.md](STATUS.md). Headlines:
  - `src/routes/+page.svelte` — full-bleed dark editor (intro/drop → two-up
    before/after with zoom/pan → encoder + option panels → resize/quantize/rotate
    → download). Saved settings persist.
  - `src/lib/editor/options/*` — option primitives + all six per-encoder panels +
    resize/quantize panels.
  - `src/lib/editor/output/*` — `Output.svelte` (two-up) + ported `pinch-zoom` /
    `two-up` custom elements.
  - `src/lib/compress.ts` — drives `imagePipeline.compressImage` (shared with
    bulk); returns before/after ImageData.
  - `src/service-worker.ts` (+ helpers) — offline; `scripts/sync-sqush-prototype.mjs`
    - `scripts/audit-static-output.mjs`.
- **Repo hygiene (done earlier):** `upstream` (GoogleChromeLabs) remote + ~113
  stale branches removed (commits preserved in `main`'s ancestry); `SquooshPlus`
  symlink + orphaned codex worktree removed.
- **Verified (2026-05-31):** all six codecs encode through the unified path;
  every panel re-encodes live; two-up + zoom/pan + slider; rotate/resize/quantize;
  saved settings round-trip; offline SW on production preview. `npm run check`
  0/0, `build` + `audit:static-output` green.

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

### Phase 1 — Codec-asset strategy: make it production-grade ✅ DONE (2026-05-31)

**Goal:** the generated codec-asset URL records + wrapper patching are robust,
documented, and audited — not a prototype-only sync hack.

- Review `scripts/sync-sqush-prototype.mjs` and `src/shared/codec-assets.ts`
  against [sveltekit-codec-asset-strategy.md](sveltekit-codec-asset-strategy.md).
- Ensure `npm run build` emits exactly one physical `.wasm` per logical asset
  (run `npm run audit:static-output`); no worker-local duplicates.
- Confirm the generator is deterministic and re-runnable (`npm run sync`).
- **Acceptance:** `audit:static-output` passes; build output has no duplicate
  WASM; records are consumed by app + worker + (later) SW from one source.

**Outcome (2026-05-31):** All acceptance gates verified green. Hardening done:
the generator's two manifests (`codec-assets/manifest.ts` + `codec-assets/precache.ts`)
previously each carried a hand-maintained copy of the 15/14 logical records — a
drift hazard. Both are now generated from a single source-of-truth
`codecAssetRecords` array in the generator, with `precache.ts` a filtered
projection (still a separate file so the runtime-only rotate WASM stays out of
the service-worker graph). Refactor produces byte-identical output. Verified:
`sync` deterministic (x2 identical hashes), `check` 0/0, `build` clean,
`audit:static-output` shows all 15 logical assets at exactly 1 physical WASM,
no threaded/parallel worker-helper duplicates. Consumption confirmed
single-source: app re-exports the generated manifest, the worker bridge resolves
all 15 logical keys via `getCodecAssetUrl(svelteKitCodecAssetRecords, …)`, and
the SW pulls the derived precache URLs. A browser run was not repeated: the
generator change is internal and emits byte-identical assets, so the
2026-05-30 runtime verification still holds.

### Phase 2 — Worker-bridge parity (all active codecs through one path) ✅ DONE (2026-05-31)

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

**Outcome (2026-05-31):** Done and browser-verified. The generator's
`prototypeEncoderNames` went from `['webP']` to all nine active encoders (avif,
browserGIF, browserJPEG, browserPNG, jxl, mozJPEG, oxiPNG, qoi, webP — wp2 stays
blocked), so the generated `EncoderState`/`encoderMap` now mirror production
minus wp2 (no more WebP-only split-brain). `src/lib/compress.ts` dropped its
per-format `switch` + direct `bridge.*Encode` calls and now drives
`imagePipeline.compressImage` with an `EncoderState` — the exact path
`bulk/processor.ts` uses, so single-image and bulk share one code path. The
SvelteKit worker bridge already implemented every active codec, so no bridge
change was needed.

Browser round-trips (Preview MCP, canvas-built source, encode through the unified
`compressImage`): WebP `RIFF…WEBP`, AVIF `ftyp avif`, JPEG XL `ff 0a`, MozJPEG
JFIF, OxiPNG PNG sig, QOI `qoif` — all valid, correct MIME/extension, zero
console errors. Decoders verified by round-tripping WebP/AVIF/JXL/QOI back to
256×256 ImageData through the bridge. Gates: `sync` deterministic, `check` 0/0,
`build` clean, `audit:static-output` unchanged (15 logical assets = 1 physical
WASM each — widening added only main-thread client runtimes, no new WASM). The
prototype slice's format row now lists the six codec encoders; browser encoders
stay in the type/surface but get proper option panels in Phase 5 (their quality
scales differ).

### Phase 3 — Service worker / offline (SvelteKit-native) ✅ DONE (2026-05-31)

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

**Outcome (2026-05-31):** Verified; **no code change needed** — the
SvelteKit-native SW was already implemented and correctly wired, so this phase
was a verification pass. `src/service-worker.ts` uses `$service-worker`
(`build`/`files`/`version`) plus `serviceWorkerCodecAssetUrls` (the generated
precache codec records + the features-worker), precaches on install, deletes
stale caches on activate, and serves cache-first with network fallback. The
generated precache manifest excludes the runtime-only rotate WASM from the
service-worker module graph (so Vite never inlines it into the SW bundle);
rotate is still offline-available via the `build` asset list. No `src/sw/`
`entry-data:`/`service-worker:` Rollup virtual imports remain in the SvelteKit
app (`src/lib/service-worker-codec-assets.ts` imports only the plain
`sw/cache-plan` helpers). Registration runs from both routes via
`registerPrototypeServiceWorker()`, production-only (`!import.meta.env.DEV`).

Runtime-verified against a production `vite preview` (Preview MCP) — the SW does
not register under `vite dev`: SW reached `active` and controlled the page;
Cache Storage held 32 entries including **all 15 canonical codec WASM** (webp
enc/simd/dec, avif enc/dec, jxl enc/dec, mozjpeg, oxipng, qoi enc/dec,
imagequant, resize, hqx, rotate), the features-worker, the app entry/start
chunks, every route-node chunk, and the navigation document `/` — all confirmed
to serve from cache. A controlled WebP encode driven through the real UI ran to
completion with the SW controlling the page (worker + WASM served cache-first),
producing valid `RIFF…WEBP` output. The harness can't toggle the browser to
literal `offline`, but the cache-completeness proof (every load-and-encode asset
present and cache-served) plus the live SW-served encode is equivalent.

### Phase 4 — App shell, routing, SPA config ◑ CONFIG DONE (2026-05-31)

> **Status (2026-05-31):** The SPA acceptance is already met — `src/routes/+layout.ts`
> sets `ssr = false` + `prerender = true`, `adapter-static` uses
> `fallback: '200.html'`, and `npm run build` emits a static SPA (`index.html`,
> `200.html` deep-link fallback, `diagnostics.html`) with no SSR/browser-global
> errors. Routes `/` and `/diagnostics` exist. **Deferred:** the `+layout.svelte`
> shared-context provider — there is no app-wide reactive state to host yet
> (theme + the bulk store land in Phases 5–6), so it is created alongside that
> state rather than as an empty shell now. The intro/marketing-route decision
> stays an open product question (see §8).

**Goal:** the SvelteKit app is a proper SPA shell with the right routes.

- Root `src/routes/+layout.ts`: `export const ssr = false; export const
prerender = true;`. Confirm `adapter-static` `fallback: '200.html'`.
- Routes: `/` (the editor entry — drop zone + editor), keep `/diagnostics`.
  Decide whether the intro/marketing screen is a separate prerendered route.
- Add a `+layout.svelte` that sets up shared context (theme, and later the bulk
  store).
- **Acceptance:** `npm run build` produces a static SPA; deep links work via
  fallback; no SSR/browser-global errors.

### Phase 5 — Single-image editor parity (the real Squoosh editor) ✅ DONE (2026-05-31)

**Goal:** rebuild the actual editor UI in Svelte at visual + functional parity
with the current Preact app. This is the big UI phase.

> **Progress (2026-05-31, branch `svelte-editor`):** Approach chosen with the
> user: **parity + light cleanup** (idiomatic Svelte that stays visually close;
> reference is the original Preact components on the engine/`main`). Done so far:
>
> - Reusable option-control primitives in Svelte 5
>   (`src/lib/editor/options/`): Range (with the drag value-bubble), Checkbox,
>   Toggle, Revealer, Select; `theme.css` ports the Squoosh palette + tokens.
> - **All six per-encoder option panels** ported at parity — WebP, AVIF, JXL,
>   MozJPEG, OxiPNG (QOI has none). AVIF/JXL use the derived-form-state model
>   (lossless inferred, effort = 10 − speed, etc.) seeded once via an `untrack`
>   snapshot and written back through `apply()`.
> - **The two-up before/after editor** (`src/lib/editor/output/`): PinchZoom and
>   TwoUp ported as local custom elements; `Output.svelte` draws the processed
>   source (left) and decoded output (right) into two synced pinch-zooms with the
>   draggable split, fit-to-view, event retargeting, and zoom/pixelated/
>   background controls. `compress.ts` now returns the before/after ImageData.
> - `compress.ts` drives `imagePipeline.compressImage` for every active format
>   (single path shared with bulk); per-format option objects live on the page
>   and feed the panels via `$bindable`/snapshot.
>
> **Done (2026-05-31):** processor controls — full Resize panel (method/preset/
> width-height with maintain-aspect/fit/premultiply/linearRGB), Quantize
> (colors + dithering), and Rotate (toolbar button, 90° per click); saved
> settings (encoder + per-format options persist to localStorage and restore on
> load); and the **full-bleed dark Squoosh reskin** — header + left "Original"
> rail (pink) + center two-up + right encoder rail (blue) with the encoder
> `<Select>` in the title and a results footer (size / % / download). Per-image
> processor state resets on load; resize dims + natural size seed from the first
> result. All browser-verified; `svelte-check` 0/0, build + audit green.
>
> **Phase 5 complete.** The Svelte single-image editor matches the Preact one
> feature-for-feature: all active codecs selectable with full option panels,
> before/after slider with zoom/pan, resize/quantize/rotate, saved settings.

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

### Phase 5 polish backlog ← CURRENT FOCUS (2026-05-31)

The editor is functionally complete; the user wants to **stabilize and smooth
rough edges before starting Phase 6**. Known items (none are blockers; verify
each in the browser, fix, keep `npm run check` green):

- **Two-up fit-centering hides image edges behind the rails.** The `.output`
  two-up abs-fills the whole `.compress` stage, so on load a wide image fits to
  the _full_ width and its left/right ~320px sit behind the option rails. The
  fit in `Output.svelte` should inset by the rail widths (and the 48px header) so
  the image fits/centers within the _visible_ viewport. (The page knows the rail
  width: 320px, 260px under the 800px breakpoint.)
- **Narrow-screen / mobile layout breaks.** The two rails are
  `position:absolute` at 320px (260px <800px); below ~700px they cover the
  viewport with no centre gap. Needs a responsive fallback — e.g. stack the rails
  below the viewport, or a mobile panel mode (Squoosh uses a `multi-panel`
  bottom-sheet on mobile; see `src/client/lazy-app/Compress/custom-els/MultiPanel`).
- **Toolbar icons are placeholder glyphs** (`⟳ ⊞ ◓`, and `− +` for zoom) instead
  of Squoosh's SVG icons (`RotateIcon`, `ToggleAliasing*Icon`, `ToggleBackground*Icon`,
  `AddIcon`/`RemoveIcon` in `src/client/lazy-app/icons`). Swap for the real icons
  (active/inactive variants for aliasing + background).
- **Minor control polish:** the editable zoom-% field sizing/focus behaviour; the
  rotate button has no hover/active affordance; the resize "Preset" select only
  shows "Custom" when the size doesn't match a preset (verify the matching logic
  feels right); confirm the `<select>` arrow/large styling matches Squoosh.
- **General QA pass:** odd aspect ratios, very large images (fit + pan), SVG
  input, re-encode debounce feel, switching encoders mid-encode (abort), download
  filename per format, keyboard split (1/2/3) discoverability.

Not in scope for polish (deferred): threaded codecs; the intro/marketing screen
redesign; codec pruning.

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
