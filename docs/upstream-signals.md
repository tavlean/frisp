# Upstream Signals

Last updated: 2026-06-09. Status: living upstream triage ledger.

This doc records high-signal issues and pull requests from
[GoogleChromeLabs/squoosh](https://github.com/GoogleChromeLabs/squoosh). These
are external product, bug, maintenance, and implementation signals. They are not
Frisp roadmap commitments.

Use this as a parking lot for upstream evidence that might inform Frisp later,
while keeping [road-map.md](road-map.md) as the committed product direction.

## How to use this doc

Classify upstream items against the local docs before promoting anything:

- **Already handled:** Frisp has solved or superseded the upstream item.
- **Existing local backlog:** the signal already has a Frisp home; update that
  doc if the upstream item adds useful detail.
- **Candidate:** useful, not yet committed, and worth discussing or testing.
- **Watch:** may matter, but needs a local repro, browser confirmation, or an
  upstream outcome before action.
- **Ignore / reject:** outside Frisp's local-first browser scope, conflicts with
  project boundaries, or is a stale implementation path.

Before acting on any item, read [STATUS.md](STATUS.md) and the relevant local
doc from [README.md](README.md). Do not merge stale upstream PRs wholesale; pull
out small ideas, reproduce locally, and add tests or browser verification.

## Survey pass: 2026-06-06

Repository state checked with `gh`: upstream is not archived and has recent
activity. Issue [#1472](https://github.com/GoogleChromeLabs/squoosh/issues/1472)
notes that most original maintainers left Google, but Jake Archibald still has
commit/publish access and planned AVIF/JPEG XL updates. PR
[#1473](https://github.com/GoogleChromeLabs/squoosh/pull/1473) is the active
AVIF/JXL work as of 2026-06-05.

Search lenses used:

- open issues sorted by comments, reactions, and recent updates;
- high-comment closed issues;
- open, merged, and notable closed pull requests sorted by comments/reactions;
- targeted searches for bulk, offline, AVIF, JXL, OxiPNG, resize, SVG, EXIF,
  metadata, paste/import, target size, crop, transparency, tests, PWA, and API.

## Already handled or superseded in Frisp

| Upstream signal | Local classification |
|---|---|
| Codec staleness and CVE risk: [#1472](https://github.com/GoogleChromeLabs/squoosh/issues/1472), [#1402](https://github.com/GoogleChromeLabs/squoosh/issues/1402), [#1234](https://github.com/GoogleChromeLabs/squoosh/issues/1234), PR [#1473](https://github.com/GoogleChromeLabs/squoosh/pull/1473) | **Already handled for the urgent track.** Frisp rebuilt all 7 shipped WASM codecs natively and verifies them with e2e + benchmarks. Keep watching PR #1473 for ideas beyond version currency: jpegli, SSIMULACRA 2, progressive/JXL options, and newer AVIF/JXL build lessons. |
| WebP 2 issues/PRs such as [#854](https://github.com/GoogleChromeLabs/squoosh/issues/854), PR [#837](https://github.com/GoogleChromeLabs/squoosh/pull/837), PR [#851](https://github.com/GoogleChromeLabs/squoosh/pull/851), PR [#853](https://github.com/GoogleChromeLabs/squoosh/pull/853) | **Reject / do not resurrect.** Frisp removed WebP 2 end to end after the codec audit. |
| Threading / SharedArrayBuffer / AVIF single-thread issues: [#1089](https://github.com/GoogleChromeLabs/squoosh/issues/1089), [#1397](https://github.com/GoogleChromeLabs/squoosh/issues/1397), PR [#829](https://github.com/GoogleChromeLabs/squoosh/pull/829), PR [#1007](https://github.com/GoogleChromeLabs/squoosh/pull/1007), PR [#1409](https://github.com/GoogleChromeLabs/squoosh/pull/1409) | **Already handled, keep watching.** Frisp has COOP/COEP, threaded oxipng/AVIF/JXL, single-thread fallback, and WebKit e2e coverage. New browser-specific failures still belong in [browser-support.md](browser-support.md) or [threading-enablement.md](threading-enablement.md). |
| Offline/service-worker basics: [#80](https://github.com/GoogleChromeLabs/squoosh/issues/80), [#258](https://github.com/GoogleChromeLabs/squoosh/issues/258), [#255](https://github.com/GoogleChromeLabs/squoosh/issues/255), PR [#234](https://github.com/GoogleChromeLabs/squoosh/pull/234), PR [#249](https://github.com/GoogleChromeLabs/squoosh/pull/249), PR [#887](https://github.com/GoogleChromeLabs/squoosh/pull/887) | **Already handled.** Offline reload and codec paths are covered by Frisp's SvelteKit service worker and Playwright e2e. |
| SVG comma-separated `viewBox`: issue [#1444](https://github.com/GoogleChromeLabs/squoosh/issues/1444), PR [#1470](https://github.com/GoogleChromeLabs/squoosh/pull/1470) | **Already handled.** `src/client/lazy-app/util/svg.ts` parses `viewBox` with `split(/[\s,]+/)`. |
| Basic paste/import affordances: [#637](https://github.com/GoogleChromeLabs/squoosh/issues/637), [#1237](https://github.com/GoogleChromeLabs/squoosh/issues/1237), PR [#98](https://github.com/GoogleChromeLabs/squoosh/pull/98), PR [#944](https://github.com/GoogleChromeLabs/squoosh/pull/944), PR [#945](https://github.com/GoogleChromeLabs/squoosh/pull/945) | **Mostly handled.** Frisp supports click, drag/drop, clipboard read, and window paste on the intro screen, with messages for empty/unreadable paste. Data URI paste is not known to be supported; treat that as candidate only if real users need it. |
| Manual rotate and rotate/resize parity: [#299](https://github.com/GoogleChromeLabs/squoosh/issues/299), PR [#322](https://github.com/GoogleChromeLabs/squoosh/pull/322) | **Partly handled.** Frisp has manual rotate and swaps resize dimensions correctly. Automatic EXIF orientation remains a separate candidate below. |
| QOI support: [#1302](https://github.com/GoogleChromeLabs/squoosh/issues/1302), PR [#1384](https://github.com/GoogleChromeLabs/squoosh/pull/1384) | **Already handled.** QOI is shipped and documented. |
| App e2e coverage: [#1086](https://github.com/GoogleChromeLabs/squoosh/issues/1086), [#313](https://github.com/GoogleChromeLabs/squoosh/issues/313) | **Already stronger than upstream, with gaps.** Frisp has a Playwright e2e suite for codecs, threading, and offline. Unit tests and decoder-input gaps are tracked in [test-plan.md](test-plan.md). |

## Existing local backlog

| Upstream signal | Local home / note |
|---|---|
| Bulk/multiple images: [#301](https://github.com/GoogleChromeLabs/squoosh/issues/301), [#1406](https://github.com/GoogleChromeLabs/squoosh/issues/1406), [#1405](https://github.com/GoogleChromeLabs/squoosh/issues/1405), [#1259](https://github.com/GoogleChromeLabs/squoosh/issues/1259), PR [#1428](https://github.com/GoogleChromeLabs/squoosh/pull/1428) | **Existing local backlog.** See [road-map.md](road-map.md) and [bulk-image-architecture.md](bulk-image-architecture.md). PR #1428 adds useful design pressure: duplicate-safe names, mixed aspect ratios, mobile top-bar layout, export-all UX, ZIP vs individual downloads, and possible File System API progressive enhancement. |
| Target file size / target percent: [#1422](https://github.com/GoogleChromeLabs/squoosh/issues/1422) | **Existing local backlog.** Tracked in [road-map.md](road-map.md) and [codec-options-model.md](codec-options-model.md). Valuable because it makes codec comparison result-driven instead of slider-name-driven. |
| Multi-format comparison and visual metrics: [#1436](https://github.com/GoogleChromeLabs/squoosh/issues/1436), PR [#1473](https://github.com/GoogleChromeLabs/squoosh/pull/1473) | **Existing adjacent backlog.** Multi-Format Compare is in [road-map.md](road-map.md). SSIMULACRA 2 from PR #1473 is a candidate metric if it can be made understandable and cheap enough. |
| New codec/processors: [#1408](https://github.com/GoogleChromeLabs/squoosh/issues/1408), [#1092](https://github.com/GoogleChromeLabs/squoosh/issues/1092), PR [#1398](https://github.com/GoogleChromeLabs/squoosh/pull/1398), [#1435](https://github.com/GoogleChromeLabs/squoosh/issues/1435), [#1440](https://github.com/GoogleChromeLabs/squoosh/issues/1440), [#1414](https://github.com/GoogleChromeLabs/squoosh/issues/1414), [#1279](https://github.com/GoogleChromeLabs/squoosh/issues/1279) | **Existing local investigation / mostly monitor.** See [new-codec-investigation.md](new-codec-investigation.md). jpegli remains watch-worthy if upstream lands a usable browser build. SVGO remains the cleanest first new processor even though it came from local audit rather than upstream Squoosh requests. TIFF/ICO/JPEG XR/PDF/HDR are lower priority until user demand appears. |
| PWA/share/folder/session import ideas: PR [#469](https://github.com/GoogleChromeLabs/squoosh/pull/469), PR [#764](https://github.com/GoogleChromeLabs/squoosh/pull/764), PR [#933](https://github.com/GoogleChromeLabs/squoosh/pull/933), [#1459](https://github.com/GoogleChromeLabs/squoosh/issues/1459), [#311](https://github.com/GoogleChromeLabs/squoosh/issues/311) | **Existing local backlog.** See [road-map.md](road-map.md) PWA/import/persistence notes and [parity-audit.md](parity-audit.md) share-target deferral. URL import must not create upload/server paths; beware CORS and privacy. |
| PWA update/install edge cases: [#255](https://github.com/GoogleChromeLabs/squoosh/issues/255), [#354](https://github.com/GoogleChromeLabs/squoosh/issues/354), [#801](https://github.com/GoogleChromeLabs/squoosh/issues/801), [#974](https://github.com/GoogleChromeLabs/squoosh/issues/974) | **Existing local backlog only when PWA polish starts.** Frisp's core offline reload is covered, but update prompts, install metadata, and work-preserving reload UX are not a current product track. |
| Browser support and cross-engine release claims | **Existing local backlog.** See [browser-support.md](browser-support.md), [manual-qa.md](manual-qa.md), and [issue-list.md](issue-list.md). |

## Candidate signals to consider

These are not committed. They are worth local repro, design discussion, or a
small plan if they align with current priorities.

| Candidate | Upstream evidence | Why it may matter |
|---|---|---|
| Set background / transparency handling | [#736](https://github.com/GoogleChromeLabs/squoosh/issues/736), related [#347](https://github.com/GoogleChromeLabs/squoosh/issues/347), PR [#1474](https://github.com/GoogleChromeLabs/squoosh/pull/1474) | Frisp has a preview background toggle and alpha codec options, but no processor that composites transparent inputs onto a chosen background before JPEG or other no-alpha outputs. PR #1474 is a concrete implementation idea: alpha-capable color input, `destination-over` compositing, hide when input has no transparency, run after resize and before palette reduction/encode. |
| Automatic EXIF orientation | [#299](https://github.com/GoogleChromeLabs/squoosh/issues/299) | Manual rotate works, but phones still produce images whose intended orientation lives in EXIF. Candidate only if it can be implemented without double-rotating Safari/browser-decoded images. The issue has useful notes on feature detection with a tiny EXIF-oriented JPEG. |
| Crop after resize / crop frame | [#314](https://github.com/GoogleChromeLabs/squoosh/issues/314), [#741](https://github.com/GoogleChromeLabs/squoosh/issues/741), [#1417](https://github.com/GoogleChromeLabs/squoosh/issues/1417) | Repeated ask. Not part of the current roadmap, but [test-plan.md](test-plan.md) already anticipates crop math tests if the feature lands. |
| In-app option explanations | [#1410](https://github.com/GoogleChromeLabs/squoosh/issues/1410), [#332](https://github.com/GoogleChromeLabs/squoosh/issues/332), PR [#1366](https://github.com/GoogleChromeLabs/squoosh/pull/1366) | Frisp has strong user-guide docs, but the app itself still expects users to understand codec names and advanced settings. A small, restrained help affordance could reduce trial-and-error without turning the editor into a tutorial. |
| Large-font / mobile control reachability | [#1442](https://github.com/GoogleChromeLabs/squoosh/issues/1442), [#1372](https://github.com/GoogleChromeLabs/squoosh/issues/1372) | Upstream reports the download button disappearing at larger Android font sizes and safe-area issues. Frisp already made mobile layout fixes, but release QA should include large text and safe-area checks before public support claims. |
| Copy compressed image to clipboard | [#1371](https://github.com/GoogleChromeLabs/squoosh/issues/1371), PR [#918](https://github.com/GoogleChromeLabs/squoosh/pull/918) | Could be useful for quick workflows, but browser support and permission UX need testing. Lower priority than download/export reliability. |
| Palette / quantization visibility | [#433](https://github.com/GoogleChromeLabs/squoosh/issues/433), [#819](https://github.com/GoogleChromeLabs/squoosh/issues/819), [#1403](https://github.com/GoogleChromeLabs/squoosh/issues/1403), PR [#1401](https://github.com/GoogleChromeLabs/squoosh/pull/1401) | Could improve Reduce Palette UX: show color count, alpha-only reduction, or palette visualization. Worth considering only after higher-priority workflow items. |
| Progressive AVIF / JXL exploration | [#1377](https://github.com/GoogleChromeLabs/squoosh/issues/1377), [#1373](https://github.com/GoogleChromeLabs/squoosh/issues/1373), PR [#1374](https://github.com/GoogleChromeLabs/squoosh/pull/1374), PR [#1473](https://github.com/GoogleChromeLabs/squoosh/pull/1473) | Might matter for advanced delivery guidance and Multi-Format Compare. Treat as research, not a near-term product promise. |

## Watch / needs local reproduction

| Signal | Why to watch |
|---|---|
| Resize crashes on mobile/WebKit/Chromium and large dimensions: [#988](https://github.com/GoogleChromeLabs/squoosh/issues/988), [#1188](https://github.com/GoogleChromeLabs/squoosh/issues/1188), [#1199](https://github.com/GoogleChromeLabs/squoosh/issues/1199) | Long-running issue class around Rust resize, Android/iOS, huge inputs, mistyped dimensions, and DevTools-sensitive WASM behavior. Frisp upgraded `resize` to 0.8.9 and has resize e2e, but this deserves mobile/Safari manual QA and dimension/memory guard consideration if resize changes. |
| Safari AVIF/OxiPNG failures: [#1458](https://github.com/GoogleChromeLabs/squoosh/issues/1458), [#1460](https://github.com/GoogleChromeLabs/squoosh/issues/1460), [#1437](https://github.com/GoogleChromeLabs/squoosh/issues/1437) | Upstream reports Safari 26.2 and Chrome Linux AVIF/OxiPNG runtime failures. Frisp has WebKit e2e and single-thread fallbacks, but real Safari version testing is still a release gate. |
| OxiPNG memory / huge tall images: [#1431](https://github.com/GoogleChromeLabs/squoosh/issues/1431) | A Figma-like 3200x22330 PNG and small intermittent failures were reported. Frisp upgraded OxiPNG and threading, but this class is worth a fixture or manual test before bulk/large-image claims. |
| AVIF color shifts and color management: [#960](https://github.com/GoogleChromeLabs/squoosh/issues/960), [#348](https://github.com/GoogleChromeLabs/squoosh/issues/348), [#1191](https://github.com/GoogleChromeLabs/squoosh/issues/1191) | Some reports may be browser/GPU display behavior, some codec/chroma behavior, and some missing profile metadata. Frisp user docs warn about AVIF/WebP color tradeoffs, but color-management work is not planned. |
| SVG optimization / SVGOMG-style requests: [#1088](https://github.com/GoogleChromeLabs/squoosh/issues/1088), [#1444](https://github.com/GoogleChromeLabs/squoosh/issues/1444) | Frisp already accepts/rasterizes SVG and fixed comma-separated `viewBox`, but true SVG optimization is still the SVGO candidate in [new-codec-investigation.md](new-codec-investigation.md). |
| Size increase warnings: [#984](https://github.com/GoogleChromeLabs/squoosh/issues/984) | Frisp already shows percentage change, but warning language could be stronger in bulk/export flows where users may not inspect every output. |
| Codec-load and decode errors: [#257](https://github.com/GoogleChromeLabs/squoosh/issues/257), PR [#1075](https://github.com/GoogleChromeLabs/squoosh/pull/1075) | Frisp has error paths, but test-plan gaps still include corrupt/unsupported file and decoder-input coverage. |

## Ignore / reject for now

| Signal | Reason |
|---|---|
| `@squoosh/lib`, CLI, npm codec packaging, and Node API issues: [#280](https://github.com/GoogleChromeLabs/squoosh/issues/280), [#934](https://github.com/GoogleChromeLabs/squoosh/issues/934), [#1084](https://github.com/GoogleChromeLabs/squoosh/issues/1084), [#1198](https://github.com/GoogleChromeLabs/squoosh/issues/1198), PR [#875](https://github.com/GoogleChromeLabs/squoosh/pull/875), PR [#1002](https://github.com/GoogleChromeLabs/squoosh/pull/1002), PR [#1123](https://github.com/GoogleChromeLabs/squoosh/pull/1123) | Frisp is a browser app. A library/CLI product would be separate and should not distract from the local-first editor. |
| Server/integration asks: [#1122](https://github.com/GoogleChromeLabs/squoosh/issues/1122), [#1331](https://github.com/GoogleChromeLabs/squoosh/issues/1331), [#1471](https://github.com/GoogleChromeLabs/squoosh/issues/1471) | Do not introduce upload/server processing. A browser-only embed API could be researched later, but it is not current scope. |
| Desktop wrapper: PR [#1448](https://github.com/GoogleChromeLabs/squoosh/pull/1448) | A native wrapper is a separate product with different packaging and support obligations. |
| Basis Universal / game texture formats: [#642](https://github.com/GoogleChromeLabs/squoosh/issues/642), PR [#1017](https://github.com/GoogleChromeLabs/squoosh/pull/1017) | Interesting for game assets, but outside the first-class web-image optimization focus. |
| Rollup/Preact-era dependency and build PRs | Frisp migrated to SvelteKit/Vite; old Rollup/Preact fixes are not directly actionable. |

## Escalation rules

When a candidate becomes real work:

1. Add or update the relevant local plan first.
2. Link this doc's upstream issue/PR as source evidence.
3. Define the smallest local acceptance test: focused unit test, e2e, manual QA,
   or benchmark, depending on the feature.
4. Update this ledger's classification after the work lands or is rejected.
