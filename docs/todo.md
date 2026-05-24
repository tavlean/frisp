# Cleanup todo

This list is ordered by priority. Do the high-priority items before building new features on top of the fork.

## Priority 0: protect the working baseline

1. Completed: decide the supported Node version.

   - `.nvmrc` says `24.12.0`.
   - `package.json` declares Node `>=24.12.0 <25` and npm `>=11`.
   - `@types/node` is pinned to the newest release compatible with the current TypeScript 4.9 toolchain; exact Node 24 typings should wait for the TypeScript migration.
   - The baseline now builds on Node 24 without the previous TypeScript spawn deprecation warning.
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
    - Single-image image-work job-state derivation now lives in pure helpers instead of inline Preact component logic.
    - Single-image display settings, result labels, image-contain decisions, and output/result render selectors now live in pure helpers instead of inline Preact render logic.
    - Single-image composed render state now lives in a pure helper instead of being assembled inline by the Preact component.
    - Single-image preprocessing completion now leaves side download URL revocation to the shared side-reset helper instead of revoking twice.
    - Single-image side encoder/processor setting mutations now live in pure helpers instead of inline Preact component logic.
    - Single-image side loading, intermediate processed result, and final encoded result updates now live in pure helpers instead of inline Preact component logic.
    - Single-image side undo restoration now uses a side-state helper instead of raw immutable path updates in the Preact component.
    - Single-image saved settings key/label lookup and saved payload creation now live with saved-settings parsing/storage helpers instead of the Preact component.
    - Single-image saved-settings read/write action helpers now keep side labels, storage keys, and savable payload construction out of the Preact component.
    - Processor enabled toggles and option merges now go through pure helpers instead of direct option-panel path updates.
    - Orientation-change resize updates for both sides now go through a pure helper instead of inline Preact component mapping.
    - Single-image preprocessor-change state updates now go through a pure helper instead of inline Preact component logic.
    - Single-image current/latest job-state derivation and work-plan assembly now go through a pure helper instead of inline Preact component logic.
    - Single-image work-start scheduling now goes through a pure helper instead of inline Preact component logic.
    - Single-image side encode decisions for original passthrough, cache hits, and new encodes now go through a pure helper instead of inline Preact component logic.
    - Single-image, image-pipeline, and bulk runner abort-error checks now use a shared utility helper instead of open-coded name checks.
    - The main editor no longer uses the deprecated `componentWillReceiveProps` lifecycle for new-file handling.
    - Single-image editor update effects for new files, title refreshes, and work scheduling now go through a tested helper instead of inline Preact lifecycle logic.
    - Single-image supported encoder filtering now lives in a tested helper instead of inline Preact options module setup.
    - Single-image saved-settings import availability now lives in a tested helper instead of inline Preact option-render logic.
    - Single-image saved-settings action tests now cover initial reads, per-side reads, write success, write failure, labels, keys, and saved payload construction.
    - Single-image initial side-state setup now lives in a tested helper instead of inline Preact state initialization.
    - Bulk normal import and MIME-sniffed import now share accepted/rejected result recording so future import surfaces do not duplicate job ID or rejection bookkeeping.
    - Bulk active status checks now come from the session model and are reused by queue and snapshot logic.
    - Bulk snapshot status validation now reuses the canonical status list from the session model.
    - Bulk current-output and export-readiness checks now come from the session model and are reused by queue/export flows.
    - Bulk queued reset behavior now goes through one helper for retry, stale-output requeue, incomplete-job requeue, and active-job cancellation.
    - Bulk add-job session mutations now normalize existing counters before appending jobs.
    - No remaining `catched`, `matchMedia().addListener`, or `matchMedia().removeListener` matches were found in `src/`.
    - Removed obsolete TS suppressions from option controls and icon props by using element-specific Preact JSX attribute types.
    - Removed the remaining maintained app/lib `@ts-ignore` by making worker-bridge dispatch explicit.

## Priority 3: tests and release confidence

