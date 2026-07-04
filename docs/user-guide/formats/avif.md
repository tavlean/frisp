# AVIF

> A modern image format that makes very small files at high quality — at the cost of slower encoding.

## Overview / When to use it

AVIF (AV1 Image File Format) is a newer image format built on the AV1 video codec. For most photos it produces noticeably smaller files than JPEG or WebP at the same visual quality, and it supports transparency and a wide range of colors. The main trade-off is speed: AVIF takes longer to compress than older formats, and **the harder it works, the smaller the file**. It is widely supported in modern browsers, so it is a great default for photos and graphics on the web when you want the smallest possible download. The catch is that very old browsers and some desktop apps still cannot open `.avif` files, so keep a JPEG or PNG fallback if you need universal compatibility.

## Controls / Settings

### Lossless

- **What it does:** Keeps every pixel exactly as it was — nothing is thrown away. The file is larger, but it is a perfect copy of the original.
- **Range & default:** Checkbox, **off** by default. The panel doesn't have a real "lossless" switch in the codec; instead it _infers_ lossless from the other settings (it shows as on when quality is at the maximum, the chroma mode is 4:4:4, and alpha quality matches). Turning it on sets quality to its top value and forces chroma to **4:4:4**; turning it off restores the lossy defaults (option keys `quality`, `qualityAlpha`, `subsample`).
- **How to choose:** Use lossless only when you genuinely cannot tolerate any change — for example archival masters, or flat graphics with sharp edges and text where even tiny artifacts show. For photos it usually produces much bigger files for a quality gain you cannot see.
- **Recommended starting point:** **Off.** Turn it on only for graphics/line art that must stay pixel-perfect.

### Quality

- **What it does:** Controls how much detail is sacrificed to shrink the file. Higher keeps more detail and looks better; lower makes a smaller file. (This slider is hidden while **Lossless** is on.)
- **Range & default:** Slider from **0 to 99**, whole steps; default **50** (option key `quality`). Higher is better. Note the slider tops out at 99, not 100 — the maximum (100) is what **Lossless** uses.
- **How to choose:** AVIF holds up well at lower quality settings than JPEG, so you can often go lower than you would expect. Around 50–70 is a good range for web photos; below ~40 you start to see smearing and loss of fine texture; above ~80 the file grows quickly for little visible gain. Always watch the live preview rather than trusting the number alone.
- **Recommended starting point:** **50** (the default) is a sensible starting point for web photos — raise toward 60–70 for hero images, lower toward 40 for thumbnails.

### Effort

