# Maintenance status

Last updated: 2026-05-23.

## Resume handoff

Current branch: `main`.

Standalone GitHub repo: `tavlean/sqush`.

Default branch: `main`.

Project homepage metadata: `https://sqush.app`.

Old fork: `tavlean/SquooshPlus`, archived and kept as historical reference.

Working tree at last update: pending commit for bulk export helpers.

Latest committed work:

- `246a8f2` Add Sqush domain metadata
- `193e462` Clean up Rollup path imports
- `078b0fd` Add bulk helper tests
- `35572b5` Add bulk session helpers
- `2dc35f3` Detect stale bulk outputs
- `3ab2fb6` Spawn TypeScript through Node
- `bd55d5a` Add bulk queue helpers
- `fc746a9` Enforce LF line endings for CI
- `34592f0` Add bulk import helpers
- `26d8880` Rename project to Sqush
- `20d4299` Add bulk session types
- `0060b8e` Add bulk settings helpers
- `4017cac` Run CI checks in generated-safe order
- `f5ad1e4` Document bulk image architecture

Latest verification run:

- `npm run format:check`: passed.
- `npm run typecheck`: passed.
- `npm run build && npm run smoke:build`: passed.
- `npm run test:bulk`: passed.
- `npm run check`: passed after removing the Rollup unused external import warning.
- Playwright CLI production-build smoke: passed after the Sqush rename, with `Sqush` title, file input present, Sqush logo alt text present, and zero console messages.

Next recommended tasks:

1. Continue bulk-image feature design in framework-neutral TypeScript modules before touching UI heavily.
2. Decide whether to fix the Rollup unused external import warning now or leave it for the larger Rollup/toolchain upgrade.
3. Keep remaining `npm audit` work as explicit build-tooling upgrade tasks; do not use `npm audit fix --force` blindly.

## Completed baseline cleanup

- Added project documentation and a road map.
- Added `npm run typecheck`.
- Added `npm run format` and `npm run format:check`.
- Added `npm run smoke:build` to verify generated build output.
- Added `npm run preview` to serve the production `build/` directory.
- Updated CI to use current checkout/setup-node actions and run the baseline checks.
- Removed the inherited upstream Google Analytics integration.
- Refreshed Browserslist data.
- Removed the Node 20 `DEP0190` warning from the TypeScript build spawn.
- Upgraded the local static server from `serve@11` to `serve@14`.
- Applied compatible `npm audit fix` updates.
- Replaced `npm-run-all` with a local dev runner script.
- Hardened saved side settings against invalid `localStorage` data.
- Modernized one editor media query listener path.
- Added framework-neutral bulk settings, session, import, queue, and stale-output helpers.
- Added framework-neutral bulk export helpers for exportable jobs and batch size summaries.
- Added a lightweight Node assertion test for bulk helper behavior.
- Removed the noisy Rollup unused external import warning by narrowing `path` imports in build plugins.

## Current verification commands

Run these before committing substantial changes:

```sh
npm run format:check
npm run build
npm run smoke:build
npm run test:bulk
npm run typecheck
```

For UI-sensitive changes, also run a browser smoke check against `build/` after `npm run build`.
Use `npm run preview` for that production-build browser check; `npm run serve` is for dev output in `.tmp/build/static`.

On a fresh checkout, run `npm run build` before `npm run typecheck` because the build creates ignored feature metadata files required by TypeScript. `npm run check` already runs commands in the safe order and includes the bulk helper tests.

## Remaining audit state

`npm audit` is reduced but still not clean. The remaining findings are mainly in old build tooling:

- PostCSS/cssnano ecosystem packages.
- Rollup/terser-related packages.
- Older glob/minimatch chains used by build utilities.

Do not run `npm audit fix --force` blindly. The remaining fixes require breaking upgrades and should be handled as explicit toolchain migration tasks with browser verification.

## Local npm cache issue

The default npm cache at `/Users/tav/.npm` previously failed with `EPERM` in this environment. The manual ownership repair was run successfully:

```sh
sudo chown -R 501:20 "/Users/tav/.npm"
npm cache verify
```

`npm cache verify` now succeeds in the user's normal terminal. The Codex sandbox may still report `EPERM` against individual cache files, so use a temporary npm cache for Codex-run install/update commands if that reappears.
