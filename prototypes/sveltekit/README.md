# Sqush SvelteKit prototype

This is a disposable technical prototype. It is not the production Sqush app and
not the bulk UI implementation.

The first milestone proves that a Svelte 5/SvelteKit static app can import
framework-neutral helpers from the existing Sqush source tree and build with a
service-worker entry point.

## Commands

```sh
npm install
npm run check
npm run build
npm audit --audit-level=low
```

## Current proof

- Uses Svelte 5 runes in `src/routes/+page.svelte`.
- Imports existing bulk helpers from `src/client/lazy-app/bulk`.
- Builds with `@sveltejs/adapter-static`.
- Includes a prototype service worker using SvelteKit's `$service-worker`
  asset manifest.
- Produces `build/index.html`, `build/200.html`, and
  `build/service-worker.js`.
- `npm audit --audit-level=low` is clean with a prototype-only `cookie`
  override.
- Local preview rendered in Chromium through `playwright-cli`; the page title
  and imported job list were visible. The only console error was the expected
  missing prototype favicon.

## Findings

- Pure bulk/session helpers can be consumed from a SvelteKit app today.
- The full bulk barrel import is not ready for this prototype because it pulls
  in processing helpers, which then pull in image-pipeline, generated
  feature-meta, worker bridge, custom `omt:` imports, and codec-facing modules.
- A narrow feature-meta type stub is enough for the current metadata-only proof,
  but production migration needs a real generated metadata strategy.
- Service-worker generation is straightforward for static assets; codec/WASM
  precaching still needs a dedicated proof with real current codec assets.
- This prototype uses `ssr = false` because the app is browser-local and relies
  on `File`. A production migration should revisit whether selected routes can
  prerender meaningful HTML without touching browser-only APIs.

## Non-goals

- No production UI migration.
- No bulk UI implementation.
- No codec deletion or movement.
- No server-side image processing.
