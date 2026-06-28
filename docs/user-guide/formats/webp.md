# WebP

> Google's modern image format that makes both photos and graphics smaller than JPEG or PNG, with optional lossless mode and transparency support.

## Overview / When to use it

WebP is a great all-rounder. In **lossy** mode it behaves like JPEG and is ideal for photographs, typically landing 25–34% smaller than a JPEG of equivalent quality (src: web.dev/learn/images/webp/). In **lossless** mode it behaves like PNG and is ideal for graphics, logos, screenshots, and anything with sharp edges or transparency, typically around 26% smaller than PNG (src: developers.google.com/speed/webp/docs/compression). WebP supports an alpha (transparency) channel in both modes — even lossy, which JPEG can't do. It's well supported in modern browsers, so for most web images WebP is a safe, smaller-file choice. If you're unsure: use **lossy for photos** and **lossless for graphics, text, or transparency**.

> Jargon note: "lossy" means the encoder throws away some detail to shrink the file (you can't get it back). "Lossless" means the image is rebuilt pixel-for-pixel identical, just stored more efficiently.

## Controls / Settings

The panel changes shape depending on the **Lossless** toggle. Two controls are always visible regardless of mode: **Lossless** (at the top) and **Preserve transparent data** (at the bottom).

### Lossless

- **What it does:** Switches the whole panel between two compression engines. Off uses lossy compression (good for photos); on rebuilds the image exactly with no quality loss (good for graphics and transparency). Toggling it swaps which controls appear below.
- **Range & default:** Off / On toggle, default **Off** (`lossless`, stored as 0 or 1).
- **How to choose:** Leave it off for photographs. Turn it on for screenshots, logos, line art, text, or anything where blurriness is unacceptable. Lossless files are larger for photos but smaller and crisper for flat-color graphics.
- **Recommended starting point:** **Off** for photos; **On** for graphics, icons, and images with hard edges or transparency.

### Preserve transparent data

- **What it does:** Keeps the color values of fully transparent pixels instead of letting the encoder clear them. Normally invisible (transparent) pixels can be recolored freely to compress better; turning this on preserves them exactly, which matters if something downstream reads those hidden colors.
- **Range & default:** Off / On toggle, default **Off** (`exact`).
- **How to choose:** Almost always leave it off — it makes files larger for no visible benefit. Turn it on only in the rare case you need the original RGB values behind transparent areas preserved.
- **Recommended starting point:** **Off** (the default).

---

### Lossy mode controls (Lossless off)

#### Effort

- **What it does:** Controls how hard the encoder works. Higher effort searches more compression options for a smaller and/or better-looking file, but takes longer to encode.
- **Range & default:** 0–6, step 1, default **6** — the highest effort, for the best compression (`method`). The slider label reads "Effort:".
- **How to choose:** Raising it makes files a little smaller or better at the cost of encoding time; lowering it is faster but slightly worse. Since Sqush runs in your browser, very high effort on large images can feel slow — but WebP stays quick even at 6 for typical web images.
- **Recommended starting point:** **6** (the default — maximum compression). Lower it only if you're compressing very large images and want a faster encode.

#### Quality

- **What it does:** The main quality dial for lossy WebP. Lower values discard more detail for a smaller file; higher values keep more detail in a larger file.
- **Range & default:** 0–100, step 1 (whole numbers), default **80** (`quality`).
- **How to choose:** This is the setting you'll adjust most. Watch the preview and the output size, then pick the lowest value that still looks good. Below ~50 you'll start seeing visible artifacts on most photos; above ~90 the file grows quickly for little visible gain.
- **Recommended starting point:** **80** (the default). Try **65–85** for typical web photos — lower for smaller files, higher when quality matters most.

---

### Lossless mode controls (Lossless on)

#### Effort

- **What it does:** In lossless mode this is a single "preset" slider that picks a balance of speed versus file size (internally it sets a method/quality pair). Higher values compress harder and smaller but take longer; the image stays pixel-perfect either way.
- **Range & default:** 0–9, step 1, default **6** (maps to the preset `[method 4, quality 75]`). The slider label reads "Effort:".
- **How to choose:** Because quality never changes in lossless mode, this is purely a size-vs-time choice. Higher = smaller file, slower encode.
- **Recommended starting point:** **6** (the default). Raise toward 9 for the smallest file if you can wait.

#### Slight loss

- **What it does:** Enables "near-lossless" compression — it allows tiny, usually invisible changes to pixels so the file compresses better, while staying far closer to the original than normal lossy mode. At 0 it's truly lossless.
- **Range & default:** 0–100, step 1, default **0** (the slider is the inverse of the codec's `near_lossless`, which defaults to 100). 0 means no loss.
- **How to choose:** Raise it slightly (e.g. 10–40) on photographic or noisy graphics where you want lossless-like quality but a smaller file. Higher values allow more change. Leave at 0 when you need an exact reproduction.
- **Recommended starting point:** **0** (truly lossless). Nudge upward only if a lossless graphic is bigger than you'd like.

#### Discrete tone image

- **What it does:** Tells the encoder the image is "graph-like" — flat areas of solid color with few gradients (charts, diagrams, logos, line art). The encoder then uses strategies tuned for that kind of content.
- **Range & default:** Off / On toggle, default **Off** (sets `image_hint` to 3 = graph hint when on, 0 = default when off).
- **How to choose:** Turn it on for charts, diagrams, screenshots of UI, and other flat-color graphics; it can shrink those further. Leave it off for photos or anything with smooth gradients.
- **Recommended starting point:** **Off**; enable for flat, poster-like graphics.

## Advanced settings (lossy mode only)

These live behind the **Advanced settings** expander, which only appears in lossy mode. The defaults are well-tuned, so most people should leave them alone. Adjust one at a time and compare in the preview.

### Compress alpha

- **What it does:** Compresses the transparency (alpha) channel rather than storing it uncompressed. This shrinks files that have transparency.
- **Range & default:** Off / On toggle, default **On** (`alpha_compression`).
- **How to choose:** Keep it on; turning it off only makes transparent images larger. It has no effect on images without transparency.
- **Recommended starting point:** **On** (the default).

### Alpha quality

- **What it does:** Sets the quality of the transparency channel, separately from the main color Quality slider.
- **Range & default:** 0–100, step 1, default **100** (`alpha_quality`).
- **How to choose:** Lower it to save bytes on the transparency mask, but soft or anti-aliased edges may degrade. Most images want the maximum.
- **Recommended starting point:** **100** (the default). Only lower it if the alpha channel is large and edge softening is acceptable.

### Alpha filter quality

- **What it does:** Chooses the filtering method used when compressing the alpha channel, which affects how well it compresses.
- **Range & default:** 0–2, step 1, default **1** (`alpha_filtering`). 0 = none, 1 = fast, 2 = best.
- **How to choose:** Higher can compress transparency slightly better at a little extra cost. The difference is usually small.
- **Recommended starting point:** **1** (the default).

### Auto adjust filter strength

- **What it does:** Lets the encoder pick the deblocking-filter strength automatically, spending extra time to reach a well-balanced result. When on, it hides and overrides the manual Filter strength slider below.
- **Range & default:** Off / On toggle, default **Off** (`autofilter`).
- **How to choose:** Turn it on to let WebP tune filtering for you; it can improve consistency on mixed images but adds encode time. When on, your manual Filter strength setting no longer applies.
- **Recommended starting point:** **Off** (the default).

### Filter strength

- **What it does:** Controls the deblocking filter, which smooths the blocky seams that lossy compression can create. Higher values smooth more; 0 turns filtering off. (Only shown when Auto adjust filter strength is off.)
- **Range & default:** 0–100, step 1, default **60** (`filter_strength`).
- **How to choose:** Raise it if you see blocky edges in flat areas; lower it if the image looks too soft. Stronger filtering trades a little sharpness for smoother gradients (src: developers.google.com/speed/webp/docs/cwebp).
- **Recommended starting point:** **60** (the default).

### Strong filter

- **What it does:** Chooses between the strong deblocking filter (on) and a simpler one (off). The strong filter gives better quality at block boundaries.
- **Range & default:** Off / On toggle, default **On** (`filter_type`, stored as 1 = strong, 0 = simple).
- **How to choose:** Keep it on for best quality. Turning it off uses a lighter filter that's marginally faster but lower quality.
- **Recommended starting point:** **On** (the default).

### Filter sharpness

- **What it does:** Adjusts how sharply the deblocking filter is applied. Note the underlying scale is inverted — in the codec, 0 is the sharpest and 7 the least sharp — and Sqush flips the slider so that a higher slider number means more filtering/softer result (src: developers.google.com/speed/webp/docs/cwebp).
- **Range & default:** 0–7, step 1 (`filter_sharpness`, shown inverted as `7 − value`); the codec default of 0 shows as **7** on the slider.
- **How to choose:** Leave it at the default. Lower the slider only if filtering is softening detail too much and you want a crisper result.
- **Recommended starting point:** Default (slider shows **7**).

### Sharp RGB→YUV conversion

- **What it does:** Uses a more accurate (but slower) method to convert your image's colors into the internal format WebP encodes. It produces sharper results on saturated edges — especially reds and blues — and fine color detail (src: developers.google.com/speed/webp/docs/cwebp).
- **Range & default:** Off / On toggle, default **Off** (`use_sharp_yuv`).
- **How to choose:** Turn it on if you see color fringing or smearing on bright, saturated edges. The cost is slower encoding.
- **Recommended starting point:** **Off**; enable for images with strong reds/blues or fine color detail.

### Passes

- **What it does:** Sets the number of entropy-analysis passes. More passes let the encoder analyze the image more thoroughly, which can shrink the file slightly.
- **Range & default:** 1–10, step 1, default **1** (`pass`).
- **How to choose:** Raising it can squeeze out a bit more compression at the cost of encode time. The benefit is usually small for a fixed quality.
- **Recommended starting point:** **1** (the default).

### Spatial noise shaping

- **What it does:** Redistributes compression bits toward the areas of the image where they matter most perceptually (busy/textured regions versus smooth ones), improving how the result looks (src: developers.google.com/speed/webp/docs/cwebp). 0 turns it off.
- **Range & default:** 0–100, step 1, default **50** (`sns_strength`).
- **How to choose:** Higher values shape noise more aggressively, which usually looks better to the eye. Very high values can occasionally smear fine detail.
- **Recommended starting point:** **50** (the default).

### Preprocess

- **What it does:** Applies an optional pre-processing pass before encoding. "Segment smooth" lightly smooths within segments; "Pseudo-random dithering" adds quality-dependent dithering during color conversion, which can reduce banding.
- **Range & default:** Dropdown, default **None** (`preprocessing`): 0 = None, 1 = Segment smooth, 2 = Pseudo-random dithering.
- **How to choose:** Leave on None normally. Try Pseudo-random dithering if you see visible banding in smooth gradients; try Segment smooth to reduce noise/grain.
- **Recommended starting point:** **None** (the default).

### Segments

- **What it does:** Divides the image into up to four segments that can each use different compression parameters, letting the encoder adapt to different regions (e.g. sky versus foliage) (src: developers.google.com/speed/webp/docs/cwebp).
- **Range & default:** 1–4, step 1, default **4** (`segments`).
- **How to choose:** More segments allow finer adaptation and usually better quality, which is why the default is the maximum. Lowering it rarely helps.
- **Recommended starting point:** **4** (the default).

### Partitions

- **What it does:** Splits the compressed data into separate chunks (the value is the log2 of the number of partitions, so 0–3 means 1, 2, 4, or 8 partitions). This is about enabling parallel decoding, not image quality.
- **Range & default:** 0–3, step 1, default **0** (`partitions`).
- **How to choose:** Almost no reason to change this for normal use; it has essentially no visible effect on the image.
- **Recommended starting point:** **0** (the default) — leave it alone.

## Recommended settings & community tips

> The settings below are **community recommendations**, gathered from Google's own `cwebp` guidance and widely-shared web-developer practice. They are advice, not new defaults — the factual ranges and defaults above come straight from the Sqush source and are unchanged. Sources are listed at the end of this section.

| Use case                                   | Suggested settings                                                              | Why                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Web photo (lossy)**                      | Quality **75–80**, Effort **6**                                                 | `q80` at max effort is the canonical "set and forget" web recipe — artifacts are imperceptible at normal viewing while files run ~25–35% under JPEG. |
| **Graphics / screenshots / line art**      | **Lossless** on (Effort 6); or near-lossless via **Slight loss ~40**            | Lossless is ~26% smaller than PNG and avoids the ringing lossy WebP creates around text and hard edges. Near-lossless trades invisible exactness for smaller files. |
| **Sharp-edged content you must keep lossy**| Quality **≥ 90**                                                                | At q90+ the edge ringing that plagues lower-quality lossy WebP on text/logos largely disappears.                                                     |
| **Transparency / alpha cutouts**           | Lossy Quality **~90**, **Alpha quality 100**                                    | Alpha is encoded separately, so you can hold the mask lossless while the color stays lossy. Higher base quality prevents halos against varied backgrounds. |
| **Re-encoding an existing JPEG**           | Lossy Quality **~80** — do **not** turn Lossless on                             | Lossless recompression of an already-lossy JPEG re-encodes its noise pixel-perfectly and almost never shrinks; drop to lossy to actually gain.       |

**Community tips**

- **Effort costs time, not quality.** Method/Effort 6 is the slowest but most efficient setting; it never hurts how the image looks, so it's worth maxing for anything you publish once and serve many times.
- **WebP is 8-bit only** — no HDR or wide-gamut. That's a hard ceiling versus AVIF/JPEG XL that surprises photographers; for archival, prefer JPEG XL or PNG.
- **The "JPEG → lossless WebP" footgun.** Turning Lossless on while transcoding a JPEG produces a *bigger* file. It's the single most common automation mistake with WebP.
- **OS/viewer support is patchy.** Some desktop image viewers and "Save image as" flows still don't handle `.webp` well, which can frustrate end users downloading the file.

_Sources: [cwebp docs](https://developers.google.com/speed/webp/docs/cwebp); [libwebp lossless-alpha study](https://developers.google.com/speed/webp/docs/webp_lossless_alpha_study); [libwebp tool docs](https://chromium.googlesource.com/webm/libwebp/+/HEAD/doc/tools.md); [webp-discuss: lossless transcode](https://groups.google.com/a/webmproject.org/g/webp-discuss/c/C62i8FkBvxU); [Cloudinary: advanced image formats](https://cloudinary.com/blog/advanced-image-formats-and-when-to-use-them)._

## Tips & pitfalls

- **Pick the right mode first.** Lossless on a photo produces a huge file; lossy on a logo or screenshot produces fuzzy edges. Match the mode to the content before touching anything else.
- **Quality is your main lever in lossy mode** — adjust it before opening Advanced. Most size savings come from Quality and Effort alone.
- **Advanced settings only exist in lossy mode.** Switch Lossless off if you want to reach the filter, segment, and preprocessing controls.
- **Auto adjust filter strength overrides Filter strength.** When the auto-filter is on, the manual Filter strength slider disappears and is ignored.
- **Filter sharpness scale is inverted under the hood** (0 = sharpest in the codec), so don't assume a higher number is sharper.
- **"Slight loss" is near-lossless, not lossy.** It stays far closer to the original than turning Lossless off — a middle ground when a truly lossless graphic is too big.
- **Preserve transparent data usually just wastes bytes.** Leave it off unless you specifically need the colors behind transparent pixels.
- **Use the preview.** Always compare against the original at 100% zoom before committing.

## Under the hood

Sqush encodes WebP entirely in your browser using a WebAssembly build of Google's official `libwebp` library; no image data leaves your device. Most control names map directly onto `cwebp`'s command-line options — for example Effort is `-m` (method), Spatial noise shaping is `-sns`, Filter strength is `-f`, Segments is `-segments`, and Sharp RGB→YUV conversion is `-sharp_yuv` — so the libwebp documentation applies if you want to dig deeper (src: developers.google.com/speed/webp/docs/cwebp). A few raw codec options (such as a target file size or target PSNR) exist in the format but are deliberately not surfaced in the Sqush UI.
