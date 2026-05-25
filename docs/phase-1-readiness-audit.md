# Phase 1 readiness audit

Last updated: 2026-05-25.

## Verdict

Phase 1 has reached the point where more small helper-extraction commits have
diminishing returns. The core single-image workflow has stronger automated
coverage than it had at the start of the phase, bulk backend logic is
framework-neutral and tested, and the current app has been kept local-first and
offline-capable.

The remaining work should be handled as larger product and platform tracks, not
as another long sequence of tiny cleanup commits.

## What is ready

- The supported local build baseline is Node 24 and npm 11.
- `npm run check` covers formatting, production build, build smoke, pure helper
  tests, and TypeScript.
- `npm run smoke:browser` covers the production Chromium flow for PNG import,
  WebP output, WebP resize to `64x64`, extensionless input naming, saved WebP
  settings import, offline app-shell reload, and service-worker-disabled app
  loading.
- Bulk backend helpers cover import, settings, queueing, processing, export
  plans, stale-output handling, selection/detail/summary selectors, snapshot
  metadata, object URL cleanup, and runner behavior without Preact dependencies.
- The single-image editor still works through the existing Preact UI, but most
  risky state and workflow decisions have been moved into tested plain
  TypeScript helpers.
- The Svelte/SvelteKit direction is documented, and current SvelteKit guidance
  still supports a static/offline app through `adapter-static` plus service
  workers.

## What is not worth doing as more Phase 1 cleanup

- Extracting every remaining event handler or JSX branch from Preact components.
  The remaining components are still old, but they are no longer the main risk.
- Deleting codecs. The codec tree is tied to generated metadata, workers, WASM
  files, service-worker caching, and current output options.
- Rewriting the visible UI without a design pass.
- Migrating the whole app to Svelte/SvelteKit before proving workers, WASM,
  service-worker caching, static output, and the imported helper modules in a
  small prototype.

## Remaining big tracks

### 1. Bulk product design

This is the next product track. The backend is ready enough for a UI design
pass, but production bulk UI should still wait for design discussion.

Decisions needed:

- single screen versus mode switch from the current single-image editor;
- image strip behavior and selected-image review;
- global settings versus per-image override controls;
- first export behavior: individual downloads first or ZIP first;
- first visible formats, most likely WebP first, then AVIF, with JPEG XL as
  advanced.

### 2. Svelte/SvelteKit prototype

This can start before a full migration. It should be a small proof, not a
production rewrite.

Prototype scope:

- use Svelte 5 runes for local UI state;
- use SvelteKit static output;
- import existing framework-neutral helpers from the current app;
- prove that one local image can move through import, settings selection,
  optimized output metadata, and export planning;
- prove service-worker/offline and WASM/worker asset handling before replacing
  the current build.

### 3. Build and dependency modernization

The repo still uses Rollup 2, older Rollup plugins, TypeScript 4.9, and a custom
build stack. This is now the largest engineering-maintenance risk.

Recommended sequence:

1. Treat a Vite/SvelteKit or Vite/Preact build as a separate spike.
2. First prove workers, WASM assets, service-worker asset lists, static output,
   and browser smoke.
3. Only then decide whether to replace the current Rollup build.
4. Do not mix this with production bulk UI.

### 4. Codec product scope and provenance

The product direction is WebP, AVIF, and JPEG XL. The inherited app still has a
larger visible and built codec surface.

Recommended sequence:

1. Decide which formats are visible in the product.
2. Hide non-target formats before deleting code.
3. Before modifying or deleting a codec, record generated-artifact provenance for
   the relevant WASM files.
4. Keep a verified checkpoint before any codec removal.

### 5. Release QA

Current automated browser smoke is Chromium-based. Before public support claims,
run manual or automated checks for the documented browser baseline:

- Chrome/Chromium 121+;
- Edge 121+;
- Firefox 115 ESR+;
- Safari 17+.

Minimum release checks should include import, WebP export, AVIF if visible,
download, saved settings, production reload, and offline app-shell behavior.

## Recommendation

Close Phase 1 after the readiness docs/dashboard are updated and the current
local commits are pushed once for CI. Then move to one of these larger tracks:

1. Start the bulk UI design/prototype discussion.
2. Start a small SvelteKit technical prototype.
3. Start a build modernization spike.
4. Decide codec visibility and product scope.

The highest-leverage engineering next step is the SvelteKit/build prototype,
because it answers whether the project can leave the old Rollup/Preact stack
without weakening the local/offline optimizer. The highest-leverage product next
step is bulk UI design.
