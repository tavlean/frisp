# PNG

> Squeeze the most out of a PNG without changing a single pixel — a fully lossless way to shrink PNG files. Encoded with **OxiPNG** (shown as **PNG** in the menu; the encoder name appears as a hover tooltip).

## Overview / When to use it

**PNG** is a format for images that need crisp edges and exact colors — logos, icons, screenshots, line art, and anything with transparency. OxiPNG is a _lossless_ optimizer: it rewrites the PNG more efficiently so the file gets smaller, but the decoded image is byte-for-byte identical to the original (no quality loss, ever). Reach for OxiPNG when you want to keep PNG's perfect fidelity and just want a smaller file. If your image is a photo, a lossy format like WebP, AVIF, or JPEG will usually be far smaller — OxiPNG is for when you specifically need PNG.

## Controls / Settings

### Effort (slower is better):

- **What it does:** Sets how hard OxiPNG works to find the smallest file. At higher levels it tries more combinations of PNG compression filters and settings, so it takes longer but usually produces a smaller file. Because the optimization is lossless, the picture itself never changes — only the file size and the time it takes (src: github.com/oxipng/oxipng).
- **Range & default:** Slider from **0 to 6**, whole steps, default **2** (option key `level`).
- **How to choose:** Raising the level spends more time searching for better compression and tends to give smaller files; lowering it is faster but leaves a little size on the table. The savings usually shrink as you climb — going from low to medium often helps noticeably, while the top levels can take a lot longer for a smaller extra gain. The highest levels use the heavier Zopfli compression strategy, which is the slowest part (src: github.com/oxipng/oxipng).
- **Recommended starting point:** **2** (the default) is a good balance. Bump it to **4–6** when the smallest possible file matters more than the wait — for example, an image you will reuse on many pages — and you have a moment to spare. Drop to **0–1** if you are batching lots of images and want speed.

### Interlace

- **What it does:** Turns on **Adam7 interlacing**, which stores the image in seven passes so a blurry low-resolution preview can appear early and sharpen as the rest loads. This is the PNG equivalent of a "progressive" image (src: developer.mozilla.org).
- **Range & default:** Checkbox, **off** by default (option key `interlace`).
- **How to choose:** Leave it **off** for the smallest file. Interlacing disrupts PNG's compression, so an interlaced PNG is typically noticeably larger — often around 20% or more — than the same image without it (src: en.wikipedia.org/wiki/PNG). Turn it on only if you specifically want the progressive "fade-in while loading" effect over a slow connection, and accept the larger file in exchange.
- **Recommended starting point:** **Off.** Most images load fast enough today that the size penalty is not worth it; only enable it for large PNGs where a progressive preview genuinely improves the experience.

## Pairing with Reduce palette

OxiPNG packs an image as efficiently as it can, but it never throws away color information. The biggest PNG savings usually come from first reducing how many distinct colors the image contains, then letting OxiPNG compress that simpler image. That first step is the shared **Reduce palette** pre-processor, which you can enable alongside OxiPNG.

When **Reduce palette** is on, the image is converted to a small, fixed set of colors (a "palette" or "indexed" image) before OxiPNG runs. Fewer colors compress dramatically better, so the combination of _Reduce palette + OxiPNG_ often produces far smaller files than OxiPNG alone — sometimes a fraction of the original size — especially for graphics, icons, and flat-color illustrations.

The Reduce palette controls (shared across formats):

| Control            | What it controls                                  | Range     | Default | Option key     |
| ------------------ | ------------------------------------------------- | --------- | ------- | -------------- |
| **Reduce palette** | Turns palette reduction on/off                    | on / off  | **off** | `enabled`      |
| **Colors:**        | How many colors to keep                           | **2–256** | **256** | `maxNumColors` |
| **Dithering:**     | How much to scatter pixels to fake missing colors | **0–1**   | **1.0** | `dither`       |

A practical recipe: enable **Reduce palette**, then lower **Colors** as far as you can before the image visibly degrades — flat graphics and icons often look fine at 64, 32, or even fewer colors, while detailed images need more. **Dithering** trades smooth gradients (higher values) against cleaner flat areas and slightly smaller files (lower values). Watch the live preview as you adjust. Because reducing colors _is_ lossy, this is the one place the OxiPNG workflow can change how the image looks — OxiPNG's own optimization stays perfectly lossless.

## Recommended settings & community tips

> The settings below are **community recommendations** from the OxiPNG project README and related docs, mapped onto Presk's 0–6 Effort slider (which corresponds to OxiPNG's `-o` levels). They are advice, not new defaults; the factual ranges and defaults above are unchanged. Sources are listed at the end.

| Use case                                           | Suggested settings                            | Why                                                                                                                       |
| -------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Interactive single-image use (default)**         | Effort **2**, Interlace off                   | OxiPNG's own default `-o 2` is "quite fast and provides good compression" — the right balance for a responsive browser tool. |
| **You can wait a bit (balanced)**                  | Effort **4**, Interlace off                   | The level the OxiPNG maintainers use in their own example config; a recognized "good balance" with still-tolerable runtime. |
| **Absolute smallest PNG (one-off hero/icon)**      | Effort **6** (max), Interlace off             | Tries the most filter/compression strategies for the smallest output, at a notably longer wait. Reserve for assets served to many users. |

**Community tips**

- **Higher Effort is *not* guaranteed smaller.** OxiPNG is explicitly "not a brute-force optimizer," so Effort 6 can occasionally come out marginally larger than 4. If a high level barely beats a medium one, step back down.
- **Interlacing inflates PNGs.** Adam7 interlacing scatters pixels and defeats DEFLATE, typically growing the file ~5–30%. Leave it off unless you genuinely want a progressive fade-in.
- **OxiPNG is lossless only.** It can't meaningfully shrink a 24-bit photographic PNG — that's a job for **Reduce palette** first, or switching to JPEG/WebP/AVIF.
- **Palette reduction does the heavy lifting.** For any image with ≤256 effective colors, run Reduce palette first; OxiPNG then just polishes the already-smaller indexed PNG.

_Sources: [OxiPNG README](https://github.com/oxipng/oxipng/blob/master/README.md); [oxipng man page](https://man.archlinux.org/man/oxipng.1.en); [Adam7 algorithm (Wikipedia)](https://en.wikipedia.org/wiki/Adam7_algorithm)._

## Tips & pitfalls

- **OxiPNG alone never changes your image.** Any visible difference comes from the separate Reduce palette step, not from OxiPNG's Effort or Interlace settings.
- **For real size wins on graphics, turn on Reduce palette.** OxiPNG by itself often only trims a modest amount; cutting the color count first is where the big savings live.
- **Don't enable Interlace by reflex.** It makes the file bigger. Only use it when you actually want the progressive load-in effect.
- **Higher Effort has diminishing returns.** If a high level takes a long time and barely beats a medium one, step back down — the file is already close to its floor.
- **Photos are the wrong job for PNG.** If your source is a photograph, compare against WebP or AVIF; PNG (even fully optimized) will usually be much larger.
- **Lower Colors gradually.** Drop the count step by step while watching the preview; stop at the point just before banding or color shifts become noticeable.

## Under the hood

OxiPNG is a lossless PNG optimizer that runs entirely in your browser as a WebAssembly module — your image never leaves the page. The app uses OxiPNG's parallel build to engage multiple CPU cores when the browser supports it, with a correct single-thread fallback otherwise. It works by re-trying PNG's row filters and recompressing the pixel data more tightly; the Effort level decides how many strategies it tries, with the top levels switching to the slower, higher-ratio Zopfli compressor (src: github.com/oxipng/oxipng).
