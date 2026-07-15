# Resize

> Change the pixel dimensions of your image — make it smaller (or larger) and choose how the new pixels are calculated.

## Overview / When to use it

Resizing changes how many pixels wide and tall your image is. The single biggest win in image compression is usually just **making the image smaller**: a photo that displays at 800 pixels wide on a web page does not need to be 4000 pixels wide in the file. Shrink it to the size it will actually be shown at and the file gets dramatically smaller before any format-specific compression even kicks in. Use the Resize panel to set a target width/height (or pick a percentage preset), and to control the quality of the scaling math — the _resampling method_ — plus a couple of advanced color-correctness toggles.

A quick note on jargon: **resampling** (or **interpolation**) is the process of inventing the new grid of pixels from the old one. When you shrink or enlarge an image, the new pixels rarely line up perfectly with the originals, so the computer has to blend nearby pixels together. The Method dropdown picks _which blending math_ is used, and different methods trade off sharpness, smoothness, and speed.

## Controls / Settings

### Method

- **What it does:** Chooses the resampling algorithm — the math that calculates each new pixel from the original pixels. This is the most important quality control in the panel.
- **Range & default:** Dropdown. Default is **Lanczos3** (option key `method`, value `lanczos3`). Full list of options below. The **Vector** option only appears when your source image is an SVG (vector) file.
- **How to choose:** See the per-method breakdown below. In short: leave it on Lanczos3 for photos; switch to **hqx (pixel art)** for crisp game sprites/pixel art; use **Browser pixelated** if you want hard, blocky pixels with no smoothing; use **Vector** to rasterize an SVG cleanly at the exact target size.
- **Recommended starting point:** **Lanczos3** for almost all photographic and general-purpose images.

The methods fall into three families. The **worker** methods (Lanczos3, Mitchell, hqx) run in high-quality WebAssembly code and unlock the **Premultiply alpha channel** and **Linear RGB** toggles. The one **Browser** method (Browser pixelated) hands the work to your browser's built-in canvas scaler (fast, no extra toggles). Vector is its own thing for SVGs.

The Method dropdown (and its Premultiply / Linear RGB companions) lives under the **Advanced settings** expander — Lanczos3, the default, is the right pick for almost every photo, so the panel leads with Preset / Width / Height instead. Open Advanced to change the scaling math.

#### Lanczos3 (`lanczos3`)

- **What it is:** A high-quality resampling filter that looks at a wide neighborhood of surrounding pixels using a windowed sinc function. It is the sharpest of the general-purpose options here.
- **Sharpness vs smoothness vs ringing:** The sharpest, best at preserving fine detail when both shrinking and enlarging photos. The trade-off is mild **ringing** — faint light/dark "echo" halos that can appear next to very high-contrast edges (src: web.dev / grokipedia.com/page/Comparison_gallery_of_image_scaling_algorithms).
- **Speed:** Slower than the simpler filters because it samples a wider area, but still fast for typical web images.
- **Pick it for:** Photos and most real-world images. This is the default for a reason.

#### Mitchell (`mitchell`)

- **What it is:** The Mitchell-Netravali cubic filter, deliberately tuned as a middle-ground between sharpness and smoothness.
- **Sharpness vs smoothness vs ringing:** Slightly softer than Lanczos3, with noticeably **less ringing**. A good "safe" choice when Lanczos3's halos bother you (src: mathworks.com interpolation kernels docs).
- **Speed:** Fast — cubic filters like this balance quality and efficiency well.
- **Pick it for:** Photos where you want clean edges without ringing artifacts, or when downscaling images with lots of sharp contrast.

#### hqx (pixel art) (`hqx`)

