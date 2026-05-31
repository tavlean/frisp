# Agent guide

Sqush is a local-first image optimizer. Its core promise is reliable single-image
optimization in the browser: no uploads, no server processing, and dependable
offline behavior after load. Any cleanup, prototype, migration, or feature work
must protect import, decode, process, encode, preview, export, and service-worker
behavior.

## Current stage

The launch path is the `svelte` branch and its worktree at
`../Sqush-svelte`. Sqush is now all-in on a SvelteKit 2 / Svelte 5 static app
under `prototypes/sveltekit/`, with the existing Preact/Rollup app on `main`
kept only as a safety net until the flip.

The immediate focus is a short **maintainer acceptance pass before new
features**: spot-check single-image editor parity, worker/WASM/static-output/
service-worker reliability, responsive layout, large/SVG inputs, downloads, and
settings. Do not start the bulk UI until this foundation is accepted.

## Boundaries

- Do not implement production bulk UI without maintainer/design discussion.
- Do not replace the current app shell as part of the prototype.
- Do not introduce server-side image processing or upload paths.
- Do not delete or move codecs, generated metadata, workers, or WASM assets
  unless the build and runtime consequences are proven.
- Keep WebP as the first production codec focus, AVIF second, JPEG XL advanced,
  and WebP 2 experimental but included for parity until there is evidence to
  prune it.

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

- [Current status](docs/STATUS.md)
- [Migration plan](docs/MIGRATION-PLAN.md)
- [Phase 1 readiness audit](docs/phase-1-readiness-audit.md)
- [Svelte migration context](docs/svelte-migration-context.md)
- [Bulk image architecture](docs/bulk-image-architecture.md)
- [Progress dashboard](docs/progress-dashboard.md)
- [Maintenance status](docs/maintenance-status.md)
