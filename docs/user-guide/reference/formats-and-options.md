# Formats & encoder options reference

Code-derived inventory of every output format and every encoder option exposed
in the Frisp editor. Sources:

- `src/lib/compress.ts` — `OUTPUT_FORMATS` and the `identity`/"Original" pseudo-format.
- `src/lib/editor/OptionsPanel.svelte` — per-format panel dispatch + the generic
  quality-slider / "no adjustable options" fallback.
- `src/lib/editor/options/*Options.svelte` — the per-encoder panels.
- `src/features/encoders/<id>/shared/meta.ts` — `label`, `extension`, `mimeType`,
  `defaultOptions`, enums.
- `codecs/<id>/enc/<id>_enc.d.ts` — the raw `EncodeOptions` interface for each WASM
  codec (the source of truth for _hidden_ options).

Notes that apply throughout:

- **Range step default**: `Range.svelte` defaults `step = 1` when none is passed.
  The on-screen value bubble shows `value/1000` with a `k` suffix once `value ≥ 10000`.
  Quality sliders are all whole numbers (`step 1`); there is no decimal Quality.
- **Magnetic snapping on wide sliders**: when `max − min ≥ 50` (Quality, filter
  strength, smoothing, …) the slider gently snaps toward multiples of 5/10 while
  dragging — round numbers are easier to land on, but every value stays reachable
  and the number field beside the slider takes an exact value. Narrow knobs
  (effort, sharpness, etc.) keep the plain drag.
- **"Effort" mappings are UI-only inversions.** Several panels invert or remap the
  raw codec field (e.g. AVIF effort = `10 − speed`, WebP lossless "Effort" picks a
  preset pair, WebP filter sharpness = `7 − filter_sharpness`). The _option key_
  columns below name the raw codec field; the _control_ columns describe the slider.
- **Default value** columns give the value from `meta.ts` `defaultOptions`, expressed
  in the UI's terms where the panel remaps it.

---

## Format roster (`OUTPUT_FORMATS` order)

| UI label           | id            | ext        | mime          | lossy/lossless     | Has panel?                                |
| ------------------ | ------------- | ---------- | ------------- | ------------------ | ----------------------------------------- |
| Original Image     | `identity`    | (original) | (original)    | passthrough        | n/a (no Compress options)                 |
| WebP               | `webP`        | `webp`     | `image/webp`  | both               | yes                                       |
| AVIF               | `avif`        | `avif`     | `image/avif`  | both               | yes                                       |
| JPEG XL            | `jxl`         | `jxl`      | `image/jxl`   | both               | yes                                       |
| JPEG               | `jpegli`      | `jpg`      | `image/jpeg`  | lossy              | yes                                       |
| PNG                | `oxiPNG`      | `png`      | `image/png`   | lossless           | yes                                       |
| SVG                | `svg`         | `svg`      | `image/svg+xml` | optimizer (gated) | yes (`SvgOptions.svelte`)                 |

- The label/ext for `jxl` are read from `encoderMap.jxl.meta` so they stay in
  sync (hence "JPEG XL"). `webP` and `avif` use hard-coded labels in
  `OUTPUT_FORMATS`. `jpegli` and `oxiPNG` are overridden to the plain format
  names **JPEG** and **PNG** (rather than the encoder names jpegli/OxiPNG); the
  underlying encoder is surfaced as a hover tooltip (title attribute) on the
  picker: JPEG→jpegli, PNG→OxiPNG, JPEG XL→libjxl, WebP→libwebp, AVIF→libaom.
- **One JPEG entry since 2026-11-04.** Until then the picker offered two JPEG
  encoders, "JPEG" (`mozJPEG`) and "JPEG (jpegli)". MozJPEG is no longer
  selectable: jpegli is faster on every bench fixture and about 7% smaller on
  photos at the shipped defaults. A saved side that chose `mozJPEG` loads as
  `jpegli` at the same quality (`migrateRetiredFormat` in
  `src/lib/editor/settings-storage.ts`). The MozJPEG codec and its panel are still
  in the build, but the service worker no longer precaches its encoder; its
  retirement is pending. The old jpegli tooltip claim "around 30% better
  compression" was removed because no measurement supports it.
