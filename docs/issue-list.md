# Issue list

Use this as a backlog seed. Keep each issue small enough to review in one focused change.

## Near term

1. Add browser smoke tests.

   - Verify the app loads from a production build.
   - Verify a file can open the editor.
   - Started: production-build shell and local-image editor import are now covered by the Playwright CLI smoke flow in [Manual QA checklist](manual-qa.md).
   - Started: production-build WebP output generation is now covered manually with Playwright CLI; the smoke verifies WebP selection, a `.webp` blob download, and zero console errors.
   - Started: `npm run smoke:browser` now automates the production-build Playwright CLI flow locally without adding Playwright dependencies to the repo.
   - Started: `npm run smoke:build` now checks that production runtime scripts, runtime links, and manifest media stay local so the offline/local-processing promise does not silently regress.
   - Started: `npm run smoke:build` now checks that service-worker precache entries point at files emitted into `build/`.

2. Expand pure helper tests.

   - Started: bulk import now covers extension-only AVIF, JFIF, TIFF, and BMP inputs plus trailing-dot rejection.
   - Started: bulk export now covers duplicate names, invalid path characters, punctuation-only base names, and hidden-style names.
   - Started: bulk export now covers collisions between generated duplicate-safe names and later source names.
   - Started: bulk export now covers invalid/path-like batch archive names.
   - Started: bulk output summary tests now cover optimized bytes, stale outputs, and already-exported jobs.
   - Started: bulk export tests now cover per-job size summaries for missing, stale, and optimized outputs.
   - Started: bulk size tests now cover shared percent-change calculation and zero-byte inputs.
   - Started: bulk queue/session tests now cover exported-count consistency when exported jobs are removed or requeued as stale.
   - Started: bulk queue/session tests now cover exported-count consistency when an exported job is completed or failed again.
   - Started: bulk queue/session tests now cover clearing stale output when a job fails.
   - Started: bulk session tests now cover normalizing empty per-image overrides away.
   - Started: bulk session tests now cover job effective-settings lookup for global/per-image override merging.
   - Started: bulk session tests now cover framework-neutral override summaries for future image-strip indicators.
   - Started: bulk queue/session tests now cover exported-count consistency when one exported job is manually requeued.
   - Started: bulk retry tests now cover clearing stale outputs from failed or skipped jobs.
   - Started: bulk session tests now cover active/exported counters when constructing a session from existing jobs.
   - Started: bulk session tests now cover active/exported counters when adding restored jobs to a session.
   - Started: bulk session tests now cover framework-neutral next/previous image selection.
   - Started: bulk session tests now cover selected-job context for future image-strip navigation state.
   - Started: bulk session tests now cover framework-neutral job status grouping.
   - Started: bulk session/export tests now cover framework-neutral action-state selectors for future controls.
   - Started: bulk object URL cleanup now covers duplicate URL revocation.
   - Started: bulk runner tests now cover pre-aborted batch cancellation before processors are called.
   - Started: bulk queue tests now cover invalid concurrency values before future UI controls can pass them through.
   - Started: shared abort helper tests now cover listener cleanup on resolve and abort.
   - Started: saved-settings parsing now rejects missing, array-shaped, or null-valued encoder options and invalid processor enabled/null values.
   - Add more saved-settings migration cases when the schema changes again.

3. Decide the first supported browser set.

   - Started: documented first public targets in [Browser support policy](browser-support.md).
   - Started: local Chromium smoke coverage exists through the system Playwright CLI; add Safari/Firefox coverage before treating the policy as release-proven.

4. Decide codec visibility before deleting codec code.
   - Start by hiding non-focus formats only after UI design discussion.
   - Do not delete codec folders until the focused bulk workflow is working and tested.

## Later

5. Investigate Rollup or bundler modernization.

   - Keep this separate from feature work.
   - Treat workers, WASM, generated metadata, prerendering, and service-worker caching as migration blockers.

6. Fill codec provenance gaps.

   - Record upstream commit/tag and build steps before changing any codec output.

7. Turn selected backlog items into GitHub issues.
   - Start with browser smoke tests, browser support policy, and codec provenance gaps.
