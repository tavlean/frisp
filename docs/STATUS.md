# Sqush — Status (start here)

Last updated: 2026-05-30.

A focused, local-first fork of Squoosh. Priorities: **WebP, AVIF, JPEG XL**;
headline feature is **bulk image optimization**; long-term UI is **Svelte 5**.
This file is the single entry point — the older status docs are layered detail.

## The one-paragraph picture

The framework-neutral engine is in good shape: the image pipeline, the codec
worker bridges, and the entire **bulk engine** are plain TypeScript, decoupled
from Preact, and proven to run under SvelteKit. The original Squoosh app (Preact

- Rollup) is untouched and still the working product. What's missing is the
  **UI** — deliberately left for the UI track. The first piece of that UI now
  exists: a runnable single-image compressor on the SvelteKit prototype.

## Branch stack (one canonical branch, not three rivals)

```
main                              stable Preact + Rollup app (production, untouched)
  └─ code/sveltekit-prototype     disposable proof: codecs run under SvelteKit   (⊂ codec-assets)
       └─ code/sveltekit-migration-seams   framework-neutral seams for Vite/SvelteKit  (⊂ codec-assets)
            └─ code/sveltekit-codec-assets  + codec-asset URL strategy   ← CANONICAL backend branch
                 └─ code/sveltekit-single-image-slice   ← NEW: runnable single-image UI
```

- `code/sveltekit-codec-assets` **contains** the prototype and migration-seams
  branches in full (verified: 0 commits of either are missing from it). It is
  the only branch that needs to exist alongside `main`.
- `code/sveltekit-migration-seams` and `code/sveltekit-prototype` are now
  **redundant** (subsets of codec-assets). Safe to retire once you're happy —
  see [HANDOFF](HANDOFF-2026-05-30.md).

## Done

- Phase 1 stabilize: Node 24 baseline, CI matrix green, dependency audit.
- Logic decoupled from Preact into ~67 framework-neutral TS modules.
- **Bulk engine** built (`src/client/lazy-app/bulk/`, 16 modules) — pure TS,
  injectable worker bridge, not wired to any UI.
- Codec focus encoded: `wp2` (WebP 2) blocked across the active worker surface.
- SvelteKit migration **seams** proven and reviewed (see
  [sveltekit-migration-seams-review.md](sveltekit-migration-seams-review.md)).
- Prototype proves the production pipeline runs under SvelteKit for WebP, AVIF,
  JPEG XL, MozJPEG, OxiPNG, QOI (single-thread), plus `processBulkImageJob` and
  `runCompressionUpdateWorkflow`.
- Canonical codec-asset URL strategy documented
  ([sveltekit-codec-asset-strategy.md](sveltekit-codec-asset-strategy.md)).

## Browser-verified (2026-05-30)

The single-image compressor was driven end-to-end in a real browser (Vite dev +
the SvelteKit codec workers) on a 2.66 MB JPEG photo. All three focus formats
produced valid, downloadable output, with the quality slider re-encoding live:

| Format            | Output   | Saved  |
| ----------------- | -------- | ------ |
| WebP (q75)        | 688.0 KB | −74.8% |
| AVIF (q50)        | 1.09 MB  | −59%   |
| JPEG XL (q75)     | 695.0 KB | −74.5% |
| WebP (q25 slider) | 245.2 KB | −91%   |

Output previews render and download is enabled. Zero console errors.
`svelte-check` passes 0/0; the Svelte autofixer reports no issues.
(AVIF at the default speed/quality is larger here because the codec defaults are
conservative — tuning per-format defaults is a follow-up.)

## In progress / just added (this pass, on the slice branch)

- **Runnable single-image compressor UI** (Svelte 5): drop/pick a real file →
  decode → optional resize → encode to WebP/AVIF/JXL → live preview, size, %
  saved, download. It reuses the shared image-pipeline helpers
  (decode/preprocess/resize) the bulk engine uses, then encodes through the
  SvelteKit worker bridge per format (AVIF/JXL aren't in the prototype's
  WebP-only `encoderMap` yet — see HANDOFF). Files:
  `prototypes/sveltekit/src/routes/+page.svelte` and
  `prototypes/sveltekit/src/lib/compress.ts`. The old diagnostic page moved to
  `/diagnostics`.
- Docs cleaned up and this STATUS + a clear `docs/dashboard.html` added.

## Next

1. Verify the slice in a browser (`cd prototypes/sveltekit && npm run dev`),
   tune defaults, polish the look gradually toward the target design.
2. Build the **bulk UI** on top of the same engine (multi-import strip,
   per-image overrides) — Phase 3/4 of the road map.
3. Decide the build tool: keep Rollup for the Preact app vs. go all-in on
   Vite/SvelteKit. (Open question — see codec-asset strategy.)
4. Hide non-focus codecs from the UI, then prune later.

## Known risks / open questions

- Threaded AVIF / JPEG XL / OxiPNG under static SvelteKit (COOP/COEP, nested
  workers, SW cache) are **not** proven — single-thread only so far.
- Build-tool decision (Rollup vs Vite) is open.
- Codec code deletion is deferred — it's coupled to generated metadata, workers,
  WASM assets, and SW caching.

## Map of the docs

- **road-map.md** — the phased plan (the "why/what next").
- **bulk-image-architecture.md** — the bulk data model.
- **sveltekit-migration-seams-review.md / -exit-audit.md** — what's mergeable to
  `main` and what stays prototype-only.
- **sveltekit-codec-asset-strategy.md** — how codec WASM URLs are generated.
- **codec-provenance.md** — where the codecs come from.
- **build-and-runtime.md**, **browser-support.md**, **manual-qa.md** — ops.
- **history/** — point-in-time records kept for reference, not active work.
