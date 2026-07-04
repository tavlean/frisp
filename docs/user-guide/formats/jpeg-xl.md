# JPEG XL

> A modern image format with excellent quality-per-byte and a true lossless mode — Presk exposes a full set of controls, from a simple Quality slider to advanced tuning like edge filtering and synthetic film grain. Encoded with **libjxl** (shown as **JPEG XL** in the menu; the encoder name appears as a hover tooltip).

## Overview / When to use it

JPEG XL (file extension `.jxl`) is a newer image format designed to do everything older JPEG does, but better: it makes photos smaller at the same quality, and it also has a genuine _lossless_ mode (a perfect, pixel-for-pixel copy) that competes with PNG. There is one big real-world catch: most web browsers still cannot _display_ `.jxl` files (see [Browser support reality](#browser-support-reality)). Reach for JPEG XL when you want to experiment with a forward-looking format, archive masters losslessly, or when you control where the images will be opened (for example an Apple-only audience). For images you need to publish on the open web today, WebP or AVIF are the safer choices.

A note on how this panel behaves: there is no separate "lossless flag" stored in the file. Internally, **Lossless is simply Quality turned all the way up to 100** — ticking the Lossless box is the same as setting Quality to its maximum, and unticking it returns you to a normal lossy quality.

## Controls / Settings

The panel leads with just **Lossless**, **Quality**, and **Effort**; the rest of the lossy tuning (Alternative lossy mode, Auto/Edge-preserving filter, Optimise-for-decoding-speed, Noise-equivalent-to-ISO, and Progressive rendering) folds away under an **Advanced settings** expander. They're all documented in feature order below regardless of where they sit in the panel.

### Lossless

- **What it does:** Switches the encoder into perfect, no-quality-loss mode — the saved image is mathematically identical to the input. When it is on, the Quality slider (and most of the lossy tuning) is replaced by a single "Slight loss" option.
- **Range & default:** On / Off checkbox. **Default Off.** It is a derived control: turning it on sets `quality = 100`; the panel considers itself "lossless" whenever `quality === 100`.
- **How to choose:** Turn it **on** when you need an exact copy — line art, screenshots, diagrams, text-heavy images, or master files you intend to keep. Leave it **off** for photographs, where lossy compression gives dramatically smaller files for a quality drop you usually cannot see.
- **Recommended starting point:** **Off** for photos; **On** only when exact reproduction matters. Expect lossless files to be much larger than lossy ones.

### Slight loss

_(Only shown when Lossless is on.)_

- **What it does:** Allows a tiny, near-invisible amount of loss in the otherwise-lossless image to shave off some file size. It is a "lossy palette" trick that can help on images with limited colors.
- **Range & default:** On / Off checkbox (option key `lossyPalette`). **Default Off.** It only has any effect while Lossless is on; in lossy mode the panel forces it off.
- **How to choose:** Leave it **off** if you truly want bit-exact output. Turn it **on** if you want "basically lossless" but a bit smaller, and you're comfortable with an imperceptible change.
- **Recommended starting point:** **Off.** Only enable it if file size is tight and the image has flat areas or few colors.

### Quality

_(Only shown when Lossless is off.)_

- **What it does:** Sets how much visual detail to preserve in lossy mode. Higher keeps more detail and produces a larger file; lower compresses harder and produces a smaller file.
- **Range & default:** **0 to 99**, in steps of **1** (whole numbers; option key `quality`, default **75**). 100 isn't reachable on this slider — that value is reserved for the Lossless toggle.
- **How to choose:** JPEG XL's quality scale is tuned so that high values are close to visually lossless. Around **90** typically "looks identical to the original" for most photos, while values approaching 100 balloon in size for gains you can't see. Dropping below ~70 starts to show visible artifacts on detailed images (src: github.com/libjxl/libjxl). Use the live preview to find the lowest number that still looks clean to you. Note: setting Quality below **7** automatically forces "Alternative lossy mode" on (see below).
- **Recommended starting point:** **75** (the default) is a good balance for general photos. Bump toward **85–90** when fidelity matters (faces, fine textures, product shots); pull down toward **60–70** when file size is the priority and the image is simple.

### Alternative lossy mode

_(Only shown when Lossless is off.)_

- **What it does:** Switches the encoder to its alternative ("modular") lossy engine instead of the default one. The default engine is generally best for photos; the alternative can do better on flat, graphic, or non-photographic images.
- **Range & default:** On / Off checkbox (option key `lossyModular`). **Default Off.** It is **forced on and locked** whenever Quality is below 7 — at very low quality the alternative engine is the only sensible choice, so the checkbox disables itself.
- **How to choose:** Leave it **off** for photographs. Turn it **on** to experiment with illustrations, screenshots, or images with large flat regions, where it may compress better or look cleaner. Compare both in the preview.
- **Recommended starting point:** **Off** for photos; flip it on as an experiment for graphic/flat content.

### Auto edge filter

_(Only shown when Lossless is off.)_

- **What it does:** Lets the encoder decide how much edge-preserving smoothing to apply. The edge-preserving filter softens compression artifacts ("blockiness" and ringing) along edges while trying to keep the edges themselves sharp. "Auto" lets JPEG XL pick the strength for you.
- **Range & default:** On / Off checkbox (it controls option key `epf`; "auto" means `epf = -1`). **Default On (auto).** Turning it off reveals the manual "Edge preserving filter" slider below.
- **How to choose:** Leave it **on** unless you have a specific reason to override the encoder. Turn it **off** only when you want to manually dial the filter strength.
- **Recommended starting point:** **On.** Most people never need to touch this.

### Edge preserving filter

_(Only shown when Lossless is off **and** Auto edge filter is off.)_

- **What it does:** Manually sets how aggressively the edge-preserving filter smooths artifacts. Higher means more smoothing of artifacts; lower (0) turns the filter off and keeps everything as-is, including any artifacts.
- **Range & default:** **0 to 3**, in steps of **1** (option key `epf`). When you switch off "Auto", it starts at **2** (the value the auto mode is treated as).
- **How to choose:** Raise it if you see ringing or blocky artifacts near edges; lower it if smoothing is washing out fine detail or texture you want to keep. 0 disables the filter entirely.
- **Recommended starting point:** **2** — and generally prefer leaving "Auto edge filter" on instead of setting this by hand.

### Optimise for decoding speed (worse compression)

_(Only shown when Lossless is off.)_

- **What it does:** Trades compression efficiency for faster _decoding_ — that is, how quickly the finished image opens/renders on the viewer's device. Higher tiers make the file faster to display but larger.
- **Range & default:** **0 to 4**, in steps of **1** (option key `decodingSpeedTier`). **Default 0** (best compression, normal decode speed).
- **How to choose:** Leave it at **0** unless display performance on low-power devices matters more to you than file size. Raise it only if you're targeting devices where fast decoding is critical and you can accept bigger files.
- **Recommended starting point:** **0.** Most users should leave this alone.

### Noise equivalent to ISO

_(Only shown when Lossless is off.)_

- **What it does:** Adds synthetic photographic grain ("photon noise") on decode, scaled as if the photo were shot at a given camera ISO. The idea: smooth, denoised areas compress smaller, and a touch of matching grain is re-added when the image is displayed so it still looks natural — without the grain bloating the file.
- **Range & default:** **0 to 50000**, in steps of **100** (option key `photonNoiseIso`). **Default 0** (no synthetic grain).
- **How to choose:** Leave it at **0** for clean, low-noise images. For grainy or film-like photos, set it roughly to match the ISO the photo was taken at (e.g. a noisy night shot at ISO 3200 → ~3200). Too high looks artificially speckly; too low loses the natural texture.
- **Recommended starting point:** **0** for most images; only raise it to preserve a grainy look while keeping the file small.

### Progressive rendering

- **What it does:** Lets the image appear gradually — a rough version first, then sharpening as more data arrives — instead of loading strictly top-to-bottom. Useful for slow connections so viewers see _something_ sooner.
- **Range & default:** On / Off checkbox (option key `progressive`). **Default Off.** This control is always visible, in both lossy and lossless modes.
- **How to choose:** Turn it **on** for large images served over the web where perceived load speed matters. Leave it **off** for local use or small images, where it adds no real benefit.
- **Recommended starting point:** **Off** — turn it on for big web-served images.

### Effort

- **What it does:** Controls how hard the encoder works to shrink the file. It affects encoding _time and compression_, not the visual target — higher effort spends more CPU searching for a smaller result at the same quality.
- **Range & default:** **1 to 9**, in steps of **1** (option key `effort`, default **7**). This control is always visible, in both lossy and lossless modes.
- **How to choose:** Raising effort generally yields a smaller file for the same quality, at the cost of a slower encode. In lossy mode, higher effort also gives more consistent visual quality. Lowering it encodes faster but leaves some size on the table (src: github.com/libjxl/libjxl). Because everything runs locally in your browser, very high effort on large images can feel slow.
- **Recommended starting point:** **7** (the default) is a sensible balance. Drop to **3–5** if encoding feels sluggish and you just want a quick result; push to **8–9** for a final export where you want the smallest possible file and don't mind waiting.

## Recommended settings & community tips

> The settings below are **community recommendations** from the libjxl docs and Cloudinary's Pareto-front analysis. JPEG XL's native quality knob on the command line is `--distance` (0 = lossless, ~1.0 = visually lossless); Presk exposes the friendlier 0–99 **Quality** slider instead, where **~90 ≈ distance 1.0**. These are advice, not new defaults; the factual ranges above are unchanged. Sources are listed at the end.

| Use case                              | Suggested settings                                                     | Why                                                                                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Web photo (lossy), high quality**   | Quality **~90** (≈ distance 1.0), Effort **7**                         | "Visually lossless" — looks identical for most photos. At medium-high quality JXL is ~20% smaller than AVIF and keeps fine texture better. |
| **Lighter web weight**                | Quality **75–85** (≈ distance 1.5–2.5), Effort **7**                   | The useful lossy band; trades a little fidelity for noticeably smaller files while staying clean on detailed images.                       |
| **Graphics / screenshots / line art** | **Lossless** on, Effort **7** (Effort 5 is also fine if speed matters) | JXL auto-selects its modular mode for flat/synthetic content; lossless on screenshots and line art is both small and artifact-free.        |
| **Transparency / alpha cutouts**      | **Lossless** on, or Quality **~90**, Effort **7**                      | JXL handles alpha natively in both modes; high quality keeps mask edges clean. No special flags needed.                                    |
| **Archival / master files**           | **Lossless** on, Effort **7–9**                                        | The strongest archival pick here: lossless is ~35% smaller than optimized PNG and supports up to 32-bit and wide gamut.                    |

**Community tips**

- **Effort 7 ("squirrel") is the sweet spot.** It sits on the Pareto front; Effort 8–9 give tiny extra savings for a large time cost. Don't waste minutes at 9 for a marginal gain.
- **JXL's killer feature is lossless JPEG transcoding.** On the command line, feeding `cjxl` a `.jpg` losslessly re-packs it ~20% smaller, reversibly, with zero quality change. Presk re-encodes from decoded pixels rather than doing this bit-exact transcode, so to mimic it, keep an existing JPEG at high quality and compare.
- **Browser support is the catch.** Native only in Safari 17+; Chrome/Firefox keep it behind a flag or removed it. Great for archiving, Safari-targeted, or controlled pipelines; not general web delivery yet.
- **Quality numbers aren't comparable across formats.** A JXL "75" is not a WebP "75". Judge by the preview.
- **JXL shines at high quality, not extreme size reduction.** For the very smallest flat-graphic files at the lowest bitrates, AVIF can edge it out; JXL's strength is photographic and high-fidelity/archival work.

_Sources: [cjxl man page](https://manpages.debian.org/unstable/libjxl-tools/cjxl.1.en.html); [libjxl](https://github.com/libjxl/libjxl); [Cloudinary: JPEG XL & the Pareto front](https://cloudinary.com/blog/jpeg-xl-and-the-pareto-front); [JPEG XL (Wikipedia)](https://en.wikipedia.org/wiki/JPEG_XL)._

## Tips & pitfalls

- **Lossless is just Quality = 100.** There's no separate lossless flag in the file. Ticking Lossless maxes out quality; the Quality slider only goes to 99 precisely so the two states stay distinct.
- **Most lossy tuning lives under Advanced — and all of it vanishes in lossless mode.** If you can't find Alternative lossy mode, Edge filter, decoding speed, ISO noise, or Progressive, open **Advanced settings** (only Quality and Effort sit up front). If even those are gone, Lossless is on — it hides the lossy controls and shows only "Slight loss".
- **Very low quality locks Alternative lossy mode on.** Below Quality 7 the "Alternative lossy mode" checkbox is forced on and greyed out; that's expected.
- **Quality numbers aren't comparable across formats.** A JPEG XL "75" is not the same as a JPEG "75" or a WebP "75". Judge by the preview, not by matching numbers.
- **Effort changes file size, not the look.** Two files at the same Quality but different Effort should look the same; the higher-Effort one is just smaller (and took longer to make).
- **"Slight loss" only does anything in lossless mode.** In lossy mode the panel forces it off, so toggling it there has no effect.
- **Watch the encode time on big images.** High Effort plus a large image is the slowest combination, since the work happens on your own device.

## Browser support reality

This is the single most important thing to know before you ship JPEG XL. Presk _encodes_ `.jxl` entirely in your browser (via WebAssembly), so creating the files works anywhere Presk runs. _Displaying_ them is the problem:

- **Safari 17+** (macOS Sonoma / iOS 17, 2023) can show `.jxl` natively.
- **Chrome / Edge** removed their experimental JPEG XL support in Chrome 110 (early 2023); it is **not** available by default.
- **Firefox** only supports it behind a flag in non-release builds, not in the normal release.

(src: caniuse.com/jpegxl; developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types)

In practice, if you put a `.jxl` on a public website, most visitors won't see it. Treat JPEG XL as great for **archiving, personal use, or Apple-centric audiences**, and prefer **WebP or AVIF** when you need images that just work for everyone today.

## Under the hood

Presk's JPEG XL support is built on the libjxl reference encoder compiled to WebAssembly, so all compression happens on your device — no image is uploaded. The "Effort" levels map onto libjxl's named speed tiers (7 = "squirrel", the default; higher = "kitten"/"tortoise", slower but smaller), and the alternative lossy engine is libjxl's _modular_ mode, which suits non-photographic images. Several of these controls (decoding-speed tier, photon-noise synthesis, edge-preserving filter) are advanced libjxl features that most users can safely leave at their defaults.
