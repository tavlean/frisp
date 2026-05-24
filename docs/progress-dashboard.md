# Progress dashboard

This dashboard keeps the larger mission visible while small cleanup commits happen.

## Mission

Make Sqush a lean, maintainable, secure image optimization tool that is comfortable to extend. The core product value is reliable local image optimization: the app should keep working offline, without server processing, and without surprising users who depend on the single-image workflow. The first new product target is bulk image optimization. The longer-term maintainer target is a codebase that can be migrated to Svelte or SvelteKit without dragging old UI assumptions into the new app.

## Current progress

| Area                                 | Progress | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------ | -------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stabilization, CI, and security      |      98% | Audit is clean, the supported build baseline is Node 24, CI covers Ubuntu, Windows, and macOS, WebP output plus resize processing to a `64x64` WebP blob and saved WebP side settings import have automated local production-build smoke coverage, extensionless PNG input, offline app-shell reload, and service-worker-disabled app-shell loading are covered in browser smoke, saved-settings storage is failure-tolerant, side output reset and unmount cleanup behavior is covered, compressed output filenames are safer against path-like and reserved names, and built-in decode releases ImageBitmap resources.                                                                                                                                          |
| Documentation and handoff clarity    |      87% | Core docs exist. Progress, roadmap, issue list, project identity, codec provenance, browser support, QA, browser smoke, Svelte migration context, Node baseline, and maintenance status are tracked. Remaining old-name references are intentionally limited to historical provenance and the active local folder note.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Bulk backend foundation              |      93% | Framework-neutral helpers now cover import, structured import rejection reasons, import-to-session creation, append-import workflows, injected MIME sniffing, settings lookup, process-plan creation, safe settings-change workflows, queueing, queue-state selectors, full queue draining, active/incomplete requeueing, active-job cancellation, derived session counters, drift-tolerant session mutations, drift-tolerant queue scheduling and transitions, metadata-only session snapshots with validated parsing/restoration, per-job size state, selected export plans, export-plan completion, export summaries, stale export guards, selected-job detail, strip and queue-aware session summary view models, command action state, processing, and URLs. |
| Repo simplification                  |      46% | Dependency/script cleanup, Node 24 baseline alignment, storage centralization, storage failure handling, result-cache coverage, shared/service-worker type cleanup, static-build utility cleanup, tested single-image display/source/preprocessor/side-state helpers, and removal of maintained app/lib TS suppressions have reduced some legacy loose typing and scattered browser APIs. Codec surface, Preact coupling, and custom Rollup complexity still remain.                                                                                                                                                                                                                                                                                              |
| Svelte/SvelteKit migration readiness |      33% | Shared pipeline, single-image work planning/source defaults/preprocessor changes/display render selectors/side-state helpers, and bulk logic extraction have started, and the current Svelte 5/SvelteKit migration guidance is documented. UI migration should wait until behavior is better tested.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

These percentages are rough planning signals, not release guarantees.

## What counts as progress

Good progress:

- protects the current single-image optimization workflow;
- keeps decode, process, encode, preview, and export behavior reliable;
- removes stale or unsafe dependencies;
- reduces build fragility;
- extracts framework-neutral logic;
- adds tests around pure behavior;
- documents decisions that prevent repeated re-analysis;
- keeps the current app working while reducing future migration risk.

Bad progress:

- makes the app less reliable for individual image optimization;
- adds bulk behavior that bypasses or weakens the proven optimization pipeline;
- commits that do not reduce risk or clarify the codebase;
- UI rewrites before the bulk workflow design is settled;
- deleting codecs before build assumptions and product scope are tested;
- starting Svelte migration before logic is decoupled from Preact components.

## Near-term focus

1. Keep strengthening framework-neutral bulk logic.
2. Add browser smoke tests for the current app, especially single-image import, optimization, preview, and export.
3. Decide exact browser support before public release.
4. Keep codec strategy focused: WebP first, AVIF second, JPEG XL advanced.
5. Continue simplifying build and dependency surfaces without breaking the current app.

## Svelte migration gate

Do not start a production Svelte/SvelteKit migration until these are true:

- core image-processing pipeline is separate from UI components;
- bulk session logic is framework-neutral and tested;
- current Preact app has browser smoke tests;
- format/codec visibility strategy is decided;
- build output and service-worker behavior are understood well enough to reproduce in a new toolchain.

When those conditions are met, start with a small Svelte prototype around imported pure modules instead of rewriting the whole app at once. Keep [Svelte migration context](svelte-migration-context.md) open while doing any Svelte-adjacent work.
