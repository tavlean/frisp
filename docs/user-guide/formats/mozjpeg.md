# JPEG

> The universal lossy "photo" format — a smarter JPEG encoder that squeezes the most quality out of every kilobyte, with a full bag of advanced tricks if you want them. Encoded with **MozJPEG** (shown as **JPEG** in the menu; the encoder name appears as a hover tooltip).

## Overview / When to use it

**JPEG** is the workhorse format for photographs and other rich, continuous-tone images (sunsets, portraits, textures). Frisp encodes it with **MozJPEG**. It produces ordinary `.jpg` files that open everywhere, but uses a more careful (Mozilla-built) encoder that typically beats a regular JPEG at the same visible quality. Reach for it whenever you have a photo and don't need transparency. (JPEG has no transparency — if your image has see-through areas, use PNG, WebP, or AVIF instead.) For most people the only control that matters is the **Quality** slider; everything else lives under **Advanced settings** and can be safely ignored unless you're chasing the last few percent.

## Controls / Settings

### Quality

- **What it does:** Sets how much detail the encoder keeps. Lower values throw away more fine information to make the file smaller; higher values preserve more at the cost of size.
- **Range & default:** 0 to 100, in steps of 1. **Default: 75** (option key `quality`).
- **How to choose:** Raising quality means a larger file but fewer JPEG artifacts (the blocky, smeary, or "ringing" halos you see around edges and text). Lowering it shrinks the file but those artifacts grow. The relationship isn't linear — going from 90 to 100 can balloon the file for little visible gain, while dropping below ~60 starts to look obviously degraded. Use the side-by-side preview and watch edges, faces, and flat color areas.
- **Recommended starting point:** **75**. Try **80–85** for hero images or anything with text/sharp edges; drop to **60–70** for thumbnails or background images where small artifacts won't be noticed.

### Channels

- **What it does:** Chooses how the image's color is encoded. "Channels" refers to the color information stored: YCbCr keeps brightness plus two color channels; Grayscale keeps only brightness; RGB stores raw red/green/blue without the usual brightness/color split.
- **Range & default:** **Grayscale** (`color_space` = 1), **RGB** (`color_space` = 2), or **YCbCr** (`color_space` = 3). **Default: YCbCr** (option key `color_space`).
- **How to choose:** Leave it on **YCbCr** for any color image — it's how virtually all JPEGs are stored and is what every chroma/subsampling trick below relies on. Switch to **Grayscale** only if the image is genuinely black-and-white (scanned documents, line art, monochrome photos) — it removes the color channels entirely, which saves space and avoids faint color tints. **RGB** is a niche choice (no subsampling, larger files) that few viewers expect; avoid it unless you have a specific reason. Choosing Grayscale (or RGB) hides the chroma-related options below, since they only apply to YCbCr.
- **Recommended starting point:** **YCbCr**, unless your source is truly grayscale.

### Auto subsample chroma

- **What it does:** Lets the encoder decide how much to compress the _color_ detail separately from the brightness detail. Human eyes are far more sensitive to brightness than to color, so JPEG can shrink color resolution ("chroma subsampling") with little visible loss.
- **Range & default:** On/off. **Default: on** (option key `auto_subsample`). Only shown for color (YCbCr) images.
- **How to choose:** When **on**, the encoder picks a sensible subsampling level based on your quality setting (more subsampling at low quality, less at high quality). Turn it **off** only when you want to set the amount yourself — for example, to force full color resolution on an image with saturated colored text or sharp color edges. Turning it off reveals the **Subsample chroma by** slider.
- **Recommended starting point:** **On**. Leave automatic unless you can see color smearing in the preview.

### Subsample chroma by

- **What it does:** Manually sets how aggressively the color channels are shrunk relative to brightness. (Appears only when **Auto subsample chroma** is off.)
- **Range & default:** 1 to 4, in steps of 1. **Default: 2** (option key `chroma_subsample`).
- **How to choose:** Think of it as "how many pixels of color share one value." Lower numbers keep more color detail; higher numbers compress color more.
  - **1** = no chroma subsampling (full color resolution, roughly 4:4:4) — best for sharp colored edges and text, but larger files.
  - **2** = the common default (roughly 4:2:0) — good balance for photos.
  - **3–4** = more aggressive color compression — smaller files, but colored edges may smear.
