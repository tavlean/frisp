# Cleanup todo

This list is ordered by priority. Do the high-priority items before building new features on top of the fork.

## Priority 0: protect the working baseline

1. Completed: decide the supported Node version.

   - `.nvmrc` says `20.16.0`.
   - `package.json` declares Node `>=20.16.0 <21` and npm `>=10`.
   - `@types/node` is aligned to Node 20 instead of the inherited Node 16 type baseline.
   - The baseline now builds on Node 20 without the previous TypeScript spawn deprecation warning.
   - Keep the required Node/npm versions documented in `README.md`.

2. Completed: add basic project scripts.

   - Add `npm run typecheck`.
   - Add `npm run format` or `npm run lint`.
   - Add a minimal smoke test script for build output.
   - Add conventional `npm test` alias for the full baseline check.
   - Keep `npm run build` as the final release check.

3. Completed: add a manual QA checklist.

   - Checklist lives in [Manual QA checklist](manual-qa.md).

## Priority 1: dependency and security cleanup

4. Completed: triage `npm audit`.

   - `npm audit --audit-level=low` now reports 0 vulnerabilities.
   - CI runs `npm run audit` before the build checks.
   - Keep this check active when dependencies are changed.

5. Completed: upgrade or replace the stale local server.

   - `serve` has been upgraded from the stale inherited version.
   - Keep watching this dependency during audit cleanup.

6. Partially completed: upgrade Rollup and custom build plugins carefully.

   - The project uses Rollup 2 and custom plugins under `lib/`.
   - Compatible Rollup 2 plugins have been refreshed.
   - A larger Rollup or bundler migration should wait until the baseline remains stable.

7. Completed: replace deprecated build patterns.

   - `lib/simple-ts.js` now spawns Node with the TypeScript CLI path directly.
   - This also fixed the Windows CI `spawn EINVAL` failure.

8. Completed: refresh Browserslist data.

## Priority 2: project clarity and maintainability

9. Completed: update the root README for this fork.

   - The README now explains Sqush, links the docs, and documents the baseline commands.

10. Completed: keep generated feature files untracked and verify generation remains reliable.

    - `src/client/lazy-app/feature-meta/index.ts`
    - `src/client/lazy-app/worker-bridge/meta.ts`
    - `src/features-worker/index.ts`
    - These files are ignored by Git today.
    - `npm run smoke:build` now verifies the build generated them before TypeScript needs them.
    - If feature generation breaks, fix the build rather than committing generated output.

11. Completed: clean up analytics and privacy.

    - The inherited upstream Google Analytics integration has been removed.
    - Do not add analytics back without a privacy and consent decision.

12. Completed: harden saved settings.

- `JSON.parse(localStorage...)` is now wrapped in safe parsing.
- Saved side settings are validated before applying them.
- New saved side settings use a versioned wrapper.
- Legacy unversioned saved settings still import.
- Missing/unknown encoders are rejected before applying the settings.
- Invalid stored settings are not treated as available for import.
- Browser storage access failures do not break editor startup or falsely report a successful save.

13. Fix small code quality issues while touching nearby code.

    - Completed: replace the remaining `Boolean` prop type with primitive `boolean`.
    - Static build file writing now returns a promise from the utility and keeps process-exit handling in the build entry point.
    - No remaining `catched`, `matchMedia().addListener`, or `matchMedia().removeListener` matches were found in `src/`.
    - Removed obsolete TS suppressions from option controls and icon props by using element-specific Preact JSX attribute types.
    - Removed the remaining maintained app/lib `@ts-ignore` by making worker-bridge dispatch explicit.

## Priority 3: tests and release confidence

14. Add browser smoke tests.

    - Use Playwright or another browser runner.
    - Start with: app loads, file can be selected, editor opens, an output is generated.
    - Started: `npm run smoke:browser` automates the local production-build Chromium/WebP smoke through the system `playwright-cli`.
    - Started: `npm run smoke:browser` now verifies extensionless PNG input exports as `icon-large.webp`.
    - Started: `npm run smoke:browser` now verifies the app shell reloads while the browser context is offline after the production app has loaded.
    - Started: `npm run smoke:browser` now verifies saved right-side WebP settings can be imported back into the real editor.
    - Started: service-worker bridge startup now no-ops when `navigator.serviceWorker` is unavailable.
    - Started: `npm run smoke:browser` now simulates service-worker-disabled mode and verifies the app shell still loads.
    - Started: shared-image service-worker handling now rejects cleanly if no controller is available.

