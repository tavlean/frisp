# Worklog

Short session-by-session build log: what changed, why, and the gotchas a future
session must know. Newest first. (Live project state stays in
[the project brief](brief.md); this is the narrative trail.)

## 2026-11-09 (Opus, executor) - Auto quality scores large images on full-size tiles

- `142556ed`: above 4 MP, SSIMULACRA2 now scores four full-resolution tiles,
  one centred in each quadrant, and the worst tile counts (`scorePairs` in
  `src/worker/score-scale.ts`; `scoreFrames` in `codec-worker.ts` keeps the
  minimum). The tiles hold as many pixels as the old 2048 px shrunk pair, so
  a probe costs the same. Frames too thin for 64 px tiles fall back to the
  shrunk pair.
- Why: the 2026-11-04 open question was right and understated. Scoring the
  12 MP photo four ways in Node, the shrunk pair overrated by 8 to 20 points
  (JPEG 24: 70.4 shrunk vs 55.3 full size; WebP 37: 70.0 vs 50.0), and the
  JPEG at 24 that Auto chose showed block ringing at 100%. The worst tile
  tracks full size within 1.6 points on JPEG and errs strict on WebP. A
  centre crop judged only the middle; a mosaic of the tiles pooled toward
  their average. Table in the spec.
- Measured on photo-large.jpg (12 MP), Balanced, Chromium / WebKit: WebP
  82 / 83 (was 37 to 38), JPEG 53 / 53 (was 23 to 24), JPEG XL stopped at
  the budget at 76 / 65. AVIF encodes too slowly to narrow the search in
  20 s, so it now commits nothing and says so, where before it kept 49 on a
  score the shrunk pair had inflated.
- Gotchas (in `docs/gotchas.md`): never judge codec artifacts on a shrunk
  frame; when one score covers several regions, keep the worst region, not
  an average.
- Gates: `npm run check` exit 0, 246 unit tests, `auto-quality.spec.ts` and
  the scorer e2e 30 of 30 in Chromium and WebKit.

## 2026-11-04 (Opus, executor) - Auto quality on AVIF, JPEG XL, and JPEG

- `c1274a2a`: the Auto row moved out of `WebpOptions.svelte` into a shared
  `AutoQualityRow.svelte`, now also under the Quality slider of AVIF, JPEG
  XL, and JPEG. `AUTO_QUALITY_BOUNDS` gained `avif` 0 to 99, `jxl` 7 to 99,
  and `jpegli` 0 to 100. The session code needed no change: it was already
  generic over the bounds table.
- Why JXL starts at 7: the panel's `apply()` forces `lossyModular` below
  quality 7, but the probe substitutes `quality` alone, so a probe at 5 would
  score a VarDCT encode the slider can never produce. Quality 7 is distance
  13.2, far below any target, so nothing is lost.
- The JXL row is hidden while the lossless transcode runs; the worker
  refuses to score a transcode, and there is no quality to choose.
- Measured on photo.jpg, Balanced (Chromium / WebKit): AVIF 57 / 57 in
  3.9 s, JPEG XL 63 / 64 in 2.9 to 3.9 s, JPEG 54 / 55 in 1.9 s.
- Measured on photo-large.jpg (12 MP), Balanced, Chromium, one cold run:
  AVIF stopped at the budget after 25 s with quality 49 (score 72.7), JPEG XL
  stopped after 22 s with quality 30 (75.3), JPEG met it at quality 24 (70.4)
  in 11 s (WebKit: 49, 24, 23). AVIF and JXL encodes at 12 MP take several seconds each, so the
  budget ends the search with a passing but loose result, as designed. JPEG
  24 is suspiciously low: the score runs on a 2x box-shrunk pair above 4 MP,
  which halves JPEG's 8x8 blocking before the metric sees it. Logged as an
  open question in the spec.
- Gates: `npm run check` exit 0, 240 unit tests, `auto-quality.spec.ts` 20
  of 20 in Chromium and WebKit.

## 2026-11-04 (Opus, executor) - Auto quality for WebP (review change D, first codec)

Branch `feat/auto-quality`, in three phases:

