# Test strategy & plan

**Status: proposal (awaiting approval). Last updated: 2026-06-03.**

A prioritized plan to give Sqush a test safety net that protects the working
app while we add **bulk processing, crop, vector optimization, and new codecs**.
The goal is confidence that new work didn't break old work — without adding tests
nobody benefits from.

This doc is a plan. Nothing here is implemented yet except where it says
"already exists." See [README.md](README.md) for the doc registry and
[STATUS.md](STATUS.md) for live state.

---

## 1. The model: two layers, two cadences

Tests split by **cost**, and what runs when is matched to that cost.

| Layer | What it checks | Speed | Runs… |
|---|---|---|---|
| **Unit tests** (new — Vitest) | One pure function in isolation: settings merge, stale-output logic, filename safety, queue counters, resize/crop math. No browser, no real images. | milliseconds (hundreds/sec) | **Always** — every push (and locally on save if wanted). Cheap enough to never think about. |
| **E2E tests** (exist — Playwright) | The whole real app in a real browser: load page → drop image → pick format → check the output file. | seconds–minutes, needs a build + 2 engines | **Selectively** — automatically only when **codec/build files change**, plus on demand / before a release. *Never* on a docs-only change. |

**Decisions locked in (2026-06-03):**

- E2E cadence: **run automatically only when codec/build files change** (CI path
  filter). A README or UI-only push does not trigger the minutes-long codec
  suite. Unit tests still run on every push.
- This directly answers the "why do codec tests keep running when codecs change
  once every few months?" concern: after this, they don't.

**Why a unit layer at all (the core finding):** there is currently **no unit
test runner and zero unit tests** (verified: no `vitest`/`jest` in
`package.json`, no `*.test.ts` anywhere outside `node_modules`). Yet
`src/client/lazy-app/bulk/` is ~2,000 lines of pure, framework-neutral logic
that **has no UI yet** — so E2E literally cannot reach it. Unit tests are the
*only* way to verify it, and it's exactly the layer bulk/crop/compare will be
built on.

---

## 2. What already exists (and is good — do not duplicate)

- **11 Playwright E2E specs** (`tests/e2e/`), run on **Chromium + WebKit**
  against the **production** static build (`vite preview`) — so they exercise the
  real emitted WASM, the generated service worker, and the COOP/COEP headers.
  - `codec-encode` (8 encoders → correct magic bytes), `alpha` (4 encoders keep
    transparency), `quantize` + `resize` (functional: decode the output and
    verify it) + `resize-twoup-footprint` (a resized-down output keeps the
    original on-screen footprint in the compare view — guards the two-up display
    regression fixed 2026-06-28), `large-image` (12 MP no-OOM), `offline` (SW reload),
    `app-shell` (boot + cross-origin isolation), and 3 threading specs
    (`threads-support`, `oxipng-threads`, `emscripten-threads`) that prove MT
    threading actually engages, cross-engine.
- **A benchmark harness** (`benchmarks/`) with a baseline + `compare.mjs`.
- **A 9-fixture corpus** (`tests/fixtures/`) that deliberately isolates banding,
  ringing, alpha, incompressible, and text inputs.
- **The `check` gate** (`npm run check`): format + svelte-check + build + static
  output audit. Runs in CI today.

The codec + threading coverage is genuinely strong and well-reasoned (the
engine-agnostic threading signals especially). **Keep it. We are not rewriting
this — we're filling the holes around it.**

---

## 3. Gaps, ranked by what protects the roadmap

1. **No unit layer at all.** ~2,000 LOC of pure bulk logic + pure helpers
   (`output-filename`, resize math) with zero coverage. *(Highest ROI.)*
2. **E2E never runs in CI.** CI runs only `check` + `audit`. The codec safety
   net — the WebKit cross-engine guard especially — only fires when someone
   remembers to run it locally.
3. **The WASM *decoders* are untested.** Every E2E feeds a JPEG/PNG (browser-
   native). The `avif`/`jxl`/`qoi`/`webp` *decode* workers only run when you
   **import** such a file — and no test ever does. A decoder rebuild can break
   input decoding with every test still green. (`codec-encode` guards encode;
   nothing guards decode.)