- **Recommended starting point:** **2** for photos. Use **1** for screenshots, logos, or images with crisp colored text where you noticed color bleeding.

### Quantization

- **What it does:** Picks the "quality recipe" (quantization table) the encoder uses to decide which image details to keep or discard. Different tables are tuned against different perceptual models — some prioritize how the image looks to human eyes, others optimize math-based quality scores.
- **Range & default:** Nine choices (option key `quant_table`):

  | Label                    | Value | Notes                                               |
  | ------------------------ | ----- | --------------------------------------------------- |
  | JPEG Annex K             | 0     | The classic table from the original JPEG standard.  |
  | Flat                     | 1     | Treats all detail levels equally.                   |
  | MSSIM-tuned (Kodak)      | 2     | Tuned for the MS-SSIM perceptual metric.            |
  | **ImageMagick**          | 3     | **Default** — a well-rounded general-purpose table. |
  | PSNR-HVS-M-tuned (Kodak) | 4     | Tuned for the PSNR-HVS-M perceptual metric.         |
  | Klein et al              | 5     | Based on a published vision model.                  |
  | Watson et al             | 6     | Based on a published vision model.                  |
  | Ahumada et al            | 7     | Based on a published vision model.                  |
  | Peterson et al           | 8     | Based on a published vision model.                  |

- **How to choose:** This is a fine-tuning knob — for most images the difference between tables is small and hard to see. The default (**ImageMagick**) is a solid all-rounder. If you're optimizing hard for a specific image, try a couple of tables at the same quality and compare file size and appearance in the preview; occasionally one will look slightly cleaner or compress a little better for your particular content.
- **Recommended starting point:** **ImageMagick** (the default). Experiment only when squeezing the last few percent.

### Pointless spec compliance

- **What it does:** Despite the tongue-in-cheek name, this forces a strict **baseline** JPEG — the simplest, most universally readable JPEG layout, which loads top-to-bottom in a single pass. The label is a wink at the fact that you almost never want it: progressive JPEGs (the default) are usually both smaller and nicer to load.
- **Range & default:** On/off. **Default: off** (option key `baseline`).
- **How to choose:** Leave it **off** for the web. Turn it **on** only if some old or strict tool in your pipeline genuinely requires a baseline JPEG. This checkbox acts as a switch for the next control: when it's **off** you get the **Progressive rendering** toggle; when it's **on** that's replaced by the **Optimize Huffman table** toggle.
- **Recommended starting point:** **Off**.

### Progressive rendering

- **What it does:** Stores the image so it loads in increasingly sharp passes (a blurry-to-clear reveal) rather than top-to-bottom. As a bonus, MozJPEG's progressive mode usually produces _smaller_ files than baseline.
- **Range & default:** On/off. **Default: on** (option key `progressive`). Shown only when **Pointless spec compliance** (baseline) is off.
- **How to choose:** Keep it **on** for web images — it both shrinks the file and gives a nicer perceived load on slow connections. To get a non-progressive file, turn on **Pointless spec compliance** instead (which hides this toggle).
- **Recommended starting point:** **On**.

### Optimize Huffman table

- **What it does:** Lets the encoder build a custom compression code tailored to your exact image instead of using a generic one, shrinking the file with zero quality loss.
- **Range & default:** On/off. **Default: on** (option key `optimize_coding`). Shown only when **Pointless spec compliance** (baseline) is on. (Progressive files always optimize this internally, which is why the toggle only appears in baseline mode.)
- **How to choose:** Leave it **on** — it's a free size win for the price of a tiny bit more encoding time. There's almost never a reason to disable it.
- **Recommended starting point:** **On**.

### Trellis multipass