15. Add small unit tests for pure utilities.

    - Bulk helper tests now cover settings merge/hash behavior, session changes, queue stale detection, and export summaries.
    - Bulk action-state tests now cover process, retry, cancel, queued, active, and incomplete command flags.
    - Bulk session mutation tests now cover drift-tolerant remove/export counter normalization.
    - Bulk import tests now cover injected MIME sniffing for extensionless, misnamed, rejected, and unreadable image files.
    - Bulk import tests now cover structured rejection reasons and summary counts for unsupported and unreadable files.
    - Bulk import tests now cover creating a bulk session from accepted import jobs while ignoring rejected files.
    - Bulk import tests now cover appending accepted import jobs to an existing session with duplicate-safe IDs.
    - Bulk runner tests now cover no-op runs when no jobs are runnable or concurrency is zero.
    - Bulk runner tests now cover draining the full queue across multiple concurrency-limited batches.
    - Bulk processor tests now cover pure process-plan creation before decode starts.
    - Bulk queue tests now cover derived queue state for normalized concurrency, active counts, open slots, queued counts, and runnable job ids.
    - Bulk requeue tests now cover active jobs being reset and active counters being decremented.
    - Bulk cancellation tests now cover resetting only active jobs while preserving failed, skipped, and completed jobs.
    - Bulk settings-change tests now cover safe workflow helpers that update global/per-image settings and requeue stale outputs.
    - Bulk export tests now cover Windows reserved output names.
    - Bulk export summary tests now cover already-exported jobs separately from pending jobs.
    - Bulk export summary tests now cover stale exported outputs being treated as pending instead of current exports.
    - Bulk export plan tests now cover selected job subsets, missing IDs, duplicate-safe names, and selected export totals.
    - Bulk export plan tests now cover marking planned exports complete without marking stale outputs.
    - Bulk export state tests now prevent stale encoded outputs from being marked exported.
    - Bulk snapshot tests now cover metadata-only session snapshots that exclude live blob download URLs and validate serialized snapshot parsing.
    - Bulk snapshot tests now cover restoring metadata-only snapshots as regeneration-ready sessions without stale blob URLs or false exported counts.
    - Bulk snapshot tests now cover restoring directly from a serialized snapshot string.
    - Bulk strip item tests now cover selected state, output size state, percent change, status grouping, and per-image override paths.
    - Bulk session summary tests now cover progress, selected-job context, action state, queue state, override totals, output totals, and export readiness from one pure selector.
    - Bulk selected-job detail tests now cover effective settings, output state, override paths, and missing selections.
    - Result-cache tests now cover cache hits, mismatched image data, mismatched encoder options, and mismatched processor options.
    - Single-image work-plan tests now cover no-op decisions, first decode/preprocess work, original-to-encoded transitions, and encoder-only updates.
    - Single-image source-state tests now cover default raster and vector resize settings for newly decoded source images.
    - Single-image source-state tests now cover orientation-change detection and resize width/height swapping after rotation.
    - Single-image document-title tests now cover idle, loading, and loaded file title text.
    - Single-image document-title tests now cover loading-state detection, file info derivation, and update gating.
    - Single-image side-copy tests now cover side index lookup and blob URL regeneration when copying one side to the other.
    - Single-image side-state tests now cover saved-settings import while preserving live output fields for undo.
    - Single-image side-state tests now cover default side setup and saved initial side overrides.
    - Output filename tests now cover extensionless sources, trailing dots, hidden names, path-like source names, punctuation-only names, and Windows reserved names.
    - Single-image and bulk export filenames now share the same basename sanitization helper.
    - Single-image side reset tests now cover clearing both side outputs and revoking both side download URLs when a new source image is loaded.
    - MIME sniffing tests now cover PNG, JPEG, WebP, TIFF, AVIF, JPEG XL, unknown data, a TIFF false-positive guard, and a non-AVIF `ftyp` guard.
    - Utility tests now cover `clean-modify`, `pretty-bytes`, saved-settings parsing/validation, and MIME sniffing behavior.
    - Service-worker bridge tests now cover service-worker controller detection.
    - Saved-settings tests now cover latest-only settings, version mismatches, and invalid versioned payloads.
    - `npm run test:unit` runs the current pure-helper test suite.

16. Completed: add CI for the real supported platform matrix.

    - CI targets Ubuntu, Windows, and macOS.
    - GitHub Actions checkout/setup-node actions are on current major versions.
    - CI cancels superseded runs, has read-only repository permissions, and has a 15-minute job timeout.

17. Partially completed: track codec provenance.

    - Initial inventory lives in [Codec provenance](codec-provenance.md).
    - Exact upstream commits/tags are still missing for many inherited `.wasm` files.
    - Before changing a codec, record the upstream project, commit/tag, build command, and generated outputs.

## Priority 4: later modernization

18. Consider replacing the custom build with a maintained tool only after the baseline is stable.

    - Vite or another modern bundler may reduce custom code.
    - This is a larger migration because of Web Workers, WASM, generated feature metadata, static prerendering, and service-worker output.
    - Svelte migration guidance is now tracked in [Svelte migration context](svelte-migration-context.md).
    - Any Svelte-adjacent extraction should keep logic framework-neutral and avoid adding UI framework assumptions.

19. Completed: review browser support.

    - Initial policy note lives in [Browser support policy](browser-support.md).
    - Current policy was reviewed again on 2026-05-24 against MDN image format guidance and Svelte migration constraints.
    - Re-check before public release or before changing codec visibility, because browser support can change quickly.

20. Completed: create an issue list from this todo.

    - Initial backlog seed lives in [Issue list](issue-list.md).
    - Convert items to GitHub issues when the project workflow is ready.

## Current product-design hold

Do not implement the bulk editor UI yet. The bulk UI and workflow need design discussion, idea iteration, and possibly prototypes first.

Allowed before that discussion:

- framework-neutral bulk model helpers;
- tests for bulk helper behavior;
- documentation and architecture notes;
- maintenance, CI, dependency, and build cleanup.
