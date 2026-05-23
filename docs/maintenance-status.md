# Maintenance status

Last updated: 2026-05-23.

## Resume handoff

Current branch: `main`.

Standalone GitHub repo: `tavlean/sqush`.

Default branch: `main`.

Project homepage metadata: `https://sqush.app`.

Old fork: `tavlean/SquooshPlus`, archived and kept as historical reference.

Working tree at last update: pending commit for duplicate bulk job ID handling.

Latest committed work:

- `6032bee` Document audit command
- `352c6dc` Version saved side settings
- `7eef5e4` Use primitive resize boolean prop
- `d5e32ea` Add bulk export entries
- `e7542ae` Track exported bulk jobs
- `9002729` Document codec provenance
- `383705e` Add bulk job removal helper
- `3eff941` Guard bulk queue transitions
- `559b118` Tighten bulk override detection
- `45f3050` Declare supported Node engine
- `b9b7f0f` Add macOS CI coverage
- Pending: duplicate bulk job ID handling

Latest verification run:

- `npm run format:check`: passed.
- `npm run typecheck`: passed.
- `npm run build && npm run smoke:build`: passed.
- `npm run test:helpers`: passed.
- `npm run check`: passed after extracting versioned saved settings.
- `npm audit --audit-level=low`: passed, 0 vulnerabilities.
- `npm run serve` wrapper: launched successfully on port 55194.
- Browser production-preview smoke: passed after shared image pipeline extraction; app shell, Sqush logo, and drop target rendered.
- Playwright CLI production-build smoke: passed after the Sqush rename, with `Sqush` title, file input present, Sqush logo alt text present, and zero console messages.

Next recommended tasks:

1. Continue bulk-image feature design in framework-neutral TypeScript modules before touching UI heavily.
2. Do not implement bulk UI until the workflow design has been discussed and iterated.
3. Use `docs/dependency-modernization.md` for dependency cleanup order; do not use `npm audit fix --force` blindly.
4. Use `docs/upstream-pr-notes.md` as reference material for useful abandoned upstream PRs.

## Completed baseline cleanup

- Added project documentation and a road map.
- Added `npm run typecheck`.
- Added Node and npm engine metadata matching `.nvmrc`.
- Added `npm run format` and `npm run format:check`.
- Added `npm run smoke:build` to verify generated build output.
- Added `npm run preview` to serve the production `build/` directory.
- Updated CI to use current checkout/setup-node actions and run the baseline checks.
- Expanded CI to cover Ubuntu, Windows, and macOS.
- Removed the inherited upstream Google Analytics integration.
- Refreshed Browserslist data.
- Removed the Node 20 `DEP0190` warning from the TypeScript build spawn.
- Upgraded the local static server from `serve@11` to `serve@14`.
- Applied compatible `npm audit fix` updates.
- Replaced `npm-run-all` with a local dev runner script.
- Hardened saved side settings against invalid `localStorage` data.
- Added versioned saved side settings serialization while preserving legacy saved settings.
- Modernized one editor media query listener path.
- Added framework-neutral bulk settings, session, import, queue, and stale-output helpers.
- Tightened bulk override detection so empty nested override objects are not treated as real overrides.
- Hardened bulk queue transitions so missing or repeated jobs do not corrupt active-job counts.
- Added framework-neutral bulk export helpers for exportable jobs and batch size summaries.
- Added bulk export entry naming helpers for duplicate-safe future batch downloads.
- Added session helpers for global setting changes and per-image override changes.
- Hardened bulk session imports so repeated files receive unique job IDs.
- Added a session helper to remove jobs while preserving valid selection and active-job counts.
- Added a session helper to mark encoded jobs exported without double-counting repeat exports.
- Added a lightweight Node assertion test for bulk helper behavior.
- Expanded the lightweight helper test to cover `clean-modify` and `pretty-bytes`.
- Extracted single-image decode/process/encode/SVG pipeline helpers into `src/client/lazy-app/image-pipeline.ts`.
- Added `src/client/lazy-app/bulk/processor.ts` to process one bulk image job through the shared image pipeline without UI coupling.
- Added `src/client/lazy-app/bulk/runner.ts` to process queued bulk jobs up to the concurrency limit.
- Added `src/client/lazy-app/bulk/urls.ts` to collect and revoke bulk preview, thumbnail, and download object URLs.
- Fixed SVG `viewBox` size parsing for comma-separated values using a tested helper.
- Replaced POSIX-only `dev` and `serve` script syntax with Node wrappers for better Windows compatibility.
- Documented the full current upstream open PR audit in `docs/upstream-pr-notes.md`.
- Removed duplicate buffer collection in `lib/url-plugin.js` based on upstream PR `#1457`.
- Added UTF-8 charset metadata based on upstream PR `#1072`.
- Added codec provenance inventory and rebuild cautions.
- Added `docs/manual-qa.md`.
- Added `npm run audit` and CI audit enforcement.
- Removed the noisy Rollup unused external import warning by narrowing `path` imports in build plugins.
- Refreshed low-risk dependencies while keeping Preact pinned because the newer Preact 10 typings require a separate migration.
- Refreshed compatible Rollup 2 plugins and set `@rollup/plugin-replace` `preventAssignment` explicitly.
- Applied the non-force `npm audit fix` lockfile update for `brace-expansion`.
- Migrated the CSS build stack to PostCSS 8-era packages.
- Upgraded `@rollup/plugin-terser` to clear the remaining serialization audit findings.

## Current verification commands

Run these before committing substantial changes:

```sh
npm run format:check
npm run build
npm run smoke:build
npm run test:helpers
npm run typecheck
```

For UI-sensitive changes, also run a browser smoke check against `build/` after `npm run build`.
Use `npm run preview` for that production-build browser check; `npm run serve` is for dev output in `.tmp/build/static`.

On a fresh checkout, run `npm run build` before `npm run typecheck` because the build creates ignored feature metadata files required by TypeScript. `npm run check` already runs commands in the safe order and includes the helper tests.

## Remaining audit state

`npm audit --audit-level=low` currently reports 0 vulnerabilities.

Keep avoiding blind `npm audit fix --force`; future findings should still be handled as explicit dependency or toolchain tasks with verification.

## Local npm cache issue

The default npm cache at `/Users/tav/.npm` previously failed with `EPERM` in this environment. The manual ownership repair was run successfully:

```sh
sudo chown -R 501:20 "/Users/tav/.npm"
npm cache verify
```

`npm cache verify` now succeeds in the user's normal terminal. The Codex sandbox may still report `EPERM` against individual cache files, so use a temporary npm cache for Codex-run install/update commands if that reappears.
