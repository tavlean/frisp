# Choosing a format

> A plain-language guide to picking the right output format in Frisp — when to use the modern formats (WebP, AVIF, JPEG XL), when to stick with the universal ones (JPEG, PNG), and when to leave the image untouched.

## Overview / When to use it

Frisp lets you re-encode an image into a different format to make it smaller, sharper, or more widely compatible. The format you pick is the single biggest factor in the size-versus-quality trade-off. This page is a decision guide: it explains the difference between _lossy_ and _lossless_ compression, matches formats to the kind of image you have (a photo, a flat-color graphic, a screenshot, something with transparency), and tells you which formats are safe to put on the public web today. None of this changes where your image goes — everything is processed on your own device and nothing is uploaded.

First, two words you'll see everywhere:

- **Lossy** compression throws away detail your eye is unlikely to notice in exchange for much smaller files. Great for photographs. Re-saving a lossy file repeatedly slowly degrades it. (src: developer.mozilla.org — image file types)
- **Lossless** compression keeps every pixel exactly as it was; the file is just packed more efficiently. Essential for graphics with sharp edges, text, or where you can't accept any change. Files are bigger than lossy.

## Quick "use X when…" table

| Your image is…                                     | Best starting format                                   | Why                                                                    |
| -------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| A photograph (lots of color, soft gradients)       | **AVIF**, or **WebP** for wider reach                  | Modern lossy codecs beat JPEG noticeably at the same quality           |
| A photo that must open _everywhere_ with zero risk | **JPEG**                                               | The universal lossy format; opens in everything                        |
| A logo, icon, flat-color illustration, or chart    | **PNG** (or **WebP lossless**)                         | Lossless keeps edges and text crisp                                    |
| A screenshot                                       | **PNG**, or **WebP** if it has photographic content    | Crisp UI text stays sharp losslessly; mixed content can go WebP        |
| Anything needing **transparency**                  | **WebP**, **AVIF**, **JPEG XL**, or **PNG**            | All support an alpha channel; JPEG does not                            |
| You're already happy with the file                 | **Original Image**                                     | No re-encoding; downloads the file unchanged                           |
| You want the absolute smallest, support be damned  | **AVIF** or **JPEG XL**                                | Best compression, but check browser support before shipping            |

A note on animation: Frisp has **no animation export**. Every output format here writes a single still frame — there is no animated GIF / WebP / AVIF encoder. If you load an animated source, you'll be compressing one frame of it.

## Controls / Settings

The format chooser is the dropdown at the top of each side's **Compress** panel. The roster shows plain format names: **WebP, AVIF, JPEG XL, JPEG, and PNG** (the underlying encoder for each appears as a hover tooltip — JPEG→MozJPEG, PNG→OxiPNG, JPEG XL→libjxl, WebP→libwebp, AVIF→libaom). The exact set is defined in `src/lib/compress.ts` (`OUTPUT_FORMATS`). They are all WebAssembly codecs and always available — there is nothing to feature-detect.

### Original Image

- **What it does:** Leaves the image completely untouched — no re-encoding. Both the before and after previews show the same (rotated, if you rotated it) source pixels, and the download is the original file byte-for-byte.
- **Range & default:** It is the special `identity` pseudo-format, not a real encoder. It is always the first entry in the dropdown, shown as "Original Image". It has no Compress options, and the Resize / Reduce-palette ("Edit") controls are hidden for this side.
- **How to choose:** Use it as the baseline on one side so you can compare a re-encoded version against the real original. Choose it as your final output when the file is already as good as you want and you only opened Frisp to inspect or rotate.
- **Recommended starting point:** **Keep one side on Original** while you tune the other side — it's the honest yardstick. Deviate when you actually want a smaller or different-format file.

### WebP

- **What it does:** A modern format from Google that does both lossy (photo) and lossless (graphics) compression, with transparency support. A strong all-rounder that is smaller than JPEG/PNG while being supported almost everywhere.
- **Range & default:** id `webP`, extension `.webp`, MIME `image/webp`. Supports both lossy and lossless (toggled by a **Lossless** checkbox in its panel).
- **How to choose:** This is the safe modern default. For photos, leave it lossy and adjust Quality. For logos/screenshots, turn Lossless on. If you can only pick one modern format to ship widely, WebP is it because support is essentially universal across current browsers. (src: caniuse.com — webp)
- **Recommended starting point:** **WebP, lossy, for photos; WebP lossless for flat graphics.** Deviate to AVIF/JPEG XL when you want even smaller files and your audience's browsers can handle them.

### AVIF

- **What it does:** A modern format based on the AV1 video codec. Typically gives the smallest files at a given quality, with strong lossless and transparency support — at the cost of slower encoding.
- **Range & default:** id `avif`, extension `.avif`, MIME `image/avif`. Supports both lossy and lossless (Lossless checkbox in its panel).
- **How to choose:** Best pick when small size matters most for photos and rich images. The trade-off is encode speed: AVIF is the slowest of the modern codecs here, and higher "Effort" makes it slower still. Browser support is now broad across current Chrome, Firefox, Safari and Edge, though older devices may miss it, so JPEG/WebP remain the safer fallbacks. (src: caniuse.com — avif)
- **Recommended starting point:** **AVIF for photos when you want the smallest file and can wait for encoding.** Deviate to WebP if you need the absolute widest reach or faster turnaround.

