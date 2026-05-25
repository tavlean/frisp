# SvelteKit prototype handoff

Last updated: 2026-05-25.

## Purpose

Create a small, disposable technical prototype that answers whether Sqush can
move from the current Rollup/Preact stack toward SvelteKit without weakening the
core product promise:

- image optimization stays local;
- no server upload path is introduced;
- offline/service-worker behavior remains viable;
- workers and WASM assets can be built and served reliably;
- existing framework-neutral helpers can be reused from a SvelteKit app.

This is not a production UI migration and not the bulk UI implementation.

## Recommended branch/worktree

Use a separate worktree and branch:

```sh
git worktree add ../Sqush-sveltekit-prototype -b code/sveltekit-prototype main
```

Keep `main` stable. The prototype branch may add temporary dependencies,
configuration, and scaffolding that would be too noisy for the production app
until proven.

## Prototype scope

Start with `prototypes/sveltekit/`.

The first milestone should prove:

1. Svelte 5/SvelteKit static output builds.
2. A Svelte route can import existing plain TypeScript helpers from the repo.
3. Bulk/session helpers can create and summarize a metadata-only batch.
4. The prototype can include a service-worker path or document what blocks it.
5. The prototype can explain how current worker/WASM codec assets would be
   handled before any real migration.

Use SvelteKit as the target. Do not broaden the spike to any non-SvelteKit
build path unless SvelteKit produces a concrete blocker that is documented with
a minimal reproduction.

Current npm versions checked on 2026-05-25:

- `svelte`: `5.55.9`
- `@sveltejs/kit`: `2.61.1`
- `@sveltejs/adapter-static`: `3.0.10`
- `@sveltejs/vite-plugin-svelte`: `7.1.2`
- `vite`: `8.0.14`
- `svelte-check`: `4.4.8`

Svelte MCP docs checked on 2026-05-25:

- `kit/project-types`
- `kit/adapter-static`
- `kit/service-workers`
- `kit/$service-worker`
- `kit/page-options`
- `kit/configuration`
- `kit/$app-environment`
- `kit/state-management`
- `kit/building-your-app`
- `kit/performance`
- `svelte/what-are-runes`
- `svelte/$state`
- `svelte/$derived`
- `svelte/$effect`
- `svelte/$props`
- `svelte/best-practices`
- `svelte/testing`
- `svelte/typescript`
- `svelte/v5-migration-guide`

Important SvelteKit/Svelte 5 guidance for this spike:

- Prefer `@sveltejs/adapter-static` and static output.
- Use SvelteKit's service-worker support and `$service-worker` manifest for
  built assets, static files, prerendered paths, and versioned cache names.
- Use `$app/environment` for browser/dev/build-time checks when needed.
- Keep browser-only APIs behind browser-only execution paths.
- Use Svelte 5 runes: `$state` for local mutable UI state, `$derived` for pure
  computed values, `$effect` only for real side effects, and `$props` for
  component inputs.
- Avoid `$effect` for state relationships that can be derived.
- Keep large binary payloads such as `File`, `Blob`, `ImageData`, workers, WASM
  modules, and object URLs out of deep reactive state unless there is a measured
  reason.
- Use keyed `{#each}` blocks for image jobs and stable job identity.
- Use `svelte-check` and the Svelte MCP autofixer before finalizing Svelte files.

Avoid:

- production bulk UI;
- replacing the current app shell;
- deleting or moving codecs;
- changing current Rollup build behavior;
- adding server-side image processing.

## Useful context files

Read these before working:

- `docs/phase-1-readiness-audit.md`
- `docs/svelte-migration-context.md`
- `docs/bulk-image-architecture.md`
- `docs/progress-dashboard.md`
- `docs/maintenance-status.md`
- `AGENTS.md`

## Current recommendation

The SvelteKit prototype is now the highest-leverage engineering spike. It should
answer the build/platform question before production migration work begins.

If it succeeds, merge back lessons and small reusable config/docs first. Do not
merge a full UI rewrite by default.

## Fresh-chat prompt

Use this short goal prompt in a new Codex chat. The goal text is intentionally
compact so it fits Codex Desktop's goal length limit; the detailed context lives
in the files it tells the new agent to read.

```text
Work on Sqush's SvelteKit 2 / Svelte 5 technical prototype until the spike can
clearly answer whether SvelteKit static output can safely carry Sqush's
local-first image optimizer architecture.

Use Codex Desktop New Worktree from branch `code/sveltekit-prototype`.

Read first:
- AGENTS.md
- docs/sveltekit-prototype-handoff.md
- docs/phase-1-readiness-audit.md
- docs/svelte-migration-context.md
- docs/bulk-image-architecture.md
- docs/maintenance-status.md
- docs/browser-support.md
- docs/codec-provenance.md
- docs/codec-source-references.md

Prototype lives in `prototypes/sveltekit/`.

Constraints:
- Keep Sqush local/offline/serverless; no upload or server image processing.
- Keep SvelteKit as the target; do not pivot unless SvelteKit has a documented
  concrete blocker with a minimal reproduction.
- Do not implement production bulk UI.
- Do not start a full production migration.
- Do not replace the current app shell yet.
- Do not delete/move codecs or major build pieces.
- Use Svelte MCP/docs when creating or analyzing Svelte code.
- Keep the prototype disposable and separated under `prototypes/sveltekit`.

Current prototype already proves pure bulk/session helpers can be consumed from
SvelteKit. Next, prove or document: generated feature metadata strategy, worker
imports, WASM assets, service-worker/offline caching, and the blockers for full
image-pipeline import.

Verify meaningful changes with:
- `npm run check` in `prototypes/sveltekit`
- `npm run build` in `prototypes/sveltekit`
- `npm audit --audit-level=low` in `prototypes/sveltekit`
- Svelte MCP autofixer for changed `.svelte` files
- browser/render check when runtime or service-worker behavior changes

Commit meaningful checkpoints and push when CI feedback is useful.
```
