# Cleanup todo

This list is ordered by priority. Do the high-priority items before building new features on top of the fork.

## Priority 0: protect the working baseline

1. Decide the supported Node version.

   - `.nvmrc` says `20.16.0`.
   - The toolchain is old enough that Node 20 already prints deprecation warnings.
   - Document the required Node/npm versions in `README.md` after confirming the build is reliable on them.

2. Add basic project scripts.

   - Add `npm run typecheck`.
   - Add `npm run format` or `npm run lint`.
   - Add a minimal smoke test script for build output.
   - Keep `npm run build` as the final release check.

3. Add a manual QA checklist.
   - Open the app.
   - Load JPEG, PNG, WebP, AVIF if available.
   - Test both comparison sides.
   - Test resize, quantize, and at least one WASM encoder.
   - Test download.
   - Test saved left/right settings.
   - Test a hard refresh after a production build to catch service-worker issues.

## Priority 1: dependency and security cleanup

4. Triage `npm audit`.

   - Current audit output reports many vulnerabilities, including critical findings.
   - Most are development/build-chain dependencies, but this still matters because the build runs arbitrary package code.
   - Do not blindly run `npm audit fix --force` without checking the generated app after each upgrade.

5. Upgrade or replace the stale local server.

   - `serve@11.3.2` is old and pulls several vulnerable transitive packages.
   - `npm run dev` also reports that `serve` has a newer major version.
   - Consider replacing it with a smaller maintained static server if upgrade friction is high.

6. Upgrade Rollup and custom build plugins carefully.

   - The project uses Rollup 2 and custom plugins under `lib/`.
   - Several audit findings are attached to Rollup/plugin transitive dependencies.
   - This is likely the hardest cleanup because the build is highly customized.

7. Replace deprecated build patterns.

   - `lib/simple-ts.js` spawns TypeScript with `shell: true`, which triggers Node's DEP0190 warning.
   - Remove `shell: true` if possible and pass executable/args directly.

8. Refresh Browserslist data.
   - The build reports stale `caniuse-lite`.
   - Run the recommended update and commit the lockfile changes after reviewing them.

## Priority 2: project clarity and maintainability

9. Update the root README for this fork.

   - Rename or explain SquooshPlus.
   - Add Node version, install, build, dev, and troubleshooting notes.
   - Link to these docs.
   - Mention that `build/` and `.tmp/` are generated.

10. Decide whether generated files should stay committed.

    - `src/client/lazy-app/feature-meta/index.ts`
    - `src/client/lazy-app/worker-bridge/meta.ts`
    - `src/features-worker/index.ts`
    - If committed, document that developers must rebuild after feature changes.
    - If not committed, update the build so they are generated before TypeScript needs them.

11. Clean up analytics and privacy.

    - The app still loads Google Analytics ID `UA-128752250-1`.
    - Universal Analytics is obsolete.
    - Decide whether this fork should remove analytics, replace it, or gate it behind configuration.
    - Update privacy text accordingly.

12. Harden saved settings.

    - Wrap `JSON.parse(localStorage...)` in safe parsing.
    - Validate settings before applying them.
    - Add a version number to saved settings.
    - Handle missing encoders/options after future upgrades.

13. Fix small code quality issues while touching nearby code.
    - `Boolean` should be `boolean` in Preact state types.
    - Some comments contain typos such as `catched`.
    - Some browser APIs used here are older, for example `matchMedia().addListener`.

## Priority 3: tests and release confidence

14. Add browser smoke tests.

    - Use Playwright or another browser runner.
    - Start with: app loads, file can be selected, editor opens, an output is generated.
    - Add checks for service-worker-disabled and production-like modes.

15. Add small unit tests for pure utilities.

    - `clean-modify`
    - `pretty-bytes`
    - MIME sniffing behavior if it can be isolated
    - saved-settings parse/validate logic after it is extracted

16. Add CI for the real supported platform matrix.

    - Existing CI targets Ubuntu and Windows.
    - If Mac development is expected, add or document macOS checks.
    - Upgrade old GitHub Actions versions.

17. Track codec provenance.
    - Document where each `.wasm` file came from.
    - Record how to rebuild each codec.
    - Decide which prebuilt codec outputs should be committed.

## Priority 4: later modernization

18. Consider replacing the custom build with a maintained tool only after the baseline is stable.

    - Vite or another modern bundler may reduce custom code.
    - This is a larger migration because of Web Workers, WASM, generated feature metadata, static prerendering, and service-worker output.

19. Review browser support.

    - The app uses modern browser APIs, PWA APIs, WebAssembly, workers, and optional threaded codecs.
    - Decide which browsers matter for this fork before spending time on compatibility fixes.

20. Create an issue list from this todo.
    - Keep each task small enough to review.
    - Start with scripts, audit triage, analytics decision, and saved-settings hardening.
