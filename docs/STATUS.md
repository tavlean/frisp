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

## Branches (two — clean)

```
main      stable Preact + Rollup app (production, untouched)
svelte    migration trunk — engine seams + codec-asset strategy + runnable
          single-image UI + all docs. This is where migration work continues.
```

- **`svelte`** is the single migration trunk (it absorbed the old
  `codec-assets`, `migration-seams`, `prototype`, and `single-image-slice`
  branches — all verified fully contained before deletion, nothing lost). Its
  worktree is at `../Sqush-svelte`.
- Optional per-phase branches cut from `svelte`: `svelte-plumbing` →
  `svelte-editor` → `svelte-bulk` (see [MIGRATION-PLAN.md](MIGRATION-PLAN.md)).
- The `upstream` (GoogleChromeLabs) remote and its ~113 stale tracking branches
  were removed; all commits remain in `main`'s ancestry.
- Older docs below may still name the retired `code/sveltekit-*` branches in
  their point-in-time narratives — that history is intact, but the live branch
  names are just `main` and `svelte`.

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

**Decided:** go all-in on Vite/SvelteKit, **plumbing-first**, parity before any
redesign, keep every codec for now. The sequenced plan lives in
**[MIGRATION-PLAN.md](MIGRATION-PLAN.md)** — start there. Phase order:

1. Productionize the codec-asset strategy (no duplicate WASM).
2. Worker-bridge parity — all active codecs through one generated path.
3. SvelteKit-native service worker (offline app shell + codec precache).
4. SPA shell + routing (`ssr=false`, `adapter-static` fallback).
5. Single-image editor parity (before/after slider + all option panels).
6. Bulk UI on the existing bulk engine (the headline feature).
7. The flip: SvelteKit becomes production; retire Preact + Rollup.

## Known risks / open questions

- Threaded AVIF / JPEG XL / OxiPNG under static SvelteKit (COOP/COEP, nested
  workers, SW cache) are **not** proven — single-thread only so far.
- Build-tool decision (Rollup vs Vite) is open.
- Codec code deletion is deferred — it's coupled to generated metadata, workers,
  WASM assets, and SW caching.

## Map of the docs

- **MIGRATION-PLAN.md** — the active, sequenced plan to go all-in on
  Vite/SvelteKit (plumbing → parity → bulk → flip). **Start here.**
- **road-map.md** — the original phased product plan (the "why/what next").
- **bulk-image-architecture.md** — the bulk data model.
- **sveltekit-migration-seams-review.md / -exit-audit.md** — what's mergeable to
  `main` and what stays prototype-only.
- **sveltekit-codec-asset-strategy.md** — how codec WASM URLs are generated.
- **codec-provenance.md** — where the codecs come from.
- **build-and-runtime.md**, **browser-support.md**, **manual-qa.md** — ops.
- **history/** — point-in-time records kept for reference, not active work.
