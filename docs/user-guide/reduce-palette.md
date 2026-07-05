# Reduce palette

> Shrink an image down to a small set of colors, which can make flat graphics, icons, and screenshots much smaller — especially when you then save as PNG.

## Overview / When to use it

"Reduce palette" performs **color quantization**: it takes an image that may contain thousands or millions of distinct colors and squeezes it down to a fixed, smaller number of colors (a "palette"). Fewer unique colors means the file compresses more tightly, so this is one of the biggest space-savers for **flat-color content** — logos, icons, illustrations, UI screenshots, charts, and simple diagrams — particularly right before you export as **PNG** (which Frisp optimizes with OxiPNG). It is usually a poor fit for **photographs**: real photos rely on subtle, smooth color transitions, and forcing them into a tiny palette tends to look blotchy or like a bad photocopy (src: en.wikipedia.org/wiki/Color_quantization). Reduce palette is a preprocessing step — it changes the pixels before whatever encoder you pick runs, so it stacks with your chosen output format.

## Controls / Settings

The panel has two sliders, "Colors" and "Dithering" (`src/lib/editor/options/QuantizeOptions.svelte`).

### Colors

- **What it does:** Sets the maximum number of distinct colors the image is allowed to keep. The quantizer (libimagequant) picks the set of colors that best represents the original, then maps every pixel to the closest one.
- **Range & default:** **2 to 256**, default **256** (option key `maxNumColors`). At the default of 256 the image keeps as many colors as a classic indexed PNG/GIF can hold, so the visual change is often small while the file can still shrink a lot.
- **How to choose:** Lowering this number forces more of the original colors to collapse onto fewer palette entries. The file gets smaller and simpler, but you risk **banding** (smooth gradients breaking into visible steps) and loss of subtle color detail. Raising it preserves more fidelity at a larger file size. Flat graphics with only a handful of real colors can often drop very low (say 8, 16, or 32) with no visible loss; gradients and detailed art need more headroom.
- **Recommended starting point:** **256** — then drag it down while watching the preview and the file-size readout. Stop when you first notice color stepping or muddiness you dislike, then nudge back up a little. For simple icons or two-tone logos, try **16 or 32**.

### Dithering

- **What it does:** Dithering scatters a fine noise pattern of palette colors so that areas which can't be represented exactly get _mixed_ from the available colors. Your eye blends these specks into in-between shades, which hides the hard "steps" (banding) that palette reduction would otherwise create in gradients and soft shadows (src: en.wikipedia.org/wiki/Color_quantization).
- **Range & default:** **0 to 1**, in steps of **0.01**, default **1.0** (option key `dither`). 0 means no dithering (clean, flat color regions with possible visible banding); 1.0 is the strongest, smoothest dithering.
- **How to choose:** Higher values trade clean flat color for smoother gradients. The catch: dithering adds noise, and noise is harder to compress, so strong dithering can make the PNG _larger_ than the same image with dithering off (src: strikingloo.github.io/dithering). Lower it (or set 0) when your image is mostly solid blocks of color — icons, line art, flat UI — where you want crisp edges and the smallest file, and where banding isn't a concern because there are no gradients to band. Keep it high for images with gradients, soft shadows, or skin-like transitions that would otherwise step.
- **Recommended starting point:** Leave it at the default **1.0** for anything with gradients or shading. For **flat graphics, icons, and line art, set it to 0** to get crisper edges and a smaller file. If 1.0 looks too grainy but 0 bands, try a middle value like **0.5**.

## Recommended settings & community tips

> The settings below are **community recommendations** from the pngquant/libimagequant project (the engine behind this panel). They are advice, not new defaults; the factual ranges and defaults above are unchanged. Sources are listed at the end.

| Use case                                          | Suggested settings                          | Why                                                                                                                       |
| ------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Flat graphics: logos, icons, screenshots, UI**  | Colors **32–128** (often far fewer), Dithering **0** (or ~0.2–0.5) | Flat graphics need few colors and look *cleaner* without dithering — dithering scatters noise that both looks worse on solid fills and compresses worse. A 2-color logo needs 2 colors. |
| **Illustrations / few-color art**                 | Colors **128**, Dithering **~0.3**          | A light touch of dithering smooths the few transitions without flooding flat areas with hard-to-compress noise.          |
| **Gradient-heavy / photographic-to-palette**      | Colors **256**, Dithering **1.0**           | Smooth gradients band badly when quantized; full dithering diffuses the error and hides the banding. (If PNG isn't required, prefer WebP/JPEG instead.) |

**Community tips**

- **Dithering is a double-edged sword.** It kills banding on gradients but *adds* noise that inflates the PNG and looks bad on flat fills. Leaving it at 1.0 globally gives worse-looking, bigger logos — turn it down (or off) for flat content.
- **256 colors is not "safe/lossless."** It's lossy; for rich images it can both degrade quality *and* end up larger than truecolor once dither noise is added. pngquant's own docs warn dithered palette images sometimes compress worse than the full 32-bit image.
- **Use the fewest colors that hold up.** Drop the count aggressively on simple images — indexed PNG typically runs 40–70% smaller than 24/32-bit when the image genuinely has few colors.
- **Always pair with OxiPNG.** Quantize first, then let OxiPNG deflate the resulting palette PNG — that's where the combined win comes from.

_Sources: [pngquant / libimagequant](https://pngquant.org/lib/); [ImageOptim/libimagequant](https://github.com/ImageOptim/libimagequant); [pngquant](https://pngquant.org/)._

## Tips & pitfalls

- **Photos: usually skip this panel.** Palette reduction is built for flat-color graphics. For photographs, lean on a lossy format's own quality slider (WebP, AVIF, JPEG XL, JPEG) instead — they handle smooth color far better than a 256-color palette.
- **Order matters: pair it with PNG.** Reduce palette pays off most when the output is **PNG**, which can store an indexed palette efficiently and which Frisp further squeezes with OxiPNG. Re-quantizing before a lossy photo codec gives little benefit and can even hurt.
- **The two sliders push against each other.** Fewer colors _plus_ heavy dithering can paradoxically grow the file, because dithering replaces clean regions with hard-to-compress noise. If a low color count with dithering on isn't shrinking the file, turn dithering down.
- **Watch the preview and the size number, not just the slider.** The "right" settings depend entirely on the image. Drag, look, compare — the live preview is the fastest way to find the lowest colors / lowest dithering you can tolerate.
- **Banding vs. noise is the core trade-off.** Too few colors with no dithering = visible bands. Too much dithering = grainy speckle and a bigger file. Aim for the gentlest dithering that hides the banding you actually see.
- **Already-flat images barely change.** If a graphic only truly uses a dozen colors, dropping "Colors" to a low number is essentially free quality-wise, and dithering at 0 keeps edges sharp.

## Under the hood

Quantization is performed by **libimagequant 2.18.0** (the engine behind pngquant), running as WASM locally in the browser — nothing is uploaded (`docs/user-guide/reference/engine-and-codecs.md`; `codecs/imagequant/`). The `dither` value maps to libimagequant's error-diffusion dithering strength, the same family of technique as Floyd–Steinberg, which spreads each pixel's rounding error into its neighbors so the overall color average stays correct (src: en.wikipedia.org/wiki/Floyd%E2%80%93Steinberg_dithering). One extra detail: the data model also carries a hidden `zx` (ZX Spectrum palette) easter-egg option, but it is deliberately **not** exposed in this panel — only the two sliders above are user-facing (`src/features/processors/quantize/shared/meta.ts`).
