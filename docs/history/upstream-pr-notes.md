# Upstream PR notes

The original `GoogleChromeLabs/squoosh` repository has many open pull requests. Because Presk is now a standalone project, these PRs should be treated as reference material, not automatic merge candidates.

Last full audit: 2026-05-23.

GitHub reported 89 open PRs at audit time. All 89 were inspected through the GitHub CLI/API.

## Highest-value references

1. `GoogleChromeLabs/squoosh#1428`: bulk processing support.
   - Most relevant reference for Presk's main product direction.
   - Use it to compare multi-file import, processing order, preview selection, and export behavior.
   - Do not merge blindly because Presk already has separate framework-neutral bulk helpers and the bulk UI is on design hold.

2. `GoogleChromeLabs/squoosh#1470`: SVG `viewBox` comma parsing.
   - Small import compatibility fix.
   - Worth cherry-picking manually after testing comma-separated and whitespace-separated `viewBox` values.
   - Current status: implemented in Presk with a tested `parseSvgViewBoxSize` helper.

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

2. `GoogleChromeLabs/squoosh#1398`: TIFF decoding.
   - Potentially useful for bulk input support.
   - High complexity because it adds another WASM codec/toolchain path.

3. `GoogleChromeLabs/squoosh#1378` and `#1379`: JPEG XL update attempts.
   - Useful as historical context.
   - Do a fresh JXL update rather than applying these old failing branches.

## Maintenance references

Dependabot-style dependency PRs such as `#1465`, `#1464`, `#1462`, `#1455`, `#1454`, `#1450`, and `#1383` should be audited as a group.

Recommended approach:

1. Upgrade one build-tool area at a time.
2. Run `npm run check`.
3. Smoke-test the production build in a browser when Rollup, TypeScript, PostCSS, terser, workers, or WASM handling changes.
4. Avoid `npm audit fix --force` unless the exact diff is reviewed first.

## Full open PR audit register

