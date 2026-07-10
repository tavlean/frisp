# Lab — intro page re-design

Last updated: 2026-07-10. Status: **DECISION PENDING** (maintainer picks a
direction; losers get deleted on promotion).

Five dev-only takes on the landing screen as a modern minimal full-viewport
single section — inviting drop area, tiny header + footer, light AND dark —
behind [/lab/intro](../src/routes/lab/intro/+page.svelte) (card added to the
/lab gallery). Grounded in Mobbin references: V7.ai's giant-headline hero,
Shuttle's extreme-whitespace minimalism, Shade's dark editorial split, the
classic Vimeo/Jasper dashed drop card — plus a maintainer-supplied
Vercel-style three-zone reference (layout only, content minimalized) for
prism.

## The variants

| Route | Concept | One-line honest read |
|---|---|---|
| `/lab/intro/billboard` | Giant two-tone statement headline ("Smaller images. / Nothing uploaded.") over ONE floating squircle drop card | The most brand-forward; the coral second line does the marketing. Card is a small target, but the whole page accepts drops. |
| `/lab/intro/frame` | The viewport IS the drop zone — permanent dashed viewfinder frame, chrome as HUD corner micro-copy, marching dashes on drag | The most original and the most "tool, not site"; header/footer minimalism taken to its logical end. Needs taste to survive real content pressure (no room for more copy, by design). |
| `/lab/intro/split` | Editorial asymmetry — headline + three stat blocks left, tall drop panel right with try-a-sample thumbs (canvas-generated real PNGs) | The most conventional landing; samples give first-time visitors a zero-friction path. Right panel is a big honest target. |
| `/lab/intro/ledger` | Hyper-minimal narrow column: hairline tray + numbered 01–04 ledger ("Upload — never" in coral); refined 2026-07-10 — header/column/footer share ONE 560px spine | The quietest and most privacy-narrative; typography does all the work. Least "wow", most trustworthy. |
| `/lab/intro/prism` | Three-zone hero (Vercel-style reference): headline + actions left, luminous prismatic drop stage around the origami bird centre, vertical trust column right, quiet format row as footer | The most product-launch polish and the only one that stars the bird; the glow is the wow. Busiest of the five (still minimal by normal standards). |

## Shared mechanics (all four)

- `src/lib/lab/intro/` — `intro-lab.css` (the `--il-*` light-dark token
  contract), `drop-demo.svelte.ts` (**real** production import path:
  `fromDataTransfer` folder walk, dot-file skip; reactive `dragActive`;
  editor handoff stubbed with an explicit "Lab stub" line), `ThemeToggle`
  (System→Light→Dark forcer), `Icon.svelte` + `icons/` (Nucleo duotone set
  exported as currentColor SVGs: sun/moon/auto, image, photos, inbox tray),
  `Brand.svelte` (origami-bird + wordmark lockup used by every header —
  always `/logo.webp`, the coral bird with real alpha; the light-mode asset
  has an opaque near-white tile baked in and must not be used on the lab's
  warm background).
- Each variant is ONE self-contained `+page.svelte` (lab convention:
  deleting a loser is one `rm -rf` + a gallery-card removal).
- States: idle / drag-over (signature surface ignites, copy flips to
  "Release to add") / accepted (summary + ≤4 names + Start over + stub) /
  keyboard-reachable browse. `prefers-reduced-motion` respected.

## Promotion notes (whichever wins)

- Replace the stubbed accept with the production route logic
  (`routeFiles` in `src/routes/+page.svelte`: 1 file → single editor,
  2+ → bulk) and delete `drop-demo.svelte.ts`'s stub surface.
- The production intro (`src/lib/editor/intro/Intro.svelte`, blob
  animation) is untouched; promotion replaces it wholesale.
- Decide whether the theme toggle ships (production is dark-only today;
  the `light-dark()` token bridge from the re-style lab is the app-wide
  light-mode path — see [lab-editor-restyle.md](lab-editor-restyle.md)).
