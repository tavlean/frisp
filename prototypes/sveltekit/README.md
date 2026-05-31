# Sqush SvelteKit app

This directory is the SvelteKit migration app on the `svelte` branch. It is
still isolated from the production Preact app on `main`, but it is no longer a
throwaway proof: it is the launch path once parity and QA are complete.

Read `../../docs/STATUS.md` first, then `../../docs/MIGRATION-PLAN.md`.

## Scope

- Single-image editor parity is the current foundation target.
- Bulk UI is intentionally not started here yet.
- The app must stay local-first: no uploads, no server processing, reliable
  offline behavior after load.
- WebP, AVIF, JPEG XL, QOI, MozJPEG, OxiPNG, browser encoders, and experimental
  WebP 2 are kept in the SvelteKit surface until pruning is evidence-based.

## Commands

Run root `npm install` once first so aliased engine imports resolve.

```sh
npm run check
npm run build
npm run audit:static-output
npm audit --audit-level=low
npm run dev
npm run preview
```

Use `npm run preview` for service-worker QA. The service worker registers only
for production builds; dev unregisters stale service workers and clears Cache
Storage so old previews do not mask edits.

## Architecture

- `src/routes/+page.svelte` owns route markup, intro/drop screen, and the
  responsive editor layout.
- `src/lib/editor/editor-session.svelte.ts` owns reactive editor orchestration:
  file lifecycle, side settings, debounced encode effects, object URL cleanup,
  resize dimension seeding, saved settings, and download names.
- `src/lib/compress.ts` adapts one file into the shared production image
  pipeline: decode -> preprocess -> process -> `imagePipeline.compressImage`.
- `src/lib/sveltekit-worker-bridge.ts` maps SvelteKit/Vite worker calls onto the
  existing framework-neutral worker bridge shape.
- `scripts/sync-sqush-prototype.mjs` generates SvelteKit-safe feature metadata,
  worker surface, patched codec wrappers, and logical codec asset manifests.
- `scripts/audit-static-output.mjs` verifies static output, service-worker cache
  coverage, and one physical WASM output per logical codec asset.

Generated files live under `.svelte-kit/sqush-generated/` and are not committed.

## Assets

The app logo lives in `static/logo.webp`. `static/favicon.png` and
`static/apple-touch-icon.png` are generated from the same source logo.

## Verification Bar

For meaningful editor, worker, codec, service-worker, or generated-asset changes,
run:

```sh
npm run check
npm run build
npm run audit:static-output
npm audit --audit-level=low
```

Then browser-test a production preview with:

- import/drop an image;
- encode WebP and at least one non-WebP WASM codec;
- test WebP 2 if codec parity changed;
- check a narrow mobile viewport for vertical two-up and panel scrolling;
- rotate, resize, quantize, replace image, download;
- reload after service-worker activation and confirm the app remains usable.
