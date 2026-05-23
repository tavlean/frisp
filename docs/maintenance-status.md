# Maintenance status

Last updated: 2026-05-23.

## Resume handoff

Current branch: `main`.

Standalone GitHub repo: `tavlean/sqush`.

Default branch: `main`.

Project homepage metadata: `https://sqush.app`.

Old fork: `tavlean/SquooshPlus`, archived and kept as historical reference.

Working tree at last update: clean after bulk import fallback cleanup. Local work may be ahead of `origin/main`; run `git status --short --branch` and `git log --oneline origin/main..HEAD` for the exact local-only list.

Latest committed work:

- `0e4118d` Ensure unique bulk job IDs
- `3dd200d` Update roadmap analytics status
- `bb8eb5a` Accept image imports by extension
- `0fd84c0` Add bulk retry helper
- `faef40e` Add detailed bulk progress
- `57eb2a4` Guard zero-size bulk outputs
- `9a9f50b` Strengthen build smoke checks
- `c40b73f` Keep CI matrix jobs independent
- `fb33d27` Add npm test alias
- `c34598c` Verify generated feature files
- `ed740b0` Add maintenance issue list
- `d1eb2db` Update local handoff status
- `5f038f9` Document browser support policy
- `b17bb09` Add unit test alias
- `e2b0bc5` Add bulk import summary
- `ec853a0` List bulk setting overrides
- `2d72944` Test bulk override paths
- `a4683c5` Refresh local progress status
- `f75c99a` Add progress dashboard
- `23e005e` Extract processor state comparison
- `4fa0db9` Add agent guide
- `67a6ed5` Update handoff after agent guide
- `c786510` Correct resume handoff status
- `9b1496f` Note current cleanup state
- `a7d7969` Reject array saved settings
- `263763d` Tighten DOM helper types
- `ec2b652` Tighten result cache typing
- `24d9010` Preserve falsy bulk overrides
- `743b91a` Update handoff after bulk settings fix
- `b4b45ef` Clarify optimizer reliability mission
- `3a78229` Guard build against external runtime assets
- `d7e19d4` Accept more extension-only image imports
- `b9b7f0f` Add macOS CI coverage
- `45f3050` Declare supported Node engine
- `559b118` Tighten bulk override detection
- `3eff941` Guard bulk queue transitions
- `383705e` Add bulk job removal helper
- `9002729` Document codec provenance
- `e7542ae` Track exported bulk jobs
- `d5e32ea` Add bulk export entries
- `7eef5e4` Use primitive resize boolean prop
- `352c6dc` Version saved side settings
- `6032bee` Document audit command

Latest verification run:

- `npm run format:check`: passed.
- `npm run typecheck`: passed.
- `npm run test:unit`: passed.
- `npm run build && npm run smoke:build`: passed.
- `npm run test:helpers`: passed.
- `npm run check`: passed after CI matrix diagnostics.
- `npm audit --audit-level=low`: passed, 0 vulnerabilities.
- Latest observed GitHub Actions state before local-only commits: commits through `c40b73f` passed. `0fd84c0` failed, but later commits containing that code passed.
- `npm run serve` wrapper: launched successfully on port 55194.
- Browser production-preview smoke: passed after shared image pipeline extraction; app shell, Sqush logo, and drop target rendered.
- Playwright CLI production-build smoke: passed after the Sqush rename, with `Sqush` title, file input present, Sqush logo alt text present, and zero console messages.

Next recommended tasks when work resumes:

1. Keep progress tied to [Progress dashboard](progress-dashboard.md) and [Agent guide](../AGENTS.md).
2. Continue extracting/tested framework-neutral logic from Preact components where it clearly reduces future Svelte migration risk.
3. Add browser smoke tests before significant UI or codec-surface changes.
4. Do not implement bulk UI until the workflow design has been discussed and iterated.
5. Use `docs/dependency-modernization.md` for dependency cleanup order; do not use `npm audit fix --force` blindly.

Quick investigation note:

- `src/client/lazy-app/image-pipeline.ts` still has an `as any` around encoder options. This is caused by generated `encoderMap` union typing. Do not rush this under time pressure; fix it with generated type improvements or a well-typed dispatch helper.

## Completed baseline cleanup

