# Test strategy & plan

**Status: in progress. Last updated: 2026-11-10.**

Frisp's test strategy protects the browser-local image pipeline: import, decode,
process, encode, preview, export, and offline reload. The current suite has three
layers: static gates, pure unit tests, and full browser e2e.

---

## 1. Current model

| Layer | Command | What it checks | Cadence |
|---|---|---|---|
| Static gate | `npm run check` | wrapper patch sync + SvelteKit sync, typecheck of the app (fails on warnings), service worker and tests, production build, static-output audit | every push/PR |
| Unit tests | `npm run test:unit` | pure helpers and bulk-engine reducers in Vitest | every push/PR |
| Browser e2e | `npm run test:e2e` | real production preview in Chromium + WebKit, codec bytes, threading, offline reload, bulk flows | every push/PR |

`npm test` runs `check`, `test:unit`, then Playwright with
`PLAYWRIGHT_SKIP_BUILD=1` so the e2e web server reuses the just-built output.
Formatting is separate (`npm run format:check` in CI) and Markdown is formatted
by hand.

---

## 2. What already exists

- Playwright e2e specs in `tests/e2e/`, run against the production static build
  on Chromium and WebKit. Coverage includes app shell isolation, codec encode
  magic bytes, alpha, quantize, resize, large images, threading, offline reload,
  editor interactions, the JPEG-to-JXL transcode, and bulk import/export flows.
  `jxl-transcode.spec.ts` is the guard for the one encode path that bypasses the
  pixel pipeline: the codec-encode suite would stay green with the whole branch
  broken, because it only ever exercises the pixel encoder.
- `export-contract.spec.ts` (2026-11-04) guards the export contract: whatever
  Save, Share, or the bulk ZIP hands out must be the result of the recipe on
  screen. It covers Save never offering the previous result under a new format's
  name, bulk showing no Rotate its export would ignore, settings changed during
  the first bulk pass leaving no job stale, removing an image mid-encode not
  stalling the batch, and the first SVG and first raster encode working offline
  with no prior online encode (Chromium only; WebKit's `setOffline` + reload is
  a harness limitation). The offline cases abort every request with
  `context.route`, because `setOffline` alone does not reach dedicated workers in
  Chromium (see [gotchas.md](gotchas.md)). Since the one-recipe model
  (2026-11-04) it also proves that rotating an image in bulk rotates its
  exported file and that a batch of SVGs gets the same vector optimization as
  one SVG.
- `worker-pipeline.spec.ts` (2026-11-04) guards the worker-side pipeline: it
  watches every message the page posts to a worker during a rotate plus
  palette encode and fails on a frame-sized buffer that is not transferred,
  with a second test proving the watcher flags a cloned frame.
- `node-pipeline.test.ts` (2026-11-04, in the unit run) bundles
  `tests/node/pipeline-worker.ts` for Node with Vite and runs the pipeline
  core in a `worker_thread` over the committed `*_node_*` codecs: JPEG decode,
  rotate, resize, grain, WebP encode, decode back. A DOM reference reaching
  `pipeline-core.ts` fails it. `pipeline-op.test.ts` covers the worker's
  source cache, `needs-source`, the transcode fallback, and the reply transfer
  list with a fake codec host.
- The e2e suite needs Playwright's Chromium headless shell installed
  (`npx playwright install chromium`); without it every Chromium test fails at
  launch.
- Vitest unit tests in `tests/unit/`, focused on pure bulk-engine/helper logic
  plus shared utility contracts. Additions on 2026-11-04: `runtime.test.ts`
  (a run requested right after a cancel restarts the drain; a job that finished
  under superseded settings is requeued, one whose settings held is not),
  `tab-presence.test.ts` (the `'app:tabs'` BroadcastChannel check behind the
  update prompt), a keep-original case in `export.test.ts` (never keep an
  original that would undo a pixel edit), and two `svg-integration.test.ts` cases
  (Auto keeps the original when no candidate passed the visual gate; a saved
  MozJPEG side loads as jpegli at the same quality). On 2026-11-10
  `editor-history.test.ts` landed (12 cases, the first test of a `.svelte.ts`
  rune module), bringing the unit run to 258 tests in 31 files.
