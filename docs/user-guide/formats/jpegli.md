# JPEG

> The universal `.jpg` file, from a modern encoder that spends its bytes carefully, with just three controls. Encoded with **jpegli** (shown as **JPEG** in the menu; the encoder name appears as a hover tooltip).

## Overview / When to use it

**jpegli** is Google's modern JPEG encoder. It is not a new format: the file it writes is an ordinary JPEG, and every browser, phone, printer and photo app on earth already reads it. What changed is the encoder's judgement about which detail is worth keeping.

Since 2026-11-04 jpegli is the one JPEG encoder in the picker. Until then Frisp also offered **MozJPEG** as a second JPEG entry. On Frisp's own benchmark images jpegli was faster on every file and about 7% smaller on photos at the default settings, so offering two encoders for the same `.jpg` only pushed a choice onto you. If you had saved settings that used MozJPEG, they now load as jpegli at the same quality number. The old MozJPEG page is kept [for reference](./mozjpeg.md).

jpegli's argument is that you should not need a bag of tuning knobs, because its quantization tables and adaptive quantization are already tuned. That is why this page is short. As with any JPEG: no transparency. If your image has see-through areas, use PNG, WebP, or AVIF.

## Controls / Settings

### Quality

- **What it does:** Sets how much detail the encoder keeps. Lower values discard more to make the file smaller; higher values preserve more at the cost of size.
- **Range & default:** 0 to 100, in steps of 1. **Default: 75** (option key `quality`).
- **How to choose:** The number is on jpegli's own quality scale, not libjpeg's, so **a jpegli 75 is not the same picture as a 75 in another JPEG tool** (including MozJPEG settings you saved before 2026-11-04, which now load at the same number). Judge it in the preview rather than by matching numbers across encoders. As with any JPEG the top of the range is expensive: 95 to 100 costs a lot of bytes for very little you can see.
- **Recommended starting point:** **75**. Try **80–85** for hero images or anything with text and sharp edges; drop to **60–70** for thumbnails and backgrounds.

### Chroma subsampling

- **What it does:** Chooses how much the _colour_ detail is compressed relative to the brightness detail. Human eyes are far more sensitive to brightness than to colour, so JPEG can store colour at a lower resolution with little visible loss.
- **Range & default:** **Auto**, **4:4:4**, or **4:2:0**. **Default: Auto** (option key `chromaSubsample`, values 0 / 1 / 2). Under **Advanced settings**.
- **How to choose:**
  - **Auto** leaves the decision to jpegli, which currently means 4:2:0 (colour stored at half resolution in both directions). This is the right answer for photographs.
  - **4:4:4** keeps colour at full resolution. Use it when the image has saturated coloured text, thin coloured lines, or hard colour edges, and you can see them smearing in the preview. Files get bigger.
  - **4:2:0** forces the same behaviour Auto currently gives. It exists so you can pin it rather than inherit it.
- **Recommended starting point:** **Auto**. Switch to **4:4:4** only when you have seen colour bleeding in the preview.

### Progressive rendering

- **What it does:** Stores the image so it loads in increasingly sharp passes, a blurry-to-clear reveal, rather than top-to-bottom.
- **Range & default:** On/off. **Default: on** (option key `progressive`). Under **Advanced settings**.
- **How to choose:** Keep it **on** for web images. It usually also makes the file slightly smaller. Turn it **off** if something downstream insists on a plain sequential JPEG.
- **Recommended starting point:** **On**.

## Tips & pitfalls

- **Do not compare quality numbers across encoders.** jpegli's slider maps onto its own internal quality target, so "75" here and "75" in another JPEG tool are different pictures. Compare at whatever setting looks right in the preview, then compare file sizes.
- **The short options list is the point.** There is no trellis section, no quantization-table picker, no separate chroma quality. jpegli's tuned defaults are what it is for.
- **No grayscale or RGB mode.** jpegli encodes colour as YCbCr, which is what virtually every JPEG in the world uses. A genuinely black-and-white source still works, it is just stored as a colour JPEG. Frisp no longer offers a true grayscale JPEG.
- **JPEG still cannot do transparency.** Transparent areas will be filled or mangled. Use PNG, WebP, or AVIF.

## Under the hood

jpegli comes out of the JPEG XL project: it applies techniques developed for JPEG XL to the plain old JPEG bitstream, so you get better decisions about what to keep without changing the format. The main levers are adaptive quantization (spending bits where the eye will notice, block by block) and quantization tables tuned against perceptual metrics rather than the 1992 defaults. It runs entirely in your browser via WebAssembly, like every other codec in Frisp, so no image ever leaves your device. The exact upstream commit Frisp builds from is recorded in `docs/codec-provenance.md`.
