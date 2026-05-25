# Agent guide

Sqush is a local-first image optimizer. Its core promise is reliable single-image
optimization in the browser: no uploads, no server processing, and dependable
offline behavior after load. Any cleanup, prototype, migration, or feature work
must protect import, decode, process, encode, preview, export, and service-worker
behavior.

## Current stage

Phase 1 cleanup is ready to stop being the main activity. Bulk backend helpers
are framework-neutral enough for design/prototype work, and the next engineering
spike is a small SvelteKit 2 / Svelte 5 static-output prototype under
`prototypes/sveltekit/`.

The prototype should answer whether SvelteKit can carry Sqush's existing
local/offline optimizer architecture: shared helpers, generated feature metadata,
workers, WASM assets, static output, and service-worker caching. Keep it
disposable and separated from the production Preact app until those questions are
answered.

## Boundaries

- Do not implement production bulk UI without maintainer/design discussion.
- Do not replace the current app shell as part of the prototype.
- Do not introduce server-side image processing or upload paths.
- Do not delete or move codecs, generated metadata, workers, or WASM assets
  unless the build and runtime consequences are proven.
- Keep WebP as the first production codec focus, AVIF second, JPEG XL advanced,
  and WebP 2 experimental only.

## Engineering rules

- Prefer behavior-preserving changes that reduce risk or clarify ownership.
- Reuse existing framework-neutral helpers before creating new logic.
- Keep browser objects such as `File`, `Blob`, `ImageData`, workers, WASM
  modules, and object URLs out of broad reactive state unless measured.
- Run focused tests for pure helper changes.
- Run `npm run check` for production app build/tooling/runtime changes.
- In `prototypes/sveltekit`, run its local `check`, `build`, and audit scripts
  for meaningful prototype changes.
- Use Svelte MCP/docs when creating, editing, or analyzing Svelte code.
- Commit meaningful checkpoints. Push when CI feedback is useful or the
  maintainer asks.

## Reference docs

- [SvelteKit prototype handoff](docs/sveltekit-prototype-handoff.md)
- [Phase 1 readiness audit](docs/phase-1-readiness-audit.md)
- [Svelte migration context](docs/svelte-migration-context.md)
- [Bulk image architecture](docs/bulk-image-architecture.md)
- [Progress dashboard](docs/progress-dashboard.md)
- [Maintenance status](docs/maintenance-status.md)
