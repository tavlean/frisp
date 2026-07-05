# Overview

> Frisp is a free, in-browser image compressor: load a picture, compare the original against a compressed version side by side, and watch quality and file size change live — all on your own device, nothing uploaded.

## What Frisp is and when to use it

Frisp makes image files smaller. You open an image, pick an output format and some settings, and Frisp re-encodes the picture so it takes up fewer bytes — handy for faster-loading websites, smaller email attachments, or fitting more photos in less space. The trick to good compression is balancing **file size** against **visual quality**, and Frisp is built to let you see that trade-off directly: it shows your original picture next to the compressed result so you can decide how far to push it.

Everything happens locally in your web browser. Your image is never sent to a server — there are no uploads, no accounts, and no tracking (more on this below).

> **Jargon check — "compress" / "encode":** _Compressing_ an image means re-saving it in a way that uses fewer bytes. _Encoding_ is the technical word for that re-saving step (turning raw pixels into a file in a given format like JPEG or PNG). In Frisp the two mean the same thing.

## The mental model: before vs. after, side by side

The heart of Frisp is a **two-up compare view** — one image, shown two ways at once:

- **Left = the ORIGINAL (the "before").** By default the left pane shows your image exactly as you loaded it, untouched.
- **Right = the ENCODED version (the "after").** The right pane shows a live preview of the compressed result using the format and settings you choose.

A **draggable divider** (the slider) sits between them. Drag it left or right to wipe between the two layers and inspect the exact same spot in both versions, pixel-for-pixel — the perfect way to spot where compression starts to hurt quality (blurry edges, blocky skies, color banding). Zoom and pan are **shared** across both sides, so when you zoom into a detail, both the before and after stay aligned on the same area.

Because each side is independent, you can also compare **two compressed versions against each other** — for example JPEG vs. WebP, or the same format at two different quality settings — not just against the original.

## How a compression actually works (the pipeline)

When you change a setting, Frisp rebuilds that side's preview through three steps:

1. **Decode** — your file is read and turned into raw pixels (an in-memory image). This is what lets Frisp re-save it in any format.
2. **Preprocess** — optional adjustments applied _before_ re-saving, namely **Resize** (scale the image down or up) and **Quantize** (reduce the number of colors). If you don't touch these, the image passes through unchanged.
3. **Encode** — the pixels are handed to the codec (the compressor) for your chosen format, which produces the final compressed file.

> **Jargon check — "codec":** short for _coder/decoder_ — the engine that knows how to write (and read) a particular image format. Frisp bundles one codec per format (for example MozJPEG for JPEG, OxiPNG for PNG).

Heavy codecs run in the background (in Web Workers / WebAssembly) so the app stays responsive while it works. The full per-format settings are documented in the format-specific pages; the engines behind each format are listed in the [engine & codecs reference](reference/engine-and-codecs.md).

## The basic workflow, end to end

1. **Load an image.** Drag and drop a file onto the window, or click to open your computer's file picker. Frisp reads common formats — JPEG, PNG, WebP, GIF, BMP, and (where your browser supports them) AVIF and JPEG XL; SVG files are rasterized (converted to pixels).
2. **Look at the compare view.** The left pane shows your original. The right pane immediately shows a first compressed preview (Frisp starts you on **WebP** by default, while the left side stays on the original).
3. **Pick a format and settings for the right side.** Each side has its own options panel. Choose the output format and adjust its quality (and, if you like, resize or reduce colors). Every change re-encodes that side automatically — no "apply" button.
4. **Compare.** Drag the slider, zoom, and pan to judge whether the compressed version still looks good enough.
5. **Read the numbers.** Below each side, a result card tells you exactly how big the file got (see the next section).
6. **Download.** When you're happy, click **Download** on the side you want. The file is named after your original with the new format's extension (for example `photo.jpg`).

You can keep tweaking and re-comparing as much as you like; nothing is final until you download.

## Reading the size & percentage readout

Each side shows a small result card. Here is what each line means:

| Line            | What it shows                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------- |
| **Size**        | The size of the compressed file, in human-friendly units (B, KB, MB, GB).                          |
| **vs original** | The compressed size as a **percentage of the original**, plus a signed byte change in parentheses. |
| **Time**        | How long this version took to encode (shown in milliseconds or seconds).                           |

The **vs original** line is the one to watch. The percentage is the new size _relative to_ the original:

- **Below 100%** means the file got **smaller** — exactly what you want. It's shown in **green** with a minus sign, e.g. `38% (−612 KB)` means the result is 38% of the original size and saved 612 KB.
- **Above 100%** means the file got **bigger**, shown in **red** with a plus sign, e.g. `120% (+50 KB)`. This can happen if you crank quality very high, or pick a format that's a poor fit for the image.

> **Tip:** lower percentage = more savings. Aim for the lowest percentage you can accept while the right pane still looks good against the left.

While a side is recalculating you'll briefly see **"Compressing…"**, and before the first result it reads **"No result yet."**

## Privacy & offline

Frisp is **local-first**: the entire pipeline — decode, preprocess, encode — runs inside your browser. No uploads, no servers, no telemetry, and no pixels ever leave your device. The compression engines are WebAssembly modules served from Frisp's own files, not fetched from anywhere else.

Because of this design, Frisp also works **offline**: after the first visit, a service worker caches the app so you can use it with no internet connection at all.

## Tips & pitfalls

- **The left side is your reference.** Keep it on the original so the slider comparison is meaningful. (Frisp lets each side use any format, including an "Original (no re-encode)" passthrough that keeps the source bytes unchanged.)
- **Watch the slider at full zoom.** Compression damage often hides in fine detail — zoom in and wipe the slider across edges, text, and smooth gradients (skies, skin) where artifacts show first.
- **Smaller isn't always better.** A jaw-dropping savings percentage means nothing if the right pane looks worse than you can accept. Judge with your eyes first, the numbers second.
- **"vs original" compares against the file you loaded**, not against the other side. To compare two compressed versions, just look at each side's Size line.
- **Right format for the job.** Photos usually shrink best as JPEG, WebP, or AVIF (lossy formats); graphics, screenshots, and anything needing crisp edges or transparency often do better as PNG or lossless WebP. See the per-format pages for specifics.
- **Going bigger?** If "vs original" turns red, you've made the file larger — lower the quality, switch formats, or resize the image down.
