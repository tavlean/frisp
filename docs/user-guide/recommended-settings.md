# Recommended settings (community guidance)

> **What this page is.** A consolidated, per-codec cheat sheet of **community best-practice settings** — gathered from Google/encoder docs and widely-shared web-developer practice — expressed in Sqush's own UI controls. It is a companion to the per-format pages, which carry the same advice in context alongside the code-derived factual reference.
>
> **What this page is _not_.** None of this changes how Sqush behaves today. The "Could become a default/preset" column is a forward-looking wishlist for the maintainer, not a description of current defaults. Sqush's **current** factual defaults are documented authoritatively in each format page and in the [Formats & options reference](./reference/formats-and-options.md); where a recommendation differs from the current default, that's called out explicitly.

Each codec section links to its full page for the reasoning, ranges, and sources.

---

## WebP — [full page](./formats/webp.md)

| Use case                          | Recommended (Sqush controls)                                 |
| --------------------------------- | ------------------------------------------------------------ |
| Web photo (lossy)                 | Quality 75–80, Effort 6                                      |
| Graphics / screenshots / line art | Lossless on (Effort 6), or near-lossless via Slight loss ~40 |
| Sharp content kept lossy          | Quality ≥ 90                                                 |
| Transparency / alpha              | Lossy Quality ~90, Alpha quality 100                         |
| Re-encoding an existing JPEG      | Lossy Quality ~80 (never Lossless)                           |

**Current Sqush default:** lossy, Quality 80, Effort 6 (updated 2026-06-03 from the upstream-Squoosh 75/4 — the "Web photo" recommendation below is now the shipped default).

**Could become a default/preset:** auto-suggesting **Lossless** when the source is a PNG or has an alpha channel or looks like a flat-color screenshot, since lossy WebP visibly hurts that material. (The earlier "Quality 80 / Effort 6 preset" suggestion is now the default.)

---

## AVIF — [full page](./formats/avif.md)

| Use case                      | Recommended (Sqush controls)                                     |
| ----------------------------- | ---------------------------------------------------------------- |
| Web photo (lossy)             | Quality 60–70, Effort 6, 4:2:0, Tuning SSIM                      |
| Graphics / screenshots / text | Quality 80–88, 4:4:4, Effort 5–6                                 |
| Transparency / alpha          | Quality 70–80, Separate alpha quality matched to color           |
| Archival / max-fidelity       | Lossless on (forces 4:4:4), Effort 6–8 — or steer toward JPEG XL |

**Current Sqush default:** lossy, Quality 50, Effort 4, 4:2:0, Tuning Auto.

**Could become a default/preset:** a "Web photo" preset around Quality 60–65 / Effort 6; a "Graphic/screenshot" preset that forces 4:4:4 and raises quality to ~85; surfacing Effort more prominently, since it swings file size 20–30% at no quality cost.

---

## JPEG XL — [full page](./formats/jpeg-xl.md)

| Use case                | Recommended (Sqush controls)           |
| ----------------------- | -------------------------------------- |
| Web photo, high quality | Quality ~90 (≈ distance 1.0), Effort 7 |
| Lighter web weight      | Quality 75–85, Effort 7                |
| Graphics / line art     | Lossless on, Effort 7 (5 also fine)    |
| Transparency / alpha    | Lossless on, or Quality ~90, Effort 7  |
| Archival / masters      | Lossless on, Effort 7–9                |

**Current Sqush default:** lossy, Quality 75, Effort 7.

**Could become a default/preset:** Effort 7 is already the right default and is on the Pareto front — keep it. A "visually lossless" preset at Quality ~90 would match the most-cited recommendation. (Bit-exact lossless JPEG → JXL transcoding is a libjxl feature Sqush does not currently do, since it re-encodes from decoded pixels.)

---

## JPEG — [full page](./formats/mozjpeg.md)

Encoded with **MozJPEG** (shown as **JPEG** in the menu; the encoder name appears as a hover tooltip).

