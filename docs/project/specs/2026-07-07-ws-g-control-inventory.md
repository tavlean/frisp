# WS-G Control Inventory (appendix to 2026-07-07-first-principles-execution.md)

Last updated: 2026-11-04.

> **Update 2026-11-04: superseded for bulk.** Change A
> ([2026-11-04-one-recipe-per-image.md](2026-11-04-one-recipe-per-image.md))
> deleted the per-encoder registry files this inventory fed
> (`src/client/lazy-app/bulk/controls/`) and the sparse per-control
> overrides. Bulk images now keep either the shared recipe or a full own copy,
> so the overridable-control directives below no longer bind any code. The
> tables remain a correct inventory of each panel's controls and raw fields,
> useful if the single-image panels are ever made data-driven
> ([../../codec-options-model.md](../../codec-options-model.md)).

Produced 2026-07-07 by a read-only Codex sweep of the option panels + codec
meta files. These tables are the direct input for the per-encoder registry
files (`src/client/lazy-app/bulk/controls/<codec>.ts`). Reviewer directives
that BIND the implementation:

1. **Mode-overlapping fields (WebP).** `webp.lossless-effort` and the lossy
   `webp.quality`/`webp.effort` own the same raw fields (`quality`,
   `method`) under different modes. Rule: a control's `equal`/`apply` is
   only meaningful when both option objects are in the control's own mode;
   when the mode field (`lossless`) differs between global and override,
   ONLY the mode control (`webp.lossless`) reports as overridden, and
   applying it carries its mode's dependent fields with it. Same rule for
   AVIF/JXL lossless. This avoids double-dotting quality when the real
   difference is the mode.
2. **UI-only state is not overridable.** `resize.maintain-aspect-ratio` has
   no persisted field — exclude it from the registry (a per-image override
   of it cannot be diffed or restored). Width/height coupling under aspect
   lock is a UI behavior, not an override semantic.
3. **Shared-field couples are one entry.** Where two visible controls write
   the same raw field (JXL `epf` auto+slider; AVIF `qualityAlpha`
   toggle+slider), the registry entry owns the field once, with the pair of
   controls presented as one override unit (one dot, one reset).
4. QOI has no panel (not an output format) — no registry file.

Read-only only. I did not modify files.

Citations use relative `file:line`. `meta.ts` citations point to the raw option definitions/defaults.