- **What it does:** Turns on a slower, smarter optimization ("trellis quantization") that makes multiple passes to choose how to encode each block for the best quality-per-byte.
- **Range & default:** On/off. **Default: off** (option key `trellis_multipass`).
- **How to choose:** Enabling it can improve compression efficiency (better quality at the same size, or smaller at the same quality) at the cost of noticeably longer encoding. It also reveals the **Optimize zero block runs** companion toggle below. Worth trying when you really care about an individual image and don't mind waiting.
- **Recommended starting point:** **Off** for casual use; turn **on** when fine-tuning a single important image.

### Optimize zero block runs

- **What it does:** A trellis-related refinement that optimizes how runs of empty (all-zero) blocks are encoded, helping compression on images with large flat areas.
- **Range & default:** On/off. **Default: off** (option key `trellis_opt_zero`). Shown only when **Trellis multipass** is on.
- **How to choose:** A small extra squeeze, most useful alongside trellis on images with big uniform regions. Low risk to enable, modest benefit.
- **Recommended starting point:** **Off**; enable when experimenting with the trellis options.

### Optimize after trellis quantization

- **What it does:** Re-optimizes the compression tables _after_ trellis has done its work, recovering a little more size savings.
- **Range & default:** On/off. **Default: off** (option key `trellis_opt_table`). (Always visible in Advanced settings, but only meaningful once trellis is engaged.)
- **How to choose:** Another incremental trellis companion. Pair it with **Trellis multipass** when chasing maximum efficiency.
- **Recommended starting point:** **Off**; enable when fine-tuning with trellis on.

### Trellis quantization passes

- **What it does:** Sets how many optimization passes the trellis routine makes. More passes = more refinement.
- **Range & default:** 1 to 50, in steps of 1. **Default: 1** (option key `trellis_loops`). (Always visible in Advanced settings.)
- **How to choose:** Higher values let the encoder keep refining for potentially better results, but with steeply diminishing returns and longer encode times. It only meaningfully matters when trellis optimization is actually engaged (see **Trellis multipass**).
- **Recommended starting point:** **1**. If you've enabled trellis and want to push further, try small bumps (e.g. 2–5) and compare — going much higher rarely pays off.

### Smoothing

- **What it does:** Applies a gentle blur before encoding. Slightly smoothing the image removes fine noise and grain, which compresses better.
- **Range & default:** 0 to 100, in steps of 1. **Default: 0** (no smoothing) (option key `smoothing`).
- **How to choose:** Raising it softens the image and can shrink noisy or grainy photos, but too much makes everything look mushy and erases real detail. Most images should stay at 0.
- **Recommended starting point:** **0**. For very noisy/grainy source photos, try a low value like **5–20** and watch the preview for loss of sharpness.

### Separate chroma quality

- **What it does:** Lets you set a _different_ quality for the color channels than for brightness. (Color images only.)
- **Range & default:** On/off. **Default: off** (option key `separate_chroma_quality`). Only shown for color (YCbCr) images.
- **How to choose:** When off, color and brightness share the main **Quality** value. Turn it **on** to compress color more (or less) independently — handy if color detail is over- or under-prioritized for your image. Enabling it reveals the **Chroma quality** slider.
- **Recommended starting point:** **Off**. Leave color tied to the main quality unless you have a specific reason.

### Chroma quality

- **What it does:** The dedicated quality value for the color channels. (Appears only when **Separate chroma quality** is on.)
- **Range & default:** 0 to 100, in steps of 1. **Default: 75** (option key `chroma_quality`).
- **How to choose:** Set it lower than the main quality to save bytes when color precision doesn't matter much; set it higher to protect saturated colors and colored edges. Watch the preview around colorful details.
- **Recommended starting point:** **75** (matching the default quality). Adjust only when separating chroma intentionally.

## Recommended settings & community tips

> The settings below are **community recommendations** from web.dev/images.guide and the MozJPEG project, mapped onto Frisp's controls. They are advice, not new defaults; the factual ranges and defaults above are unchanged. Sources are listed at the end.

