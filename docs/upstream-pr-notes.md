# Upstream PR notes

The original `GoogleChromeLabs/squoosh` repository has many open pull requests. Because Sqush is now a standalone project, these PRs should be treated as reference material, not automatic merge candidates.

## Highest-value references

1. `GoogleChromeLabs/squoosh#1428`: bulk processing support.

   - Most relevant reference for Sqush's main product direction.
   - Use it to compare multi-file import, processing order, preview selection, and export behavior.
   - Do not merge blindly because Sqush already has separate framework-neutral bulk helpers and the bulk UI is on design hold.

2. `GoogleChromeLabs/squoosh#1470`: SVG `viewBox` comma parsing.

   - Small import compatibility fix.
   - Worth cherry-picking manually after testing comma-separated and whitespace-separated `viewBox` values.
   - Current status: implemented in Sqush with a tested `parseSvgViewBoxSize` helper.

3. `GoogleChromeLabs/squoosh#1339`: copy settings as JSON.

   - Useful concept for presets and sharing compression settings.
   - Redesign as explicit preset import/export before implementing.

4. `GoogleChromeLabs/squoosh#918`: drag output files to the desktop.

   - Useful export UX idea.
   - Browser support needs testing before relying on it.

## Codec references

1. `GoogleChromeLabs/squoosh#1413`: zopfli options for oxipng.

   - Useful only if PNG remains a serious supported output.
   - Requires Rust/WASM output review and slow-compression UX decisions.

2. `GoogleChromeLabs/squoosh#912`: WebP 2 option tweaks.

   - Treat as historical reference only.
   - WebP 2 should not be a normal production output unless the codec strategy changes.

3. `GoogleChromeLabs/squoosh#1398`: TIFF decoding.

   - Potentially useful for bulk input support.
   - High complexity because it adds another WASM codec/toolchain path.

4. `GoogleChromeLabs/squoosh#1378` and `#1379`: JPEG XL update attempts.

   - Useful as historical context.
   - Do a fresh JXL update rather than applying these old failing branches.

## Maintenance references

Dependabot-style dependency PRs such as `#1465`, `#1464`, `#1462`, `#1455`, `#1454`, `#1450`, and `#1383` should be audited as a group.

Recommended approach:

1. Upgrade one build-tool area at a time.
2. Run `npm run check`.
3. Smoke-test the production build in a browser when Rollup, TypeScript, PostCSS, terser, workers, or WASM handling changes.
4. Avoid `npm audit fix --force` unless the exact diff is reviewed first.