**WebP**
| control id | label | fields owned | transform | visibility condition | coupling notes |
|---|---|---|---|---|---|
| `webp.lossless` | Lossless | `lossless` (`WebpOptions.svelte:56-60`; `webP/shared/meta.ts:43`) | checkbox bool ↔ `0/1` | always | Mode switch gates two different `quality`/`method` interpretations. |
| `webp.lossless-effort` | Effort | `method`, `quality` (`WebpOptions.svelte:45-51,64-68`; `webP/shared/meta.ts:25,28`) | visible preset `0..9` maps through `losslessPresets[preset] = [method, quality]` | `options.lossless` | Coupled pair. Overlaps lossy `webp.quality`/`webp.effort`; must be mode-aware. |
| `webp.slight-loss` | Slight loss | `near_lossless` (`WebpOptions.svelte:70-76`; `webP/shared/meta.ts:49`) | inverted: UI value = `100 - near_lossless`; write `near_lossless = 100 - value` | `options.lossless` | None. |
| `webp.discrete-tone-image` | Discrete tone image | `image_hint` (`WebpOptions.svelte:78-83`; `webP/shared/meta.ts:45`) | checkbox maps false→`0`, true→`3` | `options.lossless` | None. |
| `webp.quality` | Quality | `quality` (`WebpOptions.svelte:87-89`; `webP/shared/meta.ts:25`) | direct `0..100` | `!options.lossless` | Overlaps lossless effort’s `[method, quality]`; mode-aware ownership needed. |
| `webp.effort` | Effort | `method` (`WebpOptions.svelte:90-92`; `webP/shared/meta.ts:28`) | direct `0..6` | `!options.lossless` | Same visible label as lossless effort; proposed id is lossy-only. |
| `webp.preserve-transparent-data` | Preserve transparent data | `exact` (`WebpOptions.svelte:93-99,185-191`; `webP/shared/meta.ts:44`) | checkbox bool ↔ `0/1` | lossy: inside Advanced; lossless: visible after lossless block | Same field/control appears in both modes; one registry entry. |
| `webp.compress-alpha` | Compress alpha | `alpha_compression` (`WebpOptions.svelte:101-106`; `webP/shared/meta.ts:40`) | checkbox bool ↔ `0/1` | `!options.lossless`, Advanced open | None. |
| `webp.alpha-quality` | Alpha quality | `alpha_quality` (`WebpOptions.svelte:109-112`; `webP/shared/meta.ts:42`) | direct `0..100` | `!options.lossless`, Advanced open | Alpha-related with `alpha_compression` but no write coupling. |
| `webp.alpha-filter-quality` | Alpha filter quality | `alpha_filtering` (`WebpOptions.svelte:114-117`; `webP/shared/meta.ts:41`) | direct `0..2` | `!options.lossless`, Advanced open | None. |
| `webp.auto-adjust-filter-strength` | Auto adjust filter strength | `autofilter` (`WebpOptions.svelte:119-123`; `webP/shared/meta.ts:38`) | checkbox bool ↔ `0/1` | `!options.lossless`, Advanced open | Gates `filter_strength`. |
| `webp.filter-strength` | Filter strength | `filter_strength` (`WebpOptions.svelte:126-130`; `webP/shared/meta.ts:30`) | direct `0..100` | `!options.lossless && !options.autofilter`, Advanced open | Coupled with `autofilter` visibility. |
| `webp.strong-filter` | Strong filter | `filter_type` (`WebpOptions.svelte:133-138`; `webP/shared/meta.ts:32`) | checkbox bool ↔ `0/1` | `!options.lossless`, Advanced open | None. |
| `webp.filter-sharpness` | Filter sharpness | `filter_sharpness` (`WebpOptions.svelte:141-147`; `webP/shared/meta.ts:31`) | inverted: UI value = `7 - filter_sharpness`; write `7 - value` | `!options.lossless`, Advanced open | None. |
| `webp.sharp-rgb-yuv-conversion` | Sharp RGB→YUV conversion | `use_sharp_yuv` (`WebpOptions.svelte:150-155`; `webP/shared/meta.ts:51`) | checkbox bool ↔ `0/1` | `!options.lossless`, Advanced open | None. |
| `webp.passes` | Passes | `pass` (`WebpOptions.svelte:158-160`; `webP/shared/meta.ts:35`) | direct `1..10` | `!options.lossless`, Advanced open | None. |
| `webp.spatial-noise-shaping` | Spatial noise shaping | `sns_strength` (`WebpOptions.svelte:161-164`; `webP/shared/meta.ts:29`) | direct `0..100` | `!options.lossless`, Advanced open | None. |
| `webp.preprocess` | Preprocess | `preprocessing` (`WebpOptions.svelte:166-172`; `webP/shared/meta.ts:37`) | select numeric `0/1/2` | `!options.lossless`, Advanced open | None. |
| `webp.segments` | Segments | `segments` (`WebpOptions.svelte:174-176`; `webP/shared/meta.ts:34`) | direct `1..4` | `!options.lossless`, Advanced open | None. |
| `webp.partitions` | Partitions | `partitions` (`WebpOptions.svelte:177-180`; `webP/shared/meta.ts:33`) | direct `0..3` | `!options.lossless`, Advanced open | None. |