- **What it is:** A specialized **magnification** scaler built for pixel art (retro game sprites, low-resolution icons). It detects edges and enlarges by clean integer factors while keeping outlines crisp instead of blurry.
- **Sharpness vs smoothness vs ringing:** Designed to keep hard pixel-art edges sharp and avoid the blur that normal photo filters cause. It only enlarges by a factor of 2x, 3x, or 4x (capped at 4x); the result is then resized the rest of the way with Catmull-Rom (a high-quality cubic filter, used internally only) to hit your exact target. If your target isn't actually larger than the source, hqx leaves the pixels untouched and just resizes normally.
- **Speed:** Fast.
- **Pick it for:** **Pixel art and sprites you are scaling up.** Do not use it for photos.

#### Browser pixelated (`browser-pixelated`)

- **What it is:** Hands resizing to the browser canvas with smoothing turned off, producing hard, blocky pixels (nearest-neighbor style).
- **Sharpness vs smoothness vs ringing:** No blending at all — every pixel stays a crisp square. Great for a deliberate blocky look; terrible for photos (jagged staircase edges).
- **Speed:** Very fast (runs natively in the browser).
- **Pick it for:** Pixel art where you want an exact, no-smoothing blow-up, or an intentional "lo-fi" aesthetic.

#### Vector (`vector`)

- **What it is:** Only shown when the source is an **SVG** and you choose a raster output such as WebP, AVIF, JPEG, or PNG. Instead of resizing a grid of pixels, it draws the vector artwork directly at the raster export's target size. An **SVG output itself is text-optimized and never resized**.
- **Sharpness vs smoothness vs ringing:** The cleanest possible result for vector art, because the shapes are rendered fresh at the chosen resolution rather than scaled from an existing pixel grid — no blur, no ringing.
- **Speed:** Fast.
- **Pick it for:** Any SVG source. It is selected automatically as the method for SVG inputs.

### Preset

- **What it does:** A quick way to set width and height as a percentage of the original size, instead of typing exact numbers.
- **Range & default:** Dropdown of fixed **shrink** percentages — **25%, 50%, 100%** — plus **Custom** (option keys: `width` / `height`; preset multipliers `0.25, 0.5, 1`). The presets stop at 100% on purpose: Frisp is an optimizer, not an upscaler, so it deliberately doesn't offer one-click _enlarge_ percentages (enlarging just spreads existing pixels — blurrier and bigger, with no real detail gained). There is no single "default" preset; the dropdown shows whichever percentage currently matches your width/height, or **Custom** if it matches none (for example after you type your own numbers, or set any size in between the presets).
- **How to choose:** Pick a percentage to scale both dimensions down at once. 50% halves the size; 25% quarters it. Selecting a preset overwrites the Width and Height fields; typing your own values flips the dropdown to Custom — use it for any in-between amount (e.g. a one-third reduction) as well as for a _larger_ output (an exact target dimension, or pixel-art magnification with **hqx**).
- **Recommended starting point:** **50%** is a common, safe first step for oversized photos — preview it, and adjust from there.

### Width

- **What it does:** Sets the output width in pixels.
- **Range & default:** Whole number, minimum **1** (option key `width`). Defaults to the source image's width.
- **How to choose:** Set it to the size the image will actually be displayed at. With **Maintain aspect ratio** on (the default), changing Width auto-updates Height to keep proportions.
- **Recommended starting point:** The largest size the image is ever shown at in your layout — no bigger.

### Height

- **What it does:** Sets the output height in pixels.
- **Range & default:** Whole number, minimum **1** (option key `height`). Defaults to the source image's height.
- **How to choose:** Same logic as Width. With aspect ratio locked, editing Height auto-updates Width.
- **Recommended starting point:** Let it follow automatically from Width with aspect ratio locked, unless you have a specific target height.

### Maintain aspect ratio

- **What it does:** Keeps the original width-to-height proportions. When on, editing one dimension automatically recalculates the other so the image doesn't get stretched or squashed.
- **Range & default:** Checkbox, **on by default** (UI state `maintainAspect`).
- **How to choose:** Leave it on unless you deliberately want to distort the image (rare). Turning it **off** reveals the **Fit method** control below.
- **Recommended starting point:** **On.** Only turn it off if you need exact non-proportional dimensions.

### Fit method