- Added project documentation and a road map.
- Added an issue-list backlog seed.
- Added a progress dashboard to keep cleanup, simplification, bulk, and Svelte migration readiness aligned.
- Added an agent guide to keep future work aligned with the product and maintenance mission.
- Added an initial browser support policy note.
- Documented first public browser support targets and release gates for local/offline optimization reliability.
- Added `npm run typecheck`.
- Added `npm test` as an alias for the full baseline check.
- Added `npm run test:unit` as an alias for pure-helper tests.
- Added Node and npm engine metadata matching `.nvmrc`.
- Added `npm run format` and `npm run format:check`.
- Added `npm run smoke:build` to verify generated build output.
- Expanded `npm run smoke:build` to check generated Sqush metadata and absence of analytics code.
- Expanded `npm run smoke:build` to verify generated feature metadata and worker entry files exist.
- Expanded `npm run smoke:build` to guard against accidental external runtime scripts, runtime links, and manifest media.
- Added `npm run preview` to serve the production `build/` directory.
- Documented and verified a Playwright CLI smoke flow for the production app shell and local-image editor import path.
- Updated CI to use current checkout/setup-node actions and run the baseline checks.
- Expanded CI to cover Ubuntu, Windows, and macOS.
- CI matrix fail-fast is disabled so one platform failure does not hide the other platform results.
- Removed the inherited upstream Google Analytics integration.
- Refreshed Browserslist data.
- Removed the Node 20 `DEP0190` warning from the TypeScript build spawn.
- Upgraded the local static server from `serve@11` to `serve@14`.
- Applied compatible `npm audit fix` updates.
- Replaced `npm-run-all` with a local dev runner script.
- Hardened saved side settings against invalid `localStorage` data.
- Added versioned saved side settings serialization while preserving legacy saved settings.
- Hardened saved settings parsing to reject array-shaped payloads.
- Hardened saved settings parsing to reject missing or array-shaped encoder options.
- Hardened saved settings parsing to reject invalid processor enabled values and null option values.
- Modernized one editor media query listener path.
- Replaced avoidable `any` types in shared DOM input helpers and gesture prevention.
- Replaced the shared shallow object comparison helper's public `any` types with object types.
- Replaced avoidable public `any` types in the shared immutable update helper with `unknown`/object types.
- Replaced avoidable public `any` types in the generated worker bridge dispatch with `unknown`/method types.
- Replaced a handwritten encoder option component constructor type with Preact's component constructor type.
- Replaced the core image compression pipeline's encoder options cast with typed encoder dispatch.
- Replaced the editor encoder options render cast with typed encoder option component dispatch.
- Replaced avoidable `any` casts in the result cache processor-state comparison.
- Added framework-neutral bulk settings, session, import, queue, and stale-output helpers.
- Extracted and tested processor-state equivalence logic from the Preact editor component.
- Tightened bulk override detection so empty nested override objects are not treated as real overrides.
- Tightened bulk settings merging so falsy overrides such as `false` and `0` remain valid per-image overrides.
- Added a settings override path helper for future per-image override highlighting.
- Hardened bulk queue transitions so missing or repeated jobs do not corrupt active-job counts.
- Hardened bulk queue/session bookkeeping so removed or stale exported jobs keep exported counts consistent.
- Added a bulk queue retry helper for failed and skipped jobs.
- Added framework-neutral bulk export helpers for exportable jobs and batch size summaries.
- Added bulk export entry naming helpers for duplicate-safe future batch downloads.
- Hardened bulk export filenames for invalid characters, punctuation-only names, hidden-style names, and deterministic case-insensitive duplicate checks.
- Added session helpers for global setting changes and per-image override changes.
- Added detailed bulk progress counters for future batch status displays.
- Hardened bulk session imports so repeated files receive unique job IDs.
- Added a bulk import extension fallback for image files with missing MIME types.
- Expanded bulk import extension fallback to accept extension-only JFIF, BMP, TIFF, and TIF files.
- Added a bulk import summary helper for accepted/rejected counts and byte totals.
- Added a session helper to remove jobs while preserving valid selection and active-job counts.
- Added a session helper to mark encoded jobs exported without double-counting repeat exports.
- Added a lightweight Node assertion test for bulk helper behavior.
- Expanded the lightweight helper test to cover `clean-modify` and `pretty-bytes`.
- Extracted single-image decode/process/encode/SVG pipeline helpers into `src/client/lazy-app/image-pipeline.ts`.
- Added `src/client/lazy-app/bulk/processor.ts` to process one bulk image job through the shared image pipeline without UI coupling.
- Guarded bulk processor percent-change calculation for zero-byte inputs.
- Added `src/client/lazy-app/bulk/runner.ts` to process queued bulk jobs up to the concurrency limit.
- Added `src/client/lazy-app/bulk/urls.ts` to collect and revoke bulk preview, thumbnail, and download object URLs.
- Hardened bulk object URL cleanup so duplicate preview, thumbnail, and download URLs are only revoked once.
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
