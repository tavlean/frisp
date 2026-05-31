# Sqush — Status (start here)

Last updated: 2026-05-31.

A focused, local-first fork of Google's abandoned Squoosh. Priorities: **WebP,
AVIF, JPEG XL**, with **WebP 2 kept as experimental parity** until usage or
runtime evidence says otherwise. The headline new feature is **bulk image
optimization**, but bulk UI is intentionally frozen while the SvelteKit
foundation is hardened. The app is being rebuilt on **Svelte 5 / SvelteKit +
Vite**. This file is the single entry point — read it first, then
[MIGRATION-PLAN.md](MIGRATION-PLAN.md).

## TL;DR (current state)

- The migration is **all-in on Vite/SvelteKit, plumbing-first** (decided
  2026-05-31). The sequenced plan is [MIGRATION-PLAN.md](MIGRATION-PLAN.md).
- **Phases 1–5 are DONE** on the `svelte` branch. The foundation-hardening pass
  has tightened editor state ownership, mobile layout, WebP 2 parity,
  generated-file policy, service-worker caching, favicon/logo assets, and docs
  before Phase 6. The SvelteKit app in
  `prototypes/sveltekit/` is now a working, full-bleed dark **single-image editor
  at Squoosh parity**: drop an image → before/after two-up with zoom/pan → pick
  any active codec with full option panels → resize / quantize / rotate →
  download. Settings persist across reloads. Offline-capable.