- **What it does:** Decides what happens when the target width and height have a _different shape_ (aspect ratio) than the original. Only appears when **Maintain aspect ratio is off**.
- **Range & default:** Dropdown — **Stretch** (default) or **Contain** (option key `fitMethod`, values `stretch` / `contain`).
- **How to choose:**
  - **Stretch** squashes or stretches the whole image to exactly fill your width x height, distorting proportions if the shapes differ.
  - **Contain** keeps proportions by **cropping** — it center-crops the source to match the target shape, then scales that crop to fill the dimensions (no distortion, but you lose the cropped-off edges).
- **Recommended starting point:** If you've turned off aspect ratio on purpose, **Contain** usually looks better because it avoids distortion — just be aware it trims the edges.

### Premultiply alpha channel

- **What it does:** A correctness fix for images with **transparency** (an alpha channel). It tells the resizer to blend the color and transparency together correctly so you don't get ugly dark or bright fringes ("halos") around the edges of transparent regions. Only appears for the worker methods (Lanczos3, Mitchell, hqx).
- **Range & default:** Checkbox, **on by default** (option key `premultiply`).
- **How to choose:** When pixels are blended during resizing, the color hiding "behind" fully-transparent pixels can leak into visible edges if alpha isn't handled first. Premultiplying the alpha before blending prevents that, so edges of logos, icons, and cut-outs stay clean (src: ssp.impulsetrain.com/gamma-premult.html; lomont.org/posts/2023/correctalphagammaforimages). It has no effect on fully opaque images.
- **Recommended starting point:** **On.** Leave it on for anything with transparency; there's rarely a reason to disable it.

### Linear RGB

- **What it does:** Performs the resize math in **linear (gamma-corrected) light** instead of directly on the stored color values. Images are normally stored "gamma-encoded" (sRGB), which is not how light physically adds up — so averaging those stored values when blending pixels can subtly darken or shift colors. Doing the math in linear light gives physically more accurate blends. Only appears for the worker methods.
- **Range & default:** Checkbox, **on by default** (option key `linearRGB`).
- **How to choose:** With it **on**, blended/resized colors (especially bright areas and high-contrast edges) stay truer and gradients don't darken. Turning it **off** does the math directly on the stored sRGB values — faster conceptually but slightly less accurate, and fine details can come out marginally darker (src: lomont.org/posts/2023/correctalphagammaforimages; ssp.impulsetrain.com/gamma-premult.html).
- **Recommended starting point:** **On.** This matches how Squoosh resizes by default and gives the most color-accurate result. Only experiment with turning it off if a specific image looks better to your eye without it.

## Recommended settings & community tips

> The settings below are **community recommendations** from encoding/resampling guides. They are advice, not new defaults; Frisp's actual defaults (Lanczos3 + Premultiply alpha + Linear RGB, all on) already match best practice for photographic downscaling. Sources are listed at the end.

| Use case                                      | Suggested method                                         | Why                                                                                                                                                                                     |
| --------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Downscaling photographs (the common case)** | **Lanczos3**, Premultiply on, Linear RGB on              | Lanczos is the community standard for high-quality downscaling — best anti-aliasing and detail retention, sharper than Mitchell, at the cost of slight ringing.                         |
| **Flat graphics / illustrations / gradients** | **Mitchell**                                             | Mitchell trades a hair of sharpness for far fewer ringing halos than Lanczos — preferable on synthetic imagery and smooth gradients where overshoot is visible.                         |
| **Upscaling / enlarging**                     | **Lanczos3** generally; **Mitchell** if halos appear     | Lanczos enlarges at high quality but rings more; Mitchell gives smoother, halo-free enlargements. (Upscaling in a compressor is usually a mistake — it adds bytes without real detail.) |
| **Pixel art / sprites**                       | **hqx (pixel art)** to enlarge, or **Browser pixelated** | Any smoothing filter destroys crisp pixel-art edges; nearest-neighbor / hqx are the only correct choices, and only at integer scale factors.                                            |

**Community tips**

