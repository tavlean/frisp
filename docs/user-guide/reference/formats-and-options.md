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
| JPEG               | `mozJPEG`     | `jpg`      | `image/jpeg`  | lossy              | yes                                       |
| PNG                | `oxiPNG`      | `png`      | `image/png`   | lossless           | yes                                       |

- The label/ext for `jxl` are read from `encoderMap.jxl.meta` so they stay in
  sync (hence "JPEG XL"). `webP` and `avif` use hard-coded labels in
  `OUTPUT_FORMATS`. `mozJPEG` and `oxiPNG` are overridden to the plain format
  names **JPEG** and **PNG** (rather than the encoder names MozJPEG/OxiPNG); the
  underlying encoder is surfaced as a hover tooltip (title attribute) on the
  picker — JPEG→MozJPEG, PNG→OxiPNG, JPEG XL→libjxl, WebP→libwebp, AVIF→libaom.
- **Every output format is an always-available WASM codec** — there is no runtime
  feature detection. (QOI and the canvas/browser encoders were removed from the
  picker on 2026-06-27; QOI's decoder remains for import.)
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
| Effort   | `method`  | range   | 0–6, step 1     | 6       |
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

---

## JPEG (`mozJPEG`)

Menu label is **JPEG**; encoded with **MozJPEG** (shown as a hover tooltip on the picker).

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

## Generic fallback in `OptionsPanel.svelte`

For any non-`identity` format with no dedicated panel branch:

- If the options object has a numeric `quality` key → a generic **Quality** range
  (min 0, max 100, step 1) bound to `options.quality`.
- Otherwise → `"<label> has no adjustable options."`

No shipped format hits this fallback today — all five output formats have a
dedicated options panel. It remains as a safety net for a future encoder added
without one. (QOI, which previously hit the "no adjustable options" branch, was
removed from the picker on 2026-06-27; its decoder stays for import.)

## Editor-side ("Edit") controls shared by every real encoder

These live above the Compress section (hidden for the Original side) and are not
encoder options, but affect every output format: a **Resize** section
(`ResizeOptions.svelte`, gated by `processorState.resize.enabled`) and a
**Reduce palette** section (`QuantizeOptions.svelte`, gated by
`processorState.quantize.enabled`). Per-side title-bar buttons: **Copy settings to
other side**, **Save side settings**, **Import saved side settings** (import disabled
until something is saved).