**AVIF**
| control id | label | fields owned | transform | visibility condition | coupling notes |
|---|---|---|---|---|---|
| `avif.lossless` | Lossless | `quality`, `qualityAlpha`, `subsample` (`AvifOptions.svelte:27-31,47-50`; `avif/shared/meta.ts:31-32,37`) | derived toggle; true writes `quality=100`, `qualityAlpha=-1`, `subsample=3`; false restores UI `quality`, `qualityAlpha` rule, `subsample` | always | Strongly coupled with Quality, Subsample chroma, Separate alpha quality, Alpha quality. |
| `avif.quality` | Quality | `quality` (`AvifOptions.svelte:32-34,74-83`; `avif/shared/meta.ts:31`) | local `quality`; if incoming `quality=100`, seeds from `defaultOptions.quality` | `!lossless` | Overlaps `avif.lossless`. |
| `avif.effort` | Effort | `speed` (`AvifOptions.svelte:40,53,88-97`; `avif/shared/meta.ts:36`) | inverted: UI effort = `10 - speed`; write `speed = 10 - effort` | always | None. |
| `avif.subsample-chroma` | Subsample chroma | `subsample` (`AvifOptions.svelte:37,50,101-117`; `avif/shared/meta.ts:37`) | select string→number `0..3` | `!lossless`, Advanced open | Overlaps `avif.lossless`; gates Sharp YUV Downsampling. |
| `avif.sharp-yuv-downsampling` | Sharp YUV Downsampling | `enableSharpYUV` (`AvifOptions.svelte:45,58,118-128`; `avif/shared/meta.ts:41`) | direct boolean | `!lossless && subsample === 1`, Advanced open | Visibility coupled to `subsample`. |
| `avif.separate-alpha-quality` | Separate alpha quality | `qualityAlpha` (`AvifOptions.svelte:35-36,49,130-138`; `avif/shared/meta.ts:32`) | toggle is derived from `qualityAlpha !== -1`; false writes `qualityAlpha=-1`; true writes `alphaQuality` | `!lossless`, Advanced open | Coupled with Alpha quality and Lossless. |
| `avif.alpha-quality` | Alpha quality | `qualityAlpha` (`AvifOptions.svelte:36,49,140-150`; `avif/shared/meta.ts:32`) | local `alphaQuality`; applied only when `!lossless && separateAlpha` | `!lossless && separateAlpha`, Advanced open | Same raw field as Separate alpha quality. |
| `avif.extra-chroma-compression` | Extra chroma compression | `chromaDeltaQ` (`AvifOptions.svelte:41,54,153-161`; `avif/shared/meta.ts:38`) | direct boolean | `!lossless`, Advanced open | None. |
| `avif.sharpness` | Sharpness | `sharpness` (`AvifOptions.svelte:42,55,163-172`; `avif/shared/meta.ts:39`) | direct `0..7` | `!lossless`, Advanced open | None. |
| `avif.noise-synthesis` | Noise synthesis | `denoiseLevel` (`AvifOptions.svelte:43,56,174-183`; `avif/shared/meta.ts:33`) | direct `0..50` | `!lossless`, Advanced open | None. |
| `avif.tuning` | Tuning | `tune` (`AvifOptions.svelte:44,57,185-197`; `avif/shared/meta.ts:21-25,40`) | select string→number enum `auto=0`, `psnr=1`, `ssim=2` | `!lossless`, Advanced open | None. |
| `avif.log2-of-tile-rows` | Log2 of tile rows | `tileRowsLog2` (`AvifOptions.svelte:38,52,201-210`; `avif/shared/meta.ts:35`) | direct `0..6` | Advanced open | None. |
| `avif.log2-of-tile-cols` | Log2 of tile cols | `tileColsLog2` (`AvifOptions.svelte:39,51,212-220`; `avif/shared/meta.ts:34`) | direct `0..6` | Advanced open | None. |

**JPEG XL**
| control id | label | fields owned | transform | visibility condition | coupling notes |
|---|---|---|---|---|---|
| `jxl.lossless` | Lossless | `quality`, `lossyPalette` (`JxlOptions.svelte:22-24,31,34,42-50`; `jxl/shared/meta.ts:22,25`) | local toggle; true writes `quality=100`; false writes local `quality`; `lossyPalette = lossless ? slightLoss : false` | always | Coupled with Quality and Slight loss. |
| `jxl.slight-loss` | Slight loss | `lossyPalette` (`JxlOptions.svelte:23,34,53-63`; `jxl/shared/meta.ts:25`) | direct boolean, but applied only while lossless | `lossless` | Same field also forced false by `jxl.lossless=false`. |
| `jxl.quality` | Quality | `quality`, `lossyModular` (`JxlOptions.svelte:19,31,37,64-75`; `jxl/shared/meta.ts:22,28`) | direct `0..99`; `apply()` also forces `lossyModular=true` when `quality < 7` | `!lossless` | Coupled with Alternative lossy mode via quality<7 force. |
| `jxl.effort` | Effort | `effort` (`JxlOptions.svelte:18,30,78-87`; `jxl/shared/meta.ts:21`) | direct `1..9` | always | None. |
| `jxl.alternative-lossy-mode` | Alternative lossy mode | `lossyModular` (`JxlOptions.svelte:27,37,91-101`; `jxl/shared/meta.ts:28`) | checkbox disabled/checked true when `quality < 7`; otherwise direct local boolean | `!lossless`, Advanced open | Must be coupled with Quality because Quality can force this field. |
| `jxl.auto-edge-filter` | Auto edge filter | `epf` (`JxlOptions.svelte:21,24,33,103-111`; `jxl/shared/meta.ts:24`) | true writes `epf=-1`; false writes local edge filter value | `!lossless`, Advanced open | Coupled with Edge preserving filter. |
| `jxl.edge-preserving-filter` | Edge preserving filter | `epf` (`JxlOptions.svelte:21,33,113-123`; `jxl/shared/meta.ts:24`) | direct `0..3`, unless auto writes `-1` | `!lossless && !autoEdgePreservingFilter`, Advanced open | Same raw field as Auto edge filter. |
| `jxl.optimize-for-decoding-speed-worse-compression` | Optimize for decoding speed (worse compression) | `decodingSpeedTier` (`JxlOptions.svelte:25,35,126-135`; `jxl/shared/meta.ts:26`) | direct `0..4` | `!lossless`, Advanced open | None. |
| `jxl.noise-equivalent-to-iso` | Noise equivalent to ISO | `photonNoiseIso` (`JxlOptions.svelte:26,36,137-147`; `jxl/shared/meta.ts:27`) | direct `0..50000`, step `100` | `!lossless`, Advanced open | None. |
| `jxl.progressive-rendering` | Progressive rendering | `progressive` (`JxlOptions.svelte:20,32,150-158`; `jxl/shared/meta.ts:23`) | direct boolean | Advanced open | None. |

