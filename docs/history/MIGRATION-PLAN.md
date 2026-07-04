# Presk SvelteKit Migration Plan

Last updated: 2026-06-01.

> **Status: CONCLUDED.** All phases are done. `main` is the production
> SvelteKit 2 / Svelte 5 app; the Preact/Rollup app is archived on the `preact`
> branch. This document is kept as the historical migration record. Active work
> is now post-migration cleanup — see
> [svelte-hardening-plan.md](../svelte-hardening-plan.md).

Read [STATUS.md](../STATUS.md) first. This document is only the migration track.
New product features, including bulk UI, live in [road-map.md](../road-map.md).

## Decision

Presk is moving from the inherited Preact/Rollup app to a SvelteKit 2 /
Svelte 5 static SPA. The user-facing single-image optimizer must remain
functionally equivalent while the build/runtime foundation moves to Vite,
SvelteKit workers, generated codec metadata, and a SvelteKit-native service
worker.

The SvelteKit app has been promoted to the repo root and is now `main`. The
`prototypes/sveltekit/` spike is closed and the `svelte` branch has been merged
away. The historical Preact/Rollup app is archived on the `preact` branch (tag
`preact-final`).

## Migration Scope

In scope:

- preserve single-image import, decode, process, encode, preview, and export;
- preserve active codec parity, including experimental WebP 2;
- preserve saved settings and download behavior;
- preserve static output and offline reload;
- move build/runtime ownership to SvelteKit/Vite;
- remove obsolete Preact/Rollup source from the `svelte` branch once parity is
  proven.

Out of scope:

- production bulk UI;
- new workflows such as ZIP export, target-size mode, share target, folder
  import, or installable PWA polish;
- codec pruning or product visibility changes;
- server-side image processing.

## Completed Phases

1. **Codec asset strategy**: `scripts/sync-sveltekit-app.mjs` generates
   `.svelte-kit/presk-generated/*`, including codec URL manifests, patched
   wrapper copies, worker metadata, and service-worker cache records.
2. **Worker bridge parity**: the SvelteKit worker surface covers all active
   launch formats, including WebP 2.
3. **SvelteKit service worker**: `src/service-worker.ts` uses `$service-worker`
   plus generated codec precache URLs.
4. **Static SPA shell**: root layout uses `ssr = false`, `prerender = true`, and
   adapter-static with `fallback: '200.html'`.
5. **Single-image editor parity**: the Svelte editor supports the existing
   before/after workflow, codec options, processors, downloads, settings, and
   responsive layout.
6. **Root promotion and legacy cleanup**: the SvelteKit app, static assets,
   config, and scripts now live at the repo root. The old Rollup/Preact app
   shell and obsolete adapters have been removed from this branch.

## Current Root Structure

- `src/routes/` — SvelteKit routes.
- `src/lib/` — Svelte app adapters, editor UI, diagnostics, service-worker
  registration, and worker bridge.
- `src/client/lazy-app/` — framework-neutral image engine and bulk helpers that
  survived the migration.
- `src/features/` — feature metadata, client runtimes, and worker runtimes.
- `src/shared/codec-assets.ts` — shared codec asset contract.
- `src/sw/cache-plan.ts` and `src/sw/tiny.avif` — service-worker cache helper
  and diagnostics fixture.
- `codecs/` — committed codec JS/WASM outputs.
- `scripts/sync-sveltekit-app.mjs` and `scripts/audit-static-output.mjs` —
  generator and output audit.
- `static/` — logo, favicon, and Apple touch icon.

## Verification Gate

The local verification gate passed on 2026-05-31:

```sh
npm run check
npm run audit
```

Production preview browser smoke also passed on `http://127.0.0.1:5189/`:

- PNG encoded to WebP and WebP 2;
- JPEG, SVG, and WebP inputs encoded to WebP;
- desktop editor loaded and generated download links;
- `390 x 844` mobile viewport had no horizontal overflow;
- service worker controlled the page and offline reload loaded the app shell;
- no unexpected console or page errors were reported.

Before launch acceptance, the maintainer should still run real-use manual QA on
large photos and any edge formats they care about.

## Remaining Migration Actions

None — the migration is closed. Post-migration cleanup is tracked in
[svelte-hardening-plan.md](../svelte-hardening-plan.md); product work is in
[road-map.md](../road-map.md).

## Notes For Future Agents

- The app is no longer a disposable prototype. Do not put new app code under
  `prototypes/`.
- Generated SvelteKit files belong under `.svelte-kit/presk-generated/`; do not
  commit them.
- Use Svelte MCP/docs and the Svelte autofixer for Svelte changes.
- Keep `File`, `Blob`, `ImageData`, workers, WASM modules, and object URLs out
  of broad reactive state unless there is a measured reason.
- Threaded codecs are not launch-blocking. Single-thread codec paths are the
  parity baseline.