- **What it does:** Tells the encoder how hard to try. More effort means it searches harder for ways to compress, producing a **smaller file at the same quality** — but it takes longer.
- **Range & default:** Slider from **0 to 10**, whole steps; higher is more effort. The default is **4** (this maps to the codec's internal `speed` of 6; the panel inverts it, so Effort = 10 − speed). More Effort = lower speed = slower but smaller. (src: web.dev/articles/compress-images-avif)
- **How to choose:** This setting does not change how the image _looks_ at a given quality — it only changes file size and encode time. Higher Effort is almost always worth it for images you publish once and serve many times. Lower it when you are doing quick previews or batch-processing lots of images and want speed. (src: github.com/AOMediaCodec/libavif)
- **Recommended starting point:** **4** (the default) is the balanced choice; raise to **6–8** for final exports where size matters, and drop to **1–3** for fast previews.

## Advanced controls

These live under the **Advanced settings** expander. The defaults are sensible for most images — only reach for these if you have a specific reason. Most of them appear only in lossy mode (when **Lossless** is off); the two tiling sliders are always shown.

### Subsample chroma

- **What it does:** Chooses how much color detail to keep relative to brightness detail. Human eyes are far more sensitive to brightness than to color, so throwing away some color resolution shrinks the file with little visible effect on photos.
- **Range & default:** Four options — 4:0:0, **4:2:0**, 4:2:2, and 4:4:4 (option key `subsample`: 0 = 4:0:0, 1 = 4:2:0, 2 = 4:2:2, 3 = 4:4:4). The default is **4:2:0**.
- **How to choose:** Leave it on **4:2:0** for photos — it is the smallest and the color loss is usually invisible. Switch to **4:4:4** for images with sharp colored edges, fine colored text, or screenshots, where lower subsampling can cause color bleeding or fringing. (Interestingly, with AVIF, 4:4:4 sometimes compresses _better_ than 4:2:0 on certain images, so it is worth comparing.) Choose **4:0:0** to drop color entirely for black-and-white images. (Note: turning on **Lossless** forces 4:4:4.) (src: github.com/AOMediaCodec/libavif)
- **Recommended starting point:** **4:2:0** for photos, **4:4:4** for graphics/text or screenshots.

### Sharp YUV Downsampling

- **What it does:** Uses a smarter, slower method when reducing the color resolution, which keeps colored edges crisper and reduces fringing artifacts that 4:2:0 can introduce.
- **Range & default:** Checkbox, **off** by default (option key `enableSharpYUV`). It only appears when **Subsample chroma** is set to 4:2:0 — it has nothing to fix at the other settings.
- **How to choose:** Turn it on if you are using 4:2:0 on an image with bright, saturated edges (logos over photos, colored text, UI) and you see color smearing along those edges. It costs a little extra encode time but does not change the file's structure.
- **Recommended starting point:** **Off** — enable it if 4:2:0 makes colored edges look smeared.

### Separate alpha quality

- **What it does:** Lets you set a different quality level for the transparency (alpha) channel than for the colors. By default the alpha channel just uses the main Quality setting.
- **Range & default:** Checkbox, **off** by default (internally, alpha quality is the `qualityAlpha` key; off is stored as the sentinel value `-1`, meaning "use the main quality"). Only relevant for images that actually have transparency.
- **How to choose:** Leave it off unless your transparency mask has soft or detailed edges that look ragged. Turning it on reveals the **Alpha quality** slider below.
- **Recommended starting point:** **Off** (match color quality) — turn it on only if transparent edges look rough.

### Alpha quality

- **What it does:** Sets the quality of just the transparency (alpha) channel. Only visible when **Separate alpha quality** is on.
- **Range & default:** Slider from **0 to 99**, whole steps, higher is better — the same scale as the main Quality slider (option key `qualityAlpha`). It starts out following the main quality value.
- **How to choose:** Raise it for cleaner, smoother transparent edges at the cost of a few extra bytes; lower it to save size where a soft mask doesn't need much precision.
- **Recommended starting point:** Match it to your main Quality unless the transparent edges specifically need to be sharper.

### Extra chroma compression

- **What it does:** Lets the encoder compress the color channels a bit more aggressively than the brightness channel, saving extra bytes.
- **Range & default:** Checkbox, **off** by default (option key `chromaDeltaQ`).
- **How to choose:** Turning it on can shave file size with little perceptual cost on photos, since color detail matters less to the eye. It can occasionally dull subtle color gradients, so check the preview if your image has delicate color transitions.
- **Recommended starting point:** **Off** — try turning it on if you need to squeeze out a little more size on photos.

### Sharpness

- **What it does:** Biases the encoder toward keeping edges sharp when it decides what detail to throw away, which can make compressed output look crisper.
- **Range & default:** Slider from **0 to 7**, whole steps; default **0** (option key `sharpness`). (src: github.com/AOMediaCodec/libavif)
- **How to choose:** Higher values favor block sharpness but can exaggerate compression artifacts or add a slightly "crunchy" look. Most images look best left at 0; nudge it up only if compressed output looks slightly soft.
- **Recommended starting point:** **0** — try 1–2 only if the result looks too soft.

### Noise synthesis

- **What it does:** Applies film-grain–style denoising: instead of spending bits storing fine grain and sensor noise, the encoder can remove it during compression. This can shrink noisy or grainy photos noticeably.
- **Range & default:** Slider from **0 to 50**, whole steps; default **0** (off) (option key `denoiseLevel`).
- **How to choose:** Higher values remove more original noise, which makes the file smaller but can soften fine detail. It works best on photos that already have visible grain or sensor noise; on clean images it can wash out texture. Raise it gradually and watch the preview.
- **Recommended starting point:** **0** — try 5–15 for grainy or noisy photos to save size.

### Tuning

- **What it does:** Tells the encoder which yardstick to optimize toward when deciding what to keep and what to discard.
- **Range & default:** **Auto**, PSNR, or SSIM (option key `tune`: Auto = 0, PSNR = 1, SSIM = 2). Default is **Auto**.
- **How to choose:** **PSNR** optimizes for a raw pixel-difference metric, which can favor mathematical smoothness; **SSIM** optimizes for structural similarity, which tracks _perceived_ quality more closely and tends to preserve texture better. **Auto** lets the encoder choose. If you want the result to look as good as possible to the human eye, SSIM is often the better pick; PSNR is mostly useful for benchmarking. (src: github.com/AOMediaCodec/libavif)
- **Recommended starting point:** **Auto** — try **SSIM** if you want to prioritize how the image looks to people.

### Log2 of tile rows / Log2 of tile cols

- **What it does:** Splits the image into a grid of independently-encoded tiles. More tiles let the encoder and decoder work on pieces in parallel, which can speed things up on large images. These two sliders are always shown under Advanced, even in lossless mode.
- **Range & default:** Sliders from **0 to 6** each, whole steps; default **0** (option keys `tileRowsLog2` and `tileColsLog2`). The value is a power-of-two exponent: 0 = 1 tile, 1 = 2 tiles, 2 = 4 tiles, and so on along that axis.
- **How to choose:** Splitting into tiles slightly _increases_ file size and can create faint seams along tile edges, because each tile is compressed on its own. Leave both at 0 for normal images. They are mainly useful for very large images where decode/encode speed matters more than the last few bytes. (src: github.com/AOMediaCodec/libavif)
- **Recommended starting point:** **0** for both — only raise them for very large images where speed matters.

## Recommended settings & community tips

> The settings below are **community recommendations** drawn from web.dev's AVIF guide and encoder-community practice, translated into Presk's UI terms (its Quality slider is 0–99 and its Effort slider is 0–10, where higher Effort = slower/smaller). They are advice, not new defaults; the factual ranges and defaults above are unchanged. Sources are listed at the end.

| Use case                                | Suggested settings                                                                    | Why                                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Web photo (lossy)**                   | Quality **60–70**, Effort **6**, **4:2:0**, Tuning **SSIM**                            | AVIF's sweet spot is aggressive size reduction — it typically beats a JPEG at q85–90 at roughly half the size. Higher Effort squeezes more at no quality cost. |
| **Graphics / screenshots / text**       | Quality **80–88**, **4:4:4** (no subsampling), Effort **5–6**                          | 4:4:4 stops the color fringing the default 4:2:0 causes around text and sharp color edges; push quality up because low-bitrate AVIF blurs crisp UI detail. |
| **Transparency / alpha cutouts**        | Quality **70–80**; turn on **Separate alpha quality** and match it to color           | Keeps base quality high so cutout edges don't smear against varied backgrounds, and prevents the mask from being over-compressed. |
| **Archival / max-fidelity**             | **Lossless** on (forces 4:4:4), slow Effort (**6–8**) — or steer toward JPEG XL        | AVIF can do lossless, but at high quality JPEG XL usually matches it and keeps fine texture better, so it's a defensible-but-not-ideal archival pick. |

**Community tips**

- **JPEG quality numbers don't transfer.** Feeding an AVIF a "90" over-spends bits. AVIF holds up far lower than JPEG — start 10–15 points below your JPEG habit and judge by the preview.
- **The #1 gripe: smearing at low quality.** AVIF blurs fine texture (hair, fur, foliage, grain) instead of showing crisp artifacts. This is where JPEG XL wins at q80–95; if texture matters, raise quality or compare JPEG XL.
- **4:2:0 fringes text and logos.** Switch **Subsample chroma** to 4:4:4 for any image with sharp colored edges. On some images 4:4:4 even compresses *better* than 4:2:0 — worth comparing.
- **Effort/speed swings file size 20–30% for free.** It only costs encode time, so use a high Effort for final exports and a low one only for quick previews.
- **Tuning = SSIM tracks perceived quality** better than PSNR for stills; reach for it when you want the result to look as good as possible to the eye.

_Sources: [web.dev: compress images with AVIF](https://web.dev/articles/compress-images-avif); [openaviffile: best AVIF settings](https://openaviffile.com/best-settings-for-avif-encoding/); [chroma subsampling (Wikipedia)](https://en.wikipedia.org/wiki/Chroma_subsampling); [Cloudinary: advanced image formats](https://cloudinary.com/blog/advanced-image-formats-and-when-to-use-them); [a better image-compression comparison](https://www.rachelplusplus.me.uk/blog/2025/07/a-better-image-compression-comparison/)._

## Tips & pitfalls

- **Effort affects size, not looks.** Raising Effort makes the file smaller at the same quality — it does not improve or degrade how the image appears. The only cost is time, so use high Effort for anything you publish.
- **AVIF lets you go lower on Quality than JPEG.** A setting that would look rough as a JPEG often still looks fine as AVIF, so try lowering Quality before assuming you need a high value.
- **4:2:0 is great for photos but can blur sharp color edges.** If you compress a screenshot, logo, or colored text and see color fringing, switch **Subsample chroma** to 4:4:4 — or turn on **Sharp YUV Downsampling** while staying at 4:2:0.
- **Lossless overrides chroma.** Turning **Lossless** on forces 4:4:4 subsampling, and the Quality slider disappears because there is nothing left to trade off.
- **Separate alpha only matters with transparency.** If your image has no transparent areas, the alpha settings have no effect.
- **Tiling usually grows the file.** Only use the tile sliders when you specifically need faster encode/decode on a big image; leave them at 0 otherwise.
- **Keep a fallback for old browsers.** AVIF is widely supported in modern browsers, but very old browsers and some apps still cannot open `.avif`. Provide a JPEG or PNG fallback when universal compatibility matters.

## Under the hood

AVIF wraps a single still frame encoded by the AV1 video codec (via the libavif/aom encoder, compiled to WebAssembly and run entirely in your browser) inside an image container. That is why its controls — quality, `speed`/effort, YUV subsampling, tiling, film-grain–style denoising, and PSNR/SSIM tuning — mirror video-encoder settings. The panel exposes effort as a friendly 0–10 slider that it inverts into the codec's 0–10 `speed` value, so that higher Effort means slower, smaller encoding. (Conceptual guidance drawn from web.dev's AVIF article and the libavif/avifenc documentation; all option ranges and defaults above come from the Presk source.)