- `d258b31e`: `codecs/ssimulacra2/`, built natively with emsdk 3.1.0 from
  cloudinary/ssimulacra2 `81feacf6`, Highway 1.0.2, and lcms2 2.16 (the
  metric's libjxl slice needs lcms2 for colour management). One export,
  `score(ref, dist, w, h)` on RGBA8; alpha is judged on dark and bright
  backgrounds and the worse score counts.
- `aab29fa3`, `4fe62570`: wired through the add-a-codec touch list
  (precached everywhere, so Auto works offline), a worker op, provenance
  pins, and build notes. `tests/e2e/ssimulacra2.spec.ts` drives the built
  worker over Comlink's message protocol, with no hook in the app.
- `ab01c135`: `src/lib/editor/auto-quality.ts` (`searchQuality`: ceiling
  probe plus at most 7 bisection steps, at most 8 encodes), `autoQuality`
  on `EditorSession`, and the Auto row in `WebpOptions.svelte`. The winning
  probe goes into the ResultCache under the key encodeSide computes, so the
  final display is a cache hit.
- After merging change B: scoring moved into the worker. `OptimizeRequest`
  gained `score`; the `optimize` op runs `processFrame` (split out of
  `encodeFrame`), encodes, decodes once, and scores against the processed
  frame, with that decode doubling as the preview.
- The 12 MP fix: the full-size metric cost about 3 s per probe at 12 MP
  (more than the 0.9 to 1.4 s WebP encode), so an 8 s budget fit two probes
  and committed quality 100. Now scoring runs on a box-shrunk pair above
  4 MP (`src/worker/score-scale.ts`, long edge at most 2048 px), the budget is
  8 s plus 1 s per megapixel above 2 (capped at 20 s), and a budget stop with
  nothing passing below 100 commits nothing.

Measured on Balanced (e2e logs): photo.jpg meets the target at quality 74 in
about 2 s in Chromium and WebKit; photo-large.jpg meets it at 37 (Chromium,
15.0 s) and 38 (WebKit, 13.4 s); transparent.png on High at 24 in 1.3 s.

Gotchas: see docs/gotchas.md (Playwright and native selects inside labels;
the `select.builtin-select` convention; the metric's cost at 12 MP).

## 2026-11-04 (Opus, executor) - the worker-side pipeline (review change B)

Wrote [specs/2026-11-04-worker-side-pipeline.md](specs/2026-11-04-worker-side-pipeline.md)
(`45f84244`), then executed it in seven commits:

- `0233c3a2`: `src/client/lazy-app/pipeline-core.ts` holds the pixel step
  order once (`prepareFrame`, `encodeFrame`), `lane.ts` the lane choice. The
  WASM resize's contain-fit `crop` stopped rewriting its input buffer, a bug
  that was harmless only while every step got its own clone.
- `2f4a726c`: `src/worker/pipeline-op.ts` gives the codec worker `optimize`,
  `prepare`, and `decodeOutput`: decode in the worker, one hot source per
  worker, the transcode decided there once the size is known, every reply
  buffer transferred. Tested with a fake codec host.
- `27f551a7`: `optimizeImage` is one worker call. The editor stops decoding
  on the main thread (a third bridge serves the Original side and the grain
  preview), bulk stops decoding entirely, and `CompressOutcome` loses the
  never-rendered `sourceImageData`.
- `30f28b9a`: bulk sizes each slot's OxiPNG pool at half the cores.
- `e09cefae`: the Node proof. `tests/unit/node-pipeline.test.ts` bundles
  `tests/node/pipeline-worker.ts` with Vite and runs JPEG decode, rotate,
  resize, grain, and WebP encode in a `worker_thread` over the `*_node_*`
  codecs.
- `f01aac28`: `tests/e2e/worker-pipeline.spec.ts` patches
  `Worker.prototype.postMessage` and fails on any frame-sized buffer posted
  without a transfer, plus a self-check that the watcher flags one.
- `e86298cb`: 1,857 lines of the replaced chain deleted (per-codec bridge and
  worker methods, `compressPreprocessed`, the `compressImage` switch, the
  encoder client runtimes, the engine-level bulk runner, and the
  `/diagnostics` WebP pipeline probe).

Bench (`b0398272`, baseline re-captured): every size byte-identical to the
before run at `b437df36`; times within the usual noise (photo WebP 195 to
201 ms, photo-large AVIF 8,218 to 8,145 ms, photo-large jpegli 596 to 765 ms
on its single cold run). The bench cannot show the win: it encodes at
defaults with no processor steps, and its timed side now decodes the source
in its own worker where it used to reuse the main thread's decode.

Gates on `e86298cb`: `npm run check` 0 errors (57 `corner-shape` warnings),
214 unit tests, full e2e 112 passed and 4 skipped in Chromium and WebKit.

Gotchas (in [../gotchas.md](../gotchas.md)): a codec-worker step must never
write to its input; spreading a request drops Comlink's transfer marker;
aborting an encode drops the worker's source cache; the older Node codec
artifacts need `wasmBinary` plus a `require` and `__dirname` shim.

## 2026-11-04 (Opus, executor) - one recipe per image (review change A)

Executed [specs/2026-11-04-one-recipe-per-image.md](specs/2026-11-04-one-recipe-per-image.md)
in five commits, each reviewed by the driver before it landed.

- `bb934039`: `src/client/lazy-app/recipe.ts` defines `ImageRecipe` and the
  one `recipeSignature`; the editor's encode signature, its undo dedupe, and
  bulk's output hash all build on it. A temporary harness compared old and new
  signatures over 1,440 editor states and 288 bulk states: bulk groups
  identically, and the editor differs only in the three intended ways (an
  enabled resize counts when the size is unknown, a disabled palette folds,
  SVG output ignores rotation).
- `71cb2a7c`: `src/lib/optimize-image.ts` is the single dispatch for the SVG
  lane, the JPEG to JXL transcode, and the pixel encode; `encodeSide` calls it.
  `preview: false` skips the output decode for bulk.
- `581029ea`: bulk stores a shared recipe plus optional full own copies
  (`ownRecipe`); the sparse overrides, `DeepPartial`, and the control registry
  are deleted. The runtime runs `optimizeImage`, so SVGs in a batch stay
  vector. Image-scope edits are sent as changes, so a multi-selection keeps
  its other differences.
- `4a848c00`: the hydration bridge in `BulkMode.svelte` is gone (497 to 242
  lines). The focus view loads the job and its recipe into `EditorSession`,
  and `adoptResult` offers a current bulk output as an in-flight pass under
  the encode effect's own key, so the editor lands on it instead of encoding
  again (a 12 MP photo shows in about 0.3 s against 1.3 s for its encode).
  Rotate is back in bulk as a per-image edit; the global panel shows SVG
  options for an all-SVG batch. The two `fixme` tests in
  `export-contract.spec.ts` now pass, plus a mixed PNG and SVG batch and a
  rotate-then-Reset test.

Gates on the last commit: `npm run check` 0 errors (57 `corner-shape`
warnings), 198 unit tests, full e2e 108 passed and 4 skipped (WebKit offline)
in Chromium and WebKit. The lab skins load and encode in `npm run dev`.

Gotchas (in [../gotchas.md](../gotchas.md)):

- `ResultCache` revokes entry URLs on evict and clear, so anything adopted
  into it needs a URL the cache owns.
- `page.setInputFiles` cannot mix paths and buffers.
- A long-running `vite preview` serves a stale manifest after a rebuild.
- In a minified build, check bundle membership against a baseline build, not
  by identifier names.
- Once the bulk runtime awaits a decode first, test mocks must reject on an
  already-aborted signal.

Found and logged, not fixed: bulk strip thumbnails for SVG sources are blank
(`createImageBitmap` cannot decode an SVG blob); see
[issue-list.md](issue-list.md).

## 2026-11-04 (Opus, driver) - export-contract trust fixes and low-risk cuts

Executed the first stage of
[reports/2026-11-02-first-principles-review.md](reports/2026-11-02-first-principles-review.md)
after the maintainer's go-ahead (keep the lab skins and the desktop
direction; jpegli is the one JPEG; proceed with the rest). Every bug was
reproduced before its fix, in a real browser where the behavior is visible,
and each fix is its own commit; the execution table in the report maps items
to commits. The new regression home is `tests/e2e/export-contract.spec.ts`.

**The offline finding was bigger than the review thought.** The review said
the first SVG optimized offline would fail. The truth: no first offline
encode worked at all, raster or SVG. SvelteKit's `$service-worker` `build`
list omits the worker chunks Vite emits for `new Worker(new URL(...))`, so the
WASM was precached and nothing could load it. It hid because Playwright's
`context.setOffline(true)` does not cut dedicated workers' network in
Chromium: the worker fetched over the network and the old offline tests
passed. Only aborting every request with `context.route` exposed it. A build
plugin now writes `_app/worker-precache.json`, the service worker precaches
it, and the audit fails if the list and the emitted workers disagree. The
"SVG worker precache exclusion" it replaced never matched anything.

**Two bulk races, both in the runtime latch.** A job in flight when the
settings changed finished under the old recipe and nothing requeued it
(3 of 3 with a 12 MP photo); `#processOne` now rechecks each completion
against the live recipe. And `cancelProcessing()` left `#running` set while
the aborted loop unwound, so the run the store requested right after a
removal was flagged and then dropped (1 of 3 in WebKit). Only the current
run may clear the latch now.

**Corrections to the review.** The AVIF and WebP WASM decoders were already
skipped on browsers with native decode, and hqx is a selectable resize method,
so neither was cut. The SVG-batch gap (two SVGs rasterize to WebP, one stays
vector) is consistent between preview and export, so it waits for change A
instead of a parallel fix.

**Not done here:** change A (one recipe), B (worker-side pipeline), C (bulk
budget), D (auto-quality), and the MozJPEG/QOI-encoder codec retirement. The
bench baseline needs a re-capture for the WebP rows after the method change.

**Gotchas** (recorded in [../gotchas.md](../gotchas.md)): `setOffline` and
dedicated workers; the omitted worker chunks; a `?worker&url` import in a
production-imported module ships that worker; unquoted zsh globs in `grep
--include` match nothing; changed codec defaults do not reach autosaved
settings; the Playwright Chromium shell must be installed or every Chromium
test fails at launch; the "Compare as" count in `left-panel.spec.ts`.

## 2026-08-11 (Opus, executor) - lossless JPEG to JXL transcode

Executed
[specs/2026-07-11-jpeg-to-jxl-transcode.md](specs/2026-07-11-jpeg-to-jxl-transcode.md).
Load a JPEG, pick JPEG XL, tick **Lossless transcode**, and libjxl repacks the
source's existing DCT coefficients instead of re-encoding pixels. No quality
decision, no generation loss, and the output carries the record that rebuilds the
original `.jpg` byte for byte. Same libjxl v0.12.0, no build-system change: the
wrapper gained a second entrypoint, `transcodeJPEG` beside `encode`, worth
`+38868` bytes on the encoder wasm.

**The reversibility check, which is the whole point of the feature.** The app's
own output, transcoded in Chromium and saved to disk, reconstructed and compared:

```
djxl photo-transcoded.jxl back.jpg     → "Reconstructed to JPEG."
cmp tests/fixtures/photo.jpg back.jpg  → identical
sha256                                 → 784b5dfc… on both
```

`tests/fixtures/photo.jpg` 84947 bytes → 74604 bytes, **12.2% smaller**. Homebrew
`cjxl` (v0.11.2) transcodes the same file to 74576, a 0.04% gap that says the
wasm wrapper is faithful to upstream. The advertised ~20% shows up at camera
size: `photo-large.jpg` goes 661605 → 529848, **19.9%**. Quote the headline for
photos, not for thumbnails.

**This is the first feature that changes the pipeline's shape rather than its
settings.** Every other encode runs decode → preprocess → resize → encode on
pixels; this one needs the file bytes, so it gets its own wasm entrypoint, its
own worker op (`jxlTranscode`), and a branch in `encodeSide`. Three consequences
worth knowing:

- **The flag lives in the JXL options object** (`jpegTranscode`, default false),
  not in UI state, so it flows into the encode signature for free. That is what
  stops a transcode result and a pixel result colliding in the result cache. It
  also means the signature changed, so the first run after this lands recomputes
  every JXL entry once. `app:settings:v3` is unaffected: an additive field on a
  `Record<string, unknown>` is exactly what `sanitizeSavedOptions` already
  handles, and `settings.test.ts` passes untouched.
- **The engine re-checks the preconditions itself** rather than trusting the UI.
  Rotate, a real resize, film grain or reduce-palette all make coefficient reuse
  dishonest, so `preprocessingIsNeutral` folds them the same way the encode
  signature does (resize enabled at 100% stays neutral in both).
- **`createJxlEncoderRuntime` now returns two operations instead of one
  function**, the only runtime in `codec-worker.ts` shaped that way. It shares
  the loaded module: instantiating the encoder twice in one worker would cost a
  second 2.5 MB of wasm for an entrypoint already inside the first copy.

**Four gotchas that would each have cost a session**, written up as 20 to 26 in
[../codec-build-notes.md](../codec-build-notes.md) §libjxl. The dangerous one:
`JxlEncoderStoreJPEGMetadata` must be called *before* `JxlEncoderAddJPEGFrame`,
because that is where libjxl reads it. Call it after and nothing errors, the
output decodes to the right pixels, every test stays green, and the file is
quietly no longer reversible. Only a round-trip catches it. The other three: the
pixel path's `BUFFERING` and `RESAMPLING` pins must NOT be copied onto the
transcode settings (`CanDoStreamingEncoding` returns false for JPEG frames
outright, so the streaming default cannot fire); the libjxl checkout is
gitignored, so the copy in the main worktree was still v0.8.5 while the Makefile
said v0.12.0, and the Makefile silently reuses a stale tree; and Homebrew's
`djxl` dropped `--reconstruct_jpeg` in favour of inferring it from a `.jpg`
output extension.

**Gates.** check 0 errors / 57 known corner-shape warnings; unit 156 (155 + one
new for the unsupported-JPEG branch); e2e 94 passed + the 2 known WebKit offline
skips (90 + two new specs across both browsers); `bench:compare` +0.0% on every
codec and every fixture, JXL included, which is the point: this is a new path,
not a changed encode.

**Deliberately not done**, all per the spec: no bulk-mode transcode, no
JXL-to-JPEG reconstruction UI in the app, no auto-enable for JPEG sources, and no
keep-the-smaller-one guard.

## 2026-08-09 (Opus, executor) - jpegli lands as a second JPEG encoder

Executed [specs/2026-07-11-jpegli-codec.md](specs/2026-07-11-jpegli-codec.md).
`codecs/jpegli/` is a new encode-only single-variant WASM codec built from
`google/jpegli` commit `031a0077f5799a6041004267fc12b956c1f52a20` (BSD-3-Clause;
upstream has no release tags, so the pin is a commit). It ships as
**JPEG (jpegli)** beside the existing MozJPEG-backed **JPEG** entry, with three
options: quality, progressive, chroma subsampling. MozJPEG is untouched, still
the default JPEG, and byte-identical on every bench fixture.

**The build was one clean pass**, which is worth saying out loud after the libjxl
week. The nine things that would otherwise have cost time are gotchas 1 to 9 in
[../codec-build-notes.md](../codec-build-notes.md) §jpegli. The two that matter
most: the libjpeg62 ABI shim that would give you `jpeg_*` names is explicitly
skipped on Emscripten, so the wrapper calls `jpegli_*` directly; and
`JPEGLI_ENABLE_WASM_THREADS` defaults ON and would have put `-pthread` on every
translation unit of a codec that ships no threaded artifact.

**Quality goes through `jpegli_set_distance`, not `jpegli_set_quality`.** The
latter exists and compiles, and it silently scales the standard Annex K
quantization tables instead of jpegli's tuned ones, which throws away the entire
reason to use this codec. The wrapper takes the `cjpegli -q` path:
`jpegli_set_distance(jpegli_quality_to_distance(q))`. Slider 75 lands at
butteraugli distance 2.35 and slider 0 at exactly 25.0, the API's documented
ceiling, so the whole range is reachable without a clamp. Both endpoints were
verified encoding real JPEGs (quality 0 → 14633 bytes, quality 100 → 165068).

**One deliberate divergence from the mozjpeg template**: jpegli's default error
handler calls `exit()`, which under Emscripten kills the codec worker for the
rest of the session rather than failing one encode. The wrapper installs a
`setjmp`/`longjmp` handler (the pattern in jpegli's own
`lib/extras/enc/jpegli.cc`) and returns `val::null()`, which the worker runtime
turns back into a rejection. Costs 4622 bytes of artifact; the encode path is
unaffected, confirmed by every bench fixture producing identical bytes before and
after the change.

### The datapoint the default-JPEG decision needs, and how to read it

Both encoders at their shipped defaults, which are both labelled quality 75:

| Fixture | MozJPEG | jpegli | Δ bytes | MozJPEG ms | jpegli ms |
|---|---|---|---|---|---|
| photo | 74780 | 69804 | **−6.7%** | 219 | **153** |
| photo-large | 583978 | 540531 | **−7.4%** | 2218 | **1337** |
| illustration | 6778 | 7974 | +17.6% | 130 | 121 |
| transparent | 6569 | 7842 | +19.4% | 136 | 129 |
| gradient | 5978 | 6477 | +8.3% | 131 | 129 |
| gradient-dithered | 5969 | 6486 | +8.7% | 137 | 121 |
| hard-edges | 61927 | 91673 | +48.0% | 185 | 128 |
| noise-synthetic | 123822 | 139900 | +13.0% | 275 | 138 |
| screenshot | 32782 | 37496 | +14.4% | 209 | 169 |

**This is not an equal-quality comparison and must not be read as one.** The two
encoders run different quality scales that happen to share the number 75:
MozJPEG's is libjpeg's, jpegli's maps to a butteraugli distance. All the table
establishes is that the two default sliders are not calibrated against each
other, plus one thing that is scale-independent: **jpegli is faster on every
fixture**, by 30% on photographs and 40 to 50% on the large and noisy ones.

Deciding whether jpegli should own the `JPEG` menu entry needs the same treatment
the libjxl retune got: a distance ladder per fixture scored with SSIMULACRA2, and
bytes compared at equal delivered quality rather than at equal slider position.
Until that exists, the honest read of the shape above is that jpegli's default is
simply a *higher* quality target than MozJPEG's on synthetic content, not that it
compresses worse. Photographs, where it is both smaller and faster at a nominally
equal setting, are the encouraging signal.

Gates: `npm run check` 0 errors / 57 known `corner-shape` warnings, unit 155/155,
full e2e green in Chromium and WebKit (90 passed, the 2 usual WebKit offline
skips), `bench:compare` clean with every pre-existing codec at exactly +0.0% and
jpegli reported as a new row.

**Gotcha found, now in [../gotchas.md](../gotchas.md):** adding an output format
breaks `tests/e2e/left-panel.spec.ts`, which hard-codes `OUTPUT_FORMATS.length`
as the expected `.compare-option` count. `check` and the unit tests both stay
green, so it surfaces only in a full e2e run, in a spec that has nothing to do
with codecs.

## 2026-08-08 (Opus, executor) - libjxl v0.8.5 to v0.12.0, and the question it raises

Executed [specs/2026-07-11-libjxl-0-12-upgrade.md](specs/2026-07-11-libjxl-0-12-upgrade.md).
`codecs/jxl/enc/jxl_enc.cpp` is rewritten from libjxl's internal C++ API onto the
public `JxlEncoder*` C API, which is what v0.9.0 forced when it deleted
`enc_file.h` and `enc_color_management.h`. The app-facing contract is untouched:
same eight `JXLOptions` fields, same embind signature, same six artifacts. The
wall that stopped both Squoosh and jSquash at this exact pin is now behind us,
and the next libjxl bump is a one-line `CODEC_VERSION` change.

**The rewrite was the easy half.** The build had drifted underneath it: the
static CMake targets lost their `-static` suffix, colour management moved into a
new `libjxl_cms.a` that also swallowed skcms (which deletes the Makefile's
hand-rolled `emcc` + `llvm-ar` skcms step), and brotli's archives lost their
`-static` suffix too. All of it, plus the wrapper-level traps, is written up as
gotchas 7 to 15 in [../codec-build-notes.md](../codec-build-notes.md).

**Two things the spec could not have known.** v0.11 added a streaming encode
mode and turns it on by default for any frame over 8 groups, trading compression
for peak memory; on the 1280x800 screenshot fixture that alone cost 28702 bytes
against 14064. The wrapper pins `JXL_ENC_FRAME_SETTING_BUFFERING = 0` to keep the
whole-image behaviour v0.8.5 had. And `JxlEncoderSetFrameDistance` refuses
distances above 25, which the ported quality curve exceeds below quality 5, so
the curve is clamped rather than left to fail the encode.

**The open question, and why this is not finished.** Even with streaming off,
v0.12.0 spends more bits than v0.8.5 for the same butteraugli distance: 8 of 9
bench fixtures grew, from +3.0% on hard-edges to +70.1% on noise-synthetic, with
only `transparent` improving at -17.9%. This is upstream behaviour, confirmed by
building `cjxl` natively from the same v0.12.0 checkout and encoding the identical
pixels (6354 bytes against the wasm wrapper's 6351 at `-d 2.35 -e 7`). The extra
bytes buy real fidelity: illustration at quality 75 goes from 41.88 dB to 43.11 dB
PSNR. So the same slider position now means a better, larger file, and **whether
to retune the quality→distance mapping is a product call that has to happen before
this ships.** The mapping was deliberately left alone so the delta is attributable
to the library and nothing else.

Gates: `npm run check` 0 errors / 57 known warnings, unit 149/149, full e2e green
in Chromium and WebKit (88 passed, the 2 usual WebKit offline skips), JXL threading
engaging with the full worker pool in both. Every non-JXL codec is byte-identical.

**Benchmark methodology gotcha, now in [../gotchas.md](../gotchas.md):**
`benchmarks/baseline.json` is stale for WebP and AVIF *sizes*, not only for
timing. Comparing against it made this change look like it had regressed WebP by
20%. A control run captured at HEAD with the change stashed is the only honest
reference.

### Phase 2, same day: measurement, a resolution bug, and the retune

The open question was settled by measuring instead of arguing. Both encoder
generations were driven over the same Chromium-decoded pixels, decoded through
the app's own decoder, and scored with `ssimulacra2` and `butteraugli_main` built
natively from the same v0.12.0 checkout.

**The verdict was not the one upstream advertises.** Compared at equal
SSIMULACRA2 rather than equal distance, v0.12.0 is a wash on photographs (+0.9%
and −0.3% bytes on `photo`) and clearly worse on synthetic content: +18 to +23%
on `illustration`, +29% on `screenshot`. Cross-checked against a natively built
`cjxl` on identical pixels (6354 bytes vs the wasm build's 6351 at `-d 2.35
-e 7`), so it is upstream behaviour and not our wrapper.

**Then the measurement turned up a real bug.** libjxl encodes at half resolution
once the distance crosses a threshold, and v0.9 moved that threshold from 20 to
10. The ported v0.8.5 curve crossed 10 at slider quality 13, so quality 0 to 13
was shipping soft, half-resolution images. Nothing failed: the file decodes back
to full dimensions, so the magic-byte and size assertions in the e2e were all
happy. At slider 10 on the screenshot fixture it was also 2.7x *larger* than
v0.8.5 for a vastly worse image. The wrapper now pins
`JXL_ENC_FRAME_SETTING_RESAMPLING = 1`, which is better on both axes at every
distance from 10 to 15 on all three fixtures. Resolution belongs to the resize
control, not to a quality slider.

**The curve was redesigned rather than ported**, which the "no existing users"
call made cheap. The v0.8.5 curve was shaped around an encoder that undershot
its requested distance and compensated with an exponential tail running out to
distance 45; against an accurate encoder that compensation is actively harmful:

```
quality >= 100                    -> 0            (lossless, unchanged)
100 > quality >= 30               -> 0.1 + (100 - q) * 0.10
 30 > quality >= 0                -> 7.1 + (30 - q) * (15.0 - 7.1) / 30
```

Continuous at the joint, calibrated to delivered SSIMULACRA2 bands rather than to
a nominal distance. The default 75 lands at 2.6, which reproduces the old
default's photo behaviour almost exactly (56171 bytes at 78.54 becomes 56395 at
78.58). It deliberately starts at 0.2 rather than diving under 1.0, where flat
content pays a lot of bytes for almost no fidelity, and stops at 15 rather than
the API's 25, so with resampling pinned the slider never approaches the
downsampling zone. Verified across sliders 100/90/75/50/30/10/0 on three
fixtures: **no position downsamples**, and the old bottom-of-slider collapse is
gone (photo at 0 went from SSIMULACRA2 −12.88 to 28.40, screenshot from −5.19 to
39.11).

**Artifact size was investigated and accepted.** Every candidate reduction was
measured and rejected; the full ledger is in
[../codec-build-notes.md](../codec-build-notes.md) §libjxl. Short version: no
CMake feature flag saves anything, because wasm-ld already dead-strips what the
encoder never calls, and the only real lever is `-Os` (−392 KB for roughly 20%
slower encode), which we declined. `-O3` stays.

Also cleaned up while in there, all three verified byte-identical: the decoder's
unused `lib/jxl/color_encoding_internal.h` include is gone, so **`codecs/jxl` now
compiles against libjxl's public headers only**; three dead `-I` paths dropped
from the Makefile; and `make clean` fixed, which had been expanding to
`make -C  clean` and aborting before it cleaned either build dir.

## 2026-07-25 (Opus, later) - Search and link-preview metadata

The app had **no `<title>` in its served HTML at all**, plus no description and no
Open Graph tags, so a link to frisp.app shared with no preview. Cause: `ssr =
false` means `<svelte:head>` content is added by JS after hydration and never
reaches the prerendered shell. `+page.svelte` has set a title all along; it just
was not in `build/index.html`. Search engines run JS and were probably fine, but
social crawlers do not.

Fix: the tags live in `src/app.html`, the static shell. Added title, description,
canonical, `og:*`, and `twitter:card`, plus `static/robots.txt` (disallows the
`/diagnostics` probe page) and a one-entry `static/sitemap.xml`. Reasoning and the
copy decisions are in the new [../seo.md](../seo.md).

**The interesting problem was the brand rule.** A static template cannot import
`APP_NAME` from `brand.ts`, so two substitution schemes were measured before
accepting a hardcoded name: Vite's `transformIndexHtml` is **never applied to
SvelteKit's app.html** (a `%app.probe%` placeholder survived a production build
verbatim), and a post-adapter `closeBundle` hook does work but fires twice and
depends on plugin ordering, so a reordering would ship the raw placeholder with
the build still green. Trading a silent failure mode for one hardcoded word was
the wrong deal, so `app.html` is now a documented rename touch-point in
[../project-identity.md](../project-identity.md).

Social card: `static/social-card.png` from the new
`scripts/generate-social-card.mjs` (`npm run social-card`), so it is reproducible
from the canonical logomark, the intro's token values, the format array the landing
renders, and the shipped Satoshi face via Playwright. Dark surface and dashed
viewfinder in the landing's language, brand centred and readable, and the benefit
headline as the hero. A real editor screenshot would sell the product harder but the
re-style direction is still open, so it would go stale.

It took three rounds of maintainer review to get there, and each correction is
worth keeping:

- **Round 1 was light with a big centred logo lockup**, which buried the message
  under the mark. The landing's hierarchy (small brand, headline as hero) was the
  right reference all along.
- **Round 2 copied the landing's layout too literally**, hanging the brand in the
  top-left HUD. That works on a web page, where the viewport is understood to
  continue, and reads as unbalanced on a fixed graphic. Borrow a page's language,
  not its arrangement. It also left the name too small to read.
- **Dashes, not dots, and not CSS `dashed`.** A `2px dashed` border reads as a flat
  hairline at thumbnail size, and round dots on a near-zero dash length were too
  thin and fussy. `13 15` at 3.5px reads as deliberate dashes at every size.
- **The format list dropped SVG**, the app's daily-driver capability. The cause is
  worth knowing: `README.md` lists the raster encoders in one sentence and SVG on a
  separate bullet, so flattening that sentence loses it silently. The authority is
  the `formats` array in `Intro.svelte`. The same omission had reached the meta
  description, which is now fixed too.
- **The copy said the same thing twice.** "Compress images in your browser" plus
  "No uploads. Works offline." is one claim wearing two hats. The card now leads
  with the benefit and states the mechanism once underneath.

Checking the card at 300px and 180px wide is now part of the routine, since that is
the size a preview actually renders at.

Verified beyond the build artifact: fetched the served HTML in the preview and
confirmed the raw bytes a non-JS crawler receives carry every tag, that
robots.txt, sitemap.xml, and the card return 200 with the right content types,
and that the runtime tab title still takes over after hydration. `npm run check`
0 errors, 149 unit tests green.

Gotcha for future head work: check the **served** HTML, never the hydrated DOM.
The DOM shows the client-side values and hides the entire class of bug.

## 2026-07-25 (Opus) - Adopted the house project standard

Docs-only restructure, no app code touched. The repo now follows
`~/.agents/standard.md`, so any session or model can pick it up cold.

**Layout.** Everything about managing the project moved under `docs/project/`:
`WORKLOG.md` to `worklog.md`, `road-map.md` to `roadmap.md`, `issue-list.md`,
`specs/` wholesale, plus new `brief.md` and `ledger.md`. Completed audits became
dated reports (`reports/2026-06-02-codec-upgrade-audit.md`,
`reports/2026-07-07-first-principles-review.md`) and the finished
`codec-surface-cleanup.md` moved to `history/`. `presk-rename-runbook.md` was
renamed `rename-record.md` because a public repo should not carry a dead brand in
a filename. `docs/` root now holds only topic docs.

**STATUS.md was dissolved.** It and this worklog both claimed to be the record of
what happened, and the same events were written twice in two voices. Current state
now lives in `docs/project/brief.md` (which the standard already defines as
holding it) and the narrative stays here. The old file is in git history.

**New files.** `docs/project/brief.md` (promoted from the untracked
`.claude/PROJECT_BRIEF.md`, which is now a pointer stub, and refreshed to
2026-07-25), `docs/gotchas.md` (the silent traps harvested out of this worklog and
the old STATUS entries, so they stop being buried in prose), `docs/lab.md` (the lab
registry, which hygiene audits must read before flagging anything under
`src/lib/lab/`), `docs/design.md` (a labeled placeholder recording the conventions
that exist; the two token vocabularies are the thing a design session has to
resolve), `docs/project/ledger.md` (when each heavy audit last ran, so nothing
expensive gets re-run without cause), and a one-line `CLAUDE.md` importing
`AGENTS.md`.

**AGENTS.md went lean**, from 82 lines to navigation plus hard rules. It rides
along with every message of every session, so standing content unrelated to the
current task was costing context on every turn. The engineering advice it carried
moved into the docs that own it; what stayed is what prevents silent or
irreversible damage when no topic doc was loaded.

**Link integrity.** A one-shot script re-relativized every moved link. The check
found 39 links that were **already** dangling at `daa064cb`, all inside
`docs/history/`, left over from an earlier archive move that never relinked; those
are fixed too. The tree is now at zero dangling relative markdown links, verified
by a checker over every tracked `.md`.

**Style tie-breakers.** The four files nominated by the 2026-07-10 and 2026-07-16
passes were re-validated against current Svelte 5 documentation, not just the
validators, and all four earned their slots. `result-cache.ts` needed nothing.
`editor-session.svelte.ts` lost a `cacheKey` alias that gave one value two names
in the same call pair, a definite-assignment two-step, and a history-timer
teardown duplicated in five places. `runtime.ts` had two comments naming a
`cancel()` alias deleted back in `5d88754b`. `Intro.svelte` gained the one missing
constraint comment (an `Array.prototype.includes.call` on `DataTransfer.types` is
a compat guard for engines that expose a DOMStringList) and a keyed `{#each}`.
Left alone deliberately: the file mixes `private` and `#` fields with no rule,
which is real churn across about 20 declarations, and `#bridgeFor` casts through
`unknown` to paper over a structural type mismatch that needs the bridge types
touched.

Gotchas worth keeping, all now in `docs/gotchas.md`. `docs/history/` is frozen by
policy but its links were never audited, so "frozen" had quietly come to mean
"rotting"; a link checker is cheap enough to run before any doc reorganization is
called done. Second, `git add <dir>` while a delegate is editing that directory
stages its half-finished work under your message: `d8fb97c7` was first written as
"no code changed" while actually carrying the first slice of the polish pass, and
was rewritten before it left this machine. Third, mtimes cannot tell an absorbed
edit from a reverted one, because `git status` reads clean either way; this session
misdiagnosed the first as the second and asked the delegate to redo work that had
already landed. Fourth, Prettier never rewraps comments, so `format:check` will
not catch an overlong comment line.

## 2026-07-18 (Fable) — Lab restructure + design unification + Nucleo icons

Six maintainer asks, all in the dev-only lab, executed with three parallel
Opus worktree agents under Fable review. (1) **Navigation** (`a7d83258`):
`/lab` is a two-door index (main ui / intro page); a thin fixed tab bar
(`LabTabs` in the new `routes/lab/+layout.svelte`) flips skins/intro variants
in place; `/lab/intro` redirects to billboard; the production intro gained a
dev-only "lab ↗" HUD link. KEY MECHANISM: the layout's `.lab-viewport` is
`position:fixed` with a `transform`, making it the containing block for every
skin's `position:fixed` chrome — whole experiments shift below the bar with
zero per-skin offsets. `app-strip-dev-only-routes` now also stubs lab
layouts (pass-through) in prod builds. (2) **Direct-open**: skins auto-load
via `$lib/lab/lab-source.ts` — module-level "last file used in any lab skin,
else bundled sample (tests/fixtures/photo.jpg via ?url)" — so tab switches
keep the image being judged. (3) **Icons** (`7be0141e`, `0965d533`): 27
pure-stroke Nucleo UI glyphs in `src/lib/lab/icons/` (18×18, currentColor,
stroke 1.5) + `LabIcon.svelte` host; exporter strips duotone accent layers
(`data-stroke="none"`) — that stripping is also why `info.svg` had to be
REDRAWN by hand (its dot was an accent layer; the letterform read as "1").
Theme cycling shows the mode's glyph: sun-moon/sun/moon (maintainer call).
(4) **Design unification** (`4276f213` hybrid, `944a641f` porcelain,
`71eaf75d` darkroom; spec = specs/2026-07-18-lab-design-unification.md):
one bar system per skin, Export/Save the only primaries, nothing floating
over the canvas — porcelain collapsed five islands into ONE toolbar and CSS-
docks the production Output zoom cluster into its centre slot; darkroom
docks that cluster into the filmstrip bar; hybrid merged its three top-right
islands into one pill. Output's own glyphs stay production Material icons
(component is read-only). Net ≈ −1,000 lines. Gotchas: after merging lab
branches while `vite dev` runs, the open page can hold STALE HMR modules
(deleted-file import errors, mixed-theme surfaces) — hard-reload before
diagnosing; worktree agents need `ln -s <main>/node_modules` AND a widened
`server.fs.allow` to run the dev server (the symlink resolves outside it).

Built the Share action designed in [mobile-save-ux.md](../mobile-save-ux.md)
(`6f82067a`): `src/lib/share-file.ts` (canShareFile + share; AbortError is a
dismissed sheet, not an error) and a quiet circular Share button beside Save
in `Results.svelte` — rendered only when the OS share sheet accepts the exact
output file, never on the Original side. On iOS the sheet offers "Save Image"
straight into Photos and works in the installed PWA (where blob downloads can
dead-end in Quick Look). Bulk focus view inherits it via OptionsPanel; the
Save-all ZIP stays a download (ZIP isn't Web Share-able). Gotchas encoded in
the helper's comments: share `files` alone (WebKit drops the file if text/url
ride along), call share() straight from the tap (activation expires), carry
the download name onto the shared File. Verified: 149 unit tests, full e2e
88/88 unchanged, and live in-browser (payload shape, rename, failure
snackbar, hidden-when-unsupported). Docs updated to shipped state.

## 2026-07-17 (Fable) — Landing drag/drop + paste e2e; Safari silent-drop fix

Closed the e2e gap the fable pass flagged: `tests/e2e/landing.spec.ts` now
drives synthetic drops (1 file → single editor, 2 → bulk), the drag-feedback
contract (headline swap + the global overlay must stay asleep — pins the
stopPropagation routing), the window ⌘V paste, and the async-clipboard paste
button (stubbed `navigator.clipboard.read` — success, imageless, rejected;
stubbing avoids WebKit's ungrantable clipboard permission). 20/20 landing
specs green on both engines; full suite 88 passed / 2 skipped.

Writing them surfaced a REAL bug: WebKit hands out drop items whose
`webkitGetAsEntry().file()` rejects (NotFoundError) even though
`getAsFile()` works — `fromDataTransfer`'s entry-first read turned such
drops into a silent no-op (`8bdea572` fixes it: plain-file items are
snapshotted synchronously via `getAsFile`; the async entry walk is now
directories-only). Unit tests pin the whole `fromDataTransfer` contract.
**Gotchas for synthetic drag tests:** WebKit's DragEvent constructor ignores
`dataTransfer` in the init dict — dispatch generic Events with the property
defined on the instance; synthetic items never produce directory entries, so
folder traversal stays unit-tested only (see bulk.spec.ts's header note).

Also researched mobile save/download UX (iOS + Android) → findings and a
recommended Share-button design in `docs/mobile-save-ux.md`; decision open.

## 2026-07-16 (Fable) — Fable pass over the rebrand + frame-landing window

Senior review of every commit from 2026-07-14→16 (rebrand, frame-landing
promotion, lab/bench build stripping, QOI precache trim, e2e re-anchoring,
docs sweep). Verdict: the window's work holds up — no behavior divergence from
the recorded intent was found, so all corrections were craft-level (two
commits, behavior identical):

- **Comment truth.** Intro's narrow-screen comment described a retired
  two-corner HUD layout; the `theme-color` metas in `+page.svelte` now state
  their sync constraint (the hex values must match Intro's `--i-page` tokens,
  the body canvas, and the editor's `--bg-0` — three files, one palette).
- **Brand doctrine in the lab.** Three dev-only lab pages still displayed
  literal lowercase `frisp` (pre-dating the 2026-07-14 casing reversal); they
  now render `{APP_NAME}` like everything else.
- **Audit hardening.** `audit:static-output`'s dev-UI leak markers only covered
  the intro lab (`--il-`). Added one CSS token prefix per skin (`--pc-`,
  `--dr-`, `--hy-`) — these survive minification and also catch a production
  file accidentally importing `$lib/lab` code directly (the realistic case:
  porcelain's crop tool, which is slated to port to a winning skin someday).
  Verified zero false positives against the current production bundle.
- **Doc drift.** `manual-qa.md` listed the deleted `wordmark.svg` as a current
  asset; the Presk runbook's open logo-art item was superseded by the rebrand.

Known gap (flagged, not built): no e2e drives the landing's drag/drop, paste
(keyboard or button), or touch copy — the suite covers Browse + heading only.

## 2026-07-15 (Opus) — Rebrand, "frame" landing, and a review-driven hardening pass

Two shipped changes plus a hardening batch. **Rebrand:** new Frisp logomark +
wordmark across the app, a theme-aware SVG favicon (`static/favicon.svg`), and
regenerated PNG / apple-touch rasters; the old origami `.webp` logo assets were
dropped. **Landing:** the intro-lab "frame" variant was promoted to the live
landing (`src/lib/editor/intro/Intro.svelte`) — a full-viewport dashed
viewfinder with HUD corner micro-copy — and the retired coral blob landing was
preserved as the dev-only `/lab/intro/aurora` exhibit.

A review (external AI plus a local multi-agent audit) then found gaps, fixed
here:

- **e2e was red.** The app name moved out of the `<h1>`, so `app-shell` +
  `offline` asserted a heading that no longer existed — and because that
  assertion ran first, the COOP/COEP, console-error, SW-install and
  offline-reload checks silently stopped running. Re-anchored all three
  assertions (incl. offline's post-reload one) on the "Browse files" control.
- **Landing hardening.** The HUD micro-copy failed WCAG AA in both themes
  (2.5:1 light / 3.6:1 dark) — retuned the `--i-text-*` tokens to clear 4.5:1;
  added a `max-width:560px` layout (the two bottom HUD corners collided on
  phones) and a coarse-pointer headline variant; gave the `<h1>` a stable
  accessible name carrying the app
  identity; and reworked the import affordances — the redundant "choose a
  folder" pick link was dropped (folders still import by drag), and "paste"
  moved inline beside Browse as a ghost button with a Nucleo clipboard icon,
  snackbar feedback rewired. Wordmark set to weight 850. Final landing copy +
  layout: headline "Drop images to optimize." (touch "Add images to optimize."),
  a bigger balanced subheading carrying the qualities, the format line moved to
  the bottom-center (SVG added, JPEG last), and the redundant bottom-right HUD
  removed. Dropped `static/wordmark.svg` (redundant with `logo.svg` + live text).
- **Precache trim.** Stopped precaching the QOI encoder — QOI is no longer a
  user output (the encoder is only hit by the diagnostics webp-pipeline probe),
  so it was dead weight in every install shell. The QOI decoder stays for `.qoi`
  inputs; the encoder is still runtime-cacheable if the probe runs.
- **Dead lab code shipped to prod.** `/lab` + `/bench-svg` guard on `dev` at
  RUNTIME, so their chunks (~234 KB) were still emitted and precached. Added the
  `app-strip-dev-only-routes` Vite plugin (`apply: 'build'`) that stubs those
  routes to "Not found" in production; guarded in `audit:static-output`.
  **Gotcha:** an `{#if dev}` template guard does NOT keep a statically-imported
  component out of the bundle — only the build-time plugin (or a `dev`-gated
  dynamic import that DCE can drop) does. Client JS+CSS fell ~1697 KB → ~1463 KB.
- **Brand hygiene.** One canonical logomark source (`src/lib/brand/logomark.svg`)
  shared by the intro + lab instead of three hand-copied paths; `.DS_Store`
  removed from `static/` and guarded so it can't ship again.

Deferred: a theme-aware `favicon.png` fallback (a single PNG can't be
theme-aware without an opaque/neutral badge redesign, and no CLI rasterizer is
available here; the primary SVG favicon already covers modern browsers).

## 2026-07-12 (late night, Opus) — SVG benchmark: nano + ImageOptim legs

Ran the external-baseline comparison the maintainer asked for.
**ImageOptim 1.9.3** (full 215-file corpus, gzip): Frisp auto 144W/18T/34L,
loses only editor-exports. **vecta nano** (57-file stratified sample, RAW
bytes): Frisp auto −41.8% vs nano −26.4% overall; near-even file-by-file
(28/2/27). Split: Frisp auto wins on precision-heavy content (logos −51% vs
−6%, illustrations, clean color icons); nano wins on icons-stroke (strips
Tabler's invisible bounding `<path fill=none stroke=none>` — SVGO keeps it)
and editor-exports (aggressive dirty-file cleanup). Two v2 levers recorded
in the analysis doc. **Gotcha for anyone re-running nano:** its compressor
is client-side (`window.Vecta.compress` / `window.nano`), the drop handler
is triggerable via a synthetic DragEvent with in-page File objects (bypasses
the OS picker), but the SVG *download* is a `data:` URI the in-app browser
sandbox won't save AND `Vecta.compress` diverges from the UI pipeline
(skips clean+options+mode → drops opacity), so only nano's *reported* output
sizes are faithfully capturable (exact <1KB, ±51B rounded above). nano caps
at 10 files total per page load → reload between batches. Full method +
harness: benchmarks/svg/compile-nano.mjs, external/nano/RESULTS-nano.md.

## 2026-07-12 (night) — SVG optimization SHIPPED (S1–S6) + benchmark harness

Same-day build of the approved plan, spec
[specs/2026-07-12-svg-optimization.md](specs/2026-07-12-svg-optimization.md)
(stage states + commit shas live there). SVG sources now get an "SVG
(optimized)" output: SVGO 4.0.2 in a lazy dedicated worker, Auto mode
default (precision ladder + reusePaths/convertStyleToAttrs trials, every
candidate gated by pixelmatch at 3 sizes × 3 backgrounds against the
original, winner badge), manual precision/toggles, raw+gzip lines,
vector-true preview (SvgPreview layout-sized overlay — crisp at 3200%,
verified live; pinch-zoom children can opt out of the pinched transform via
`data-pinch-overlay`), SW first-use caching of the worker chunk (audit
tripwire asserts svgo stays worker-side). Gotchas for future sessions:
pinch-zoom transforms EVERY child via `pinch-zoom > *` CSS (not just the
first); SvelteKit emits hash-only chunk names so SW exclusions must key on
the stable `workers/<name>-` segment; `$lib/svg/optimize` must only ever be
dynamic-imported; the auto gate deliberately upscales small sources
(precision loss invisible at 24px is obvious at 256px); dimensionless SVGs
(no width/height/viewBox) are rejected by the inherited import contract —
surfaced as errors in the bench, possible v2 relaxation. Benchmark corpus
(200 stratified files + licenses) and a Playwright harness driving the REAL
pipeline via dev-only /bench-svg landed; external nano/ImageOptim
comparison next.

## 2026-07-12 (evening) — SVG optimization research pass (analysis only)

Maintainer asked whether Frisp can import/export SVGs at nano/ImageOptim
quality. Four parallel Codex research agents (nano published-technique
analysis — public blog/docs sources only, 2026 optimizer landscape,
beat-SVGO techniques, repo integration audit) → distilled into
[svg-optimization-analysis.md](../svg-optimization-analysis.md); **direction
approved same day**. Headlines: ImageOptim's SVG engine IS SVGO (parity by
construction); nano's 22% claim is 2018-era vs SVGO 1.x; the winning design
is a vector lane (SVG text → SVGO v4.0.1 in a lazy worker) plus a Phase-2
candidate search with a pixelmatch visual gate. Maintainer decisions:
precache the SVGO chunk (SVG is first-class — he optimizes SVGs daily) and
**vector-true preview** (SVG sides re-render at current zoom, never a
scaled frozen bitmap; offscreen raster only for the diff gate). Gotchas:
use SVGO 4.0.1 not 4.0.0 (XML-entity DoS), svgcleaner is GPL+dead (never
bundle), signature must exclude raster processor state on the vector lane.
No code changed.

## 2026-07-12 (later still) — Grain size rescaled to a 1–100 slider

Maintainer feedback: whole-pixel size steps (1–4) jumped too much. The
`size` option is now the 1–100 slider value at 20 units per pixel (default
20 = the calibrated 1px look, byte-identical; 40 = 2px = the debanding
recipe; 100 = 5px), with values ≤20 clamped to the per-pixel path — like
Luminar, the default sits mid-scale with room both ways. The lattice now
takes fractional spacing; the variance correction became separable
(per-column array × per-row factor — no per-pixel sqrt). Labels: the shared
AdvancedSection disclosure now reads "Advanced" (all panels), the control
reads "Grain size". Old saves with size 1–20 render identically to the new
default.

## 2026-07-12 (later) — Grain v1.1: Size control + live scrub preview

Same session, maintainer go on both follow-ups. (1) **Advanced Size (1–4)**:
band-limited grain via a bilinear noise lattice with exact per-phase variance
correction (Amount = same σ at every size; unit-tested at 2/3/4). Motivated
by a measured debanding experiment (results in the spec §Size): the encoder
DELETES faint fine noise (sub-threshold 1px grain = pay nothing, fix
nothing), while 2px grain at Amount ~5 debands like 1px at Amount 12 for
~1/6 the bytes. Roughness deliberately not added. (2) **Live grain preview**:
while an encode is in flight and the grain recipe differs from what's on
screen, the viewer shows the preprocessed frame with the CURRENT grain
applied (same function/seed = exact encoder input); the settled encode
replaces it. Guards: suppressed when a real resize or quantize is active
(the frame would mislead). **Gotchas:** (a) do NOT throttle with
requestAnimationFrame — it never fires in non-compositing contexts
(headless/e2e, background tabs); a latest-wins drain loop with setTimeout
yields is used instead (this failure was hit live during verification);
(b) at rotation 0 `#preprocessedPromise` is deliberately null — the
preprocessed frame is `#decodedPromise.decoded` (see `#preparedSource`);
(c) `SideRuntime.displayedGrainSig` records the grain recipe baked into the
displayed result — bulk focus hydration self-heals it via the encode
effect's redundant-pass branch. Verified live: preview lands <100ms after a
scrub while the encode is still in flight, settles to encoded truth; unit
122, check 0 errors, full e2e green.

## 2026-07-12 — Film grain shipped (measured model, single slider)

Designed and shipped the film-grain processor in one session, pulled ahead of
the 2026-07 codec batch by the maintainer. The design question ("use
JXL/AVIF's native grain synthesis or bake uniform grain?") was resolved by
research + measurement: **baked pixels won** (native paths can't author
aesthetic grain on AVIF, only decode in Safari for JXL, and don't exist at all
for JPEG/WebP/PNG; baked is WYSIWYG everywhere). Full rationale in
`docs/project/specs/2026-07-12-film-grain.md`.

The grain model was **measured, not invented**: the maintainer exported 20
calibration images from Luminar Neo + Pixelmator Pro onto known synthetic
canvases plus 3 real-photo pairs; analysis (numpy, session scratchpad)
decoded Luminar's default look — monochrome per-pixel white noise (lag-1
autocorr ≈ 0; Luminar's Size slider is measurably inert), flatter-than-
gaussian samples (kurtosis ≈ −1.5 ⇒ `sign(u)·|u|^0.683`), amplitude =
`0.44·amount · 4L(1−L)` (midtone parabola over the pixel's own sRGB luma).
Verified against the real photos within ~5%, then verified again END-TO-END in
the browser: lossless PNG output measures σ 5.31 vs 5.28 predicted at the
default Amount 12. Frisp's slider is 1:1 on Luminar's Amount scale
(maintainer's taste: 10–12 everyday, ~24 creative).

Implementation mirrors quantize everywhere: `features/processors/grain/`
(pure-JS apply, fixed-seed xorshift32, one PRNG step per pixel, alpha-0 pixels
untouched), pipeline order resize → grain → quantize (grain scale stable at
output resolution; palette contract preserved), `grainIsReal()` folds
"enabled at 0" out of the encode signature / bulk recipe (toggle-off = cache
hit, asserted by the new `tests/e2e/grain.spec.ts`), UI = one "Film grain"
ToggleRow + Amount slider shared by both editors. **Gotchas:** (1) per-side
saved settings default-fill a missing `grain` on parse — `app:settings:v3`
frozen, do NOT bump; (2) `BulkMode.svelte`'s per-image override diff loop
hardcodes the processor key list — new processors must be added there
(`['grain', 'resize', 'quantize']`) or per-image edits silently drop; (3) the
bulk `processorControls` registry has no consumer yet (WS-G UI half pending) —
the grain entry is registered for when the dots/resets wiring lands. Gates:
check 0 errors, 119 unit (9 new), full e2e 61+2 passed both browsers.

## 2026-07-11 (later) — CLI scope notes, npm name, film-grain idea

Follow-up in the same session. The maintainer agreed with the CLI direction;
scope notes captured in `docs/frisp-cli-analysis.md` §3a: manual `--quality`
stays first-class (never auto-only), the preset ladder gains a lossy-tolerant
**Compact** target (SSIMULACRA2 ≈ 60, also added to the auto-quality spec so
app and CLI share one vocabulary), and agent experience is a v1 requirement
with a concrete bar (teaching `--help`, fix-stating errors, stable NDJSON,
determinism, fast `npx` start, `frisp mcp`).

The `frisp` npm name looked unclaimed (404) but publishing it is **blocked by
npm's typosquat filter**: 403 "too similar to existing package fresh". No CLI
workaround exists; the moniker rule is enforced server-side on PUT. A support
ticket requesting an exception was submitted 2026-07-11 via npmjs.com/support
("problem with the npm registry" category, from tav@artusion.com; sent-
confirmation banner received). The placeholder package (`packages/cli/`, bin
stub + README, deliberately NOT a workspace yet) stays named `frisp`; publish
is on hold for npm's reply. Maintainer ruled out `@tavlean/frisp`; `frisp-cli`
verified unclaimed as the fallback. **Gotchas for the eventual publish:** the
web-2FA flow needs a TTY (`script -q /dev/null npm publish` from a sandboxed
shell, then approve the printed npmjs.com/auth/cli URL in the maintainer's
browser — npm masks the URL in non-TTY error output but prints it plainly
under a pty).

New idea recorded in the roadmap ("Film Grain / Debanding"): subtle grain to
mask gradient banding at low quality and to de-plastick AI images. Key
findings: grain must be baked pre-encode for WebP/JPEG (costs bytes, and very
low quality smooths it — preview shows the sweet spot), but JXL already has
decode-time noise (`photonNoiseIso` — shipped in Frisp's advanced options
today) and AVIF/AV1 has in-format Film Grain Synthesis worth investigating.

## 2026-07-11 — Codec landscape guidance + four-feature batch

Guidance session on the codec landscape: Frisp is current on WebP and AVIF,
but behind on JPEG XL (libjxl v0.8.5 versus v0.12.0). The maintainer approved
four features, each now captured in a Codex-executable spec:

- `docs/project/specs/2026-07-11-libjxl-0-12-upgrade.md` — libjxl v0.12.0 upgrade
  with a public-API encoder rewrite, isolated on its own branch;
- `docs/project/specs/2026-07-11-jpegli-codec.md` — new encode-only jpegli codec from
  google/jpegli;
- `docs/project/specs/2026-07-11-jpeg-to-jxl-transcode.md` — lossless JPEG→JXL
  transcode, blocked on the libjxl upgrade;
- `docs/project/specs/2026-07-11-auto-quality-mode.md` — SSIMULACRA2-targeted
  auto-quality search plus a new `codecs/ssimulacra2` metric module.

Also written: `docs/frisp-cli-analysis.md`, decision material for a possible
Frisp CLI; recommendation yes-but-sequenced after the codec batch, decision
pending. The jpegli and JPEG→JXL skip verdicts in
`docs/new-codec-investigation.md` are now superseded.

**Gotcha:** the libjxl v0.8.5 pin is an internal-API wall: `enc_file.h` was
deleted upstream at v0.9, so this is a wrapper rewrite rather than a routine
version bump. Cross-doc claims about the pin and upgrade were reconciled today.

## 2026-07-10 (later) — intro-page lab: five landing variants

Maintainer-requested lab experiment: the landing screen as a minimal
full-viewport single section (drop area + tiny header/footer, light+dark).
Scaffold (orchestrator-authored): `src/lib/lab/intro/` tokens + IntroDropDemo
(REAL production import path, reactive dragActive, stubbed editor handoff) +
ThemeToggle + Nucleo duotone icon set (`Icon.svelte`, currentColor exports
from the local Nucleo library). Variants (parallel delegated builds, each one
self-contained +page.svelte, orchestrator-reviewed + icon-retrofitted):
`/lab/intro/billboard` (statement headline + floating card), `frame`
(viewport-as-drop-zone viewfinder, marching dashes), `split` (editorial
asymmetry + canvas-generated try-a-sample PNGs), `ledger` (typographic
privacy ledger). Design grounded in Mobbin references (V7/Shuttle/Shade).
All four verified live in both modes; split's sample click produced a real
507 kB PNG through the accept path. Doc: `docs/lab-intro-page.md`
(registry row added). Decision PENDING; commits `477c2f1d` + `01ed6333`.
Gotchas: the /lab index's old `labRoute` type-widening hack died once all
routes existed — plain `resolve()` literals now; an SVG used as a full-bleed
frame needs an explicit CSS box (inset alone leaves it at intrinsic 300×150);
the Nucleo "photos" pinwheel reads as the Apple Photos brand at display sizes
— use the plain image glyph instead.

Round 2 (same day): maintainer supplied a Vercel-style three-zone reference →
fifth variant `/lab/intro/prism` (Opus build, orchestrator-reviewed): headline
+ actions left, prismatic-glow drop stage starring the origami bird centre,
vertical trust column right, format row as footer; real canvas sample via
"Try a sample". Brand lockup componentized (`Brand.svelte`: /logo.webp coral
bird — the ONLY logo asset with alpha; logo-light-mode.webp has an opaque
tile) and adopted by all five headers. Ledger re-composed onto a single
560px spine (header/column/footer share one left edge; dot accent dropped;
200px tray). Verification gotcha: Svelte 5 flushes class bindings async —
a synchronous DOM read right after .click() misses the update and fakes a
"broken toggle"; wait a tick before asserting.

Round 3 (same day): (1) GRAPHITE identity — new `/logo-dark-mode.webp` steel
bird adopted as the main mark in Brand.svelte for BOTH modes (light mode
darkens it via `--il-bird-brightness` filter token); permanent coral demoted
to grey in billboard ("Nothing uploaded.") and split ("locally."); ledger's
"never" + drag ignitions stay as the rare accents. Prism: bird removed from
the drop stage (header-only), lockup gap tightened. (2) SIXTH variant
`/lab/intro/showcase` (Opus build, orchestrator-verified end-to-end): hero
features a CSS-mock app window that is a live drop target; on accept it
feeds the REAL EditorSession and FLIP-morphs (measured rect → fullscreen,
480ms) into the production editor composition (Output + panels + undo/redo,
styles ported from routes/+page.svelte) — encode runs DURING the animation;
Back fades home and clears the session. Verified personally: synthetic drop
→ morph → real 265 kB PNG → 1.70 kB WebP ↓99% → Back restores the hero.
Gotcha: full-page screenshots composite fixed overlays at partial opacity
(ghost header) — trust elementFromPoint over the stitched capture.

## 2026-07-10 — Whole-project quality pass (fable-pass)

Deep senior pass over the production code (labs excluded by design — decision
pending, losers get deleted): every file judged against its spec/decision
docs, most-central first. Headline: the codebase is in strong shape — editor
core, bulk engine, worker layer, and service worker all read at exemplar
standard; most areas needed nothing.

**What changed (each commit gated by typecheck + 110 unit tests; full e2e
61-passed/1-skip both browsers before and after):**

- `c6cfdd86` — **one canonical encode-signature projection.** BulkMode's
  focus-hydration had reimplemented the editor's encode/resize signature
  construction (4 helpers + a fourth private `stableStringify`) — the exact
  drift class the 2026-07-02 hardening batch (`da273584`) eliminated. Now
  `src/lib/editor/encode-signature.ts` (sideRecipe / resizeIsReal /
  encodeSignature / resizeSignature) feeds both `EditorSession.encodeSide`
  and BulkMode.
- `da58751b` — **fix:** `BulkStore.reset()/dispose()` now clear BOTH debounced
  apply timers (+ the pending payload); before, a pre-reset global-apply
  snapshot could re-apply onto the fresh session ~200ms after reset.
- `5d88754b` / `284871c0` / `9fadb1fb` — craft: `formatLabel` deduped into
  `src/lib/editor/format-label.ts`; self-only exports un-exported; unused
  `BulkRuntime.cancel/dispose` aliases deleted; `cloneOrNull`→`clone`;
  OptionsPanel's dead `sourceName` prop removed from all 4 call sites;
  pinch-zoom/two-up/Snackbar comment rot fixed (headers now admit the real
  local features).

**Verified-refuted (no change, worth remembering):** the JXL panel's
unguarded `lossyModular = quality < 7` under lossless is output-inert —
`codecs/jxl/enc/jxl_enc.cpp:63` sets `modular_mode = (lossyModular ||
quality == 100)` and quality 100 forces distance 0. Upstream parity kept;
the bulk registry's extra guard is equally correct.

**Flagged, not fixed:** engine-barrel pruning, drag-teardown micro-gaps, and
the intentional coarse override-path seam → [issue-list.md](issue-list.md)
items 5–7. Both memory-flagged must-dos (two-up divider, host-objects-in-
$state) were confirmed long since fixed.

## 2026-07-05 — Rename-proofing + sqush.app sunset Worker

**Why:** the maintainer may rename the app again; a rename must be a small task,
not a project. Also fixed the zombie-service-worker trap on the old domain.

**What changed:**

- **Rename-proofing refactor** (delegated implementation, orchestrator-reviewed): `src/shared/brand.ts` (`APP_NAME`) is now the only place the name
  lives in code; every internal identifier de-branded (`.editor-root`,
  `app-generated` alias, `__appEmscripten*` globals, `registerServiceWorker`,
  SW cache `app-${version}`, localStorage `app:*` keys — FROZEN schema now,
  renamed one final time while the domain cutover had client storage reset
  anyway; bulk ids `bulk-N`; `static/wordmark.svg`). Bulk ZIP download name
  still branded, derived from `APP_NAME`. Full details: runbook Phase E.
- **`infra/sqush-sunset/`**: Cloudflare Worker for the sqush.app zone — serves
  a self-destructing service worker at `/service-worker.js` and 301s all else
  to frisp.app. NOT yet deployed (needs user: deploy + disable the zone's
  Single Redirect Rule — redirect rules run before Workers, so the rule must go
  for the Worker to see traffic). Steps: runbook Phase F.
- Living docs re-pointed at the new identifiers; `project-identity.md` now
  documents the (cheap) future-rename procedure; runbook gained Phases E/F and
  a reconciled user-action checklist.

**Verification:** `npm run check` green; full Playwright e2e 61 passed /
1 expected WebKit skip, both browsers (verified independently by the orchestrator).

**Gotchas:**

- `wasm-bindgen` bakes Rust crate names into `.wasm` import strings — the
  `squoosh_*` codec artifacts CANNOT be renamed without a rebuild (runbook
  Phase B; fold into the next codec upgrade; build-green is NOT sufficient,
  only e2e catches it).
- The Codex sandbox can't bind the Playwright preview-server port; e2e must be
  run outside it.

## 2026-07-05 (later) — Presk → frisp rename + Pages→Workers move

Full cutover executed in one session (naming decision + infra). See the
Postscript in `docs/rename-record.md` for the complete record.
Key state: app lives at **frisp.app** on Cloudflare **Worker `frisp`**
(static assets, root `wrangler.jsonc`); both sqush.app and presk.app 301 to
it via the shared sunset Worker; old Pages project dormant. Brand casing:
lowercase `frisp` in UI/wordmark, "Frisp" in prose.

**Gotchas:**

- Cloudflare Pages projects can't change their `*.pages.dev` subdomain —
  that plus Workers being the recommended platform drove the move.
- Workers static assets: `_headers`/`_redirects` work as on Pages (verified
  live), but SPA fallback is `not_found_handling` serving `/index.html` —
  the adapter's `200.html` ships unused.
- Workers Builds CI not yet connected (manual `wrangler deploy` until the
  user finishes the dashboard connect step).

## 2026-07-05 (later) — E2E CI flakiness hardening

Two-layer fix after the rename push surfaced flaky e2e failures on GitHub
runners (all passed locally):
- **Systemic net** (`playwright.config.ts`): `retries: 2` on CI (0 locally, so
  real flakes still surface in dev); per-test `timeout` 90s→120s on CI for
  webkit WASM codec cold-starts.
- **Root-cause fix** (`bulk.spec.ts:166`): the "per-image override" test raced
  the options-panel re-render — selecting a cell flips the scope tab's
  aria-selected BEFORE the panel rebinds the Quality input to per-image scope,
  so a setQuality() fired in that window drops its `input` event on a
  being-replaced node (override never registers → override-dot never appears →
  full-timeout failure). Wrapped set+assert in `expect(...).toPass()` so the
  idempotent quality change re-fires once the panel settles. Verified: 12
  consecutive passes with retries OFF (was flaking ~every CI run).

Not touched: the ~15 other sub-20s per-assertion timeouts in the suite — most
are intentional stability checks (assert a value did NOT change), and retries
covers any genuine environmental flake. Don't lengthen them.

## 2026-07-07 — First-principles whole-app review

Maintainer asked for a from-scratch re-examination of every inherited decision
(Squoosh-era and migration-era). One deep manual pass over the runtime core +
four independent read-only sweeps (legacy/dead code, Svelte idioms vs current
docs, build/tooling, runtime inventory — automated read-only sweeps). Output:
`docs/project/reports/2026-07-07-first-principles-review.md` (registered in the README registry), ranked
P1–P10 with a suggested sequence. Headlines: every encode pass re-decodes the
source on the main thread (P1); the Comlink boundary structured-clones
full-res pixels up to ~5×/pass, no transferables (P2); the 2,006-line
sync-sveltekit-app.mjs generates ~480 lines of static TS and can mostly retire
(P3); bulk options seam is WebP-typed, endorsing the codec-options-model
sequencing (P4); 12 orphaned worker wrappers + 5 stale d.ts shims (P5); unit
tests don't run in CI (P7). No code changed — review only.

## 2026-07-07 — First-principles execution day (orchestrated)

The P1–P10 review became specs (WS-A…H in
docs/project/specs/2026-07-07-first-principles-execution.md) and 7 of 8 day-one
workstreams landed same-day, delegated implementation, orchestrator-reviewed, every one
gated by check + unit + full e2e (Chromium+WebKit):
dead code `85944296` · dedup `67b99863` · tooling/CI `5eca4145` ·
decoded-source cache `3a44a63d` · bulk drain `116928aa` · codegen retirement
`2eefc99e` (−2,357 lines net) · Svelte idioms `e120b55b` (worktree, merged
`7fd0b3d5`). Bonus regression fix `db0a696a` (vitest aliases; ZIP name).

Gotchas for future sessions:
- `codex exec` in a compound background command MUST end with `</dev/null`
  (stdin never closes → hangs at "Reading additional input from stdin...";
  the command hangs until stdin closes).
- vitest.config.ts does NOT inherit vite.config aliases — it imports the
  exported `appAliases`; keep them in sync via that export only.
- Playwright local build reuse is opt-in via PLAYWRIGHT_SKIP_BUILD=1 (`npm
  test` sets it); never make it inferred — stale build/ would test old code.
- The bench's photo-large fixture is 1 cold run — regression signal only.
- WS-H rename must go LAST (conflicts with everything); its inventory doc has
  a delta header to apply first.

## 2026-07-07 (later) — WS-D(a) + WS-G engine half land; day-one board complete

WS-D(a) transfers landed (`cf380396`; outputs byte-identical, timing deltas =
known single-cold-run bench variance, no regression). BONUS beyond day-one
scope: the WS-G options-slice ENGINE half landed (`ba6a4f8c`/`d3dd6177`) —
per-codec control registries + per-control sparse overrides; the "one tweak
freezes every option" Phase-3 blocker is fixed at the engine level, 91 unit
tests. D(b)/D(c) got FULL designs in the spec (`0d687b97`) — every remaining
review item is now zero-judgment executable: D(b), D(c), WS-G UI wiring,
WS-H rename (LAST). Deploy note: nothing deployed today; `main` is ahead of
production — `wrangler deploy` when ready.

## 2026-07-07 (later) — editor re-style lab: porcelain + darkroom experiments

Two dev-only lab routes exploring a full editor re-skin from two maintainer-
supplied reference screenshots; both are REAL editors (production
EditorSession + Output + option components under new chrome), zero
production-file changes, dev-gated like the old bulk lab. `/lab/porcelain`
(`4e0cff81`): light/airy squircle style — floating top toolbar, Image|Compare
+ Edit|Compress segmented tabs, Variations-style format grid, custom format
dropdown, `corner-shape: squircle` progressive enhancement. `/lab/darkroom`
(`7827b86f`): dense pro-tool IA — top nav bar, left icon rail opening
flyouts, inspector with eye-icon-as-enable sections (Resize/Reduce palette),
chip dropdowns, and a real session FILMSTRIP (multi-image gallery, click to
switch) previewing the bulk direction. Both theme-dynamic via
`color-scheme: light dark` + `light-dark()` tokens over the existing
`.editor-root` var contract (manual force switch included) — the blueprint
for app-wide light mode. Design doc + harvested feature ideas + pending
decision: `docs/lab-editor-restyle.md` (registry row added, `791104cd`).
Gotchas: both labs override COMPILED component class selectors under their
root class (`.controls .button`, `.results .download`, `.option-text-first`…)
— refactors of those components can silently drift the labs; check the labs
after touching editor components while the experiments live. Decision is
PENDING (maintainer to pick a direction/hybrid); losing lab code should be
deleted on promotion.

## 2026-07-07 (round 2) — hybrid experiment, /lab index, control docking, light purity

Maintainer follow-up on the re-style lab: (1) `/lab/hybrid` (`fe578225`) —
darkroom's IA in porcelain's skin; inspector uses STACKED eye-enable
sections (no tabs) and the canvas zoom cluster is CSS-docked into the bottom
filmstrip bar (one bar, no stray floating panels). (2) `/lab` card-gallery
index (`f1c44129` + squircle cards `544726d7`) — pure-CSS vignette cards
linking all three experiments. (3) Porcelain: zoom cluster moved INTO the
top toolbar (view-options popover flips downward), theme pill relocated
top-right. (4) Light-mode purity in both parents (`ac2d992a`): two-up
scrubber, snackbar, ProcessingBadge de-hardcoded via light-dark(); darkroom
range track was invisible — a bare color in a non-final background layer
invalidates the whole shorthand at computed-value time; fixed with a
flat-gradient fill layer (gotcha worth remembering). Squircle convention
confirmed by maintainer: @supports (corner-shape: squircle) + re-tuned
larger radius, plain rounding as fallback. All verified in dev preview both
modes; check clean. Decision still PENDING (start at /lab; recommendation:
hybrid). Verification gotcha: getComputedStyle sweeps right after a
color-scheme flip or HMR reload can return stale values — re-query after
settling before trusting a dark-background audit.

## 2026-07-07 (later) — porcelain lab: full Pixelmator-style CROP TOOL

Maintainer-requested crop tool, built in `/lab/porcelain` (dev-only; zero
production changes). Spec + coordinate model + API contract:
`docs/project/specs/2026-07-07-porcelain-crop-tool.md` (registry row added). Commits
`46cc7e27` (core) + `3c7c97b9` (panel + wiring). What shipped: crop rect
with 8 handles; rotate by dragging OUTSIDE the corners (custom cursor, 0.25°
snap, shift=15°, sticky 0); straighten slider ±45° that folds into 90°
orientation steps; rotate-90/flip buttons; move/out-of-canvas crop
(unclamped by design); Constrain menu (free, custom ratio w/ editable
fields, Original, 13 ratio presets, 2 size presets — ratio switch is
area-preserving); W/H px fields; empty-area fill (transparent default,
white/gray/black, any-color picker, sample-from-image click); 7 guide
overlays × auto/always/never (rotating auto-shows Grid); Reset/Cancel/Apply,
Esc/Enter, arrow-key nudge. Architecture: crop is a LAB-PAGE-LEVEL source
transform upstream of EditorSession — Apply renders a PNG (alpha kept) and
feeds `session.pickFiles`, so WebP/AVIF/PNG outputs keep transparency and
encoder recipes survive; NON-destructive: the page keeps `original` +
`CropSnapshot`, re-opening restores the crop over the original pixels.
Key invariants (tested, 19 new unit tests): world = R(θ)·F·(p−center),
rect axis-aligned in world AND on screen (the IMAGE rotates); rotation
pivots on the crop center (c′=R(Δ)c); apply-time pixel snap at angle 0 keeps
pure crops resample-free; `CropTool.transformEpoch` lets the stage keep the
crop center screen-anchored across rotation/flip remaps (without it the
composition jumps — see spec "If things break"). Deferred (discuss):
Perspective sliders (needs homography resampling), Auto Crop, Auto
Straighten; slider granularity is 0.5° while gesture rotation is 0.25°.
Delegation notes: Codex built overlays + geometry tests (one stdin stall —
relaunch with `< /dev/null`; it also correctly REJECTED a wrong test
assertion I suggested, matching the documented model instead); Opus built
CropPanel to the spec contract with zero API mismatches. Verified live in
preview: gestures, out-of-canvas + fills, 16:9 refit, apply→re-encode,
re-edit restore, light+dark. Gates: check 0 errors, 110 unit tests green.

## 2026-08-03: install-app support (web app manifest)

Chrome never offered "Install app" for frisp.app because the site had no web
app manifest at all; the service worker and favicons were already in place.
Shipped `static/manifest.webmanifest` (name Frisp, standalone, dark #111113
ground) linked from `app.html`, plus `static/icon-192.png` /
`static/icon-512.png` rendered from the canonical logomark by the new
`npm run pwa-icons` script (same reproducible Playwright pattern as the
social card; mark sized inside the maskable safe zone, one set serves
`any maskable`). The icons stay out of the SW install shell like the crawler
files (the browser fetches them only at install time); the manifest itself
stays in the shell so the installed identity resolves offline. Deployed with
`wrangler deploy`; verified live: manifest + icons resolve, SW activated and
controlling. Gates: check 0 errors, 149 unit, 88 e2e green. Gotchas: the
embedded Claude browser pane never fires `beforeinstallprompt`, so the
omnibox icon itself cannot be proven from inside it, only the criteria; and
a hidden pane defers page JS, which makes SW registration look absent on
first sample. Local SW testing still needs the `?sw` opt-in on localhost.

## 2026-08-03 (later): apple-touch icon folded in, iOS standalone metas

Follow-up sweep after "is the apple touch icon missing?": it was not
(present, linked, live), but it was a hand-regenerated one-off, so
`npm run pwa-icons` now renders it alongside the manifest icons from the
canonical logomark (same tokens; mark a step larger at 0.62 because iOS
crops its own squircle and has no maskable safe zone). Added the three
Safari-only metas that the manifest cannot express (capable + title for
older-iOS standalone, status-bar-style black for the tint); deliberately
skipped iOS startup-splash images (~30 device-specific PNGs for a cosmetic
launch frame) and the deprecated mask-icon. Android needed nothing more.
Gate note: the WebKit landing e2e specs (drag-over :134, keyboard paste
:185) are FLAKY under parallel load and occasionally in isolation;
reproduced 1-of-6 on a clean pre-change tree, so pre-existing; spawned a
follow-up task. Everything else green (check 0 errors, 149 unit).
