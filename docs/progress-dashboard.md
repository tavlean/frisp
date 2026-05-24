# Progress dashboard

This dashboard keeps the larger mission visible while small cleanup commits happen.

## Mission

Make Sqush a lean, maintainable, secure image optimization tool that is comfortable to extend. The core product value is reliable local image optimization: the app should keep working offline, without server processing, and without surprising users who depend on the single-image workflow. The first new product target is bulk image optimization. The longer-term maintainer target is a codebase that can be migrated to Svelte or SvelteKit without dragging old UI assumptions into the new app.

## Current progress

| Area                                 | Progress | State                                                                                                             |
| ------------------------------------ | -------: | ----------------------------------------------------------------------------------------------------------------- |
| Stabilization, CI, and security      |      85% | Audit is clean, CI covers Ubuntu, Windows, and macOS, and WebP output has manual production-build smoke coverage. |
| Documentation and handoff clarity    |      78% | Core docs exist. Progress, roadmap, issue list, codec provenance, QA, and maintenance status are tracked.         |
| Bulk backend foundation              |      60% | Framework-neutral import/session/settings/queue/export/processor/runner/URL helpers exist with stronger tests.    |
| Repo simplification                  |      33% | Dependency and script cleanup started. Codec surface, Preact coupling, and custom Rollup complexity still remain. |
| Svelte/SvelteKit migration readiness |      22% | Shared pipeline and bulk logic extraction has started. UI migration should wait until behavior is better tested.  |

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
4. Keep codec strategy focused: WebP first, AVIF second, JPEG XL advanced, WebP 2 experimental only.
5. Continue simplifying build and dependency surfaces without breaking the current app.

## Svelte migration gate

Do not start a production Svelte/SvelteKit migration until these are true:

- core image-processing pipeline is separate from UI components;
- bulk session logic is framework-neutral and tested;
- current Preact app has browser smoke tests;
- format/codec visibility strategy is decided;
- build output and service-worker behavior are understood well enough to reproduce in a new toolchain.

When those conditions are met, start with a small Svelte prototype around imported pure modules instead of rewriting the whole app at once.
