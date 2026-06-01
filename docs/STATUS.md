# Sqush Status

Last updated: 2026-06-01.

Read this first. Sqush is a local-first image optimizer: image work stays in the
browser, the build is static, and offline reload must work after load.

## Current State

- The SvelteKit 2 / Svelte 5 migration is **concluded**. `main` is the
  production app at the repo root (not in `prototypes/sveltekit/`).
- The original Preact/Rollup app is preserved on the `preact` branch (tag
  `preact-final`) for reference only — it is no longer a fallback for `main`.
  There is a single working tree at the repo root; the `svelte` branch and the
  `../Sqush-svelte` worktree are gone.
- The current track is **post-migration cleanup and Svelte hardening**: remove
  dead Preact-era code, make ported components fully idiomatic Svelte 5, and fix
  the defects found by the post-migration review. Prioritized backlog:
  [svelte-hardening-plan.md](svelte-hardening-plan.md).
- Bulk UI is not part of this cleanup. Bulk and other product additions are
  tracked in [road-map.md](road-map.md).
- Repo hygiene (2026-06-01): the ambient Emscripten type declaration now lives
  at `src/emscripten-types.d.ts`, alongside the other `src/*.d.ts` ambient
  files, instead of sitting loose at the repo root (its `///` reference in
  `src/app.d.ts` was updated to match). Disposable local scratch
  (`.playwright-cli/`, `.tmp/`, stray `.DS_Store`) was also cleared. The type
  move is compile-time only, so build output is unchanged and `npm run check`
  stays green.

## Product Scope For Launch

The root app preserves the existing single-image optimizer:

- import by file picker or drag/drop;
- local decode, preprocess, resize, quantize, encode, preview, and download;
- two-up before/after output with zoom, pan, split, backgrounds, and rotate;
- per-side output format and option panels;
- saved per-side encoder settings;
- static output through SvelteKit adapter-static;
- SvelteKit-native service worker and codec/WASM precache;
- WebP, WebP 2, AVIF, JPEG XL, MozJPEG, OxiPNG, QOI, and browser encoders.

WebP remains the first production focus, AVIF second, JPEG XL advanced, and WebP
2 experimental but included for parity until maintainer testing proves whether
it should stay.

## Active Architecture

- `src/routes/+page.svelte` — single-image optimizer route.
- `src/routes/diagnostics/+page.svelte` — runtime diagnostics for generated
  workers, WASM assets, pipeline probes, and shared helpers.
- `src/lib/editor/editor-session.svelte.ts` — rune-backed editor state and
  encode orchestration.
- `src/lib/editor/options/` — Svelte option controls and per-format panels.
- `src/lib/editor/output/` — two-up output view and local pointer/zoom helpers.
- `src/lib/compress.ts` — Svelte adapter over the shared image pipeline.
- `src/lib/sveltekit-worker-bridge.ts` — SvelteKit worker bridge over generated
  worker metadata.
- `src/client/lazy-app/image-pipeline*` — framework-neutral single-image engine.
- `src/client/lazy-app/bulk/` — framework-neutral bulk helpers for future work.
- `src/features/**` — codec metadata, client runtimes, and worker runtimes.
- `src/shared/codec-assets.ts` — build-tool-neutral codec asset records.
- `scripts/sync-sveltekit-app.mjs` — generates
  `.svelte-kit/sqush-generated/*`.
- `scripts/audit-static-output.mjs` — verifies emitted worker/WASM output.
- `src/service-worker.ts` — SvelteKit service worker.

Generated files live under `.svelte-kit/sqush-generated/` and are not
committed. Run `npm run sync` or `npm run check` to regenerate them.

## Commands

From the repo root:

```sh
npm install
npm run dev
npm run build
npm run preview
npm run check
npm run audit
```

`npm run check` is the standard gate: formatting check, generator sync,
SvelteKit sync, `svelte-check`, production build, and static-output audit.

## Verification State

Current local verification:

- `npm install` pruned the old Rollup/Preact graph and produced a clean audit.
- `npm run sync` regenerates the SvelteKit metadata and codec wrapper copies.
- `svelte-check --tsconfig ./tsconfig.json` is green after the root move.
- `npm run check` passes: formatting, generator sync, SvelteKit sync,
  `svelte-check`, production build, and static-output audit.
- `npm run audit` reports 0 vulnerabilities.
- Production preview smoke on `http://127.0.0.1:5189/` passes with Playwright:
  PNG to WebP, PNG to WebP 2, JPEG/SVG/WebP inputs to WebP, desktop load,
  `390 x 844` mobile viewport with no horizontal overflow, controlled service
  worker, offline reload, and no console/page errors.
- Svelte MCP docs were consulted for project structure, adapter-static,
  service workers, `$service-worker`, config, `.svelte.ts` modules, and Svelte 5
  best practices.
- Svelte MCP autofixer reports no hard issues for the edited route/editor
  components. Remaining suggestions are DOM/canvas effects that are intentional
  side effects.

A post-migration read-only review (two independent passes) confirmed the
migration is idiomatic at the surface — no `createEventDispatcher`, `on:`
directives, `export let`, `$:`, or `writable()` stores. The remaining work is
hardening, captured in [svelte-hardening-plan.md](svelte-hardening-plan.md).

## Next Actions

Work the cleanup backlog in [svelte-hardening-plan.md](svelte-hardening-plan.md),
roughly in wave order:

1. Wave 0 — confirmed defects/rule-violations: the two-up "2"-key divider bug,
   browser host objects in deep `$state`, and the unthrottled `persistSettings`
   write.
2. Wave 1 — dead-code purge (the `preact` type shim, `clean-modify.ts`, dead
   `util/index.ts` helpers, orphaned `.css.d.ts` stubs).
3. Waves 2–3 — the controlled-component event boundary and the `apply()`
   mirror-state panels (AVIF/JXL).
4. Then reactivity cleanups, Output attachments, and structural simplification.

Roadmap/product work (starting with bulk-optimization design) follows the
cleanup — see [road-map.md](road-map.md).

## Gotchas

- Do not add bulk UI as part of migration cleanup.
- Do not prune WebP 2 yet; it remains included as experimental parity.
- Do not touch `codecs/**` without codec provenance, build, service-worker, and
  browser verification.
- Preview browsers can keep old service workers. If behavior looks stale, clear
  site data or use a fresh context.
