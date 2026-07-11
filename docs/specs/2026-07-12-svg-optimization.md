# Spec — SVG Optimization: vector lane + auto candidate search + benchmark

Last updated: 2026-07-12. Status: **in progress** (stage states below).
Decision record: [../svg-optimization-analysis.md](../svg-optimization-analysis.md).
Maintainer priority: above the codec batch. Phases 1+2 of the analysis ship
together here; bulk SVG preservation and font subsetting are OUT of scope.

## Goal

An SVG dropped into Frisp gets a first-class "SVG (optimized)" output: SVGO
v4.0.1 running in a lazy worker, an **auto mode** that searches candidates and
verifies each one visually before keeping the smallest, honest raw+gzip size
reporting, and a **vector-true preview** (crisp at any zoom). A benchmark
harness proves where Frisp stands vs vecta nano, ImageOptim, and nano→ImageOptim
chained.

## Non-goals (v1)

- Bulk preserve-format SVG (bulk keeps rasterizing SVGs; wording only).
- Font embedding/subsetting; lossy curve refitting (analysis Phase 3).
- SVG output for raster sources (no raster→vector).
- `removeOffCanvasPaths`/`removeDimensions` in auto mode (manual-only toggles).

## Locked decisions

| Decision | Value |
|---|---|
| Engine | `svgo@^4.0.1` (NOT 4.0.0 — XML-entity DoS), `svgo/browser` import, dedicated module worker |
| Never bundle | svgcleaner (GPL + dead), oxvg (pre-1.0), any hosted API |
| SW policy | SVGO chunk EXCLUDED from install precache; runtime-cached on first SVG use |
| Preview | Vector sides render as layout-sized `<img>` (blob URL), NEVER a transform-scaled frozen bitmap; offscreen raster only for the diff gate |
| Compressed-size lib | `fflate` (`gzipSync`, level 9) in the worker |
| Visual gate | `pixelmatch` (threshold 0.1), mismatch ratio vs **painted-union** pixels ≤ 5e-4, at 3 sizes × 2 backgrounds |
| Rotate | Hidden for SVG sources in v1 (the vector lane can't honestly express it; raster-side rotate on an SVG source is deferred with it) |
| Settings | `app:settings:v3` payload extended backward-compatibly (`optionsByFormat.svg`); key NEVER renamed |
| Defaults | mode `auto`, precision 3, multipass on, keep title/desc ON, all aggressive toggles off |

## Architecture

```
SVG source file
  ├─ vector lane (format 'svg'): source text → [worker: svgo+gzip] → SVG File
  │     preview: <img> at zoom×natural layout size (original AND optimized)
  │     auto mode: main thread renders candidates → pixelmatch gate → smallest gzip wins
  └─ raster lane (unchanged): rasterize → processors → WASM codec
```

The invariant "every side is ImageData in/out" stays true for the raster lane;
the vector lane bypasses `compressPreprocessed` entirely and produces a
`CompressOutcome` whose pixels exist only to serve legacy consumers (cache
accounting, bulk hydration); display uses the file URL.

## Authored contracts (place UNCHANGED; wire everything else to these)

### 1. Options — `src/lib/svg/optimize-options.ts`

```ts
/**
 * The SVG lane's complete recipe — the ONLY state hashed into its encode
 * signature. Raster processor/preprocessor state never applies to this lane.
 */
export interface SvgOptimizeOptions {
  /** 'auto' searches candidates behind a visual gate; 'manual' applies the
   *  knobs below directly. Auto respects keepTitleDesc (a semantic policy,
   *  not a size knob) and ignores the other manual toggles. */
  mode: 'auto' | 'manual';
  /** Decimal places for numeric/path data, 0–4. Transform precision is
   *  derived as min(precision + 2, 5) — transforms need headroom (matrix
   *  math amplifies rounding); never set them uniformly. */
  precision: number;
  multipass: boolean;
  /** Keep <title>/<desc> (accessibility metadata). Default ON. */
  keepTitleDesc: boolean;
  /** Aggressive extras — manual mode only; each is individually risky and
   *  the compare view is the safety net. */
  reusePaths: boolean;
  convertStyleToAttrs: boolean;
  removeOffCanvasPaths: boolean;
  removeDimensions: boolean;
}

export const DEFAULT_SVG_OPTIONS: SvgOptimizeOptions = {
  mode: 'auto',
  precision: 3,
  multipass: true,
  keepTitleDesc: true,
  reusePaths: false,
  convertStyleToAttrs: false,
  removeOffCanvasPaths: false,
  removeDimensions: false,
};
```

### 2. SVGO config builder — `src/lib/svg/svgo-config.ts`

Pure function, unit-tested. Signature:

```ts
import type { Config } from 'svgo/browser';

/** One concrete candidate: a full SVGO run configuration. */
export interface SvgCandidate {
  /** Stable id surfaced in the UI winner badge, e.g. 'p2+reusePaths'. */
  id: string;
  precision: number;
  addons: ('reusePaths' | 'convertStyleToAttrs' | 'removeOffCanvasPaths')[];
  config: Config;
}

export function buildSvgoConfig(opts: {
  precision: number;
  multipass: boolean;
  keepTitleDesc: boolean;
  addons: SvgCandidate['addons'];
  removeDimensions?: boolean;
}): Config;
```

Config rules (v4 semantics — verify against svgo.dev during S1):

- Base = `preset-default` with `overrides`:
  - `cleanupNumericValues: { floatPrecision: precision }` (this plugin has no
    transform params — verified against v4.0.1 source)
  - `convertPathData: { floatPrecision: precision, transformPrecision: min(precision + 2, 5) }`
  - `convertTransform: { floatPrecision: precision, transformPrecision: min(precision + 2, 5), degPrecision: min(precision + 2, 5) }`
    (degPrecision pinned for deterministic output; default is 3)
  - `removeDesc: false` when `keepTitleDesc` (note: `removeTitle` is NOT in
    the v4 preset; `removeDesc` IS — only the latter needs disabling).
- Addons append the named plugins after the preset. `reusePaths` is followed
  by `removeXlink` (correct for modern-browser/SVG-2 output, which is Frisp's
  target; converts generated `xlink:href` to `href`).
- API facts verified against v4.0.1 source 2026-07-12: `optimize` +
  `Config` type both import from `'svgo/browser'`; malformed XML makes
  `optimize()` THROW (worker must catch); pixelmatch is v7, ESM default
  export, accepts `ImageData.data` directly, returns mismatch count.
- `multipass` set at the top level of `Config`.
- NEVER enable `removeViewBox`.

### 3. Worker protocol — `src/lib/svg/svg-worker-protocol.ts` + worker

```ts
export interface SvgOptimizeJob {
  id: number;
  source: string;
  config: import('svgo/browser').Config;
}

export interface SvgOptimizeReply {
  id: number;
  ok: boolean;
  /** Present when ok. */
  svg?: string;
  rawBytes?: number;   // UTF-8 length of `svg`
  gzipBytes?: number;  // fflate gzipSync(level 9) length
  error?: string;      // present when !ok; message only, no stack
}
```

`src/lib/svg/svg-optimizer.worker.ts`: module worker; imports
`{ optimize } from 'svgo/browser'` and `{ gzipSync, strToU8 } from 'fflate'`;
one message in → one reply out; a thrown `optimize` surfaces as `ok: false`.
`src/lib/svg/optimizer-client.ts`: lazy `new Worker(new URL(...), { type:
'module' })`, monotonically increasing job ids, per-job Promise map,
AbortSignal support (abort = reject + terminate + null the worker so next use
restarts it — mirrors the codec bridge's terminate-on-abort philosophy).

### 4. Signature — `src/lib/editor/encode-signature.ts`

Add to `sideRecipe` (verbatim, as the first statement):

```ts
// The SVG lane's output depends ONLY on its optimizer options: raster
// processors/preprocessors never touch it, so they must not be able to
// cause a miss (or a stale-state false edit in history).
if (format === 'svg') {
  return { format, options: options ?? {}, grain: null, quantize: null, resize: null };
}
```

`encodeSignature` keeps hashing `preprocessorState` for all formats; that is
acceptable in v1 ONLY because rotate is hidden for SVG sources (locked
decision) — the preprocessor is therefore constant while an SVG is loaded. If
rotate ever un-hides, revisit.

### 5. Outcome — `src/lib/compress.ts`

- `export type SideFormat = OutputFormat | 'identity' | 'svg';`
- `CompressOutcome` gains an optional field:

```ts
/** Present only on vector-lane results (format 'svg'): the text +
 *  transfer-size facts the raster fields can't express. The identity side
 *  carries no svg field — the UI reads originalGzipBytes from here. */
svg?: {
  optimizedText: string;
  rawBytes: number;
  gzipBytes: number;
  originalGzipBytes: number;
  /** Auto mode's winning candidate id (e.g. 'p2+reusePaths'); undefined in
   *  manual mode. */
  winner?: string;
};
```

- `getDefaultOptions('svg')` returns `structuredClone(DEFAULT_SVG_OPTIONS)`.
- The vector lane itself lives in `src/lib/svg/optimize.ts` (NOT inside
  `compressPreprocessed`): input = source SVG text + `SvgOptimizeOptions` +
  AbortSignal + optimizer client; output = a full `CompressOutcome` (renders
  original + optimized at natural size via `src/lib/svg/render.ts` to fill
  the ImageData fields; `outputFile` = optimized text as
  `File([...], name, { type: 'image/svg+xml' })`).

### 6. Auto search — `src/lib/svg/auto-search.ts` (main thread)

```
render original at sizes S = [64, 256, min(natural, 1024)] × backgrounds
  B = [#fff, #202124]  (composite; 6 reference bitmaps, rendered ONCE)

ladder: for p of [3, 2, 1, 0]:
  candidate = base(p, multipass on)
  optimize in worker; render candidate at S×B; gate each rendering:
    pixelmatch(threshold 0.1); painted-union denominator
      (union of pixels with alpha > 0 in either image, computed pre-composite);
    pass ⇔ mismatched / max(paintedUnion, 1) ≤ 5e-4 for ALL S×B
  if p == 3 and gate FAILS: try p=4; if that fails too → manual preset-default
    p=3 result WITHOUT gate demotion is still shown, but winner = 'p3!' and
    the UI marks it "verify visually" (never silently ship a gate failure).
  if gate fails at p < 3: stop descending (keep last passing).
P* = lowest passing precision.
addons: try 'reusePaths' and 'convertStyleToAttrs' each alone at P*;
  keep an addon iff gate passes AND gzipBytes strictly decreases.
  If both kept → also try combined; same keep rule.
winner = smallest gzipBytes among all gated passers;
  ties → smaller rawBytes → fewer addons → higher precision.
Abort-check between every candidate (signal from the encode effect).
```

Determinism: no randomness, so a given (source, options) always yields the
same winner — signatures and the result cache stay valid.

### 7. Vector-true preview

For SVG sources, BOTH the identity side and the `'svg'` side display as an
absolutely positioned `<img src={blobUrl}>` inside the two-up, with **CSS
layout width/height = naturalSize × zoom** and pan applied as translation.
Layout-sizing (not `transform: scale`) is the invariant: browsers rasterize
SVG images at layout size, so every zoom step re-rasterizes — crisp at any
magnification. The canvas path stays for raster sides; mixed SVG-vs-raster
sides share the same geometry so the divider still lines up.

If the pinch-zoom component can only express zoom as a transform, the
fallback is: transform during the gesture, then on settle (~120 ms quiet) set
layout size and reset the transform to 1. Either way the ACCEPTANCE TEST is:
zoom ≥ 32× on `tests/fixtures`' SVG in Chromium AND WebKit — edges must be
crisp (no bitmap softening) once the gesture settles.

### 8. Service worker

Exclude the SVG-optimizer chunks (the worker chunk + the svgo/fflate/
pixelmatch vendor chunks reachable only from it) from `appShellUrls` in
[src/service-worker.ts](../../src/service-worker.ts) via a filename predicate
(the build emits identifiable names; verify in `.svelte-kit/output`). They
stay in `assets`, so the existing fetch handler runtime-caches them on first
use. Acceptance: the install precache list contains NO svgo chunk; after one
SVG optimization, reload offline → SVG optimization still works.

## Touch list (beyond the authored files)

| File | Change |
|---|---|
| [src/lib/editor/editor-session.svelte.ts](../../src/lib/editor/editor-session.svelte.ts) | Cache source SVG text once per file; `encodeSide` dispatches `format === 'svg'` → vector lane; `availableFormats` becomes `$derived` (adds `{ id: 'svg' }` entry only when `isVectorSource`); default right-side format = `'svg'` when an SVG loads (respect saved settings if present) |
| [src/lib/editor/OptionsPanel.svelte](../../src/lib/editor/OptionsPanel.svelte) | `format === 'svg'` → hide Edit section (resize/grain/quantize), mount `SvgOptions.svelte`; hide rotate for SVG sources |
| `src/lib/editor/options/SvgOptions.svelte` (new) | Auto/manual toggle; precision slider (0–4); keep title/desc; advanced disclosure with the four aggressive toggles (risk-worded); winner badge in auto mode |
| [src/lib/editor/format-label.ts](../../src/lib/editor/format-label.ts) | `'svg'` → label "SVG", ext `svg` |
| Results/size display | For sides with `outcome.svg`: second line "N kB gzipped" (both sides' gzip shown for honest comparison) |
| [src/lib/editor/settings-storage.ts](../../src/lib/editor/settings-storage.ts) | `isValidFormat` accepts `'svg'`; `optionsByFormat.svg` round-trips; old payloads stay valid |
| [src/lib/result-cache.ts](../../src/lib/result-cache.ts) | Byte accounting adds `svg.optimizedText.length` when present (comment: text is cheap, count it anyway) |
| [src/service-worker.ts](../../src/service-worker.ts) | Precache exclusion (contract §8) |
| [src/lib/editor/output/Output.svelte](../../src/lib/editor/output/Output.svelte) + two-up | Vector preview (contract §7) |
| e2e | New spec: drop SVG → default 'svg' side → assert output bytes parse as SVG + smaller; toggle manual precision; offline-after-first-use is manual QA |
| Docs | user-guide (formats + new svg page), parity-audit (new capability), STATUS, WORKLOG |

## Stages & state

Each stage = one Codex task; orchestrator reviews the diff line-by-line,
runs gates, commits. Baseline at spec time: `npm run check` clean, **123 unit
tests**, 61+ e2e green. No stage may reduce those.

| Stage | Scope | Gate | State |
|---|---|---|---|
| S1 | deps (svgo/fflate/pixelmatch) + `src/lib/svg/*` core (options, config builder, worker, client, render) + unit tests | check + unit | ⚪ |
| S2 | lane integration: compress.ts, encode-signature, editor-session dispatch, settings, format-label, result-cache | check + unit + manual smoke | ⚪ |
| S3 | UI: SvgOptions panel, OptionsPanel wiring, size display, availableFormats, rotate hiding | check + svelte-autofixer + manual | ⚪ |
| S4 | vector-true preview (contract §7) | crispness acceptance test | ⚪ |
| S5 | auto mode (auto-search + gate + UI badge) | unit (gate math) + manual | ⚪ |
| S6 | SW exclusion + e2e suite + docs sweep | check + full e2e | ⚪ |
| S7 | benchmark corpus + harness (below) | harness runs green | ⚪ |
| S8 | external baselines (nano, ImageOptim, nano→ImageOptim) + report | report published | ⚪ |

## Benchmark plan (S7–S8)

Lives in `benchmarks/svg/`. Purpose: a defensible answer to "where does Frisp
stand vs nano, ImageOptim, and nano→ImageOptim".

- **Corpus** (`benchmarks/svg/corpus/`, with a `MANIFEST.json` recording
  source/license/sha256 per file): ~200 files stratified — stroke icons
  (Lucide/Tabler), fill icons (Material/simple-icons), multi-color (Twemoji/
  OpenMoji), logos with gradients/masks, flat illustrations (unDraw-class),
  dirty editor exports (Figma/Illustrator/Inkscape exports of the same
  drawings where possible), adversarial (text, `<use>`, filters, evenodd,
  tiny/huge coordinate systems, embedded raster). Public sources only,
  licenses recorded.
- **Frisp runners**: Playwright drives Chromium loading a minimal bench page
  that imports the REAL app modules (`svgo-config`, `auto-search`, worker) —
  the browser rendering in the gate is the production truth, not a Node
  re-implementation. Two configurations: `frisp-safe` (manual defaults) and
  `frisp-auto`.
- **External baselines**, run on COPIES of the corpus, outputs + settings +
  dates + hashes archived under `benchmarks/svg/external/`:
  - nano: via vecta.io/nano (10-file batches; record any visual warnings).
  - ImageOptim: `/Applications/ImageOptim.app` (installed) on file copies;
    record app version + Lossy setting; run default AND lossy.
  - chained: nano output → ImageOptim.
- **Metrics** per file/tool: raw bytes, gzip-9 bytes (same gzip impl for all
  tools — fflate via a Node script), visual pass/fail vs original (same gate
  as auto mode), errors. Aggregates: median + geomean ratio, p10/p90,
  win/tie/loss (tie = within max(4 B, 0.1%)), per-stratum tables.
- **Report**: `benchmarks/svg/RESULTS.md` — the "clear picture" deliverable.

## Gotchas (read before implementing)

- `createImageBitmap(svgBlob)` is NOT reliably supported — SVG rasterization
  must use the main-thread `<img>` path (reuse `processSvg`/`blobToImg` from
  [image-pipeline-shared.ts](../../src/client/lazy-app/image-pipeline-shared.ts);
  Safari's `img.decode()` SVG bug workaround already lives there).
- SVGs without width/height need the viewBox dimension injection that
  `processSvg` already does — reuse it, don't reimplement.
- MIME sniffing: `.svg` files can arrive with empty `type` — the lane
  classifier is MIME OR extension + bounded text sniff (`<svg`/`<?xml`
  within the first 1 KB after whitespace/BOM/comments).
- Never `{@html}` any SVG text; preview only via blob-URL `<img>`.
- Cap input size (5 MB, matching nano's own limit) and per-candidate
  optimize time (10 s watchdog → treat as failed candidate).
- Keep original file when optimization fails or output ≥ input ("keep
  original" outcome, same philosophy as bulk's keep-when-larger).
- Style contract for every delegated diff: match
  [encode-signature.ts](../../src/lib/editor/encode-signature.ts) /
  [result-cache.ts](../../src/lib/result-cache.ts) — header comments state
  why-it-exists and constraints code can't show; no defensive bloat; no
  restating the diff in comments.
