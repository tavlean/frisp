# Lab — intro page re-design

Last updated: 2026-07-15. Status: **DECIDED — `frame` promoted to the live intro**
(2026-07-15). The other takes were kept as lab exhibits rather than deleted, and
the previous production landing was preserved as a new `aurora` variant (see
Promotion notes below).

Six dev-only takes on the landing screen as a modern minimal full-viewport
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
| `/lab/intro/billboard` | Giant two-tone statement headline ("Smaller images." near-black / "Nothing uploaded." grey since the graphite round) over ONE floating squircle drop card | The most brand-forward; the two-tone headline does the marketing. Card is a small target, but the whole page accepts drops. |
| `/lab/intro/frame` | The viewport IS the drop zone — permanent dashed viewfinder frame, chrome as HUD corner micro-copy, marching dashes on drag | The most original and the most "tool, not site"; header/footer minimalism taken to its logical end. Needs taste to survive real content pressure (no room for more copy, by design). |
| `/lab/intro/split` | Editorial asymmetry — headline + three stat blocks left, tall drop panel right with try-a-sample thumbs (canvas-generated real PNGs) | The most conventional landing; samples give first-time visitors a zero-friction path. Right panel is a big honest target. |
| `/lab/intro/ledger` | Hyper-minimal narrow column: hairline tray + numbered 01–04 ledger ("Upload — never" in coral); refined 2026-07-10 — header/column/footer share ONE 560px spine | The quietest and most privacy-narrative; typography does all the work. Least "wow", most trustworthy. |
| `/lab/intro/prism` | Three-zone hero (Vercel-style reference): headline + actions left, luminous prismatic drop stage centre (logo-free since the graphite round), vertical trust column right, quiet format row as footer | The most product-launch polish; the glow is the wow. Busiest of the static variants (still minimal by normal standards). |
| `/lab/intro/showcase` | The hero IS the app: a framed dark "UI screenshot" that is a live drop target — drop/pick and a FLIP morph expands it into the REAL production editor, already encoding (no stub; Back returns to the hero) | The boldest concept and the only one where the landing demos the product by being it. Heaviest page (mounts the real editor); the morph is the wow. |

## Shared mechanics (all six; showcase skips the stub — its handoff is real)

- `src/lib/lab/intro/` — `intro-lab.css` (the `--il-*` light-dark token
  contract), `drop-demo.svelte.ts` (**real** production import path:
  `fromDataTransfer` folder walk, dot-file skip; reactive `dragActive`;
  editor handoff stubbed with an explicit "Lab stub" line), `ThemeToggle`
  (System→Light→Dark forcer), `Icon.svelte` + `icons/` (Nucleo duotone set
  exported as currentColor SVGs: sun/moon/auto, image, photos, inbox tray),
  `Brand.svelte` (origami-bird + wordmark lockup used by every header —
  since round 3 the GRAPHITE bird `/logo-dark-mode.webp` in both modes, with a
  light-mode brightness filter via `--il-bird-brightness`; maintainer doctrine:
  graphite is the main identity, coral/azure only as rare moments — permanent
  coral was demoted to grey in billboard/split; ledger's "never" and the
  drag-over ignitions remain the accents. Asset notes: `/logo.webp` = the
  coral bird (accent tier, real alpha); `/logo-light-mode.webp` has an opaque
  near-white tile baked in — never use it on the lab's warm background).
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

## What actually shipped (`frame`, 2026-07-15)

- `src/lib/editor/intro/Intro.svelte` was replaced wholesale with the frame
  design, keeping the `onFiles` prop (`routeFiles`) as its only input. It
  attaches its **own** drop target and `stopPropagation`s the drag events, so a
  drop over the intro routes exactly once (here, not the app-wide `fileDrop`)
  and the global pink overlay stays hidden — the viewfinder is the drag
  feedback instead. Browse (multi-file input) and Cmd/Ctrl+V paste route the
  same way. The lab's `--il-*` tokens were inlined as scoped `--i-*`
  `light-dark()` values, so the intro follows the **OS** theme (no toggle —
  the lab `ThemeToggle` did not ship). The tray icon and brand lockup are
  inlined (no `$lib/lab` imports leak into production).
- The old production landing was preserved verbatim as the **`aurora`** lab
  variant (`/lab/intro/aurora`, `AuroraIntro.svelte`); `blob-anim.ts` moved
  from `editor/intro/` to `lib/lab/intro/` since aurora is now its only user.
- The losing variants (`billboard`, `split`, `ledger`, `prism`, `showcase`)
  were **kept** as lab exhibits rather than deleted, so `drop-demo.svelte.ts`,
  `ThemeToggle`, `Brand`, `Icon`, and `intro-lab.css` all remain in use.