14. Add browser smoke tests.

    - Use Playwright or another browser runner.
    - Start with: app loads, file can be selected, editor opens, an output is generated.
    - Started: `npm run smoke:browser` automates the local production-build Chromium/WebP smoke through the system `playwright-cli`.
    - Started: `npm run smoke:browser` now verifies resize processing by checking a generated WebP blob is `64x64`.
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
    - Bulk session mutation tests now cover drift-tolerant add-job counter normalization.
    - Bulk import tests now cover injected MIME sniffing for extensionless, misnamed, rejected, and unreadable image files.
    - Bulk import tests now cover structured rejection reasons and summary counts for unsupported and unreadable files.
    - Bulk import tests now cover creating a bulk session from accepted import jobs while ignoring rejected files.
    - Bulk import tests now cover appending accepted import jobs to an existing session with duplicate-safe IDs.
    - Bulk runner tests now cover no-op runs when no jobs are runnable or concurrency is zero.
    - Bulk runner tests now cover draining the full queue across multiple concurrency-limited batches.
    - Bulk processor tests now cover pure process-plan creation before decode starts.
    - Bulk processing now uses the shared source decode helper, including the SVG/vector path used by the single-image editor.
    - Bulk queue tests now cover derived queue state for normalized concurrency, active counts, open slots, queued counts, and runnable job ids.
    - Bulk queue tests now cover shared job counter deltas for queued, active, and exported states; direct and batch queue transitions now reuse those deltas.
    - Bulk queue tests now cover shared queued reset behavior for status, output, and error cleanup.
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
    - Bulk helper tests now cover the canonical status list used by snapshot parsing.
    - Bulk strip item tests now cover selected state, output size state, percent change, status grouping, and per-image override paths.
    - Bulk session summary tests now cover progress, selected-job context, action state, queue state, override totals, output totals, and export readiness from one pure selector.
    - Bulk selected-job detail tests now cover effective settings, output state, override paths, and missing selections.
    - Result-cache tests now cover cache hits, mismatched image data, mismatched encoder options, and mismatched processor options.
    - Single-image work-plan tests now cover no-op decisions, first decode/preprocess work, original-to-encoded transitions, encoder-only updates, planned image work assembly, active-job precedence, work-start scheduling, and side encode planning.
    - Single-image source-state tests now cover default raster and vector resize settings for newly decoded source images.
    - Single-image source-state tests now cover applying default resize settings to both comparison sides without mutating the old side state.
    - Single-image source-state tests now cover orientation-change detection and resize width/height swapping after rotation.
    - Single-image document-title tests now cover idle, loading, and loaded file title text.
    - Single-image document-title tests now cover loading-state detection, file info derivation, and update gating.
    - Single-image display-state tests now cover the composed output/result render model consumed by the editor.
    - Single-image side-copy tests now cover side index lookup and blob URL regeneration when copying one side to the other.
    - Single-image side-state tests now cover saved-settings import while preserving live output fields for undo.
    - Single-image side-state tests now cover default side setup, paired initial sides, and saved initial side overrides.
    - Single-image side-state tests now cover loading transitions, intermediate processed output, final encoded output, and old blob URL revocation.
    - Single-image side-state tests now cover preprocessing completion state updates and old side output cleanup.
    - Single-image side-state tests now cover restoring a previous side during undo.
    - Saved-settings tests now cover side storage key and label lookup.
    - Output filename tests now cover extensionless sources, trailing dots, hidden names, path-like source names, punctuation-only names, and Windows reserved names.
    - Single-image and bulk export filenames now share the same basename sanitization helper.
    - Added `docs/progress-dashboard.html` as a clean direct-open visual progress dashboard for ongoing project status, with expandable detail sections.
    - Added `npm run dashboard` for event-based dashboard reloads when the HTML file changes.
    - Single-image side reset tests now cover clearing both side outputs and revoking both side download URLs when a new source image is loaded.
    - MIME sniffing tests now cover PNG, JPEG, WebP, TIFF, AVIF, JPEG XL, unknown data, a TIFF false-positive guard, and a non-AVIF `ftyp` guard.
    - Utility tests now cover `clean-modify`, `pretty-bytes`, saved-settings parsing/validation, and MIME sniffing behavior.
    - Service-worker bridge tests now cover service-worker controller detection.
    - Utility tests now cover shared abort-error detection.
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
