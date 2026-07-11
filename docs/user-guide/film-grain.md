# Film grain

> Add a fine, film-like texture to your image before it's compressed — to make clean or AI-generated images feel photographic, or to hide the banding that shows up in smooth gradients at low quality.

## Overview / When to use it

"Film grain" adds a subtle, evenly distributed noise texture to the pixels of your image before your chosen encoder runs. It is a preprocessing step like Resize and Reduce palette, so it works identically for every output format — what you see in the compare view is exactly what lands in the file, in every browser and viewer.

Two situations where it shines:

- **De-plasticking.** Very clean images — AI-generated pictures, heavily retouched photos, smooth 3D renders — can look artificially perfect. A small amount of grain reads as "photograph" to the eye.
- **Debanding.** Smooth gradients (skies, soft shadows, studio backdrops) often break into visible stripes ("banding") when compressed hard. Grain acts as a dither: it breaks the stripes up into texture the eye accepts, sometimes letting you drop the quality slider further than you otherwise could.

The honest trade-off: grain is fine detail, and fine detail costs bytes. Turning grain on makes the output larger at the same quality setting, and very low quality settings will partially smooth the grain away. The live preview and the size readout make that trade visible — find the spot where the look and the size both feel right.

## Controls / Settings

The panel has one visible slider, plus a Size slider under "Advanced settings" (`src/lib/editor/options/GrainOptions.svelte`). That's deliberate: the grain's *texture* is fixed to carefully calibrated film-like values, so the everyday decision is just *how much* — and Size exists for one specific job (efficient debanding, below).

### Amount

- **What it does:** Sets the strength of the grain. The grain is monochrome (it brightens/darkens pixels, never shifts their color), strongest in the midtones, and fades to nothing in deep shadows and bright highlights — the way real film behaves.
- **Range & default:** **0 to 100**, default **12** (option key `amount`).
- **How to choose:** **10–12** is the sweet spot for making clean images feel photographic without the grain calling attention to itself. **20–30** is a deliberate, visible creative texture. Higher values are stylized effects.
- **Live preview:** while you drag, the view shows the grain applied instantly (the exact pixels the encoder is about to receive); when you pause, the real compressed result replaces it. If the grain looks softer after it settles, that's the encoder eating fine detail — raise Amount, raise quality, or raise Size.
- **Determinism:** The grain pattern is fixed for a given image and settings — re-encoding with the same settings produces byte-identical output, so undo/redo and the instant-result cache behave exactly as they do for every other option.

### Size (Advanced)

- **What it does:** Sets the grain particle size in pixels, **1 to 4**, default **1** (option key `size`). 1 is the calibrated fine film look. Larger values make coarser, softer grain — same overall strength.
- **When to use it — debanding on a budget:** compressors delete fine noise first, so faint 1px grain often vanishes at low quality (and the banding comes back), while strong 1px grain survives but costs a lot of bytes. Coarser grain survives at *low* strength: measured on gradient images, **Size 2 with Amount 4–6** removes banding for roughly **one-sixth the byte cost** of doing it with Size 1. If you want the smallest possible file that still fixes banding, start there.
- For the film look, leave Size at 1 and ignore this control entirely.

## Tips

- **Watch it in the compare view.** Put the original on the left and your output on the right; the divider makes the grain (and the debanding effect) easy to judge at 100% zoom.
- **Grain + Reduce palette:** grain runs first, so the palette step keeps its promise — you still get exactly the number of colors you asked for, with the grain folded into the dithering.
- **JPEG XL users:** the JXL panel's Advanced section also offers "Noise equivalent to ISO", a codec-native alternative that costs almost no bytes — but it only renders in viewers that decode JXL, and its look differs from Film grain. Film grain is the universal, what-you-see-is-what-you-get option.