### JPEG XL

- **What it does:** A modern format designed to replace JPEG, with excellent quality-per-byte, true lossless, transparency, and even lossless re-compression of existing JPEGs. Encoded with **libjxl** (shown as **JPEG XL** in the menu; the encoder name appears as a hover tooltip).
- **Range & default:** id `jxl`, extension `.jxl`, MIME `image/jxl`. Supports both lossy and lossless. Its label is read from the codec, hence "JPEG XL". (MozJPEG and OxiPNG are instead overridden to the plain format names **JPEG** and **PNG**, with the encoder shown in the tooltip.)
- **How to choose:** Excellent compression and quality, but browser support is the catch: as of 2026 it ships in Safari, while Chrome and Firefox do not enable it by default. Treat output as great for archiving or supported pipelines, not for general web delivery yet. (src: caniuse.com — jpegxl)
- **Recommended starting point:** **Use for archival, experiments, or Safari-targeted delivery.** Deviate to WebP/AVIF when you need broad browser support today.

### JPEG

- **What it does:** A highly tuned JPEG encoder. Produces standard `.jpg` files that open literally everywhere, but smaller than a typical JPEG at the same quality. Lossy only; no transparency. Encoded with **MozJPEG** (shown as **JPEG** in the menu; the encoder name appears as a hover tooltip).
- **Range & default:** id `mozJPEG`, extension `.jpg`, MIME `image/jpeg`. Lossy only.
- **How to choose:** The universal-compatibility choice for photos. Pick it when the file must open on any device, browser, or old software with zero risk, and you don't need transparency. It can't match AVIF/WebP on size, but nothing beats it on reach.
- **Recommended starting point:** **JPEG for photos that must be maximally compatible.** Deviate to WebP/AVIF when your audience's browsers are modern and you want smaller files.

### PNG

- **What it does:** A lossless PNG optimizer. Keeps every pixel exactly, supports transparency, and squeezes the PNG as small as it can go. Ideal for sharp-edged graphics and text. Encoded with **OxiPNG** (shown as **PNG** in the menu; the encoder name appears as a hover tooltip).
- **Range & default:** id `oxiPNG`, extension `.png`, MIME `image/png`. Lossless only.
- **How to choose:** The universal-compatibility choice for graphics, logos, icons, screenshots of UI/text, and anything needing crisp edges or transparency. PNG opens everywhere. For flat-color images it can rival or beat lossy formats; for photographs it will be much larger than JPEG/WebP/AVIF.
- **Recommended starting point:** **PNG for flat-color graphics, logos, and crisp screenshots.** Deviate to WebP lossless if you want even smaller files and modern-browser delivery; deviate to a lossy format if the image is actually a photo.

## What about importing other formats?

The format picker above is for **output** — what Frisp writes. The set of formats it can **read** is broader and separate: see [Engine & codecs → Input formats](./engine-and-codecs.md#input-formats-what-you-can-open). In short, you can open JPEG, PNG, GIF, BMP, SVG, WebP, AVIF, JPEG XL, and QOI even though several of those aren't output options. (HEIC is not supported.)

## Tips & pitfalls

- **Always keep one side on "Original" to compare.** It re-encodes nothing and is your honest reference for both size and quality.
- **Lossy ≠ permanent damage on the first pass, but it compounds.** Don't repeatedly export the same image through a lossy format; start from the best-quality source you have.
- **Don't save flat graphics or text as a lossy format.** WebP/AVIF/JPEG lossy will smear sharp edges and text into fuzzy halos. Use PNG or WebP _lossless_ for logos, icons, charts, and screenshots of UI.
- **Don't save photographs as PNG.** PNG will keep them perfect but enormous; a lossy WebP/AVIF/JPEG will be a fraction of the size with no visible loss.
- **JPEG has no transparency.** If your image has a transparent background and you pick JPEG, the transparency is lost. Use WebP, AVIF, JPEG XL, or PNG instead.
- **Modern ≠ always safe to ship.** Ranked by how widely they open today: JPEG and PNG (everywhere) > WebP (near-universal) > AVIF (broad on current browsers) > JPEG XL (mainly Safari). Match the format to where the image will be used. (src: caniuse.com)
- **Smaller files cost encode time.** AVIF and high "Effort"/"Passes" settings are the slowest; JPEG and PNG are the fastest. If a side feels slow to update, that's expected for AVIF.
- **Want concrete starting numbers?** Once you've picked a format, the [Recommended settings](./recommended-settings.md) cheat sheet lists community best-practice values per codec (and each format page repeats them in context).

## Under the hood

Every output format (WebP, AVIF, JPEG XL, MozJPEG, OxiPNG) runs as a WebAssembly codec inside a worker (`src/lib/compress.ts`). "Original" is the `identity` pseudo-encoder: it skips encoding entirely, hands back the source file unchanged, and reports 0% change. When you pick a real encoder, Frisp also decodes the result back to pixels so the "after" preview shows the true codec output — compression artifacts and all — rather than an idealized version.
