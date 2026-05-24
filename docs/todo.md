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

13. Fix small code quality issues while touching nearby code.

    - Completed: replace the remaining `Boolean` prop type with primitive `boolean`.
    - No remaining `catched`, `matchMedia().addListener`, or `matchMedia().removeListener` matches were found in `src/`.

## Priority 3: tests and release confidence

14. Add browser smoke tests.

    - Use Playwright or another browser runner.
    - Start with: app loads, file can be selected, editor opens, an output is generated.
    - Started: `npm run smoke:browser` automates the local production-build Chromium/WebP smoke through the system `playwright-cli`.
    - Add checks for service-worker-disabled and production-like modes.

15. Add small unit tests for pure utilities.

    - Bulk helper tests now cover settings merge/hash behavior, session changes, queue stale detection, and export summaries.
    - `npm run test:unit` runs the current pure-helper test suite.
    - `clean-modify`
    - `pretty-bytes`
    - MIME sniffing behavior if it can be isolated
    - saved-settings parse/validate logic

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

19. Partially completed: review browser support.

    - Initial policy note lives in [Browser support policy](browser-support.md).
    - Exact minimum browser versions still need current compatibility research before public release.

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