**MozJPEG**
| control id | label | fields owned | transform | visibility condition | coupling notes |
|---|---|---|---|---|---|
| `mozjpeg.quality` | Quality | `quality` (`MozjpegOptions.svelte:20-22`; `mozJPEG/shared/meta.ts:32`) | direct `0..100` | always | None. |
| `mozjpeg.channels` | Channels | `color_space` (`MozjpegOptions.svelte:25-31`; `mozJPEG/shared/meta.ts:15-25,38`) | select enum: `1` Grayscale, `2` RGB, `3` YCbCr | Advanced open | Gates chroma controls. |
| `mozjpeg.auto-subsample-chroma` | Auto subsample chroma | `auto_subsample` (`MozjpegOptions.svelte:34-38`; `mozJPEG/shared/meta.ts:44`) | direct boolean | `color_space === YCbCr`, Advanced open | Gates Subsample chroma by. |
| `mozjpeg.subsample-chroma-by` | Subsample chroma by | `chroma_subsample` (`MozjpegOptions.svelte:39-44`; `mozJPEG/shared/meta.ts:45`) | direct `1..4` | `color_space === YCbCr && !auto_subsample`, Advanced open | Coupled with Auto subsample chroma visibility. |
| `mozjpeg.separate-chroma-quality` | Separate chroma quality | `separate_chroma_quality` (`MozjpegOptions.svelte:46-48`; `mozJPEG/shared/meta.ts:46`) | direct boolean | `color_space === YCbCr`, Advanced open | Gates Chroma quality. |
| `mozjpeg.chroma-quality` | Chroma quality | `chroma_quality` (`MozjpegOptions.svelte:49-54`; `mozJPEG/shared/meta.ts:47`) | direct `0..100` | `color_space === YCbCr && separate_chroma_quality`, Advanced open | Coupled with Separate chroma quality. |
| `mozjpeg.pointless-spec-compliance` | Pointless spec compliance | `baseline` (`MozjpegOptions.svelte:59-60`; `mozJPEG/shared/meta.ts:33`) | direct boolean | Advanced open | Gates Progressive vs Optimize Huffman table. |
| `mozjpeg.progressive-rendering` | Progressive rendering | `progressive` (`MozjpegOptions.svelte:62-65`; `mozJPEG/shared/meta.ts:35`) | direct boolean | `!baseline`, Advanced open | Mutually exclusive UI branch with Optimize Huffman table. |
| `mozjpeg.optimize-huffman-table` | Optimize Huffman table | `optimize_coding` (`MozjpegOptions.svelte:66-69`; `mozJPEG/shared/meta.ts:36`) | direct boolean | `baseline`, Advanced open | Mutually exclusive UI branch with Progressive rendering. |
| `mozjpeg.smoothing` | Smoothing | `smoothing` (`MozjpegOptions.svelte:72-74`; `mozJPEG/shared/meta.ts:37`) | direct `0..100` | Advanced open | None. |
| `mozjpeg.quantization` | Quantization | `quant_table` (`MozjpegOptions.svelte:76-88`; `mozJPEG/shared/meta.ts:39`) | select numeric `0..8` | Advanced open | None. |
| `mozjpeg.trellis-multipass` | Trellis multipass | `trellis_multipass` (`MozjpegOptions.svelte:91-92`; `mozJPEG/shared/meta.ts:40`) | direct boolean | Advanced open | Gates Optimize zero block runs. |
| `mozjpeg.optimize-zero-block-runs` | Optimize zero block runs | `trellis_opt_zero` (`MozjpegOptions.svelte:94-97`; `mozJPEG/shared/meta.ts:41`) | direct boolean | `trellis_multipass`, Advanced open | Coupled with Trellis multipass visibility. |
| `mozjpeg.optimize-after-trellis-quantization` | Optimize after trellis quantization | `trellis_opt_table` (`MozjpegOptions.svelte:99-100`; `mozJPEG/shared/meta.ts:42`) | direct boolean | Advanced open | None. |
| `mozjpeg.trellis-quantization-passes` | Trellis quantization passes | `trellis_loops` (`MozjpegOptions.svelte:102-105`; `mozJPEG/shared/meta.ts:43`) | direct `1..50` | Advanced open | None. |