- **Every raster output format is an always-available WASM codec** — there is no
  runtime feature detection. (QOI and the canvas/browser encoders were removed from
  the picker on 2026-06-27; QOI's decoder remains for import.)
- **`svg` is the one exception — a vector-source-only lane, not a raster codec.**
  It only appears in the picker when the source is an SVG (`isVectorSource`), where
  `availableFormats` prepends it (`SVG` label, `SVGO` tooltip) and side 1 defaults
  to it; it runs SVGO (JS, in a lazy worker) over the source text rather than
  encoding pixels. Its `lossy/lossless` cell reads "optimizer (gated)" because Auto
  mode trades numeric precision for size behind a multi-scale visual gate. See the
  dedicated section below.
- The format `<select>` always prepends an **"Original Image"** entry whose value
  is `identity`. (It no longer appends the source filename; a richer source-image
  info display is planned separately.)

---

## Original / `identity` (pseudo-format)

Not a real encoder. `IDENTITY = 'identity'`. The side shows the _preprocessed_
(rotated) source pixels on both before/after, downloads the original file as-is,
reports 0% change, and `getDefaultOptions('identity')` returns `{}`. The Compress
section renders no encoder options and the whole "Edit" (resize/reduce-palette)
block is hidden for this side.

---

## WebP (`webP`)

Panel: `WebpOptions.svelte`. Default options (`meta.ts`) are the full `WebPConfig`
struct. Lossless vs lossy splits the whole panel.

**Always visible**

| UI label                  | key        | control  | range / values | default |
| ------------------------- | ---------- | -------- | -------------- | ------- |
| Lossless                  | `lossless` | checkbox | 0/1            | 0 (off) |
| Preserve transparent data | `exact`    | checkbox | 0/1            | 0 (off) |

**Lossy mode (`lossless` off)**

| UI label | key       | control | range           | default |
| -------- | --------- | ------- | --------------- | ------- |
| Effort   | `method`  | range   | 0–6, step 1     | 4       |
| Quality  | `quality` | range   | 0–100, step 1   | 80      |

**Lossy → Advanced settings** (Revealer toggle, UI-only)

| UI label                    | key                 | control  | range / values                                        | default            |
| --------------------------- | ------------------- | -------- | ----------------------------------------------------- | ------------------ |
| Compress alpha              | `alpha_compression` | checkbox | 0/1                                                   | 1 (on)             |
| Alpha quality               | `alpha_quality`     | range    | 0–100, step 1                                         | 100                |
| Alpha filter quality        | `alpha_filtering`   | range    | 0–2, step 1                                           | 1                  |
| Auto adjust filter strength | `autofilter`        | checkbox | 0/1                                                   | 0 (off)            |
| Filter strength             | `filter_strength`   | range    | 0–100, step 1 (only when autofilter off)              | 60                 |
| Strong filter               | `filter_type`       | checkbox | 0/1                                                   | 1 (on)             |
| Filter sharpness            | `filter_sharpness`  | range    | 0–7, **inverted** (`7 − value`)                       | 0 → bubble shows 7 |
| Sharp RGB→YUV conversion    | `use_sharp_yuv`     | checkbox | 0/1                                                   | 0 (off)            |
| Passes                      | `pass`              | range    | 1–10, step 1                                          | 1                  |
| Spatial noise shaping       | `sns_strength`      | range    | 0–100, step 1                                         | 50                 |
| Preprocess                  | `preprocessing`     | select   | 0 None / 1 Segment smooth / 2 Pseudo-random dithering | 0                  |
| Segments                    | `segments`          | range    | 1–4, step 1                                           | 4                  |
| Partitions                  | `partitions`        | range    | 0–3, step 1                                           | 0                  |

**Lossless mode (`lossless` on)**

| UI label            | key                       | control  | range / values                                                               | default              |
| ------------------- | ------------------------- | -------- | ---------------------------------------------------------------------------- | -------------------- |
| Effort              | `method`+`quality` preset | range    | 0–9, step 1, picks a `[method, quality]` preset pair from `kLosslessPresets` | preset 6 = `[4, 75]` |
| Slight loss         | `near_lossless`           | range    | 0–100, **inverted** (`100 − value`)                                          | 100 → bubble shows 0 |
| Discrete tone image | `image_hint`              | checkbox | sets 3 (`WEBP_HINT_GRAPH`) vs 0 (`WEBP_HINT_DEFAULT`)                        | 0                    |

Lossy Effort defaults to 4, libwebp's own default (it was 6 until 2026-11-04).
Method 6 saved 3 to 5% on photos but ran about 50x slower on alpha content for a
slightly larger file (transparent.png: 2880 ms vs 57 ms). The slider still reaches
6. A side already autosaved at 6 keeps 6, because `app:settings:v3` stores the full
options object.

**Hidden WebP options** — present in `EncodeOptions`/`defaultOptions` but never in the UI:
`target_size` (0), `target_PSNR` (0), `show_compressed` (0), `partition_limit` (0),
`emulate_jpeg_size` (0), `thread_level` (0), `low_memory` (0), `use_delta_palette` (0).
`filter_type` is exposed only as the binary "Strong filter" toggle (the codec field is
a number). `image_hint` only ever toggles between 0 and 3 in the UI even though the
codec accepts other hint values.

---

## AVIF (`avif`)

Panel: `AvifOptions.svelte`. `lossless` derived from `quality===100 &&
(qualityAlpha===-1||100) && subsample===3`. "Effort" = `10 − speed`. `qualityAlpha = -1`
means "use main quality" (separate alpha off).

**Always visible**

| UI label | key                               | control  | range / values                           | default            |
| -------- | --------------------------------- | -------- | ---------------------------------------- | ------------------ |
| Lossless | (derived: sets quality/subsample) | checkbox | on → quality 100, subsample 3            | off                |
| Quality  | `quality`                         | range    | 0–99 (`MAX_QUALITY−1`) (only when lossy) | 50                 |
| Effort   | `speed`                           | range    | 0–10 (UI = `10 − speed`)                 | speed 6 → effort 4 |

**Advanced settings** (Revealer). Subsection in `{#if !lossless}`:

| UI label                 | key                               | control  | range / values                                | default                |
| ------------------------ | --------------------------------- | -------- | --------------------------------------------- | ---------------------- |
| Subsample chroma         | `subsample`                       | select   | 0 (4:0:0) / 1 (4:2:0) / 2 (4:2:2) / 3 (4:4:4) | 1 (4:2:0)              |
| Sharp YUV Downsampling   | `enableSharpYUV`                  | checkbox | bool (only when subsample === 1)              | false                  |
| Separate alpha quality   | (derived: toggles `qualityAlpha`) | checkbox | off → `qualityAlpha = -1`                     | off                    |
| Alpha quality            | `qualityAlpha`                    | range    | 0–99 (only when Separate alpha on)            | follows quality        |
| Extra chroma compression | `chromaDeltaQ`                    | checkbox | bool                                          | false                  |
| Sharpness                | `sharpness`                       | range    | 0–7, step 1                                   | 0                      |
| Noise synthesis          | `denoiseLevel`                    | range    | 0–50, step 1                                  | 0                      |
| Tuning                   | `tune`                            | select   | Auto(0) / PSNR(1) / SSIM(2)                   | Auto (`AVIFTune.auto`) |

Always inside Advanced (regardless of lossless):

| UI label          | key            | control | range       | default |
| ----------------- | -------------- | ------- | ----------- | ------- |
| Log2 of tile rows | `tileRowsLog2` | range   | 0–6, step 1 | 0       |
| Log2 of tile cols | `tileColsLog2` | range   | 0–6, step 1 | 0       |

**Hidden / quirks** — every `EncodeOptions` field is reachable in the UI. The codec
`.d.ts` declares fields in order `…tileRowsLog2, tileColsLog2…` while `meta.ts`
`defaultOptions` lists `tileColsLog2, tileRowsLog2` — values are identical (both 0) so
no effective difference. `qualityAlpha = -1` sentinel is never shown as a number.

---

## JPEG XL (`jxl`) — "JPEG XL"

Panel: `JxlOptions.svelte`. `lossless` derived from `quality===100`. `epf === -1`
means "auto edge filter".

**JPEG sources only** (the panel receives the loaded file's MIME type; the row is
absent for every other source)

| UI label           | key             | control  | range / values | default |
| ------------------ | --------------- | -------- | -------------- | ------- |
| Lossless transcode | `jpegTranscode` | checkbox | bool           | false   |

The only option that picks a different pipeline rather than an encoder setting:
`transcodeJpegToJxl` hands the JPEG's file bytes to libjxl's `transcodeJPEG`
entrypoint, which repacks the existing DCT coefficients and stores JPEG
reconstruction data. Disabled (with a reason) whenever rotate, a real resize,
film grain, or reduce-palette is active, because coefficient reuse cannot
survive a pixel change. While it is on and not blocked, every other JXL control
is hidden, because none of them applies. Single-image editor only; bulk mode has no
transcode lane.

**Always visible**

| UI label              | key                       | control  | range / values   | default          |
| --------------------- | ------------------------- | -------- | ---------------- | ---------------- |
| Lossless              | (derived: sets `quality`) | checkbox | on → quality 100 | off (quality 75) |
| Progressive rendering | `progressive`             | checkbox | bool             | false            |
| Effort                | `effort`                  | range    | 1–9, step 1      | 7                |

**Lossless on**

| UI label    | key            | control  | values                             | default |
| ----------- | -------------- | -------- | ---------------------------------- | ------- |
| Slight loss | `lossyPalette` | checkbox | bool (only applied while lossless) | false   |

**Lossless off**

| UI label                                        | key                 | control  | range / values                                    | default                            |
| ----------------------------------------------- | ------------------- | -------- | ------------------------------------------------- | ---------------------------------- |
| Quality                                         | `quality`           | range    | 0–99, step 1                                      | 75                                 |
| Alternative lossy mode                          | `lossyModular`      | checkbox | bool; **forced true & disabled when quality < 7** | false                              |
| Auto edge filter                                | `epf` (`-1`)        | checkbox | toggles `epf = -1` (auto)                         | true (epf -1)                      |
| Edge preserving filter                          | `epf`               | range    | 0–3, step 1 (only when Auto off)                  | 2 (the value used when epf was -1) |
| Optimise for decoding speed (worse compression) | `decodingSpeedTier` | range    | 0–4, step 1                                       | 0                                  |
| Noise equivalent to ISO                         | `photonNoiseIso`    | range    | 0–50000, step 100                                 | 0                                  |

**Hidden / quirks** — all `EncodeOptions` fields are exposed. `lossyModular` is
coerced to `true` whenever `quality < 7` (apply() override, checkbox also disabled).
`lossyPalette` only takes effect in lossless mode (`apply()` sets it false otherwise).
`jpegTranscode` is the one field the wasm encoder never reads: it lives in the
options object so it reaches the encode signature that keys the result cache and
the undo history, and it survives on a non-JPEG source (harmlessly, since the
engine re-checks the preconditions before routing).

---

## MozJPEG (`mozJPEG`), no longer offered

Not in the picker since 2026-11-04 (see the roster notes above); a saved MozJPEG
side loads as jpegli. The panel and codec below still exist in the code until the
codec's retirement lands, so the table records what the panel renders, not what a
user can reach today.

Panel: `MozjpegOptions.svelte`. Always lossy. Booleans bind directly. Channels select
uses the `MozJpegColorSpace` enum (GRAYSCALE 1 / RGB 2 / YCbCr 3).

**Always visible**

| UI label | key       | control | range         | default |
| -------- | --------- | ------- | ------------- | ------- |
| Quality  | `quality` | range   | 0–100, step 1 | 75      |

**Advanced settings** (Revealer)

| UI label                            | key                       | control  | range / values                                                                                                                                                 | default         |
| ----------------------------------- | ------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Channels                            | `color_space`             | select   | Grayscale(1) / RGB(2) / YCbCr(3)                                                                                                                               | YCbCr (3)       |
| Auto subsample chroma               | `auto_subsample`          | checkbox | bool (only when YCbCr)                                                                                                                                         | true            |
| Subsample chroma by                 | `chroma_subsample`        | range    | 1–4, step 1 (only when YCbCr & auto off)                                                                                                                       | 2               |
| Separate chroma quality             | `separate_chroma_quality` | checkbox | bool (only when YCbCr)                                                                                                                                         | false           |
| Chroma quality                      | `chroma_quality`          | range    | 0–100, step 1 (only when separate on)                                                                                                                          | 75              |
| Pointless spec compliance           | `baseline`                | checkbox | bool                                                                                                                                                           | false           |
| Progressive rendering               | `progressive`             | checkbox | bool (only when **not** baseline)                                                                                                                              | true            |
| Optimize Huffman table              | `optimize_coding`         | checkbox | bool (only when baseline)                                                                                                                                      | true            |
| Smoothing                           | `smoothing`               | range    | 0–100, step 1                                                                                                                                                  | 0               |
| Quantization                        | `quant_table`             | select   | 0 JPEG Annex K / 1 Flat / 2 MSSIM-tuned Kodak / 3 ImageMagick / 4 PSNR-HVS-M-tuned Kodak / 5 Klein et al / 6 Watson et al / 7 Ahumada et al / 8 Peterson et al | 3 (ImageMagick) |
| Trellis multipass                   | `trellis_multipass`       | checkbox | bool                                                                                                                                                           | false           |
| Optimize zero block runs            | `trellis_opt_zero`        | checkbox | bool (only when multipass on)                                                                                                                                  | false           |
| Optimize after trellis quantization | `trellis_opt_table`       | checkbox | bool                                                                                                                                                           | false           |
| Trellis quantization passes         | `trellis_loops`           | range    | 1–50, step 1                                                                                                                                                   | 1               |

**Hidden MozJPEG option** — **`arithmetic`** (bool, default `false`) exists in both the
codec `EncodeOptions` and `meta.defaultOptions` but is **never rendered in the panel**
(arithmetic coding toggle is unreachable from the UI).

---

## JPEG (`jpegli`)

Menu label is **JPEG**; encoded with **jpegli** (google/jpegli, pinned by
commit; see `docs/codec-provenance.md`), shown as a hover tooltip on the picker.

Panel: `JpegliOptions.svelte`. Always lossy. Booleans bind directly. The chroma
select uses the `JpegliChromaSubsample` enum (AUTO 0 / FULL 1 / HALF 2).

**Always visible**

| UI label | key       | control | range         | default |
| -------- | --------- | ------- | ------------- | ------- |
| Quality  | `quality` | range   | 0–100, step 1 | 75      |

**Advanced settings** (Revealer)

| UI label              | key               | control  | range / values                  | default  |
| --------------------- | ----------------- | -------- | ------------------------------- | -------- |
| Chroma subsampling    | `chromaSubsample` | select   | Auto(0) / 4:4:4(1) / 4:2:0(2)   | Auto (0) |
| Progressive rendering | `progressive`     | checkbox | bool                            | true     |

**No hidden options.** The codec `EncodeOptions` interface is exactly
`{ quality, progressive, chromaSubsample }`, and all three are rendered. This is
deliberate: jpegli's tuned quantization tables are the reason to use it, so the
wrapper does not expose the libjpeg-style overrides that would bypass them.

Behaviours that are not options, and are worth knowing when comparing against
`mozJPEG`:

- **`quality` is jpegli's own scale, not libjpeg's.** The wrapper converts it with
  `jpegli_quality_to_distance()` and calls `jpegli_set_distance()`, the same path
  `cjpegli -q` takes. `jpegli_set_quality()` exists but scales the standard Annex K
  tables instead, which discards jpegli's tuning. **The same number means a
  different picture in the two JPEG encoders.**
- **`chromaSubsample: 0` writes no sampling factors at all**, leaving jpegli's
  library default of 4:2:0. (The `cjpegli` tool overrides that default to 4:4:4;
  Frisp does not.)
- **Alpha is dropped, not composited**, byte for byte the way `mozJPEG` handles it
  (`JCS_EXT_RGBA` input, fourth channel ignored). The two JPEG encoders are
  deliberately identical here so their outputs are comparable.
- **No `color_space` equivalent.** jpegli output is always YCbCr; there is no
  grayscale or RGB mode. MozJPEG had those, but it is no longer offered.

---

## PNG (`oxiPNG`)

Menu label is **PNG**; encoded with **OxiPNG** (shown as a hover tooltip on the picker).

Panel: `OxipngOptions.svelte`. Lossless PNG optimizer; only two fields total and both
are exposed.

| UI label  | key         | control  | range / values | default |
| --------- | ----------- | -------- | -------------- | ------- |
| Interlace | `interlace` | checkbox | bool           | false   |
| Effort    | `level`     | range    | 0–6, step 1    | 2       |

No hidden options — the `EncodeOptions` interface is exactly `{ level, interlace }`.

---

## SVG (`svg`) — the vector-source optimize lane

Menu label is **SVG**; encoded with **SVGO** (v4, shown as a hover tooltip on the
picker). Not a raster codec: it minifies the SVG _text_ in a lazy worker
(`src/lib/svg/svg-optimizer.worker.ts`) and never rasterises. Only offered when the
source is an SVG; side 1 (the "after") defaults to it. Options shape:
`src/lib/svg/optimize-options.ts` (`SvgOptimizeOptions`); panel:
`SvgOptions.svelte`. The whole raster "Edit" block (Resize / Film grain / Reduce
palette) is hidden while this lane is active — raster processors don't apply.

**Always visible**

| UI label | key    | control | values            | default |
| -------- | ------ | ------- | ----------------- | ------- |
| Mode     | `mode` | select  | `auto` / `manual` | `auto`  |

**Auto mode** shows a hint ("Tries several settings and keeps the smallest result
that renders identically.") and, once a result lands, a winner line via
`describeWinner` (e.g. "Auto: precision 2 · reused paths"). It searches a precision
ladder (p3 → p2/p1/p0, or p4 if p3 fails the gate) plus `reusePaths` /
`convertStyleToAttrs` add-on trials, admitting a candidate only after multi-scale
pixel checks (`visual-gate.ts`, pixelmatch, normalized by painted pixels) at
64/256/natural px over transparent + light + dark backgrounds. Auto respects
`keepTitleDesc` but ignores the other manual toggles. When no candidate passes the
gate, Auto keeps the original SVG (0% change) and the winner line reads "original
kept, no smaller version looked identical (Manual can trade precision for size)"
(winner id `original!`). Before 2026-11-04 it shipped the precision-3 candidate
with a "verify preview" note instead.

**Manual mode**

| UI label  | key         | control | range / values | default |
| --------- | ----------- | ------- | -------------- | ------- |
| Precision | `precision` | range   | 0–4, step 1    | 3       |

**Manual → Advanced settings** (Revealer)

| UI label                     | key                    | control  | default |
| ---------------------------- | ---------------------- | -------- | ------- |
| Multipass                    | `multipass`            | checkbox | true    |
| Keep title & description     | `keepTitleDesc`        | checkbox | true    |
| Reuse identical paths        | `reusePaths`           | checkbox | false   |
| Convert styles to attributes | `convertStyleToAttrs`  | checkbox | false   |
| Remove off-canvas paths      | `removeOffCanvasPaths` | checkbox | false   |
| Remove width/height          | `removeDimensions`     | checkbox | false   |

Notes: transform precision is derived as `min(precision + 2, 5)` (matrix math needs
headroom); `removeDimensions` is manual-only (not searched by Auto). The output never
regresses: `keepOriginalSvg` reverts to the source text (0% change) when the
optimized bytes aren't smaller or Auto's gate rejected every candidate. Sources
above 5 MB are rejected. Results carry a
`svg` block (`optimizedText`, `rawBytes`, `gzipBytes`, `originalGzipBytes`, `winner`)
that drives the Results panel's second "gzip: <n> · was <n>" line.

---

## Generic fallback in `OptionsPanel.svelte`

For any non-`identity` format with no dedicated panel branch:

- If the options object has a numeric `quality` key → a generic **Quality** range
  (min 0, max 100, step 1) bound to `options.quality`.
- Otherwise → `"<label> has no adjustable options."`

No shipped format hits this fallback today — all five raster output formats have a
dedicated options panel, as does the `svg` lane (`SvgOptions.svelte`). It remains as
a safety net for a future encoder added without one. (QOI, which previously hit the
"no adjustable options" branch, was removed from the picker on 2026-06-27; its
decoder stays for import.)

## Editor-side ("Edit") controls shared by every real encoder

These live above the Compress section (hidden for the Original side, and hidden
entirely on the `svg` lane) and are not encoder options, but affect every raster
output format. In panel/pipeline order: a **Resize** section (`ResizeOptions.svelte`,
gated by `processorState.resize.enabled`), a **Film grain** section
(`GrainOptions.svelte`, gated by `processorState.grain.enabled`), and a **Reduce
palette** section (`QuantizeOptions.svelte`, gated by
`processorState.quantize.enabled`). The pipeline applies them resize → grain →
quantize. Film grain exposes an **Amount** slider (0–100, default 12) plus an
Advanced **Grain size** slider (1–100, default 20; 20 units = 1px). The Edit header
has no per-side buttons: the Squoosh-era **Copy settings to other side**, **Save side
settings**, and **Import saved side settings** buttons were removed on 2026-11-04
(autosave already restores both sides).
