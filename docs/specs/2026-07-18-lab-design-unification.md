# Lab Main-UI design unification + Nucleo icon pass

Last updated: 2026-07-18 · Status: in progress

The three `/lab` editor skins (porcelain, darkroom, hybrid) grew organically
and it shows: each screen mixes several floating-bar styles, controls sit in
odd corners, and every skin hand-draws its own icons. This pass makes each
skin look **purposefully designed** — one bar system per skin, aligned
placements, proper panel layouts, and ONE shared icon language — while
keeping each skin's own identity (palette, radius, density). The skins remain
*competing candidates*; do not make them identical.

Audit basis: 2026-07-18 screenshots of all three skins, light + dark, with
the auto-loaded sample image (see WORKLOG entry).

## Shared conventions (all skins)

1. **Icons.** The unified set lives in `src/lib/lab/icons/*.svg` — 25
   Nucleo-UI outline glyphs, 18×18 viewBox, `stroke="currentColor"`,
   stroke-width 1.5. Embed via the shared host component:

   ```svelte
   import LabIcon from '$lib/lab/LabIcon.svelte';
   import undoIcon from '$lib/lab/icons/undo.svg?raw';
   ...
   <button aria-label="Undo"><LabIcon svg={undoIcon} /></button>
   ```

   Replace EVERY hand-drawn inline `<svg>` and every text glyph used as an
   icon (`↺`, `✕`, `＋`, `◐`, `…`) in lab components with set icons. Default
   size 16 inside buttons; 14 in dense chips is fine. Never restyle the
   glyph's stroke-width.

   Semantic map (filename → use): `back` (leave/back), `undo`, `redo`,
   `crop`, `rotate` (rotate 90°), `sliders` (view/advanced options), `plus`
   (add image / zoom in), `minus` (zoom out), `fit` (fit-to-screen / reset
   view), `export` (Export CTA), `save` (save side settings), `copy` (copy
   settings to other side), `import` (import saved side settings), `info`
   (image info), `compare` (second side / split view), `sun-moon` / `sun` /
   `moon` (theme cycle), `eye` / `eye-off` (section enable, keep-original),
   `close` (dismiss/clear), `chevron-down` / `chevron-right` (dropdowns,
   disclosures), `image` (format dropdown), `remove` (trash/remove from
   batch), `check` (selected menu item), `more` (overflow menu).

   **Theme cycle button (maintainer decision 2026-07-18):** there is no
   `theme.svg`. The button shows the CURRENT mode's glyph — `sun-moon.svg`
   while following the system, `sun.svg` when forced light, `moon.svg` when
   forced dark.

2. **One island style per skin.** Within a skin, every floating surface
   (toolbar, panel, docked bar) uses the same background, border, radius and
   shadow tokens. No mixed pill heights side by side.

3. **Primary action.** `Export` and `Save` are the skin's ONLY filled/primary
   buttons and share one treatment. Everything else is quiet.

4. **Nothing floats over the canvas image.** Zoom/rotate/view clusters dock
   into a bar (top toolbar or bottom strip), never hover mid-image.

5. **Theme control.** One icon button cycling system → light → dark, its
   glyph showing the current mode (`sun-moon` / `sun` / `moon` — see the
   map above), with an `aria-label` + tooltip naming the current mode. No
   segmented three-way switches; no "<skin> lab" caption (the lab tab bar
   already names the experiment).

6. **A11y + themes.** Keep every existing `aria-label`/`aria-current`,
   keyboard handler and focus-visible outline. Verify BOTH color schemes —
   all colors via the skin's `light-dark()` tokens; never a bare literal in
   a multi-layer `background` shorthand (it silently invalidates the
   shorthand — see docs/lab-editor-restyle.md).

## Per-skin worklist

### porcelain (`src/routes/lab/porcelain/+page.svelte`, `src/lib/lab/porcelain/*`)

- **Collapse the five top islands into ONE floating toolbar** (single
  porcelain pill, one height, one shadow): left cluster `back · undo · redo ·
  crop`, right cluster `zoom-out · zoom% · zoom-in · fit · rotate · sliders
  (view options popover) · theme · Export`. Export is the dark primary pill
  INSIDE the toolbar's right end. Delete the standalone theme segmented
  control (`ThemeSwitch.svelte` becomes a cycle icon button or is replaced).
- **Left panel becomes a content-height card** — it currently stretches to
  the bottom leaving a huge void. `height: fit-content` (keep `max-height` +
  internal scroll). Remove the `Frisp` brand row from the panel; put a small
  logomark (`$lib/lab/Logomark.svelte`) at the toolbar's far left instead.
- Right panel header icon buttons (copy/save/import) switch to set icons;
  Save keeps the primary treatment paired with Export.
- The now-unreachable dropzone `{:else}` state may stay, but restyle its
  button to the panel button style and drop the "porcelain — lab" eyebrow.

### darkroom (`src/routes/lab/darkroom/+page.svelte`, `src/lib/lab/darkroom/*`)

- **Remove BOTH floating clusters over the image** (zoom island + rotate/
  sliders island, bottom-right). Their controls dock into the bottom
  filmstrip bar's right side: `zoom-out · zoom% · zoom-in · fit · rotate ·
  sliders`, replacing the "Drop more images — batch editing is coming." hint
  (drop the hint; the `+` tile already communicates it).
- TopBar: keep the IA (brand + EDITOR/DIAGNOSTICS left; undo/redo, EXPORT,
  `+` right) but make it one visual system: consistent control heights,
  EXPORT as the single primary, and a clearly visible disabled state for
  undo/redo (currently near-invisible).
- Rail: swap glyphs for set icons (`back`, `info`, `compare`; bottom:
  `fit` for reset-view if that's the ↺ semantics — read the handler — and
  the theme cycle glyphs per the map above).
- Inspector/chips/menus: set icons for chevrons, `more`, `check`, eye
  toggles, filmstrip `plus`/`close`.

### hybrid (`src/routes/lab/hybrid/+page.svelte`, `src/lib/lab/hybrid/*`)

- **Merge the three top-right islands into one** porcelain-style pill:
  `undo · redo · plus (add) · Export(primary)`. Keep the brand/nav pill on
  the left as-is.
- Keep the docked bottom bar (it is the reference pattern) — just swap its
  glyphs for set icons and align paddings/heights with the top pill.
- Rail + inspector + flyouts + filmstrip: same icon swap and
  consistent-height treatment as darkroom's list above.

## Ground rules for executors

- Touch ONLY your skin's files plus (read-only) the shared pieces:
  `$lib/lab/LabIcon.svelte`, `$lib/lab/icons/*`, `$lib/lab/Logomark.svelte`.
  NEVER edit production code (`src/lib/editor/**`, `src/client/**`,
  `src/lib/bulk/**`), other skins, `theme.css`, or the lab layout/tab bar.
- Style contract: comments state constraints the code can't show — match
  `src/lib/editor/intro/Intro.svelte`'s discipline. No defensive bloat.
- The skins are REAL editors on the production pipeline — do not change any
  `EditorSession` call, prop wiring, or keyboard handler semantics.
- Gate: `npm run typecheck` must stay at 0 errors, 0 warnings.

## Verification (orchestrator)

Per skin, light + dark: one toolbar system, docked zoom, icons coherent,
panels content-fit, no console errors; then `npm run check` + full e2e.
