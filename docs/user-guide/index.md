# Sqush user guide

**Sqush is a free, local-first image compressor that runs entirely in your web browser.** You drop in a picture, pick an output format, tweak a few settings, and watch the file shrink — all on your own device. Nothing is ever uploaded: every step (decoding, resizing, and compressing) happens locally, so your images never leave your computer.

This guide explains what each option does, in plain language, and points you to deeper notes when you want them.

---

## Start here

New to image compression? Follow this short path:

1. **[Overview](./overview.md)** — what Sqush is, what "compression" means, and the before/after compare view.
2. **[Editor features](./editor-features.md)** — how to load an image, use the two-up slider, zoom/rotate, and download your result.
3. **[Choosing a format](./choosing-a-format.md)** — a quick decision guide: which format to pick for photos, graphics, transparency, or maximum compatibility.

Once you've picked a format, jump to that format's page below to understand its sliders and toggles. When in doubt, **WebP** at the default quality is a safe, widely supported starting point.

---

## Getting started

| Page                                        | What it covers                                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Overview](./overview.md)                   | What Sqush is, the local-first promise, and the basic compress-and-compare workflow.                                                                               |
| [Editor features](./editor-features.md)     | Loading and replacing images, the two-up before/after compare, zoom/pan/rotate, smoothing and background toggles, copy/save/import side settings, and downloading. |
| [Bulk optimization](./bulk-optimization.md) | Importing several images or a folder, batch settings, per-image tweaks, strip sizes, Save all as ZIP, keep-originals, and remove+Undo.                              |
| [Choosing a format](./choosing-a-format.md) | How to decide between formats for photos, illustrations, transparency, animation, and browser support.                                                             |
| [Recommended settings](./recommended-settings.md) | A per-codec cheat sheet of community best-practice settings (in Sqush's controls), with notes on which could become app defaults or presets later.                  |

## Formats

Each output format has its own page covering what it's good at and what every option does (with ranges and recommended starting points).

| Page                                                    | Best for                                                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [WebP](./formats/webp.md)                               | A great all-round default — good compression, broad browser support, lossy and lossless modes. |
| [AVIF](./formats/avif.md)                               | Excellent compression for photos; modern browsers.                                             |
| [JPEG XL](./formats/jpeg-xl.md)                         | High-quality, flexible format with a lossless mode; limited browser support today.             |
| [JPEG](./formats/mozjpeg.md)                            | A finely tuned JPEG encoder (MozJPEG) — maximum compatibility for photographs.                 |
| [PNG](./formats/oxipng.md)                              | Lossless PNG optimisation (OxiPNG) for graphics, screenshots, and transparency.                |

## Editing

Adjustments you can apply to either side _before_ compression (shown in the "Edit" section of each panel).

| Page                                  | What it covers                                                                                                                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Resize](./resize.md)                 | Changing pixel dimensions, resampling methods (Lanczos3, Mitchell, and friends), presets, aspect-ratio lock, fit method, and the advanced premultiply-alpha / linear-RGB options. |
| [Reduce palette](./reduce-palette.md) | Shrinking the number of colours (2–256) with optional dithering — great for flat graphics and tiny PNGs.                                                                          |

## Under the hood

| Page                                      | What it covers                                                                                                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [Engine & codecs](./engine-and-codecs.md) | How Sqush runs local WebAssembly/worker processing, the codecs it uses, and how service-worker offline support works. |

---

## Reference (code-derived)

These pages are exhaustive inventories generated directly from the source code. They're aimed at developers and AI agents who need the precise, authoritative list of every option, range, default, and behaviour.

- [Feature reference](./reference/features.md) — every feature and interaction in the single-image editor.
- [Formats & options reference](./reference/formats-and-options.md) — every output format and every encoder option, including hidden/unsurfaced ones.
- [Engine & codecs reference](./reference/engine-and-codecs.md) — processors, preprocessors, codec versions, and the service worker.