- **Current focus: foundation hardening / QA the single-image editor** before
  adding features (the user's explicit choice). After this pass: **Phase 6 —
  Bulk UI**, then **Phase 7 — the flip**.
- `main` (Preact + Rollup) is the **untouched production app**, kept as a safety
  net until the SvelteKit app reaches full parity, then retired in Phase 7.

## Branches (two — clean)

```
main      untouched Preact + Rollup production app (safety net)
svelte    migration trunk — Phases 1–5 complete; worktree at ../Sqush-svelte
```

Per-phase branches are cut off `svelte`, fast-forward-merged back, then deleted
(`svelte-plumbing` covered Phases 1–4 and `svelte-editor` covered Phase 5 — both
merged and deleted). The next would be `svelte-bulk` for Phase 6. The user
prefers short branch names. `main` is the default branch but is NOT where
migration work goes.

## What's done

**Plumbing (Phases 1–3):**

- **Phase 1 — codec-asset strategy.** The generator
  (`scripts/sync-sqush-prototype.mjs`) derives both the canonical manifest and
  the service-worker precache manifest from one source-of-truth array. Audit
  (`npm run audit:static-output`) confirms exactly one physical WASM per logical
  asset.
- **Phase 2 — worker-bridge parity.** The generated encoder surface covers all
  ten output formats, including experimental WebP 2. `src/lib/compress.ts`
  drives `imagePipeline.compressImage` — the **same path the bulk engine uses**.
- **Phase 3 — SvelteKit-native service worker.** `src/service-worker.ts` uses
  `$service-worker` (build/files/prerendered/version) + the generated codec
  precache; verified offline-capable on a production preview.

**SPA + editor (Phases 4–5):**

- **Phase 4 — SPA shell.** `ssr=false` + `prerender=true`, `adapter-static` with
  `fallback: 200.html`; builds a static SPA with deep-link fallback.
- **Phase 5 — single-image editor parity (the big UI phase):**
  - Reusable option primitives (Range with drag value-bubble, Checkbox, Toggle,
    Revealer, Select) + `theme.css` (Squoosh palette + tokens).
  - **Per-encoder option panels** ported at parity from the Preact components:
    WebP, WebP 2, AVIF, JXL, MozJPEG, OxiPNG, and Browser JPEG. QOI, Browser
    PNG, and Browser GIF have no adjustable options.
  - **Two-up before/after editor**: draggable split (TwoUp) + synced
    pinch-zoom/pan (PinchZoom), both ported as local custom elements; viewport
    controls (zoom −/%/+, pixelated, background, rotate).
  - **Processor controls**: full Resize panel (method/preset/width-height with
    maintain-aspect/fit/premultiply/linearRGB), Quantize (colors + dithering),
    Rotate (90°/click).
  - **Saved settings**: chosen encoder + per-format options persist to
    localStorage and restore on load (per-image processor state is not
    persisted).
  - **Full-bleed dark Squoosh reskin**: top bar + left "Original" rail (pink) +
    center two-up + right encoder rail (blue, encoder `<Select>` in the title) +
    results footer (size / % / Download).

## Editor architecture (file map of the new UI)

All paths under `prototypes/sveltekit/`:

- `src/routes/+page.svelte` — the editor page. Intro/drop screen + the
  `.compress` full-bleed layout.
- `src/lib/editor/editor-session.svelte.ts` — the Svelte 5 rune-backed editor
  session. Owns side settings, per-format `optionsByFormat`, processor state,
  preprocessor state, debounced encode orchestration, object URL cleanup,
  dimension seeding, saved settings, and download names.
- `src/lib/compress.ts` — adapter. `compressFile(file, request, signal)`:
  decode → preprocess → process → `imagePipeline.compressImage`; returns the
  output File + the decoded **before/after** ImageData for the two-up.
  `getDefaultOptions(format)`. `CompressRequest` carries `options`,
  `processorState`, `preprocessorState`.
- `src/lib/sveltekit-worker-bridge.ts` — codec worker bridge (all active codecs).
- `src/lib/editor/theme.css` — palette, theme tokens, and option-panel layout
  classes (`.options-*`, `.option-toggle/-one-cell/-text-first/-reveal`,
  `.section-enabler`, `.text-field`), scoped under `.sqush-editor`.
- `src/lib/editor/options/` — primitives (Range, Checkbox, Toggle, Revealer,
  Select) + panels (Webp/Wp2/Avif/Jxl/Mozjpeg/Oxipng/BrowserJpeg/Resize/
  Quantize Options) + `processor-types.ts` (flat resize/quantize shapes for the
  UI).
- `src/lib/editor/output/` — `Output.svelte` (two-up editor + viewport
  controls), plus `pinch-zoom.ts`/`.css` and `two-up.ts`/`.css` (ported custom
  elements).
- `src/pointer-tracker.d.ts` — ambient types for the `pointer-tracker` package.
- `src/service-worker.ts`, `src/lib/service-worker-registration.ts`,
  `src/lib/service-worker-codec-assets.ts` — offline.
- `src/routes/diagnostics/+page.svelte` — the original engine probe page.
- `scripts/sync-sqush-prototype.mjs` (generator) + `scripts/audit-static-output.mjs`.

The framework-neutral **engine** is reused as-is via path aliases (`client`,
`features`, `shared`, `sqush-generated`): `src/client/lazy-app/image-pipeline*`,
the 16-module bulk engine in `src/client/lazy-app/bulk/`, `src/features/**`,
`codecs/**`. We repaint the UI; we don't rewrite the engine.

## How to run / test / verify

From `prototypes/sveltekit/` (also run `npm install` at the **repo root** once,
so engine imports type-resolve):

```sh
npm install
npm run dev      # the editor (dev). With the launch config below: http://localhost:5188
npm run check    # svelte-check  (currently 0 errors / 0 warnings)
npm run build    # vite build + adapter-static  → build/
npm run preview  # serve the production build (needed to test the service worker)
npm run sync     # regenerate .svelte-kit/sqush-generated/*
npm run audit:static-output   # one physical WASM per logical asset
```

`.claude/launch.json` (untracked — it carries an absolute worktree path) defines
two Preview-MCP servers: `sqush-prototype` (dev, `--port 5188 --strictPort`) and
`sqush-preview` (`vite preview`, `--port 5189 --strictPort`). Use the **preview**
(5189) to test the service worker — it only registers in production builds.

Every Svelte component is validated with the Svelte MCP autofixer; re-run
`npm run check` after edits.

## Browser-verified (2026-05-31)

The editor has been driven end-to-end on the `svelte` branch:

- Earlier full-editor QA verified all then-active codec formats through the unified
  `compressImage` path, option panels, two-up zoom/pan/split, rotate, resize,
  quantize, saved settings, and offline service-worker behavior.
- Current hardening QA on a production preview (`127.0.0.1:5189`) verified the
  new logo asset, desktop two-up horizontal layout, mobile vertical layout at
  390×844 with no horizontal overflow, WebP 2 online encode to `.wp2`, WebP 2
  offline encode after reload, zero console errors, and a controlled service
  worker cache containing `/`, `/diagnostics`, `/logo.webp`, and the WebP 2
  encoder/decoder WASM.
- Current static audit verifies 17 logical codec assets and one physical WASM per
  logical asset, including WebP 2 encoder/decoder. `npm run check`,
  `npm run build`, `npm run audit:static-output`, `npm audit --audit-level=low`,
  and root `npm run check` are green.

## Next

1. **Do a short maintainer acceptance pass** before any new feature work: large
   images, SVG input, downloads, and settings import/save on the production
   preview.
2. **Phase 6 — Bulk UI** on the existing 16-module bulk engine (multi-file
   import, image strip, global settings + per-image overrides, batch processing,
   export). See [bulk-image-architecture.md](bulk-image-architecture.md).
3. **Phase 7 — The flip**: promote `prototypes/sveltekit/` to production, retire
   Preact + Rollup.

## Known risks / gotchas (carry forward)

- **Threaded codecs** (AVIF/JXL/OxiPNG multi-thread, COOP/COEP) are **not**
  proven — single-thread is the parity baseline; threaded is an optional perf
  track.
- **Generated files aren't committed.** `npm run sync` regenerates the
  prototype's `.svelte-kit/sqush-generated/*`; the root `src/client/lazy-app/
feature-meta/*` are produced by the root build. A fresh worktree needs
  `npm install` at the repo root.
- **Preview / service-worker gotcha**: the Claude preview browser persists
  service workers across runs; a stale SW can mask dev edits (curl shows new code
  while the browser shows old). Dev now auto-unregisters SWs + clears caches on
  load; ports are pinned (5188 dev / 5189 preview). When verifying, the editor's
  option controls only render after a file is loaded.
- **WebP 2 is experimental parity.** It is included in the SvelteKit active
  surface now, using single-thread encode/decode assets. Chromium preview QA
  covers online and offline encode, but do not promote it as a primary production
  codec until maintainer/product testing says it is worth keeping.
- **Don't touch `codecs/`** without the provenance/build/SW/browser checks in
  [codec-provenance.md](codec-provenance.md).

## Map of the docs

- **MIGRATION-PLAN.md** — the active sequenced plan (phases 1–7 + the Phase 5
  polish backlog). **Read after this file.**
- **bulk-image-architecture.md** — the bulk data model (Phase 6 reference).
- **sveltekit-codec-asset-strategy.md** — how codec WASM URLs are generated.
- **codec-provenance.md** — where the codecs come from; rules for touching them.
- **road-map.md** — the original product roadmap (the "why").
- **HANDOFF-2026-05-30.md**, **sveltekit-migration-seams-\*.md**, **history/** —
  point-in-time records, superseded by this STATUS for live state.
