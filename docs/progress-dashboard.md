# Progress dashboard

This dashboard keeps the larger mission visible while small cleanup commits happen.

## Mission

Make Sqush a lean, maintainable, secure image optimization tool that is comfortable to extend. The first product target is bulk image optimization. The longer-term maintainer target is a codebase that can be migrated to Svelte or SvelteKit without dragging old UI assumptions into the new app.

## Current progress

| Area                                 | Progress | State                                                                                                             |
| ------------------------------------ | -------: | ----------------------------------------------------------------------------------------------------------------- |
| Stabilization, CI, and security      |      80% | Audit is clean, baseline scripts exist, CI covers Ubuntu, Windows, and macOS, smoke checks are stronger.          |
| Documentation and handoff clarity    |      75% | Core docs exist. Progress, roadmap, issue list, codec provenance, and maintenance status are now tracked.         |
| Bulk backend foundation              |      50% | Framework-neutral import/session/settings/queue/export/processor/runner helpers exist with tests.                 |
| Repo simplification                  |      30% | Dependency and script cleanup started. Codec surface, Preact coupling, and custom Rollup complexity still remain. |
| Svelte/SvelteKit migration readiness |      20% | Non-UI logic extraction has started. UI migration should wait until business logic is cleaner and better tested.  |

These percentages are rough planning signals, not release guarantees.

## What counts as progress

Good progress:

- removes stale or unsafe dependencies;
- reduces build fragility;
- extracts framework-neutral logic;
- adds tests around pure behavior;
- documents decisions that prevent repeated re-analysis;
- keeps the current app working while reducing future migration risk.

Bad progress:

- commits that do not reduce risk or clarify the codebase;
- UI rewrites before the bulk workflow design is settled;
- deleting codecs before build assumptions and product scope are tested;
- starting Svelte migration before logic is decoupled from Preact components.

## Near-term focus

1. Keep strengthening framework-neutral bulk logic.
2. Add browser smoke tests for the current app.
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