| Use case                                  | Suggested settings                                                                        | Why                                                                                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **General web photography (default)**     | Quality **80–85**, Progressive on, **Trellis multipass** on, chroma auto (4:2:0)          | `q80–85` is the documented web sweet spot (~30–40% savings at acceptable quality). Trellis is the whole reason to use MozJPEG over plain libjpeg — it makes globally better block decisions for a few % free. |
| **Thumbnails / retina (2×) imagery**      | Quality **60–70**, Progressive on, chroma auto (4:2:0)                                     | On high-DPI screens, pixel density masks artifacts, so q~60–70 is fine and cuts bytes substantially.                              |
| **Text / UI screenshots / sharp edges**   | Quality **90+**, **Auto subsample chroma off** + **Subsample chroma by 1** (4:4:4)        | 4:2:0 halves color resolution and makes colored text/edges look fuzzy; keep full color resolution for crisp content (JPEG is still photo-first — for true graphics use PNG/WebP). |
| **Max-quality / archival**                | Quality **92–95**, 4:4:4, full trellis suite, Trellis passes **2**                        | Stacking trellis multipass + zero-block + after-trellis at high quality squeezes the last few percent; only worth it for masters. |
| **Smallest file (slow, batch)**           | Quality **72–80**, full trellis suite, Progressive on, 4:2:0                               | The full trellis stack wrings out the last bytes at the cost of much slower encode — diminishing returns past ~1–2 Trellis passes. |

**Community tips**

- **Trellis is off by default but is MozJPEG's headline feature.** Turning **Trellis multipass** on is the documented way to get MozJPEG's edge over a regular JPEG. It interacts with the other trellis toggles, so enable it first.
- **Auto subsampling silently applies 4:2:0**, which blurs colored text and UI. For anything with sharp colored edges, force 4:4:4 (Auto off → Subsample chroma by 1).
- **Progressive is worth it but not free.** Progressive JPEGs are a bit smaller and reveal nicely on slow connections, but can decode up to ~3× slower than baseline on weak mobile CPUs.
- **The quantization table rarely needs tuning.** The default (ImageMagick) is a solid all-rounder; only experiment when chasing the last few percent on a specific image.

_Sources: [images.guide (web.dev)](https://images.guide/); [MozJPEG guide](https://imagecompressor.io/blog/mozjpeg-guide/); [MozJPEG issue #111 (trellis)](https://github.com/mozilla/mozjpeg/issues/111); [chroma subsampling (Wikipedia)](https://en.wikipedia.org/wiki/Chroma_subsampling)._

## Tips & pitfalls

- **Start and stop at Quality.** For 95% of images, picking a Quality between 70 and 85 and ignoring the advanced panel gives an excellent result. Use the preview to confirm.
- **JPEG can't do transparency.** If your image has transparent areas, MozJPEG will fill or mangle them. Use PNG, WebP, or AVIF for transparency.
- **Watch the high end.** Quality 95–100 produces big files for tiny visible gains. There's usually a sweet spot well below 100.
- **Subsampling and text.** If colored text or sharp color edges look smeared, turn **Auto subsample chroma** off and set **Subsample chroma by** to **1** (or use a transparency-capable format like WebP/PNG for crisp graphics — JPEG is built for photos, not screenshots).
- **"Pointless spec compliance" = baseline JPEG.** The jokey label just forces a plain, non-progressive file. Leave it off unless a downstream tool insists on baseline; progressive is smaller and loads more gracefully.
- **The trellis options are a package.** "Trellis quantization passes," "Optimize zero block runs," and "Optimize after trellis quantization" only really do something useful when **Trellis multipass** is on. They trade encode time for marginal size/quality gains.
- **Grayscale hides color options.** Switching **Channels** to Grayscale (or RGB) removes the chroma and separate-chroma-quality controls, since they only apply to YCbCr.
- **Smoothing is a one-way blur.** It can help noisy photos but permanently softens detail; bump it slowly.

## Under the hood

MozJPEG is Mozilla's drop-in JPEG encoder, run here entirely in your browser via WebAssembly — no image ever leaves your device. It improves on a standard JPEG mainly through **trellis quantization** (smarter per-block decisions about what to keep), **optimized progressive scan ordering**, and carefully tuned **quantization tables**, which together let it hit the same visible quality at a smaller size while still emitting fully standard `.jpg` files. (src: web.dev/squoosh, MozJPEG project docs.)