- **Keep Linear RGB on.** Resizing in gamma (non-linear) space darkens fine detail and thin bright features. Frisp defaults it on; turning it off makes downscales subtly muddier.
- **Keep Premultiply alpha on** for anything transparent. Forgetting it produces dark fringes around transparent edges after a resize.
- **Lanczos ringing = halos.** If you see light/dark echoes near high-contrast edges (especially on flat graphics), switch to Mitchell — the #1 reason to leave Lanczos for non-photographic content.
- **Downscaling softens; sharpen _after_.** The standard fix for the inherent softening of downscaling is a light unsharp/sharpen pass at the _final_ size. Frisp doesn't expose a post-resize sharpen today, so if you need crispness back, do it in another tool after exporting.

_Sources: [encoding/resampling guide](https://guideencodemoe-mkdocs.readthedocs.io/encoding/resampling/); [image-scaling algorithms comparison](https://grokipedia.com/page/Comparison_gallery_of_image_scaling_algorithms); [PixInsight interpolation algorithms](https://pixinsight.com/doc/docs/InterpolationAlgorithms/InterpolationAlgorithms.html)._

## Tips & pitfalls

- **Resize first, then compress.** Shrinking to the display size is the highest-impact thing you can do for file size — often bigger than any quality-slider change in the format panel.
- **Enlarging never adds detail.** Scaling above 100% just spreads existing pixels over a bigger area; it can't recover detail that isn't there. That's why the presets only go down to 100% — to enlarge at all you have to type larger Width/Height values yourself. For pixel art you want to blow up, use **hqx** or **Browser pixelated** instead of a photo filter.
- **At 100% there's nothing to do.** With Resize enabled but left at the source's own size (100%), the default scaler is an identity pass, so Frisp skips it entirely — no re-encode and no "Resizing" pill. You only get a resize once you set a size that's actually different.
- **Method, Premultiply, and Linear RGB are under Advanced settings.** Open the **Advanced settings** expander to reach them; the panel leads with Preset/Width/Height because the default Lanczos3 is right for almost everything.
- **The Premultiply and Linear RGB toggles only show up for the worker methods.** Switch the Method to Lanczos3/Mitchell/hqx and they appear; pick Browser pixelated or Vector and they're hidden (those paths don't use them). They also only _do_ anything while you're actually scaling — they correct the color math during pixel blending, so at 100% (no blending) toggling them changes nothing.
- **Ringing vs blur is a real trade-off.** If Lanczos3 gives you faint halos around sharp edges, switch to **Mitchell** — softer, with much less ringing. If Mitchell looks too soft, step back up to Lanczos3 for maximum detail.
- **Fit method only matters with aspect ratio off.** While "Maintain aspect ratio" is on, fit method is irrelevant (and hidden) because proportions can't change. **Contain** crops the pixels; it does not letterbox — expect to lose the edges that don't fit the new shape. (Separately, the side-by-side compare view letterboxes the smaller output inside the original footprint so the two halves stay aligned — that is a display effect, not part of the resize.)
- **Don't use hqx or Browser pixelated for photos.** They're built for hard-edged pixel art and will look bad on photographic content.

## Under the hood

The worker methods run in WebAssembly: Mitchell and Lanczos3 use the Rust `resize` crate (via the `squoosh-resize` wrapper), while **hqx** uses the Rust `hqx` crate (`squooshhqx`). hqx enlarges only by integer factors of 2x-4x and then finishes the resize to your exact dimensions using Catmull-Rom — one of two extra filters (with Triangle/bilinear) that the `resize` crate still provides but that Frisp no longer offers as its own menu entry. **Browser pixelated** is the lone browser scaler kept: it calls the canvas API with smoothing turned off (nearest-neighbor); the smooth `imageSmoothingQuality` low/medium/high levels were removed because the worker filters are higher quality and consistent across machines. The Vector method rasterizes the SVG by drawing it onto a canvas at the target size. The **Contain** fit method center-crops the source (via `getContainOffsets`) before scaling, so you get a proportional fill rather than a stretched one.