4. **SVG / vector path untested** — `processSvg` + the SVG decode branch exist
   and SVG is an accepted input; planned vector optimization will need coverage
   and there isn't even a baseline.
5. **Single-image editor logic untested beyond the happy path** — localStorage
   save/restore parsing, encode-snapshot/untrack logic, object-URL lifecycle,
   abort-on-rapid-format-switch. The roadmap's "preserve single-image workflow
   before adding modes" principle has no automated guard.
6. **Error/failure paths untested** — corrupt/unsupported file → graceful error;
   encoder throw; bulk partial-batch failure + retry.

---

## 4. Unit-test plan (Layer 1 — the new work)

**Tooling:** add **Vitest** (integrates natively with the existing Vite config;
fast, ESM-native, jsdom available for the few helpers that touch `File`). Add
`npm run test:unit` and fold it into `npm run check` (or a new `test:fast`) so it
runs in CI on every push. A shared `fixtures.ts` (fake `File` + job/session
builders) makes most cases one-liners.

The bulk engine is **clean to test**: every function is a pure reducer
(`(session, …) => newSession`), there is **no hidden `Date.now`/`Math.random`/
`crypto`**, and the few impure leaves already inject their dependencies
(`processor.ts` injects the pipeline + `createDownloadUrl`; `urls.ts` injects
`revokeObjectURL`; import injects the MIME sniffer). So tests need almost no
mocking.

### Proposed test files (~73 cases total)

