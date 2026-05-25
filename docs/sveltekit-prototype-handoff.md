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

Use Codex Desktop's **New Worktree** option from the existing
`code/sveltekit-prototype` branch. Keep `main` stable. The prototype branch may
add temporary dependencies, configuration, and scaffolding that would be too
noisy for the production app until proven.

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

The SvelteKit prototype is now the active engineering spike. It should answer
the build/platform question before production migration work begins.

If it succeeds, merge back lessons and small reusable config/docs first. Do not
merge a full UI rewrite by default.

## Autonomous next-task queue

Use this queue when continuing the prototype for longer autonomous runs. Work in
order, keep each checkpoint meaningful, and stop only when a task is proven,
blocked with a concrete reproduction, or a safer next task is clearly documented.

### 1. WebP single-image pipeline probe

Status: proven for a narrow WebP path.

The prototype now has a diagnostic SvelteKit path that starts from a locally
generated PNG `File`, uses existing local helper primitives for encode-to-source,
mime sniffing, browser decode, resize processing, output naming, percent change,
settings resolution, and settings hashing, then encodes through the existing
WebP worker module in a SvelteKit-built worker. Runtime browser verification
produced a real `RIFF`/`WEBP` output and export metadata.

Do not treat this as proof that the full current image pipeline is drop-in.
`src/client/lazy-app/image-pipeline.ts` and `bulk/processor.ts` still pull the
full generated encoder map, production worker bridge, Preact option entries, and
Rollup-only virtual import schemes. The next task should turn the successful
primitive imports into a reusable migration seam instead of broadening the
prototype into production UI.

### 2. Reusable migration seams

Status: started.

The first behavior-preserving shared-source seam is in place:
`src/client/lazy-app/abort.ts` owns abort helpers, and
`src/client/lazy-app/image-decode.ts` owns browser decode/mime helpers. The broad
`util` module keeps re-exports for compatibility, production image-pipeline code
imports the narrow modules directly, and the SvelteKit prototype no longer needs
to import browser decode helpers through `util`.

If the pipeline probe needs tiny shared helpers, extract them from Preact code
only when the change is behavior-preserving and covered by checks. Prefer
framework-neutral helper modules over Svelte-specific or Preact-specific glue.
Do not broaden into production UI work.

### 3. Prototype offline proof

Status: proven for the prototype shell and WebP probe assets.

The prototype registers its emitted `service-worker.js` in production builds.
The static audit now confirms cache-manifest coverage for app entry/start/route
assets, page CSS, service-worker-imported codec workers, baseline WebP WASM, and
SIMD WebP WASM. Runtime Chrome verification confirmed the page becomes
service-worker controlled after reload and Cache Storage contains the app shell,
pipeline worker, baseline WebP WASM, and SIMD WebP WASM.

One important finding: SvelteKit's build manifest and the explicit codec asset
manifest can both contain the same WebP WASM URLs. Passing duplicates to
`cache.addAll` makes the service-worker install fail and the worker become
redundant, so the prototype de-dupes the install list with `Set`.

Extend `audit:static-output` and browser checks to confirm app shell, worker
assets, baseline WebP WASM, SIMD WebP WASM, and generated codec asset
references are cache-covered. If the available browser surface cannot expose
service workers, document that limitation and add the strongest static/runtime
proxy check available.

### 4. Codec asset duplication

Investigate why explicit service-worker codec imports plus existing Emscripten
worker imports emit duplicate WASM files. Prefer a disposable generated manifest
or Vite-compatible asset URL seam if it removes duplication without moving
codec files. If not solved, document the exact blocker and migration
implication.

### 5. Readiness verdict

Keep `prototypes/sveltekit/README.md` and this handoff current. End the spike
with a clear verdict: what is proven, what remains blocked, and the safest next
engineering track before any production migration.

### Verification expectations

- In `prototypes/sveltekit`: run `npm run check`, `npm run build`,
  `npm run audit:static-output`, and `npm audit --audit-level=low`.
- Run Svelte MCP autofixer for changed `.svelte` files.
- Run browser/render checks for runtime or service-worker behavior changes.
- Run root `npm run check` when touching shared production source.
- Commit meaningful checkpoints.
- Push when CI feedback is useful and check the CI result.

## Fresh-chat prompt

Use this short goal prompt in a new Codex chat. The goal text is intentionally
compact so it fits Codex Desktop's goal length limit; the detailed context lives
in the files it tells the new agent to read.

```text
Continue Sqush's SvelteKit 2 / Svelte 5 technical prototype until it can give a
clear migration-readiness answer for Sqush's local-first single-image optimizer.

Use Codex Desktop New Worktree from branch `code/sveltekit-prototype`.

Read first:
- AGENTS.md
- docs/sveltekit-prototype-handoff.md
- docs/svelte-migration-context.md
- docs/phase-1-readiness-audit.md
- docs/bulk-image-architecture.md
- docs/browser-support.md
- docs/codec-provenance.md
- prototypes/sveltekit/README.md

Prototype lives in `prototypes/sveltekit/`.

Constraints:
- Keep Sqush local/offline/serverless; no uploads or server image processing.
- Keep SvelteKit static output as the target unless there is a concrete blocker
  documented with a minimal reproduction.
- Do not implement production bulk UI.
- Do not start a full production migration.
- Do not replace the current Preact app shell.
- Do not delete/move codecs, generated metadata, workers, or WASM assets.
- Use Svelte MCP/docs when creating, editing, or analyzing Svelte code.
- Keep the prototype disposable and separated under `prototypes/sveltekit`.

Current prototype already proves SvelteKit static output, shared bulk/session
helper imports, generated WebP metadata, worker/WASM asset emission, and real
WebP worker encoding. Continue through the "Autonomous next-task queue" in
`docs/sveltekit-prototype-handoff.md`, committing meaningful checkpoints.

Verification: use the handoff's verification expectations. Push when CI feedback
is useful and check the CI result.
```
