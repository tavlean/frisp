# Design system

Last updated: 2026-11-10.

> **PLACEHOLDER.** This doc records the conventions that already exist in the
> code; it is not yet a designed system. The production editor and the three lab
> skins currently use two different token vocabularies, which is the main thing a
> design session has to resolve. Design work, labs, and design reviews read this
> file FIRST and update it as decisions land. Nothing here is ratified.

## Where the tokens live

| Surface | File | Vocabulary |
|---|---|---|
| Production editor | `src/lib/editor/theme.css` | `--bg-*`, `--surface*`, `--text-*`, `--accent-*`, `--good`/`--bad`, `--*-radius` |
| Intro and intro labs | `src/lib/lab/intro/intro-lab.css` | `--il-*` |
| porcelain skin | `src/lib/lab/porcelain/porcelain.css` | per-skin |
| darkroom skin | `src/lib/lab/darkroom/darkroom.css` | per-skin |
| hybrid skin | `src/lib/lab/hybrid/hybrid.css` | per-skin |

The editor theme is scoped to `.editor-root` so other routes are unaffected. It
deliberately keeps the variable **contract** the ported Squoosh components were
built against (`--main-theme-color`, `--hot-theme-color`, `--header-text-color`
resolve per comparison side via `.options-1` / `.options-2`), with a block of
legacy aliases mapping the old pink/blue names onto the current palette. Renaming
those aliases is a real refactor, not a rename.

## Conventions in force

- **Two side accents.** Coral is the brand colour and belongs to the left
  comparison side; azure belongs to the right. Size deltas use `--good` and
  `--bad`, never the accents.
- **Dimensions are rem-based** against the 12px root set in `+layout.svelte`.
  New spacing follows that scale rather than introducing pixel values.
- **Theming uses CSS `light-dark()`**, not a class-swapped theme or a JS
  variable. A surface that needs both modes declares both values in one place.
- **Squircles use the CSS `corner-shape` property**, paired with a radius.
  `svelte-check` reports 0 warnings and `npm run typecheck` fails on any
  warning (since 2026-11-10), so a new warning is a real failure.
- **Icons are Nucleo**, exported as `currentColor` SVGs. The lab set is 27
  pure-stroke 18px glyphs in `src/lib/lab/icons/` behind `LabIcon.svelte`. The
  exporter strips duotone accent layers, which is why a glyph whose meaning lived
  in an accent layer has to be redrawn rather than re-exported.
- **One canonical brand mark**, `src/lib/brand/logomark.svg`, imported with
  `?raw` and rendered as a single `currentColor` SVG. Never hand-copy the paths.
- **The theme toggle cycles System, Light, Dark** and shows the glyph of the
  mode it is in (sun-moon, sun, moon).

## Brand mark direction

Tavlean's taste on the mark, stated through what he rejected across the 2026-07
logo exploration. These are directions to avoid, not a brief:

- **Soft matte depth** is the register that landed. Not flat vector, not gloss.
- **No alphabet logos.** A letterform standing in for the product reads as a
  placeholder.
- **No pixel language.** It dates the mark and fights the matte direction.
- **Avoid anything that reads as an audio waveform.** It repeatedly came out
  looking like an audio tool, which is the wrong category signal for an image
  compressor.

The canonical mark today is `src/lib/brand/logomark.svg` (see Conventions in
force above).

## Open for a design session

- Whether the production editor adopts a re-style at all, and which of the three
  lab skins wins ([lab.md](lab.md) has the registry and the recommendation).
- One token vocabulary across the editor, the intro, and the winning skin,
  replacing the per-skin sets and retiring the legacy pink/blue aliases.
- A documented type scale. Satoshi is the typeface (one self-hosted upright
  variable woff2, weights 300 to 900, in `static/fonts/`, preloaded from
  `src/app.html`; the italic face was dropped on 2026-11-10 because nothing sets
  italic text) but the scale it is used at has never been written down.
- Motion: there is no shared easing vocabulary yet. Since 2026-11-10 the two
  shared transitions live in `src/lib/editor/motion.ts` (`reveal`, a 300 ms
  height slide, and `toast`, the snackbar's 200 ms rise). Under reduced motion
  the reveal is instant and the toast keeps only its fade.
- Whether light mode ships for the production editor, which today is dark only.
