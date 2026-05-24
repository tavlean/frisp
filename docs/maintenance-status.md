# Maintenance status

Last updated: 2026-05-24.

## Resume handoff

Current branch: `main`.

Standalone GitHub repo: `tavlean/sqush`.

Default branch: `main`.

Project homepage metadata: `https://sqush.app`.

Old fork: `tavlean/SquooshPlus`, archived and kept as historical reference.

Working tree at last update: Node runtime type definitions aligned to the supported Node 20 baseline and locally verified. Run `git status --short --branch` for the exact state.

Latest recent committed work at last update:

- `b98f4c0` Document dependency drift
- `974ea79` Limit redundant CI runs
- `abd74e7` Tighten service worker utility types
- `f890ea1` Automate production browser smoke
- `7243559` Summarize bulk job sizes
- `6f007fe` Add bulk job settings lookup
- `08cb06a` Add bulk selected job context
- `6608e75` Add bulk action selectors
- `281521b` Update handoff after status grouping
- `662808c` Group bulk job statuses
- `0f9b001` Update handoff after selection navigation
- `04488dd` Add bulk selection navigation
- `9e3d2a6` Update handoff after override summary
- `1fdf5eb` Summarize bulk overrides
- `1e2ead6` Update handoff after percent cleanup
- `6345b2d` Share bulk percent change calculation
- `4df5cd0` Update handoff after bulk counter cleanup
- `e4e3c1d` Update bulk counters when adding jobs
- `16a36f3` Normalize empty bulk overrides
- `dc94c12` Summarize bulk optimized output
- `48746ca` Clear stale output on bulk retry
- `aa59341` Normalize bulk queue concurrency
- `995c9b2` Document WebP smoke coverage
- `63adddf` Update handoff after failure cleanup
- `09d0f7b` Clear stale output on bulk failure
- `ffc9138` Update handoff after queue hardening
- `1090c84` Keep exported count stable on completion
- `93519a2` Update handoff after CI recovery
- `7c2c39e` Reject null saved encoder options
- `9d7ac14` Update handoff after abort cleanup
- `ef12543` Clean up abortable listeners
- `0bbe31a` Update handoff after smoke coverage
- `64e7600` Verify service worker build assets
- `1959482` Derive counters for restored bulk sessions
- `82eb7b6` Reserve generated bulk export names
- `1fc97c3` Refresh static render dependency
- `eed9cb2` Sanitize bulk export archive names
- `2666f83` Guard bulk runner aborts before processing
- `df147a6` Deduplicate bulk object URL cleanup
- `0c06bbe` Type encoder options rendering
- `7971432` Type core encoder dispatch
- `2732488` Use Preact constructor type for quality options
- `557d935` Tighten worker bridge dispatch types
- `27fb26a` Tighten clean modify types
- `03edd81` Tighten shallowEqual types
- `0dd042d` Keep bulk exported counts consistent
- `28a16e2` Document Playwright CLI smoke flow
- `a69317c` Define browser support baseline
- `fbaf1ae` Validate saved processor settings
- `df5f370` Validate saved encoder options
- `f20c721` Harden bulk export filenames
- `ae8e4c0` Update handoff after import fallback
- `d7e19d4` Accept more extension-only image imports
- `3a78229` Guard build against external runtime assets
- `b4b45ef` Clarify optimizer reliability mission

Latest verification run:

- `npm run format:check`: passed.
- `npm run typecheck`: passed, including after bulk queue concurrency normalization and retry stale-output cleanup.
- `npm run test:unit`: passed, including after bulk queue concurrency normalization and retry stale-output cleanup.
- `npm run typecheck`: passed after bulk output summary helper.
- `npm run test:unit`: passed after bulk output summary helper.
- `npm run typecheck`: passed after empty per-image override normalization.
- `npm run test:unit`: passed after empty per-image override normalization.
- `npm run typecheck`: passed after add-jobs counter derivation.
- `npm run test:unit`: passed after add-jobs counter derivation.
- `npm run typecheck`: passed after shared bulk percent-change helper.
- `npm run test:unit`: passed after shared bulk percent-change helper.
- `npm run typecheck`: passed after bulk override summary helper.
- `npm run test:unit`: passed after bulk override summary helper.
- `npm run typecheck`: passed after bulk selection navigation helpers.
- `npm run test:unit`: passed after bulk selection navigation helpers.
- `npm run typecheck`: passed after bulk job status grouping helper.
- `npm run test:unit`: passed after bulk job status grouping helper.
- `npm run typecheck`: passed after bulk action-state selectors.
- `npm run test:unit`: passed after bulk action-state selectors.
- `npm run typecheck`: passed after bulk selected-job context helper.
- `npm run test:unit`: passed after bulk selected-job context helper.
- `npm run format:check`: passed after bulk job effective-settings helper.
- `npm run typecheck`: passed after bulk job effective-settings helper.
- `npm run test:unit`: passed after bulk job effective-settings helper.
- `npm run format:check`: passed after bulk per-job size summary helper.
- `npm run typecheck`: passed after bulk per-job size summary helper.
- `npm run test:unit`: passed after bulk per-job size summary helper.
- `npm run smoke:browser`: passed locally after automating the production-build Playwright CLI WebP output smoke.
- `npm run check`: passed after adding the automated browser smoke command.
- `npm run check`: passed after service-worker/shared type cleanup.
- `npm run smoke:browser`: passed after service-worker/shared type cleanup.
- `npm audit --audit-level=low`: passed after dependency drift review.
- `npm outdated --cache /private/tmp/sqush-npm-cache`: reviewed on 2026-05-24; remaining drift is major-version migration work, not routine patch cleanup.
- `npm run check`: passed after saved-settings storage refactor.
- `npm run smoke:browser`: passed after saved-settings storage refactor.
- `npm run smoke:browser`: passed after adding real-editor saved side settings verification.
- `npm run check`: passed after adding real-editor saved side settings verification.
- `npm run check`: passed after updating `@types/node` from Node 16 types to Node 20 types.
- `npm run build && npm run smoke:build`: passed.
- `npm run test:helpers`: passed.
- `npm run check`: passed after CI matrix diagnostics.
- `npm audit --audit-level=low`: passed, 0 vulnerabilities.
- Latest observed GitHub Actions state: pushed commits through `63adddf` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after the WebP smoke documentation push: `995c9b2` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after the bulk queue/retry cleanup: `48746ca` passed on Ubuntu, Windows, and macOS after rerunning a transient macOS DNS failure during `npm audit`.
- Latest observed GitHub Actions state after bulk summary/override/add-jobs cleanup: `e4e3c1d` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after shared bulk percent-change cleanup: `6345b2d` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after bulk override summary cleanup: `1fdf5eb` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after bulk selection navigation cleanup: `04488dd` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after bulk status grouping cleanup: `662808c` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after latest handoff update: `281521b` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after bulk action/selection/effective-settings cleanup: `6f007fe` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after latest handoff update: `677750f` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after bulk per-job size summaries: `7243559` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after automated browser smoke command: `f890ea1` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after CI hygiene cleanup: `974ea79` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after dependency drift documentation: `b98f4c0` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after saved-settings storage refactor: `68d03b4` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after latest handoff update: `ae72c6c` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after saved-settings browser smoke: `bc78e14` passed on Ubuntu, Windows, and macOS.
- `npm run serve` wrapper: launched successfully on port 55194.
- Browser production-preview smoke: passed after shared image pipeline extraction; app shell, Sqush logo, and drop target rendered.
- Playwright CLI production-build smoke: passed after the Sqush rename, with `Sqush` title, file input present, Sqush logo alt text present, and zero console messages.
- Playwright CLI production-build image import smoke: passed on `2026-05-23`; built app loaded, `icon-large.png` imported into `/editor`, processing completed with title `icon-large.png - Sqush`, WebP options were present, and console errors were 0.
- Playwright CLI production-build WebP output smoke: passed on `2026-05-24`; built app loaded, `icon-large.png` imported into `/editor`, output side switched to `WebP`, `icon-large.webp` blob download was present, output was `24.1 kB` with a 9% reduction, and console errors were 0.

Next recommended tasks when work resumes:

1. Keep progress tied to [Progress dashboard](progress-dashboard.md) and [Agent guide](../AGENTS.md).
2. Continue extracting/tested framework-neutral logic from Preact components where it clearly reduces future Svelte migration risk.
3. Add browser smoke tests before significant UI or codec-surface changes.
4. Do not implement bulk UI until the workflow design has been discussed and iterated.
5. Use `docs/dependency-modernization.md` for dependency cleanup order; do not use `npm audit fix --force` blindly.

Quick investigation note:

- `rg "as any|: any| any[),;]" src/client/lazy-app src/features lib/test-helpers.js` currently reports no remaining matches in the main lazy app, feature code, or helper tests. The only generated `as any` text found is emitted by `lib/feature-plugin.js` for worker exposure.

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
- Updated Node type definitions to match the supported Node 20 runtime baseline.
- Added `npm run format` and `npm run format:check`.
- Added `npm run smoke:build` to verify generated build output.
- Expanded `npm run smoke:build` to check generated Sqush metadata and absence of analytics code.
- Expanded `npm run smoke:build` to verify generated feature metadata and worker entry files exist.
- Expanded `npm run smoke:build` to guard against accidental external runtime scripts, runtime links, and manifest media.
- Expanded `npm run smoke:build` to verify service-worker precache assets exist in the production build.
- Added `npm run preview` to serve the production `build/` directory.
- Documented and verified a Playwright CLI smoke flow for the production app shell and local-image editor import path.
- Documented and verified a Playwright CLI smoke flow for explicit WebP output generation and export-link presence.
- Added `npm run smoke:browser` to automate the local production-build Playwright CLI smoke without adding Playwright as a project dependency.
- Expanded `npm run smoke:browser` to verify the real editor writes versioned WebP side settings to `localStorage`.
- Updated CI to use current checkout/setup-node actions and run the baseline checks.
- Expanded CI to cover Ubuntu, Windows, and macOS.
- CI matrix fail-fast is disabled so one platform failure does not hide the other platform results.
- CI uses read-only repository permissions, a 15-minute job timeout, and concurrency cancellation so superseded runs do not keep running after newer pushes.
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
- Hardened saved settings parsing to reject null encoder option values.
- Hardened saved settings parsing to reject invalid processor enabled values and null option values.
- Centralized saved-settings storage reads/writes and fixed the right-side settings event listener cleanup path.
- Modernized one editor media query listener path.
- Hardened the shared abort helper so it removes abort listeners when wrapped work settles.
- Replaced avoidable `any` types in shared DOM input helpers and gesture prevention.
- Replaced the shared shallow object comparison helper's public `any` types with object types.
- Replaced avoidable public `any` types in the shared immutable update helper with `unknown`/object types.
- Replaced avoidable public `any` types in the generated worker bridge dispatch with `unknown`/method types.
- Replaced a handwritten encoder option component constructor type with Preact's component constructor type.
- Replaced the core image compression pipeline's encoder options cast with typed encoder dispatch.
- Replaced the editor encoder options render cast with typed encoder option component dispatch.
- Replaced avoidable `any` casts in the result cache processor-state comparison.
- Replaced avoidable `any` usage and optional Promise entries in service-worker cache cleanup and shared ref utilities.
- Added framework-neutral bulk settings, session, import, queue, and stale-output helpers.
- Hardened bulk session construction so initial active and exported jobs derive matching counters.
- Hardened bulk session job additions so active and exported counters update when adding restored jobs.
- Extracted and tested processor-state equivalence logic from the Preact editor component.
- Tightened bulk override detection so empty nested override objects are not treated as real overrides.
- Tightened bulk session updates so empty per-image override objects are stored as no override.
- Added framework-neutral bulk override summary helpers for future image-strip indicators.
- Added framework-neutral bulk next/previous selection helpers for future image-strip navigation.
- Added framework-neutral bulk selected-job context for future image-strip navigation state.
- Added framework-neutral bulk job effective-settings lookup to keep global/override merge rules out of UI code.
- Added framework-neutral bulk job status grouping for future status labels and controls.
- Added framework-neutral bulk action-state selectors for future export/retry/activity controls.
- Tightened bulk settings merging so falsy overrides such as `false` and `0` remain valid per-image overrides.
- Added a settings override path helper for future per-image override highlighting.
- Hardened bulk queue transitions so missing or repeated jobs do not corrupt active-job counts.
- Hardened bulk queue scheduling so invalid, fractional, negative, or infinite concurrency values do not produce surprising runnable-job lists.
- Hardened bulk queue/session bookkeeping so removed or stale exported jobs keep exported counts consistent.
- Hardened bulk queue completion/failure transitions so exported-count bookkeeping recovers if an exported job is overwritten.
- Hardened bulk queue failure transitions so failed jobs do not retain stale output download data.
- Hardened bulk retry transitions so failed or skipped jobs do not retain stale output download data.
- Hardened bulk single-job requeue bookkeeping so reprocessing an exported job decrements exported counts.
- Added a bulk queue retry helper for failed and skipped jobs.
- Added framework-neutral bulk export helpers for exportable jobs and batch size summaries.
- Added a framework-neutral bulk output summary helper for valid optimized bytes, stale outputs, and already-exported jobs.
- Added a framework-neutral bulk per-job size summary helper so future image-strip stats can ignore stale outputs consistently.
- Added a shared bulk percent-change helper used by processing and summary code.
- Added bulk export entry naming helpers for duplicate-safe future batch downloads.
- Hardened bulk export entry naming so names generated to resolve earlier collisions are also reserved against later files.
- Hardened bulk export archive names so batch IDs cannot create path-like or invalid download names.
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
- Hardened the bulk runner so already-aborted batches do not start jobs or call processors.
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
- Refreshed `preact-render-to-string` within major 5 for static prerendering without starting the Preact migration.
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
