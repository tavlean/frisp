# Editor re-style lab — porcelain & darkroom (2026-07-07)

Two dev-only lab experiments exploring a full visual re-skin (and, in the
second, a re-arrangement) of the single-image editor, each translated from a
reference screenshot the maintainer supplied in chat. Goal: decide by LOOKING
— pick a direction (or a hybrid) for the editor's next visual iteration, and
harvest control/panel patterns for upcoming features (bulk overrides UI,
keyboard control, theming).

Both experiments are REAL editors, not mockups: they instantiate the
production `EditorSession`, encode with the real pipeline, and show real
sizes/undo/redo. Only the chrome is new. Zero production files were changed —
everything lives under `src/routes/lab/<name>/` (dev-gated exactly like the
old bulk lab: `prerender=false`, `dev` guard) and `src/lib/lab/<name>/`.

## How to run

`npm run dev`, then open `/lab/porcelain` and `/lab/darkroom`. Both follow the
system light/dark preference and have a manual override (porcelain: a
System|Light|Dark pill bottom-left; darkroom: a sun/moon rail button).

## Theming mechanism (shared idea, new to this app)

The production editor is dark-only. Both labs carry a dual-mode token set:
`color-scheme: light dark` on the lab root + every token defined with
`light-dark(light, dark)`; forcing a mode = setting `color-scheme` via a
`.force-light`/`.force-dark` class. Each lab overrides the EXISTING
`.editor-root` token contract (`--surface`, `--border`, `--text-*`, …) under
its own root class, so every reused production component (Output, option
panels, Results) re-skins without edits. If a lab is promoted, this is the
blueprint for app-wide light-mode support.

## Experiment 1 — `porcelain` (light, airy, squircle)

Reference: a 3D-design AI app in light mode. White floating panels on warm
light gray, large superellipse corners, two-level depth (raised = white +
hairline border + soft diffuse shadow; inset = recessed warm-gray track),
inset segmented controls with a raised active pill, thin-stroke icons,
sentence-case labels, near-invisible borders, dark tooltip pills with kbd
hints.

Feature mapping (reference → Frisp):

| Reference element | Frisp feature it drives |
| --- | --- |
| Floating top toolbar | Back, Undo/Redo (real history; "Undo ⌘Z" tooltips), Export = right side's Save |
| Design/Animation tabs | Edit \| Compress segmented tabs in the right panel (the two real OptionsPanel sections) |
| "Lens" dropdown rows | Encoder format picker as a custom clean dropdown |
| "Variations" popover | "Compare as…" 2-col format-tile grid (sets the left side's encoder) |
| Left panel + scene list | Filename header + image-info rows as airy list rows |
| Bottom prompt bar zone | Output's zoom/rotate/view cluster, re-skinned |

Squircles are real where supported: `@supports (corner-shape: squircle)`
bumps radii and sets `corner-shape`; elsewhere plain large radii.

## Experiment 2 — `darkroom` (dense pro-tool, rail + inspector + filmstrip)

Reference: a pro image-effects tool, provided in BOTH modes (dark-first).
Near-black flat page, compact chips (8–12px radii), micro-uppercase labels,
label-left/control-right rows with numeric chips, collapsible inspector
sections with an EYE icon per section, chip dropdowns, a left icon rail whose
buttons open panels, and a bottom timeline strip.

Feature mapping (reference → Frisp):

| Reference element | Frisp feature it drives |
| --- | --- |
| Top nav bar | frisp mark + EDITOR/DIAGNOSTICS nav, Export chip, "+" add-images, undo/redo chips |
| Left icon rail | Back, info flyout, compare flyout, rotate, theme toggle |
| Rail-opened panels | Flyouts: image info rows; Compare-as grid → left-side options when comparing |
| Section eye icons | REAL enable state: eye on "Resize"/"Reduce palette" = `processorState.*.enabled` |
| Chip dropdowns | Format picker + (restyled) selects in option rows |
| "Add animation" bottom button | Results footer's Save as a full-width chip button |
| Bottom timeline | SESSION FILMSTRIP: real multi-image gallery (add/drop many, click to switch, remove) — a stepping stone toward the bulk-override UI |
| Canvas corner chips ("4:3", "HQ") | Output's zoom/reset/rotate/view cluster restyled as bottom-right canvas chips |

## Status

- 2026-07-07: both experiments speced by the top-tier session, built by Opus
  subagents in parallel worktrees, merged, and verified in the dev preview at
  1440×900 in BOTH modes (real encodes, compare flow, dropdowns, filmstrip
  switching, eye-enable, flyouts). Commits: doc `791104cd`, porcelain
  `4e0cff81`, darkroom `7827b86f`. `npm run check` clean after each merge
  (porcelain adds 14 benign `corner-shape` CSS-lint warnings, gated behind
  `@supports`). One live fix during verification: porcelain's theme pill
  moved bottom-left → top-right (it collided with the left panel's results
  footer).

## Decision

PENDING — maintainer to compare `/lab/porcelain` vs `/lab/darkroom` (both
modes each) and pick a direction, a hybrid, or neither. Record the outcome
here + in the registry row; delete losing lab code (git history keeps it).

## Ideas harvested while translating (candidates, NOT commitments)

1. **Eye-as-enable on section headers** (darkroom) — quieter than toggle rows
   for Resize/Reduce palette; frees the row for a collapse chevron.
2. **Manual theme toggle + light mode app-wide** — the labs prove the token
   mechanism; production could adopt `light-dark()` over the same contract.
3. **Encoder presets row** (from the reference's duotone presets grid) — e.g.
   "Web / Crisp / Max squeeze" chips above the quality slider; pairs with the
   parked fit-under-target ideas.
4. **Per-section "Reset to defaults"** (from "Randomize/Reset") — small,
   real gap; undo exists but a one-tap section reset doesn't.
5. **Numeric value chips beside sliders** (darkroom rows) — clearer than the
   current inline text fields at small sizes.
6. **Canvas status chips** (aspect ratio, smoothing state) — surfacing state
   the app already computes (`aspect.ts`, view options) as glanceable chips.
7. **Session filmstrip → bulk** — the darkroom strip is a live prototype of
   "batch as a strip under the canvas"; informs the Phase-3 override UI and
   the strip/stack direction in `bulk-ui-design-options.md`.
8. **Tooltip language with kbd hints** — both references use dark pills with
   right-aligned shortcuts; pairs with `docs/keyboard-control.md`.
