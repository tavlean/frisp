# Lab registry

Last updated: 2026-11-04.

Every lab experiment, its route, and whether its code is still wanted. **Dead-code
and hygiene audits MUST read this file first**: anything marked _ongoing_ or
_kept for reference_ is deliberate and must never be flagged or deleted.

All lab routes are dev-only. They are stripped from production builds by the
`app-strip-dev-only-routes` Vite plugin and the removal is enforced by
`npm run audit:static-output`. Since 2026-11-04 the same plugin also strips
`/diagnostics` and its probe workers, which had been shipping to production. Run `npm run dev` and open `/lab`, a two-door
index (main ui / intro page) with a thin tab bar that flips variants in place.
Skins auto-load the last file used in any skin, else a bundled sample, via
`src/lib/lab/lab-source.ts`, so switching tabs keeps the image being judged.

## Main UI re-style

**Status: ongoing. The direction decision is still open.** Three full re-skins of
the single-image editor, each a real editor rather than a mockup: they
instantiate the production `EditorSession` and encode through the real pipeline,
so only the chrome is new. Design record:
[lab-editor-restyle.md](lab-editor-restyle.md). The 2026-07-18 unification pass
that gave all three one bar system, docked zoom clusters, Export/Save as the only
primaries, and one shared Nucleo icon set is specced in
[project/specs/2026-07-18-lab-design-unification.md](project/specs/2026-07-18-lab-design-unification.md).

| Variant | Route | Code | Read |
|---|---|---|---|
| porcelain | `/lab/porcelain` | `src/lib/lab/porcelain/` | Light, airy, squircle. Also hosts the crop tool below. |
| darkroom | `/lab/darkroom` | `src/lib/lab/darkroom/` | Rail plus inspector plus filmstrip. |
| hybrid | `/lab/hybrid` | `src/lib/lab/hybrid/` | Darkroom's information architecture in porcelain's skin. **Recommended** by the 2026-07-07 session. |

Shared lab chrome lives in `src/lib/lab/LabIcon.svelte`, `LabTabs.svelte`,
`Logomark.svelte`, and `icons/` (27 pure-stroke 18px Nucleo glyphs on
`currentColor`).

**Production code kept alive only for these skins.** On 2026-11-04 the
production editor dropped its per-side Copy settings, Save side settings, and
Import saved side settings buttons. `EditorSession` still has `copyToOther`,
`saveSide`, `importSide`, and `canImport` (and the `app:side-settings:*`
storage behind them) only because the three skins call them
(`src/routes/lab/{porcelain,darkroom,hybrid}/+page.svelte` and the darkroom and
hybrid `Inspector.svelte`). When the skins are retired or the winner is
promoted without those buttons, delete the methods with them; until then a
dead-code audit must not flag them.

## Crop tool

**Status: ongoing, kept for reference regardless of the skin verdict.** A
Pixelmator-Pro-style crop tool living in `src/lib/lab/crop/`, hosted by porcelain
but written to be chrome-agnostic so it ports to whichever skin wins. The fixed
coordinate model, the `CropTool` API, and the deferred features (perspective,
auto-crop, auto-straighten) are specced in
[project/specs/2026-07-07-porcelain-crop-tool.md](project/specs/2026-07-07-porcelain-crop-tool.md).

## Intro page

**Status: concluded 2026-07-15. Verdict: `frame` won and was promoted** to the
live landing at `src/lib/editor/intro/Intro.svelte`. Design record and the
per-variant honest reads: [lab-intro-page.md](lab-intro-page.md).

The six original takes stay behind `/lab/intro` as exhibits rather than being
deleted, and the retired coral blob landing was preserved as a seventh:

| Variant | Route | Keep because |
|---|---|---|
| frame | `/lab/intro/frame` | The promoted design. Compare against the shipped version. |
| billboard | `/lab/intro/billboard` | Two-tone statement headline; the most brand-forward take. |
| split | `/lab/intro/split` | Editorial asymmetry with try-a-sample thumbs. |
| ledger | `/lab/intro/ledger` | The privacy-narrative typography study. |
| prism | `/lab/intro/prism` | Three-zone hero; the luminous drop stage. |
| showcase | `/lab/intro/showcase` | The only variant where the landing IS the app, via a FLIP morph into the real editor. |
| aurora | `/lab/intro/aurora` | **Kept for reference:** the pre-2026-07-15 production landing. This is the only surviving copy outside git history. |

## Bulk optimization

**Status: concluded 2026-07-03. Verdict: promoted to production.** The lab's
consolidated bulk UI became the real bulk mode on the main route; the lab modules
moved to `src/lib/bulk/` as the production store and UI, and `/lab/bulk` was
deleted. Grid mode was tried and removed before promotion. Records:
[bulk-ui-design-options.md](bulk-ui-design-options.md) for the design session,
[project/specs/2026-07-02-bulk-phase-2-promotion.md](project/specs/2026-07-02-bulk-phase-2-promotion.md)
for the executed migration.

## SVG benchmark harness

**Status: ongoing.** `/bench-svg` drives the real SVG optimizer over the
stratified corpus in `benchmarks/svg/`. It is the vehicle for the open S8
comparison against nano and ImageOptim, so it stays until that lands. Protocol:
[project/specs/2026-07-12-svg-optimization.md](project/specs/2026-07-12-svg-optimization.md).

## Font comparison

**Status: concluded 2026-07-02. Verdict: Satoshi won** over Outfit and Geist and
is the app typeface, self-hosted in `static/fonts/`. The comparison surface was
part of the bulk lab and went away with it; the Outfit subsets were removed.