| File | ~Cases | Covers (highest-value contracts) |
|---|---|---|
| `queue.test.ts` | ~16 | Scheduler gate (`getRunnableJobs`) + **counter integrity** across `startJob`/`completeJob`/`failJob`/`requeue*`/`cancelActiveJobs`. Where silent active-count drift would live. |
| `export.test.ts` | ~14 | `getBulkExportEntries` **duplicate-name dedup** (case-insensitive, extension-preserving), size/export summaries, stale-output export gate, filename derivation. |
| `snapshot.test.ts` | ~10 | `parseBulkSessionSnapshot` rejection matrix (malformed JSON, wrong version, partial/bad job) + restore **status demotion** (active/encoded/exported → queued, counters zeroed, selection fallback). |
| `import.test.ts` | ~9 | `isSupportedBulkImage`, sync vs MIME-sniffed partition (sniffer throws → `unreadable`; non-image → `unsupported-type`), import summary. |
| `settings.test.ts` | ~8 | `mergeDeep` override merging, `settingsHash` stability (this decides what's stale → what reprocesses), override-path detection. |
| `session.test.ts` | ~12 | Counter normalization, unique job-ID dedup, `markJobsExported` stale guard, select-next/prev edges, add/remove. |
| `output-filename.test.ts` | ~9 | **Reserved Windows names** (`con`, `nul`, `com1` → `-file`), illegal/control chars, dotfiles, path stripping. Cross-OS download safety. |
| `urls.test.ts` | ~5 | Dedup collect + revoke spy counts (leak prevention). |
| `size.test.ts` | ~4 | `getPercentChange` incl. divide-by-zero (orig 0 → 0, not NaN). |
| `detail/strip/summary.test.ts` | ~6 | Light composition smoke only — these are mostly selectors; **don't over-test**. |
| `changes.test.ts` | (folded) | "change a global setting → only stale jobs requeue, overrides preserved" — the core bulk promise. |

### Top 8 highest-value targets (do these first)

1. `completeJob`/`failJob`/`startJob` — transition counter integrity.
2. `requeueStaleJobs` — "settings changed → rebuild only what's stale."
3. `parseBulkSessionSnapshot` — the only untrusted-input boundary; must never throw.
4. Restore status demotion — reload behavior.
5. `getBulkExportEntries` duplicate-name dedup — silent file overwrite risk.
6. `getBulkJobSizeSummary` + `getBulkExportSummary` — feed the whole UI dashboard.
7. `getSafeFileNameBase` — reserved names + sanitization.
8. `getRunnableJobs` + `getPercentChange` — scheduler math + the everywhere-used percentage.

### Extraction-for-testability (small refactors that unlock unit tests)

Some pure logic is currently trapped inside `.svelte`/`.svelte.ts` files behind
reactive plumbing, so it can't be unit-tested without booting the whole editor.
Extract to plain modules first (improves the code *and* enables the test):

- **High:** `editor-session.svelte.ts` helpers — `parseSavedSide`,
  `isValidProcessorState`, `snapshotProcessorStateForEncode`, `buildSide`,
  download-name logic → `editor-session-helpers.ts`. Unlocks table-testing
  malformed-localStorage and encode-snapshot logic.
- **Medium:** `prettySize` (`Results.svelte`) → `pretty-bytes.ts` (parity-
  sensitive byte formatting); the WebP lossless-preset table +
  `determineLosslessQuality`/`setLosslessPreset` (`WebpOptions.svelte`) →
  `webp-lossless.ts`.
- **Medium:** `ResizeOptions` aspect-lock arithmetic →
  `computeLockedDimensions(w|h, aspect)` (a known bug class; also the template
  for crop's rect math).

---

## 5. E2E plan (Layer 2 — fill the holes in the existing suite)

Add, reusing the existing patterns (the `resize.spec.ts` decode-the-output
template is the gold standard):

- **Decoder-input matrix (High).** Import a `.jxl` and `.qoi` fixture (always
  WASM-decoded) and an `.avif`/`.webp` where applicable → assert it decodes to
  the right dimensions and isn't garbage. Closes gap #3 — protects decoder
  rebuilds. *(Needs 2–3 new fixtures in those formats.)*
- **SVG import smoke (Medium).** Import an SVG → rasterizes → encodes. Baseline
  for the planned vector work. (Note the Safari `img.decode` SVG quirk already
  handled in `image-decode.ts`.)
- **Unsupported/corrupt file → graceful error (Medium).** Feed a non-image →
  assert a user-facing error/snackbar, no crash.
- **Object-URL lifecycle regression (Medium).** Assert replacing a side's
  result / clearing / aborting revokes the previous blob URL (the host-object
  mitigation is correct but silently breakable).

### Templates for features as they land (write the test *with* the feature)

- **Crop** → mirror `resize.spec.ts`: set a crop rect → assert exact output
  dimensions + non-garbage. Plus a unit test for the crop-rect math.
- **Bulk UI** → import 2 files → 2 strip items → ≥1 output generated → change a
  global setting → outputs go stale/reprocess → override one image → only that
  one shows override state. (The unit layer already covers the engine beneath
  this; the E2E just covers the wiring.)
- **Multi-Format Compare** → import one image → parallel encodes across formats
  → comparison table populated; bound concurrency to `hardwareConcurrency`.

---

## 6. CI changes

- **Unit tests → run on every push** (cheap; add to the existing `check` job or
  a parallel fast job).
- **E2E → path-filtered:** a separate job that runs `test:e2e` automatically
  **only when codec/build-relevant files change** (e.g. `src/features/**`,
  `codecs/**`, `vite.config.ts`, `svelte.config.js`, `scripts/**`,
  `tests/e2e/**`, `package-lock.json`). Otherwise skipped.
- **On-demand:** keep `npm run test:e2e` runnable by hand any time; consider a
  manual-dispatch / pre-release trigger for the full 2-engine run.
- Keep `npm run audit` + `npm run check` as-is.

---

## 7. Cleanup track (we're here to clean up too)

From the Svelte-5 idiom review — the code is in **good shape** (no Svelte 4
holdovers, runes used correctly, the host-object-in-`$state` risk is already
mitigated by `$state.raw` + array reassignment + manual URL revocation). The
framework-neutral layer **earns its keep** and should stay neutral (it's what
lets the engine be unit-tested DOM-free and shared by single + bulk). Findings:

- **Keep framework-neutral, don't rewrite as runes.** One honest exception worth
  a *future* internal refactor (not a rune migration): the bulk session counters
  (`activeJobs`/`exportedCount`) are stored and defensively re-normalized in
  nearly every reducer. **Derive them from `jobs` on read** (drop the stored
  fields) — kills the manual delta-accounting drift class *and* keeps the layer
  neutral *and* simplifies the queue tests. Medium value.
- **Remove dead code:** `JxlOptions.svelte` unused `showAdvanced = $state(false)`;
  the `zx` field on `QuantizeOptionsState` (`processor-types.ts`) — dead UI
  superset field (the ZX easter-egg is intentionally omitted in the panel).
- **Low/keep (document, don't change):** the two option-panel idioms
  (in-place-bind vs snapshot-then-`apply()` for AVIF/JXL) are both valid; the
  `{#key options}` remount is the reason. Worth a clarifying comment, not a
  refactor.

These are optional and independent of the test work; sequence per §9.

---

## 8. Documentation fixes (verified — apply with care)

A doc-accuracy audit found claims that assert tests exist when they don't. These
are the **live-doc** corrections (line numbers verified; `docs/history/**` is a
frozen archive and its prototype-era "tested helper" references are left as-is):

| File:line | Problem | Fix |
|---|---|---|
| `docs/bulk-image-architecture.md:335` | **FALSE:** "processor orchestration … is covered with injected-pipeline tests." No such tests exist. | Reword to "designed to be covered by injected-pipeline tests (planned — see test-plan.md)." |
| `docs/manual-qa.md:88` | **FALSE (stale, inverse):** "The repo does not currently ship a Playwright dependency." It does, and the suite exists. | Update to reflect the shipped Playwright suite. |
| `docs/README.md:29` | **MISLEADING:** "17-test Playwright e2e suite." Actual = 10 spec files / **21 `test()` cases per engine** (8 codec-encode + 4 alpha + 2 emscripten-threads + 7 single-case). | Recount and reword (or say "the Playwright e2e suite" without a brittle number). |
| `AGENTS.md:43` | **MISLEADING:** "Run focused tests for pure helper changes" — implies a unit runner that doesn't exist (yet). | Clarify; revisit once Vitest lands (then it becomes true). |

Aspirational statements that describe planned tests (`bulk-image-architecture.md`
lines 143, 355, 362; `codec-options-model.md:49`; `road-map.md:201`) are fine —
leave as plans.

After this plan is approved/executed, update per the doc-hygiene rule:
README.md (registry + status), STATUS.md, manual-qa.md, and
bulk-image-architecture.md's test-plan section.

---

## 9. Suggested sequencing

1. **Phase 0 — tooling:** add Vitest + `test:unit` + a `fixtures.ts`. Wire into
   CI (unit always). *(Small, unblocks everything.)*
2. **Phase 1 — highest-value unit tests:** queue, export, snapshot, settings,
   session, output-filename, size, urls (§4 top-8 first). *(The big safety net.)*
3. **Phase 2 — extraction-for-testability** (§4) + the editor-session/helpers
   tests + object-URL lifecycle tests.
4. **Phase 3 — E2E gaps:** decoder-input matrix (+ fixtures), SVG smoke,
   error-path; add the path-filtered E2E CI job.
5. **Phase 4 — doc fixes** (§8) + optional cleanup (§7).
6. **Ongoing:** crop / bulk-UI / compare each ship *with* their test (§5
   templates).

Phases 1–2 are the core ask ("don't break what works"). Phases 4–5 are cheap.

---

## 10. Open decisions

- Fold `test:unit` into `npm run check`, or keep it a separate always-on CI job?
- Which decoder-input fixtures to add (need real `.jxl` / `.qoi` / `.avif`
  samples — generate vs. encode-then-reuse from the existing corpus)?
- Do the counter-derivation refactor (§7) before or after the queue tests?
  (Before = simpler tests; after = tests prove the refactor is safe.)
- Effort cap for the first pass: just Phases 0–1, or through Phase 3?