- Added 2026-11-10 in e2e: `not-found.spec.ts` (unknown URLs, nested ones
  included, render the not-found page; `vite preview` does not model the
  host's 404 status, so that part is checked only with `wrangler dev`),
  `motion.spec.ts` (Chromium only: an
  option row's reveal animates, reduced motion removes it, and the snackbar
  animates on its first show), and a `resize.spec.ts` case pinning that
  enabling resize starts from the image's own dimensions.
- `tests/tsconfig.json` type-checks every test file and the three root config
  files (`npm run typecheck:tests`, also part of `npm run typecheck`). Its
  `include` must keep `../src/**/*.d.ts`, or the ambient app types (custom
  elements, `App` namespace) disappear from the tests' view.
- A benchmark harness (`benchmarks/`) with a fixture corpus and before/after
  comparison for codec changes.
- `npm run audit:static-output`, which checks emitted codec assets,
  service-worker asset selection, and duplicate-output hazards.

---

## 3. Remaining gaps, ranked

1. **Decoder-input matrix.** E2E mostly starts from browser-native JPEG/PNG;
   add AVIF/WebP/JXL/QOI input fixtures where WASM decode paths matter.
2. **Error paths.** Corrupt/unsupported imports, encoder throws, and bulk
   partial-failure/retry flows need automated coverage.
3. **Single-image helper extraction.** Some editor-session parsing, snapshot,
   and object-URL lifecycle logic still lives behind Svelte state and should be
   extracted before broad unit testing.
4. ~~**History units.**~~ Done 2026-11-10: `editor-history.test.ts` covers
   `EditorHistory`. (`ResultCache` gained its tests on 2026-08-08, and the SVG
   lane is covered by `tests/e2e/svg.spec.ts` and the export-contract suite.)

---

## 4. Unit-test plan (Layer 1 — the new work)

**Tooling:** **Vitest landed 2026-07-02** for the pure unit layer, with
`npm run test:unit` (`vitest run`), a `vitest.config.ts` scoped to
`tests/unit/**/*.test.ts`, and shared `fixtures.ts` fake-`File` / job / session
builders. jsdom is not used; the tests run in the default Node environment with
lightweight `File` fixtures. Since 2026-11-10 the config also loads the Svelte
plugin, so tests can import `.svelte.ts` rune modules; they compile as the
server build, where effects never run. Unit tests are in CI and `npm test`; `npm run check` remains the static gate.

**Phase 2 landed 2026-07-03:** the engine unit layer added 13 cases for
`restoreJob`, the keep-original-when-larger export option, and `relativePath`
import/export naming, bringing bulk/helper coverage from 63 to 76+ cases. The
new bulk e2e smoke (`tests/e2e/bulk.spec.ts`) covers multi-entry bulk routing,
single-image editor regression, override dot signaling, real ZIP bytes, the
keep-original toggle, and remove+Undo.

The bulk engine is **clean to test**: every function is a pure reducer
(`(session, …) => newSession`), there is **no hidden `Date.now`/`Math.random`/
`crypto`**, and the few impure leaves already inject their dependencies
(`processor.ts` injects the pipeline + `createDownloadUrl`; `urls.ts` injects
`revokeObjectURL`; import injects the MIME sniffer). So tests need almost no
mocking.

### Proposed test files (~73 cases total)

| File | ~Cases | Status | Covers (highest-value contracts) |
|---|---|---|---|
| `queue.test.ts` | ~16 | **Implemented: 10 cases** | Scheduler gate (`getRunnableJobs`) + **counter integrity** across `startJob`/`completeJob`/`failJob`/`requeue*`. Includes stale stored-counter normalization, source-dimension-aware no-op resize staleness, mixed-size 50% resize requeue, stale requeue, incomplete requeue, exported-job requeue, and queue-state math. `cancelActiveJobs` remains planned. |
| `export.test.ts` | ~14 | **Implemented: 11 cases** | `getBulkExportEntries` **duplicate-name dedup** (case-insensitive, extension-preserving), size/export/output summaries, stale-output export gate, archive/output filename derivation, marking export-plan entries exported, and (2026-11-04) never keeping an original that would undo a resize, grain, or palette edit. |
| `snapshot.test.ts` | ~10 | **Implemented: 5 cases** | `parseBulkSessionSnapshot` rejection matrix (malformed JSON, wrong version, missing settings, bad job/status/file/output) + restore **status demotion** (active/encoded/exported → queued, counters zeroed, selection fallback). |
| `import.test.ts` | ~9 | **Implemented: 5 cases** | `isSupportedBulkImage`, sync vs MIME-sniffed partition (sniffer throws → `unreadable`; non-image → `unsupported-type`), import summary, session creation, and append-to-session. |
| `settings.test.ts` | ~8 | **Implemented: 8 cases** | Deep override merging, encoder override replacement, `settingsHash` stability, disabled processor normalization, identity-resize collapse, per-job percentage-resize resolution, override detection, and override-path reporting. |
| `session.test.ts` | ~12 | **Implemented: 9 cases** | Counter normalization, unique job-ID dedup, remove/selection fallback, select-next/prev edges, global settings + overrides, `markJobsExported`, selected context, progress, and action-state selectors. |
| `output-filename.test.ts` | ~9 | **Implemented: 5 cases** | **Reserved Windows names** (`con`, `nul`, `com1`, `lpt9` → `-file`), illegal/control chars, path stripping, dotfiles, fallback names, and extension normalization. |
| `urls.test.ts` | ~5 | **Implemented: 3 cases** | Dedup collect + per-job/session revoke spy counts (leak prevention). |
| `size.test.ts` | ~4 | **Implemented: 2 cases** | `getPercentChange` shrink/growth and divide-by-zero (orig 0 → 0, not NaN). |
| `result-cache.test.ts` | ~8 | **Implemented: 5 cases** (2026-08-08) | `ResultCache` (`src/lib/result-cache.ts`, plain TS with no DOM, an ideal unit target): LRU recency on `get`, byte-budget + entry-cap eviction, **pinned keys never evicted**, `clear()` revokes every URL (spy counts), no double-insert. |
| `editor-history.test.ts` | ~8 | **Implemented: 12 cases** (2026-11-10) | `EditorHistory` (`editor-history.svelte.ts`, loaded through the Svelte plugin in `vitest.config.ts`): commit/undo/redo pointer math, signature dedup (no-op commit), redo-tail truncation on a new commit, `#limit` front-trim, `reset`/`clear`. |
| `detail/strip/summary.test.ts` | ~6 | Planned | Light composition smoke only — these are mostly selectors; **don't over-test**. |
| `changes.test.ts` | (folded) | Planned | "change a global setting → only stale jobs requeue, overrides preserved" — the core bulk promise. Partially covered through `queue.test.ts` + `settings.test.ts`, but not yet as the dedicated change reducer. |

### Top 8 highest-value targets (do these first)

1. ✅ `completeJob`/`failJob`/`startJob` — transition counter integrity.
2. ✅ `requeueStaleJobs` — "settings changed → rebuild only what's stale."
3. ✅ `parseBulkSessionSnapshot` — the only untrusted-input boundary; must never throw.
4. ✅ Restore status demotion — reload behavior.
5. ✅ `getBulkExportEntries` duplicate-name dedup — silent file overwrite risk.
6. ✅ `getBulkJobSizeSummary` + `getBulkExportSummary` — feed the whole UI dashboard.
7. ✅ `getSafeFileNameBase` — reserved names + sanitization.
8. ✅ `getRunnableJobs` + `getPercentChange` — scheduler math + the everywhere-used percentage.

### Extraction-for-testability (small refactors that unlock unit tests)

Some pure logic is currently trapped inside `.svelte`/`.svelte.ts` files behind
reactive plumbing, so it can't be unit-tested without booting the whole editor.
Extract to plain modules first (improves the code *and* enables the test):

- **High:** `editor-session.svelte.ts` helpers — `parseSavedSide`,
  `isValidProcessorState`, `snapshotProcessorStateForEncode`, `buildSide`,
  download-name logic → `editor-session-helpers.ts`. Unlocks table-testing
  malformed-localStorage and encode-snapshot logic.
- **Medium:** the WebP lossless-preset table +
  `determineLosslessQuality`/`setLosslessPreset` (`WebpOptions.svelte`) →
  `webp-lossless.ts`.
- **Medium:** `ResizeOptions` aspect-lock arithmetic →
  `computeLockedDimensions(w|h, aspect)` (a known bug class; also the template
  for crop's rect math).

---
## 5. E2E backlog

Add tests using the existing Playwright patterns:

- **Decoder-input matrix:** import `.jxl`, `.qoi`, `.avif`, and `.webp` fixtures
  as applicable, then assert dimensions and non-garbage output.
- **Unsupported/corrupt file:** assert a user-facing failure and no app crash.
- **Object-URL lifecycle:** assert eviction/clear paths revoke URLs and pinned
  displayed results survive while visible.
- **Future feature rule:** crop, Multi-Format Compare, and bulk Phase 3 should
  land with one e2e wiring smoke plus focused unit coverage under it.

---

## 6. CI state

CI now runs `check`, unit tests, format check, audit, and the full two-browser
e2e suite on every push/PR. Keep full e2e on every push unless runtime cost
becomes a real bottleneck; path-filtered e2e was considered earlier but is no
longer the current policy.

---

## 7. Cleanup notes

Keep framework-neutral engine code neutral; it is what makes the unit layer cheap
and keeps single-image and bulk behavior aligned. Optional future cleanup:
revisit stored bulk counters, extract remaining editor helpers, and unit-test
cache/history contracts before large UI changes.
