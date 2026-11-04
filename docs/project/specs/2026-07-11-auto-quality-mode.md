# Spec: Auto-quality mode (SSIMULACRA2-targeted quality search)

Last updated: 2026-11-04. Status: **Shipped 2026-11-04 for WebP, AVIF, JPEG XL, and JPEG (jpegli).**
Origin: maintainer decision 2026-07-11 (codec guidance session). Related:
[2026-07-11-frisp-cli-analysis](../../frisp-cli-analysis.md) (the same engine is
the planned core of a future CLI), [codec-options-model.md](../../codec-options-model.md)
(the control-registry seam this feature slots into).

## As built (2026-11-04)

What shipped differs from the plan below in these ways; the rest of this spec
is kept as the history of the decision.

- **Module.** `codecs/ssimulacra2/` is built natively with emsdk 3.1.0 from
  cloudinary/ssimulacra2 `81feacf6` plus Highway 1.0.2 and **lcms2 2.16**. The
  plan said only Highway was needed; the metric's vendored libjxl slice does
  its colour management through lcms2 (its skcms branch needs a header the
  slice does not ship). The `.js`/`.wasm` pair sits in the codec root, not
  `pkg/`. Pins and licenses: [codec-provenance.md](../../codec-provenance.md);
  recipe: [codec-build-notes.md](../../codec-build-notes.md#ssimulacra2).
- **Alpha is scored, not ignored.** With any transparency, both images are
  blended onto a dark and a bright background and the worse score counts, as
  the reference CLI does.
- **Scoring runs in the codec worker, inside the `optimize` op** (the
  worker-side pipeline, change B). A probe is
  `optimizeImage(..., { preview: true, score: true })`: the worker runs resize,
  grain, and quantize (`processFrame` in pipeline-core.ts), encodes, decodes
  the output once, and scores the decoded output against that **processed**
  frame, not the raw source. The target therefore measures the encoder's loss
  alone, and a resize can never cause a size mismatch. The decoded output is
  also the preview, so nothing decodes twice. Scored requests are pixel-lane
  only; a JXL transcode is refused.
- **Downscaled scoring.** Above 4 MP both frames are box-filtered by the same
  whole factor until the long edge is at most 2048 px (`src/worker/score-scale.ts`).
  At 12 MP the full-size metric took about 3 s per probe, more than the WebP
  encode.
- **Search.** `searchQuality` in `src/lib/editor/auto-quality.ts`: a ceiling
  probe, then at most 7 bisection steps with lo starting one below the range
  (so the bottom of the range can win), so at most 8 encodes.
- **Budget.** 8 s plus 1 s per megapixel above 2 of the processed size, capped
  at 20 s. Once spent, no new probe starts.
- **No guessed commits.** A budget stop with a pass below the ceiling commits
  that pass ("stopped after n s"). A budget stop with nothing passing below
  the ceiling commits nothing ("Auto ran out of time on this large image;
  quality unchanged."). A ceiling that fails within budget commits 100 with
  the honest best score.
- **Caching.** Losing probes' URLs are revoked as soon as the search drops
  them; the winner goes into the session ResultCache under the key encodeSide
  computes after the commit, so the displayed result is a cache hit.
- **Cancel.** A new search, any change to the side's recipe (not only
  Quality), a format change, or a new or closed file cancels the running one.
- **Formats and bounds.** `AUTO_QUALITY_BOUNDS` covers every lossy encoder in
  the picker: WebP 0 to 100, AVIF 0 to 99, JPEG XL 7 to 99, jpegli 0 to 100.
  AVIF and JXL stop at 99 because their panels spell lossless as 100. JXL
  starts at 7 because its panel forces `lossyModular` below 7 and the probe
  substitutes `quality` alone, so a lower probe would score an encode the
  slider cannot produce (quality 7 is distance 13.2; no target lands there).
  MozJPEG left the picker; PNG has no quality. One `AutoQualityRow.svelte`
  serves all four panels, shown only in lossy mode and, for JXL, not while
  the lossless transcode runs (the worker refuses to score a transcode).
- **Measured (2026-11-04, Balanced):** on photo.jpg, Chromium and WebKit:
  WebP 74 in about 2 s, AVIF 57 in 3.9 s, JPEG XL 63 to 64 in 2.9 to 3.9 s,
  JPEG 54 to 55 in 1.9 s. On photo-large.jpg (12 MP): WebP 37 to 38 in 13 to
  21 s; in Chromium, AVIF stopped at the budget with 49 (score 72.7) after
  25 s, JPEG XL stopped with 30 (75.3) after 22 s, JPEG met it at 24 in 11 s.
- **Open question: downscaled scoring flatters blocky codecs.** JPEG at
  quality 24 on the 12 MP photo is lower than WebP's 37 on the same image.
  Above 4 MP the score runs on a box-shrunk pair (2x at 12 MP), which halves
  JPEG's 8x8 block edges before the metric sees them. A full-resolution
  centre crop of the same pixel count, or a crop scored alongside the
  shrunk pair (worse score counts), would judge artifacts at the size people
  view. Not built; needs a visual check of the 12 MP JPEG at 24 first.

## Objective

Add a one-shot **"Auto quality"** action to every lossy encoder panel (WebP,
AVIF, JPEG XL, MozJPEG). The user picks a perceptual target — *Visually
lossless*, *High*, *Balanced*, or *Compact* — and Frisp binary-searches the codec's
`quality` value until the encoded output's **SSIMULACRA2** score against the
source meets the target, then commits that quality to the normal options state
(slider moves, normal encode pipeline takes over). This turns "guess a quality
number" into "state an intent", using the codecs we already ship — the one
place an app can beat every other tool without writing a codec.

Two deliverables:

1. **`codecs/ssimulacra2/`** — a new single-threaded WASM module exposing a
   stateless scoring function, built from Cloudinary's reference C++
   implementation (BSD-3-Clause, same license family as the other codecs).
2. **The search engine + UI** — an `autoQuality(index, target)` method on
   `EditorSession` modeled directly on the parked branch's proven `fitToSize`
   bisection (branch `claude/clever-swartz-2b34ed`, kept deliberately as idea
   material), routed through the current decoded-source cache.

## Non-goals

- **No persistent auto mode.** This is a one-shot action that *sets* the
  quality slider, not a sticky mode that re-searches on every edit. (A
  persistent per-image auto target for bulk is a natural v2 — design later,
  after bulk Phase 3 overrides.)
- **No bulk integration in v1.** Single-image editor only.
- **No fit-under-file-size mode.** That is the parked branch's separate
  feature; do not merge it into this work.
- **No `_mt` (threaded) variant of the ssimulacra2 module.** Single-threaded
  is enough; the metric is far cheaper than the encodes it sits between.
- **No effort/speed substitution during the search.** Probes run at the
  user's current effort/speed settings so the committed quality is honest.
  (Fast-probe-then-final-encode is a later optimization; see Edge cases.)
- **No changes to `encode-signature.ts` or `result-cache.ts`.** The search
  works *through* them, not by modifying them.

## Codebase assumptions (re-verify before starting)

- `EditorSession` at `src/lib/editor/editor-session.svelte.ts` with
  `#preparedSource(bridge, preprocessorState)` decoded-source cache (~line
  465) and per-side persistent bridges via `bridgeFor(index)` (~line 451).
- `compressPreprocessed(prepared, request, signal, bridge)` at
  `src/lib/compress.ts` (~line 157) returning a `CompressOutcome` with
  `outputSize`, `outputImageData`, `sourceImageData`, `outputUrl`.
- Codec worker at `src/worker/codec-worker.ts`; asset manifest
  `src/shared/codec-asset-records.json`; SW precache plan
  `src/sw/cache-plan.ts`; worker returns use Comlink transfer (WS-D(a)).
- Encoder metas under `src/features/encoders/<codec>/shared/meta.ts` with
  `defaultOptions.quality`: webP 80, avif 50, jxl 75, mozJPEG 75.
- Per-codec control registries from the WS-G engine slice (see
  `tests/unit/controls.test.ts`).
- Parked branch `claude/clever-swartz-2b34ed` still exists (do NOT delete it;
  read `fitToSize` in its `editor-session.svelte.ts`, ~line 673, as the
  algorithm reference).

If any of these moved, `git log --follow` the file and adapt — do not
reinvent the seam.

## Part 1 — `codecs/ssimulacra2/` WASM module

**Source:** pin the latest commit of <https://github.com/cloudinary/ssimulacra2>
(record the exact SHA in the Makefile `CODEC_URL` and in
`docs/codec-provenance.md`, per that doc's rules). The C++ implementation
needs only **libhwy** for the metric core — the libpng/libjpeg/lcms2
dependencies belong to its CLI image loader, which we do not build. Follow
the build conventions of the existing codec Makefiles (see
`codecs/oxipng/Makefile` / `codecs/avif/Makefile` for the emsdk pattern) and
`docs/codec-build-notes.md` for the toolchain (emsdk 3.1.0 sweep of 2026-06).

**Wrapper** (`codecs/ssimulacra2/ssimulacra2.cpp`) — this shape is fixed;
it deliberately mirrors the deleted `codecs/visdif/visdif.cpp` (see commit
`7bd03980^` for reference) but stateless and RGBA-first:

```cpp
#include <emscripten/bind.h>
#include <emscripten/val.h>
// ssimulacra2.h from the pinned source

using namespace emscripten;

// ref and dist are RGBA8 buffers (4*width*height bytes), sRGB, straight alpha.
// Returns the SSIMULACRA2 score (100 = mathematically lossless, 90 = visually
// lossless, 70 = high quality), or -1000.0 on failure (dimension mismatch,
// image smaller than 8x8).
double score(std::string ref, std::string dist, int width, int height);

EMSCRIPTEN_BINDINGS(my_module) {
  function("score", &score);
}
```

Implementation notes for `score`: convert both RGBA8 buffers to the float
planar representation the pinned source expects (it handles sRGB→linear→XYB
internally — read `ssimulacra2.cc` in the pinned source and feed it the input
type it declares; do not re-implement color math in the wrapper). Alpha is
ignored in v1 (composite is a later refinement; note it in a comment).

**Artifacts:** `codecs/ssimulacra2/pkg/` with the `.js` + `.wasm` pair, named
and registered exactly like the other single-threaded codec modules in
`src/shared/codec-asset-records.json` (one record, no `_mt` variant), and
added to the SW precache plan the same way. Run `npm run sync` if the
Emscripten wrapper patching applies.

## Part 2 — search engine and UI

### Interfaces & data shapes

```ts
// src/lib/editor/auto-quality.ts (new file — pure helpers, no Svelte)

export type AutoQualityTarget =
  | 'visually-lossless'
  | 'high'
  | 'balanced'
  | 'compact';

// SSIMULACRA2 scale (per the reference README): 90 = visually lossless,
// 70 = high ("artifacts perceptible but not annoying"), 50 = medium/fair.
// Targets sit on/near those published anchors. 'compact' (maintainer,
// 2026-07-11) deliberately accepts visible-but-fine slight loss for
// byte-sensitive targets; these four presets are shared verbatim with the
// planned CLI (frisp-cli-analysis.md).
export const AUTO_QUALITY_TARGETS: Record<AutoQualityTarget, number> = {
  'visually-lossless': 90,
  high: 80,
  balanced: 70,
  compact: 60,
};

// Per-format quality bounds for the search. hi avoids lossless-mode cliffs.
export const AUTO_QUALITY_BOUNDS: Record<string, { lo: number; hi: number }> = {
  webP: { lo: 0, hi: 100 },
  avif: { lo: 0, hi: 99 },  // 100 flips libavif into lossless mode
  jxl: { lo: 7, hi: 99 },   // <7 flips lossyModular; 100 is lossless
  mozJPEG: { lo: 0, hi: 100 },
};
```

`EditorSession` gains (mirroring the parked branch's `fitToSize` state
verbatim in shape): `autoQualityRunning: boolean[]` per side,
`#autoQualityControllers: (AbortController | null)[]`, and:

```ts
async autoQuality(index: 0 | 1, target: AutoQualityTarget): Promise<void>
```

### The search algorithm (fixed — place unchanged, adapt identifiers only)

Objective: the **lowest integer quality whose score ≥ target** (smallest
bytes that still meet the intent). Score is treated as monotonic
non-decreasing in quality; bisection therefore keeps the invariant
"best known passing quality" and narrows below it.

```ts
const { lo: minQ, hi: maxQ } = AUTO_QUALITY_BOUNDS[side.format];
const targetScore = AUTO_QUALITY_TARGETS[target];

// Ceiling probe: if even maxQ can't reach the target, commit maxQ honestly
// and tell the user instead of pretending.
const ceil = await probe(maxQ); // {score, outputSize}
if (ceil.score < targetScore) {
  commit(maxQ);
  snackbar(`Best this format can do here is ${fmtScore(ceil.score)} — used quality ${maxQ}.`);
  return;
}

let lo = minQ;        // known/assumed failing side
let hi = maxQ;        // known passing side
let best = maxQ;
for (let i = 0; i < 7 && hi - lo > 1; i++) {
  const mid = Math.round((lo + hi) / 2);
  if (mid === lo || mid === hi) break;
  const p = await probe(mid);
  if (p.score >= targetScore) {
    best = mid;
    hi = mid;
  } else {
    lo = mid;
  }
}
commit(best);
```

`probe(quality)` builds the request from a snapshot of the side's current
options with only `quality` substituted, then:

1. `#preparedSource(bridge, preprocessorState)` — never `compressFile`; the
   decoded-source cache is what makes probes cheap (the parked branch
   predates it — this is the one deliberate deviation from its code).
2. `compressPreprocessed(prepared, request, signal, bridge)`.
3. Scores `outcome.outputImageData` against `outcome.sourceImageData` via the
   new worker op (below), on the **same side's bridge** (serial per-side
   queue is correct and expected).
4. `URL.revokeObjectURL(outcome.outputUrl)` immediately — probes keep only
   `{score, outputSize}` (parked-branch discipline; prevents URL leaks).

`commit(quality)` replaces the side's options object with
`{...options, quality}` exactly the way `fitToSize` does (new object so the
panel `{#key}` remounts and the normal encode `$effect` runs the final,
displayed encode — which for `best` is usually a `ResultCache` hit).
Snackbar on success: `Auto quality: ${label} met at quality ${best}
(score ${fmtScore(...)}).`

Re-entry/cancel: same pattern as `fitToSize` — an `AbortController` per side,
starting a new search or changing format/file aborts the old one; abort must
also stop between probe and commit (check `signal.aborted` before `commit`).

### Codec-worker op

Add to `src/worker/codec-worker.ts`:

```ts
async ssimulacra2Score(ref: ImageData, dist: ImageData): Promise<number>
```

Lazy-loads the ssimulacra2 module on first call (same dynamic-import pattern
as the codec encoders), validates `ref.width === dist.width &&
ref.height === dist.height` (throw on mismatch), calls the WASM `score`,
returns the number. Inputs arrive via Comlink transfer like every other
worker op (WS-D(a) pattern) — but note the caller must **not** transfer
buffers it still needs; pass copies if `sourceImageData` is the cached
decoded frame (it is — see Anticipated mistakes #4).

### UI

One new row in each of the four lossy option panels
(`src/lib/editor/options/{WebpOptions,AvifOptions,JxlOptions,MozjpegOptions}.svelte`),
visually grouped with the Quality slider: a compact select labeled
**Auto** with options *Visually lossless*, *High*, *Balanced*, *Compact* and
a Go button (or a select that fires on choose and resets to placeholder —
match whichever idiom `OptionsPanel.svelte` already uses for one-shot
actions; the parked branch's fit-under-target row is the style reference).
While running: the row shows a small busy state and a Cancel affordance;
the quality slider stays enabled (moving it cancels the search).

Hide the row when the current options are in a lossless mode (webP
`lossless: 1`, avif quality pinned 100, jxl quality 100) — auto-targeting a
perceptual score is meaningless there.

**Do not** add `autoQuality` to `EncodeOptions`, `defaultOptions`,
`encode-signature.ts`, or settings persistence — it is an action, not an
output-affecting option. It therefore also needs **no** WS-G control-registry
entry (registries track output-affecting fields only).

## Edge cases

| Input | Required behavior |
|---|---|
| Ceiling probe already ≥ target at `maxQ`, and so is every lower probe | Search proceeds normally; commits the lowest passing quality (can be `minQ`). |
| Even `maxQ` scores below target (heavy resize/quantize upstream, tiny image) | Commit `maxQ`, snackbar the honest "best achievable" message (verbatim shape above). Never loop. |
| Image smaller than 8×8 after preprocessing | WASM `score` returns -1000 → treat as "score below any target" on the ceiling probe → commit `maxQ` with the honest message. |
| Non-monotonic wobble (score dips as quality rises near a mode boundary) | Tolerated by design: bisection keeps the best *passing* probe; worst case commits a slightly higher quality than optimal. No special handling. |
| User changes format/file/options mid-search | Abort the search (existing controller pattern); commit nothing. |
| Both sides run auto-quality simultaneously | Allowed — each side has its own bridge and controller; no shared state beyond `ResultCache` (which dedups by signature anyway). |
| 12 MP image on AVIF at default speed | Works but slow (~7 encodes). Acceptable in v1; the busy state + cancel is the mitigation. Do NOT silently downscale or change speed. |
| Quantize (palette reduction) active | Probes include it (it's in `processorState`) — correct: the target is judged on what the user will actually export. |

## Test plan

- **Unit (`tests/unit/auto-quality.test.ts`, new):** the bisection loop with
  a stubbed `probe` — asserts (a) lowest-passing-quality selection on a
  monotonic score table, (b) ceiling-probe bailout commits `maxQ`, (c) probe
  count ≤ 8, (d) abort between probe and commit commits nothing, (e) bounds
  respected per format (jxl never probes < 7, avif/jxl never probe 100).
  Extract the loop into `src/lib/editor/auto-quality.ts` as a pure function
  taking `probe`/`commit` callbacks precisely so this is testable.
- **E2E (extend `tests/e2e/` with `auto-quality.spec.ts`):** load
  `photo.jpg`, pick WebP, run Auto → *Balanced*; assert the quality value in
  the panel changed from the default 80, a download link exists, output has
  WebP magic bytes, and zero page errors (copy the `codec-encode.spec.ts`
  assertions). One Chromium run is enough; add the WebKit project only if it
  is free.
- **Bench note:** add SSIMULACRA2 scoring of each codec's default-settings
  output to `benchmarks/` ONLY if trivial; otherwise file it as the follow-up
  the benchmarks README already asks for. Not an acceptance gate.

## Acceptance criteria

1. `codecs/ssimulacra2/pkg/` exists, is registered in
   `src/shared/codec-asset-records.json` and the SW precache plan, and
   `docs/codec-provenance.md` records the pinned SHA + license.
2. Scoring sanity: identical images score ≥ 99.5; `photo.jpg` vs its own
   WebP-quality-10 encode scores < 70 (assert in the unit/e2e layer wherever
   the module can be loaded — a tiny e2e helper is fine).
3. All four lossy panels show the Auto row; lossless modes hide it.
4. Running Auto → *Balanced* on `photo.jpg`/WebP commits a quality < the
   default 80 (Balanced=70 is well below default quality's typical score) and
   the final displayed encode matches the committed quality.
5. `npm run check`, `npm run test:unit`, `npm run test:e2e` all pass.
6. No change to `encode-signature.ts`, `result-cache.ts`, `EncodeOptions`
   types, or stored settings schema (`app:settings:v3` frozen).
7. Search never issues more than 8 encodes (1 ceiling + ≤7 bisection).

## Verification

```
npm run check
npm run test:unit
npm run test:e2e
npm run bench && npm run bench:compare   # must show zero codec regressions
```

Manual: dev server → drop `tests/fixtures/photo.jpg` → WebP → Auto →
*Visually lossless* → watch the slider move; toggle to AVIF and repeat;
cancel mid-search and confirm the slider/result are untouched.

## Guardrails

- Do NOT touch `codecs/**` beyond adding the new `codecs/ssimulacra2/`
  directory (provenance rules in `docs/codec-provenance.md` apply).
- Do NOT delete or rebase branch `claude/clever-swartz-2b34ed`.
- Do NOT modify `fitToSize` remnants if any exist on main (they don't today).
- Do NOT add the metric to the encode hot path — it runs only during an
  explicit auto-quality search.
- Do NOT persist anything new to localStorage.
- If the ssimulacra2 WASM build fights emsdk for more than ~2 hours, STOP
  and record findings in `docs/codec-build-notes.md` — do not substitute a
  JS reimplementation of the metric.

## Anticipated mistakes

1. **Using `compressFile` for probes** (copying the parked branch verbatim)
   — re-decodes the source every probe on the main thread. The spec's probe
   path (`#preparedSource` + `compressPreprocessed`) is mandatory; check the
   diff for any `compressFile(` call inside the search.
2. **Searching for the *highest* passing quality.** The objective is the
   *lowest* quality meeting the target (smallest file). The invariant is
   `hi` = passing, `lo` = failing; a literal-minded copy of `fitToSize`
   (which maximizes quality under a byte budget) inverts this. The unit test
   (a) catches it.
3. **Adding an `autoQuality` field to `EncodeOptions`/signature/settings** —
   it's an action. Criterion 6 catches it.
4. **Transferring the cached decoded frame's buffer to the worker** — the
   Comlink transfer pattern detaches ArrayBuffers; `sourceImageData` may be
   the shared decoded-source cache entry. Clone before transfer (or pass
   without transfer for the metric call); a detached-buffer crash on the
   *second* probe is the symptom.
5. **Letting AVIF/JXL probe quality 100** — flips lossless mode, which has
   different fields/semantics and poisons the search. Bounds table + unit
   test (e) catch it.
6. **Forgetting `URL.revokeObjectURL` per probe** — leaks one blob URL per
   probe. Grep the search body for `revokeObjectURL`.
7. **Registering an `_mt` variant or adding the module to the threaded
   precache variants** — it has none; the SW plan must list it once.

## If things break

- **Scores look absurd (negative, or ~0 for identical images):** RGBA→planar
  conversion in the wrapper is wrong (stride/order), or the pinned source's
  input type changed — re-read `ssimulacra2.cc`'s entry point; test the
  module standalone in Node with two identical buffers first.
- **Second probe crashes with detached ArrayBuffer:** Anticipated mistake #4.
- **Search commits but the displayed result doesn't update:** the options
  object was mutated instead of replaced — `commit` must assign a NEW object
  so the `$effect` and `{#key}` fire (see `fitToSize`'s finish block).
- **Search never converges / runs 8 encodes every time on tiny images:**
  bounds not integer-collapsed — check the `hi - lo > 1` and `mid === lo`
  exits.
- **e2e flake on WebKit:** run the metric op serially after the encode on the
  same bridge (it already is, if the spec was followed); if the module fails
  to instantiate on WebKit, check it wasn't accidentally built with pthread
  flags (single-threaded module must not require COOP/COEP beyond what the
  app already sets).

---

**TLDR:** New `codecs/ssimulacra2/` WASM module (stateless `score(ref, dist,
w, h)`), plus a one-shot Auto-quality action on the four lossy panels that
bisects quality (≤8 encodes, decoded-source-cached probes) to the lowest
quality meeting a SSIMULACRA2 target (90/80/70), committing it to the normal
options state. No persistent mode, no bulk, no signature/cache changes.

Spec: `docs/project/specs/2026-07-11-auto-quality-mode.md`

Handoff (build/metric half is mechanical; the C++ wrapper + search loop are
given verbatim):
`codex exec -C /Users/tav/Development/Tavlean/Frisp -s workspace-write -m gpt-5.6-sol -c model_reasoning_effort="low" "Implement docs/project/specs/2026-07-11-auto-quality-mode.md exactly. Follow its guardrails. Do not commit or push. Report PASS or FAIL against each acceptance criterion."`