|        PR | Title                                  | Category         | Relevance | Suggested action                                    | Risk/conflict                    |
| --------: | -------------------------------------- | ---------------- | --------- | --------------------------------------------------- | -------------------------------- |
|      1470 | Fix SVG viewBox parsing                | bugfix           | High      | Done in Presk                                       | Overlapped current SVG work      |
|      1469 | Remove bad FAQ link                    | docs             | Low       | Note only                                           | Issue template only              |
|      1465 | minimatch/serve bump                   | build/dependency | Medium    | Already superseded by fresh audit work              | Major lockfile churn             |
|      1464 | serialize-js/terser bump               | build/dependency | Medium    | Already superseded by fresh audit work              | Node/toolchain risk              |
|      1462 | on-headers/serve bump                  | build/dependency | Medium    | Already superseded by fresh audit work              | Lockfile churn                   |
|      1461 | edit test                              | obsolete/ignore  | Low       | Ignore                                              | Broad unreviewable modernization |
|      1457 | remove duplicate url-plugin code       | bugfix           | Medium    | Done in Presk                                       | Low                              |
|      1455 | js-yaml bump                           | build/dependency | Medium    | Already superseded by fresh audit work              | Lockfile only                    |
|      1454 | rollup bump                            | build/dependency | Medium    | Investigate later                                   | Bundler behavior                 |
|      1453 | js-yaml/cssnano bump                   | build/dependency | Medium    | Already superseded by fresh audit work              | CSS minification changes         |
|      1452 | simple-ts fix                          | bugfix           | High      | Already superseded by current `simple-ts` spawn fix | Tiny, verify current code        |
|      1450 | shell-quote bump                       | build/dependency | Low       | Already superseded by fresh audit work              | Lockfile only                    |
|      1448 | Electron offline app                   | other            | Low       | Ignore                                              | Product scope shift              |
|      1433 | npm audit fix force                    | build/dependency | Medium    | Already superseded by fresh audit work              | Forced majors                    |
|      1430 | Windows scripts                        | build/dependency | Medium    | Partially addressed in Presk                        | Can break Unix scripts if copied |
|      1428 | Bulk processing                        | bulk             | High      | Reference only                                      | Presk already has bulk modules   |
|      1421 | braces bump                            | build/dependency | Medium    | Already superseded by fresh audit work              | Stale lockfile                   |
|      1418 | fix dev error                          | bugfix           | Medium    | Investigate later                                   | May be obsolete                  |
|      1416 | ejs bump                               | build/dependency | Medium    | Already superseded by fresh audit work              | Lockfile only                    |
|      1413 | zopfli on oxipng                       | codec            | High      | Investigate later                                   | Codec output/perf risk           |
|      1401 | alpha channel reduction toggle         | codec/UX         | High      | Investigate later                                   | Option/meta conflicts            |
|      1400 | CI action bumps                        | build/dependency | Low       | Note only                                           | Upstream CI only                 |
|      1399 | Windows support                        | build/dependency | Medium    | Partially addressed in Presk                        | Script portability               |
|      1398 | TIFF decoding                          | codec            | Medium    | Investigate later                                   | New decoder surface              |
|      1383 | postcss 8 bump                         | build/dependency | Medium    | Already completed in Presk                          | Plugin compatibility             |
|      1380 | codec versions README                  | docs             | Low       | Note only                                           | Docs only                        |
|      1379 | JXL v0.7 failing build                 | codec            | Low       | Ignore                                              | Marked failing                   |
|      1378 | JXL v0.7                               | codec            | Medium    | Investigate later                                   | Superseded/stale                 |
|      1374 | progressive decode draft               | codec            | Low       | Ignore                                              | Draft/experimental               |
|      1369 | Modal component                        | UX               | Low       | Note only                                           | Unused abstraction               |
|      1364 | yaml/lint-staged bump                  | build/dependency | Low       | Already superseded by fresh audit work              | Stale lockfile                   |
|      1349 | Update Output index                    | UX               | Low       | Note only                                           | Unclear change                   |
|      1339 | copy settings JSON                     | UX               | High      | Investigate later                                   | Options UI conflicts             |
|      1337 | minimist bump                          | build/dependency | Medium    | Already superseded by fresh audit work              | Lockfile only                    |
| 1330-1327 | bumpalo codec bumps                    | build/dependency | Medium    | Investigate later                                   | Rust lockfiles                   |
|      1326 | Reduce threads                         | build/dependency | Medium    | Investigate later                                   | Draft, worker perf               |
|      1323 | json5 bump                             | build/dependency | Medium    | Already superseded by fresh audit work              | Lockfile only                    |
| 1320-1319 | crossbeam oxipng bumps                 | build/dependency | Medium    | Investigate later                                   | Rust codec lockfiles             |
| 1318-1308 | terser/color/minimist/json5/ansi bumps | build/dependency | Medium    | Already superseded by fresh audit work              | Stale security updates           |
|      1306 | image display resolution               | UX               | Medium    | Investigate later                                   | UI fit/conflict                  |
|      1295 | loader-utils bump                      | build/dependency | Low       | Already superseded by fresh audit work              | Stale                            |
|      1291 | README update                          | docs             | Low       | Note only                                           | Docs only                        |
|      1278 | libsquoosh add del                     | build/dependency | Low       | Note only                                           | libsquoosh scope                 |
|      1266 | Node 18 support                        | build/dependency | Medium    | Note only                                           | Scripts/toolchain                |
|      1253 | CLI encConfig fix                      | bugfix           | Low       | Note only                                           | CLI may be irrelevant            |
|      1239 | front page size units                  | UX/docs          | Low       | Note only                                           | Cosmetic                         |
|      1229 | issue templates                        | docs             | Low       | Note only                                           | Upstream maintenance             |
|      1224 | not-inline CSS                         | build/dependency | Low       | Investigate later                                   | CSP/build interaction            |
|      1220 | publish codec types                    | build/dependency | Low       | Note only                                           | npm packaging                    |
| 1216-1214 | path-parse/ansi-regex bumps            | build/dependency | Low       | Already superseded by fresh audit work              | Stale                            |
|      1201 | build guide rephrase                   | docs             | Low       | Note only                                           | Docs only                        |
|      1197 | strict CSP                             | build/dependency | Medium    | Investigate later                                   | Can break workers/WASM           |
|      1158 | inline logo SVG                        | UX               | Low       | Note only                                           | Cosmetic                         |
|      1114 | Imagepool filename override            | other            | Low       | Note only                                           | libsquoosh API                   |
|      1096 | size change indicators                 | UX               | Low       | Note only                                           | Prototype                        |
|      1075 | mozjpeg decode errors                  | codec/bugfix     | Medium    | Investigate later                                   | Changes requested, WASM          |
|      1072 | charset meta tag                       | bugfix           | Low       | Done in Presk                                       | Tiny                             |
|      1004 | MozJPEG progressive steps              | codec            | Low       | Ignore                                              | Draft/experimental               |
|       945 | hide paste if unsupported              | UX/bugfix        | Medium    | Investigate manually                                | Clipboard UI changed             |
|       944 | paste data URI                         | UX               | Medium    | Investigate later                                   | Input handling/security          |
|       941 | latest wasm-opt                        | build/dependency | Medium    | Investigate later                                   | Codec build reproducibility      |
|       939 | disable worker termination in dev      | bugfix           | Low       | Note only                                           | Dev-only behavior                |
|       918 | drag files to desktop                  | UX               | Medium    | Investigate later                                   | Browser compatibility            |
|       914 | restore focus outline                  | UX/bugfix        | High      | Investigate manually                                | Accessibility, low risk          |
|       912 | WP2 options                            | codec            | Low       | Ignore                                              | Obsolete codec/WASM              |
|       906 | CLI file size units                    | docs/bugfix      | Low       | Note only                                           | CLI only                         |
|       890 | preprocessor transformations UI        | UX               | Low       | Ignore                                              | Huge stale feature               |
|       812 | remove maskable icon copy              | obsolete/ignore  | Low       | Ignore                                              | Likely obsolete                  |
|       798 | normalize src                          | obsolete/ignore  | Low       | Ignore                                              | Ancient restructure              |
|       797 | Parcel 2                               | build/dependency | Low       | Ignore                                              | Obsolete build migration         |
|       760 | update resizer                         | codec            | Low       | Ignore                                              | Ancient WASM/pkg churn           |
|       738 | declare css/scss modules               | bugfix           | Low       | Note only                                           | Old tree paths                   |
|       704 | stricter TS options                    | build/dependency | Low       | Ignore                                              | Old source layout                |
|       698 | introduce ESLint                       | build/dependency | Low       | Ignore                                              | Old source layout                |
|       680 | document title busy indicator          | UX               | Low       | Note only                                           | Cosmetic                         |
|       586 | path aliases/import tidy               | build/dependency | Low       | Ignore                                              | Old source layout                |
|       452 | PWA install link                       | UX               | Low       | Note only                                           | Intro page changed               |
|       372 | reset position/zoom                    | UX               | Low       | Ignore                                              | Old paths, changes requested     |
|       256 | extract pinch zoom                     | obsolete/ignore  | Low       | Ignore                                              | Ancient, already diverged        |
