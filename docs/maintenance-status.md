# Maintenance status

Last updated: 2026-05-23.

## Completed baseline cleanup

- Added project documentation and a road map.
- Added `npm run typecheck`.
- Added `npm run format` and `npm run format:check`.
- Added `npm run smoke:build` to verify generated build output.
- Updated CI to use current checkout/setup-node actions and run the baseline checks.
- Removed the inherited upstream Google Analytics integration.
- Refreshed Browserslist data.
- Removed the Node 20 `DEP0190` warning from the TypeScript build spawn.
- Upgraded the local static server from `serve@11` to `serve@14`.
- Applied compatible `npm audit fix` updates.
- Replaced `npm-run-all` with a local dev runner script.
- Hardened saved side settings against invalid `localStorage` data.
- Modernized one editor media query listener path.

## Current verification commands

Run these before committing substantial changes:

```sh
npm run format:check
npm run typecheck
npm run build
npm run smoke:build
```

For UI-sensitive changes, also run a browser smoke check against `build/` after `npm run build`.

## Current known warnings

`npm run build` succeeds, but after compatible dependency updates Rollup reports unused external `path.sep` imports while loading `rollup.config.js`.

This warning appears to come from the old custom Rollup/TypeScript build setup, not from broken app output. The production app was smoke-tested in Chromium through Playwright after the warning appeared.

Treat this as part of the future Rollup/toolchain modernization work rather than as a blocker for bulk-image feature design.

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