**OxiPNG**
| control id | label | fields owned | transform | visibility condition | coupling notes |
|---|---|---|---|---|---|
| `oxipng.effort` | Effort | `level` (`OxipngOptions.svelte:13-15`; `oxiPNG/shared/meta.ts:13-24`) | direct `0..6`, step `1` | always | None. |
| `oxipng.interlace` | Interlace | `interlace` (`OxipngOptions.svelte:16-18`; `oxiPNG/shared/meta.ts:13-24`) | direct boolean | always | None. |

**Resize**
| control id | label | fields owned | transform | visibility condition | coupling notes |
|---|---|---|---|---|---|
| `resize.preset` | Preset | `width`, `height` (`ResizeOptions.svelte:39-45,57-62,70-78`; `processor-types.ts:7-23`; `resize/shared/meta.ts:38-67`) | derives selected preset from current dimensions; selecting `0.25/0.5/1` writes rounded input-scaled width+height; `custom` writes nothing | always | Coupled with Width and Height. |
| `resize.width` | Width | `width`, conditionally `height` (`ResizeOptions.svelte:47-51,79-87`; `processor-types.ts:9-10`) | number input; if `maintainAspect`, also writes `height = round(width / aspect)` | always | Coupled with Height, Preset, Maintain aspect ratio. |
| `resize.height` | Height | `height`, conditionally `width` (`ResizeOptions.svelte:52-56,88-96`; `processor-types.ts:9-10`) | number input; if `maintainAspect`, also writes `width = round(height * aspect)` | always | Coupled with Width, Preset, Maintain aspect ratio. |
| `resize.maintain-aspect-ratio` | Maintain aspect ratio | local `maintainAspect`; may write `height` (`ResizeOptions.svelte:29,63-66,97-99`) | UI-only state; when set true writes `height = round(width / aspect)` | always | No persisted raw field; controls Width/Height transforms and Fit method visibility. |
| `resize.fit-method` | Fit method | `fitMethod` (`ResizeOptions.svelte:100-110`; `processor-types.ts:21`; `resize/shared/meta.ts:41,65`) | select `'stretch' | 'contain'` | `!maintainAspect` | Visibility coupled to UI-only Maintain aspect ratio. |
| `resize.method` | Method | `method` (`ResizeOptions.svelte:36-38,115-136`; `processor-types.ts:13-20`; `resize/shared/meta.ts:17-31,44-56,64`) | select; `vector` option only for SVG; otherwise `lanczos3`, `mitchell`, `hqx`, `browser-pixelated` | Advanced open | Gates Premultiply/Linear RGB via worker-method check. |
| `resize.premultiply-alpha-channel` | Premultiply alpha channel | `premultiply` (`ResizeOptions.svelte:137-141`; `processor-types.ts:22`; `resize/shared/meta.ts:48-51,66`) | direct boolean | Advanced open and `method` is worker method (`triangle/catrom/mitchell/lanczos3/hqx`) | Coupled with Method visibility. |
| `resize.linear-rgb` | Linear RGB | `linearRGB` (`ResizeOptions.svelte:142-144`; `processor-types.ts:23`; `resize/shared/meta.ts:48-51,67`) | direct boolean | Advanced open and `method` is worker method (`triangle/catrom/mitchell/lanczos3/hqx`) | Coupled with Method visibility. |

**Quantize**
| control id | label | fields owned | transform | visibility condition | coupling notes |
|---|---|---|---|---|---|
| `quantize.colors` | Colors | `maxNumColors` (`QuantizeOptions.svelte:13-15`; `processor-types.ts:26-30`; `quantize/shared/meta.ts:13-22`) | direct `2..256` | always when Quantize panel is mounted | None. |
| `quantize.dithering` | Dithering | `dither` (`QuantizeOptions.svelte:16-19`; `processor-types.ts:26-30`; `quantize/shared/meta.ts:13-22`) | direct `0..1`, step `0.01` | always when Quantize panel is mounted | None. |