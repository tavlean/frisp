# Issue list

Use this as a backlog seed. Keep each issue small enough to review in one focused change.

## Near term

1. Add browser smoke tests.

   - Verify the app loads from a production build.
   - Verify a file can open the editor.
   - Verify output generation for at least WebP.

2. Expand pure helper tests.

   - Add MIME and extension edge cases around bulk import.
   - Add more export naming edge cases.
   - Add saved-settings migration cases when the schema changes again.

3. Decide the first supported browser set.

   - Document minimum Chrome, Safari, Firefox, and Edge targets.
   - Include WebAssembly, workers, service worker, AVIF, and WebP expectations.

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