| Use case                          | Recommended (Sqush controls)                                             |
| --------------------------------- | ------------------------------------------------------------------------ |
| General web photography (default) | Quality 80–85, Progressive on, Trellis multipass on, chroma auto (4:2:0) |
| Thumbnails / retina (2×)          | Quality 60–70, Progressive on, 4:2:0                                     |
| Text / screenshots / sharp edges  | Quality 90+, Auto subsample off + Subsample chroma by 1 (4:4:4)          |
| Max-quality / archival            | Quality 92–95, 4:4:4, full trellis, Trellis passes 2                     |
| Smallest file (slow)              | Quality 72–80, full trellis, Progressive on, 4:2:0                       |

**Current Sqush default:** Quality 75, Progressive on, Trellis multipass off, quant table ImageMagick.

**Could become a default/preset:** raise the default Quality from 75 to ~80 and turn **Trellis multipass** on by default — trellis is the whole reason to use MozJPEG over plain libjpeg, so leaving it off ships a weaker default. Optionally auto-switch to 4:4:4 when Quality ≥ 90.

---

## PNG — [full page](./formats/oxipng.md)

Encoded with **OxiPNG** (shown as **PNG** in the menu; the encoder name appears as a hover tooltip).

| Use case                           | Recommended (Sqush controls)  |
| ---------------------------------- | ----------------------------- |
| Interactive single-image (default) | Effort 2, Interlace off       |
| You can wait (balanced)            | Effort 4, Interlace off       |
| Absolute smallest PNG (one-off)    | Effort 6 (max), Interlace off |

**Current Sqush default:** Effort 2, Interlace off.

**Could become a default/preset:** keep Effort 2 — it matches OxiPNG's own default and is correct for interactive use; the diminishing-returns-vs-runtime curve makes raising it the wrong call. Interlace already correctly defaults off. A one-click "Balanced (Effort 4)" affordance for users willing to wait would be a nice addition.

---

## Image Resize — [full page](./resize.md)

| Use case                      | Recommended (Sqush controls)                               |
| ----------------------------- | ---------------------------------------------------------- |
| Downscaling photographs       | Lanczos3, Premultiply on, Linear RGB on                    |
| Flat graphics / illustrations | Mitchell, Premultiply on, Linear RGB on                    |
| Upscaling / enlarging         | Lanczos3 generally; Mitchell if halos appear               |
| Pixel art / sprites           | hqx (pixel art), or Browser pixelated — integer scale only |

**Current Sqush default:** Lanczos3, Premultiply on, Linear RGB on.

**Could become a default/preset:** the current default already matches community best practice — keep it. Possible additions: auto-suggest **Mitchell** when the source looks like flat graphics (to dodge ringing), and an optional **post-resize sharpen** (unsharp mask) for photos, since downscaling inherently softens.

---

## Reduce palette (libimagequant) — [full page](./reduce-palette.md)

| Use case                           | Recommended (Sqush controls)             |
| ---------------------------------- | ---------------------------------------- |
| Flat graphics: logos, icons, UI    | Colors 32–128, Dithering 0 (or ~0.2–0.5) |
| Illustrations / few-color art      | Colors 128, Dithering ~0.3               |
| Gradient / photographic-to-palette | Colors 256, Dithering 1.0                |

**Current Sqush default:** Colors 256, Dithering 1.0.

**Could become a default/preset:** reconsider the default Dithering of 1.0 — full dithering is right for gradients but actively worse (bigger + noisier) on the flat-graphics images that are the prime use case for palette reduction. A content-aware default (e.g. Dithering 0 for detected flat/low-color images, 1.0 for gradient-heavy ones) would serve the common case better. Always running OxiPNG after quantization is the recommended pairing.

---

## At-a-glance: where current defaults already match best practice

| Codec / tool   | Default already optimal?                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------- |
| WebP           | **Yes (since 2026-06-03)** — default is now Quality 80 / Effort 6, matching the web consensus. |
| AVIF           | Quality 50 is conservative; community leans ~60–70 for photos. Effort under-surfaced.          |
| JPEG XL        | **Yes** — Effort 7 is the Pareto-front sweet spot; Quality 75 is reasonable.                   |
| JPEG           | Quality 75 is a touch low; Trellis off is the notable gap vs the codec's whole point.          |
| PNG            | **Yes** — Effort 2 matches OxiPNG's own default and suits interactive use.                     |
| Image Resize   | **Yes** — Lanczos3 + Linear RGB + Premultiply is the recommended photographic default.         |
| Reduce palette | Partly — Colors 256 is a safe default; Dithering 1.0 hurts the flat-graphic common case.       |
