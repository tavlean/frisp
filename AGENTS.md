# Agent guide

Sqush is a local-first image optimizer. Its core promise is reliable
single-image optimization in the browser: no uploads, no server processing, and
dependable offline behavior after load. Any cleanup, migration, or feature work
must protect import, decode, process, encode, preview, export, and
service-worker behavior.

## Current stage

The SvelteKit 2 / Svelte 5 migration is **concluded**. `main` is the production
app, living at the repo root as a static SPA. The retired Preact/Rollup app is
preserved on the `preact` branch (tag `preact-final`) for reference only — it is
no longer a fallback for `main`. There is a single working tree at the repo
root; the old `../Sqush-svelte` worktree and the `svelte` branch are gone.

The immediate focus is **post-migration cleanup and Svelte hardening**: remove
dead Preact-era code, make the ported components fully idiomatic Svelte 5, and
fix the defects/rule-violations found by the post-migration review — all
behavior-preserving. The prioritized backlog is
[svelte-hardening-plan.md](docs/svelte-hardening-plan.md). Bulk UI and other new
product work remain roadmap items, not part of this cleanup.

## Boundaries

- Do not implement production bulk UI without maintainer/design discussion.
- Do not treat new product features as part of the Svelte migration.
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
- Run `npm run check` for app, build/tooling, runtime, service-worker, or docs
  changes.
- Use Svelte MCP/docs when creating, editing, or analyzing Svelte code. Run the
  Svelte autofixer after meaningful Svelte edits.
- Prefer idiomatic Svelte 5 over verbatim Preact ports: `$derived` for computed
  values (reserve `$effect` for genuine side effects), `bind:`/`$bindable` over
  controlled-input plumbing, `{@attach}` over `use:` actions, and snippets over
  duplicated markup. When unsure, write the question into a doc rather than guess.
- Commit meaningful checkpoints. Push when CI feedback is useful or the
  maintainer asks.

## Reference docs

- [Current status](docs/STATUS.md)
- [Cleanup & Svelte hardening plan](docs/svelte-hardening-plan.md)
- [Migration plan](docs/MIGRATION-PLAN.md) (concluded; historical)
- [Build and runtime map](docs/build-and-runtime.md)
- [Product roadmap](docs/road-map.md)
- [Svelte migration context](docs/svelte-migration-context.md)
- [Bulk image architecture](docs/bulk-image-architecture.md)
- [Manual QA checklist](docs/manual-qa.md)
