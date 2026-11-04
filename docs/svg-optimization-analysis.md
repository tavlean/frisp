# SVG Import/Export & Optimization — Analysis and Recommended Approach

Last updated: 2026-07-15. Status: **SHIPPED (stages S1–S6 live); only the S8
benchmark remains open.** The vector lane is merged and live: the SVGO worker
pipeline under `src/lib/svg/`, the `SvgOptions.svelte` options panel, and
`'svg'` as an editor output format. Direction was approved by the maintainer on
2026-07-12 (he is a daily SVG user and wanted this in Frisp instead of external
tools) and Phases 1+2 shipped together. The design record below is preserved
as-is; the open S8 benchmark content is unchanged.

The maintainer's ask (2026-07-12): import SVGs, export optimized SVGs, matching
or beating his current workflow — **vecta.io/nano** as the default compressor,
sometimes chained with **ImageOptim** for extra gains. Research was run by four
parallel agents (nano published-technique analysis, 2026 optimizer landscape,
beat-SVGO techniques, Frisp integration audit); this doc is the distilled
record.

> **Sources note.** Every claim about other tools comes from their own
> published material — Vecta's blog posts and product pages, ImageOptim's
> changelog and open-source repository, SVGO's docs and releases — cited in
> the agent reports. Nothing was probed or decompiled. Naming benchmark
> targets is standard practice; the comparisons here are factual and the
> respect for those tools' work is genuine. Load-bearing repo facts were
> verified directly in-tree.

## TL;DR — can we match or beat nano + ImageOptim?

**Yes.** Three findings make this tractable:

1. **ImageOptim's SVG engine IS SVGO** (plus svgcleaner — GPL-2.0, archived 2021,
   license-incompatible and dead). Running the same SVGO v4 in a browser worker
   gives ImageOptim parity essentially by construction. Its "Lossy minification"
   toggle maps to SVGO precision reduction, which we can expose with better
   control (a slider + live preview instead of a blind checkbox).
2. **Nano's "22% smaller than the competition" claim is stale marketing** — it
   dates from 2018–2019 against SVGO 1.x, with no published corpus, config, or
   even a named competitor. SVGO v4 (2025–2026) closed years of gaps; on
   documented technique-by-technique mapping, almost everything nano does has a
   stock SVGO v4 plugin equivalent. Nano's real remaining edges are (a) font
   embedding/subsetting for text-bearing SVGs, (b) embedding-mode profiles
   (img/object/inline), and (c) per-file visual verification that lets it be
   aggressive safely.
3. **The chain "nano then ImageOptim sometimes wins" is a crude candidate
   search** — two different pipelines, keep the smaller output. That's exactly
   the mechanism Frisp can industrialize: generate N candidates (precision grid ×
   plugin sets × single/multipass), render each, gate on pixel diff, keep the
   smallest by compressed size. Nobody ships this in the open ecosystem (SVGOMG
   is manual; SVGym is weeks old); Frisp's client-side rendering + compare UI is
   the natural home for it.

Honest bound: on **text-bearing SVGs with embedded fonts**, nano's font
subsetting can win big (its own example: 71.3 KB → 20.1 KB of font payload) and
we won't match that without a font-subsetting phase (deferred). On everything
else — icons, logos, illustrations, editor exports — SVGO v4 tuned + candidate
search should match or beat nano, and always match ImageOptim.

## Engine decision

**SVGO v4.0.1** (MIT, active, pure JS) via the official `svgo/browser` ESM entry
in a **dedicated lazy worker**. ~780 KB raw chunk (much less over the wire).
Not 4.0.0 — 4.0.1 fixes an XML entity-expansion DoS. Alternatives ruled out:

| Tool | Verdict |
|---|---|
| oxvg (Rust→WASM, MIT) | Pre-1.0, incomplete parity; benchmark later, don't build on it |
| SVGM (Rust, MIT) | Best 2026 benchmark (marginally beats SVGO 4.0.1, 33× faster natively) but **no browser/WASM build**; track it |
| svgcleaner | Dead (archived 2021) + GPL — excluded |
| scour | Apache-2.0 but stale (2020) + Python-only — excluded |
| SVGOMG / online tools | SVGO frontends, not engines; steal UX ideas only |

## Recommended product shape (three phases)

### Phase 1 — the vector lane (ImageOptim parity, nano-competitive)

Frisp **already imports SVG** (rasterizes via `<img>` — `processSvg` in
[svg-source.ts](../src/client/lazy-app/svg-source.ts);
bulk accepts `.svg`; the Vector resize method re-renders from source). The
shipped SVG **output** lane (stages S1–S6):

- SVG source → right side defaults to **"Optimized SVG"**; raster formats stay
  available (existing rasterize path untouched). SVG is never offered for
  raster sources.
- A separate **vector lane** through the editor, NOT a fake raster encoder:
  SVG text → SVGO worker → SVG file. The ImageData invariant in
  compress/processors is left alone.
- **Vector-true preview (maintainer requirement, 2026-07-12):** SVG sides in
  the compare view must re-render at the current zoom scale — crisp at ANY
  magnification, because pixel-peeping an extreme zoom to confirm zero
  raster artifacts is the whole point of vectors. A once-rasterized,
  bitmap-scaled preview is explicitly rejected as dishonest. Two acceptable
  implementations (spec decides by two-up rework cost): native `<img>`
  elements sized by layout (browser re-rasterizes per zoom), or re-rendering
  the vector into the existing canvas two-up at each settled zoom level.
  Offscreen rasterization remains only for the automated pixel-diff gate
  (measurement, not display) and for the raster-export branch.
- Options panel (replaces Edit section for the SVG format): conservative
  default = `preset-default` + multipass, **precision slider** (per-plugin
  mapping: number/path precision with transform precision stepped
  independently — never uniform), and advanced toggles grouped by risk
  (safe extras / visually-verify / context-changing / destructive), following
  the landscape report's grouping. `removeViewBox` never recommended.
- **Report raw AND gzipped size** (fflate in the worker) — SVGs ship
  compressed; nano reports both and users compare against that.
- Bulk: keep rasterizing SVGs in v1 (current behavior, clearer wording);
  preserve-format bulk is a later, larger design (bulk is one-encoder-shaped).

Key integration facts (verified in-repo): lane-aware side recipe +
`encodeSide` dispatch in
[editor-session.svelte.ts](../src/lib/editor/editor-session.svelte.ts);
signature must hash optimizer options and EXCLUDE raster processor state
([encode-signature.ts](../src/lib/editor/encode-signature.ts));
`ResultCache` needs modest generalization; `optionsByFormat` in the frozen
`app:settings:v3` payload extends backward-compatibly; ZIP export already
format-agnostic. Full touch-list and risk register live in the integration
report (agent output, 2026-07-12); the ten weight-bearing files are listed
there and match this doc.

### Phase 2 — "Auto" candidate search (the differentiator; beats nano on most files)

The vector twin of the already-specced raster auto-quality mode
([specs/2026-07-11-auto-quality-mode.md](project/specs/2026-07-11-auto-quality-mode.md)):

- Generate candidates: precision grid (3/5 → 2/4 → 1/3, optional 0/2) ×
  {single-pass, multipass} × isolated risky plugins (`reusePaths`,
  `convertStyleToAttrs`, `removeOffCanvasPaths` static-only,
  `convertPathData.makeArcs`).
- Visual gate per candidate: render at multiple sizes (16/32/64/256/512 px,
  1× and 2×) on transparent/white/black, compare with **pixelmatch** (ISC),
  mismatch normalized by union-of-painted-pixels (not canvas area). Strict
  gate for icons.
- Pick the smallest **gzipped** survivor (raw as tie-break); show the diff in
  the existing compare UI so "lossy but verified" is a first-class, honest
  state — better than nano's opaque 1%-warning.
- Embedding-mode profiles (nano's best transferable idea): Static image /
  Inline / Interactive presets controlling scripts, IDs, title/desc,
  dimensions.

### Phase 3 — only if benchmarks demand (deferred)

> **Benchmark signals (2026-07-12).**
>
> **vs ImageOptim 1.9.3** (full 215-file corpus, gzip, benchmarks/svg/RESULTS.md):
> frisp-auto beats it overall (144W/18T/34L) but LOSES editor-exports
> (ImageOptim median −51% vs our −36%) — more aggressive on editor junk.
>
> **vs vecta nano** (57-file stratified sample, RAW output bytes,
> benchmarks/svg/external/nano/RESULTS-nano.md — nano's download is a
> data:URI the in-app browser can't capture, so this leg is raw-only via
> nano's own reported sizes; gzip + nano→ImageOptim chain NOT run, stated
> honestly). Overall **Frisp auto −41.8% vs nano −26.4%** (auto wins on
> total bytes; file-by-file a near-even 28W/2T/27L). The split is the real
> story:
> - **Frisp auto WINS** where precision reduction dominates — logos
>   (−51% vs −6%), illustrations (−53% vs −48%), already-clean color icons
>   (−34% vs −8%). Its coordinate rounding crushes decimal-heavy paths nano
>   leaves alone.
> - **nano WINS** on **icons-stroke (−43% vs −19%, 0/0/10)** and
>   **editor-exports (−44% vs −37%)** — it strips structurally. Two concrete
>   Frisp v2 levers surfaced:
>   1. **Remove truly-invisible elements** — Tabler stroke icons ship a
>      `<path stroke="none" … fill="none"/>` bounding rect; nano drops it,
>      SVGO preset-default keeps it (`removeHiddenElems` only catches
>      display:none/opacity:0/zero-size). Add a "remove paint-none paths"
>      pass to the auto search.
>   2. The editor-junk aggression lever (below), same root cause as the
>      ImageOptim loss.
>
> Concrete v2 lever (both ImageOptim & nano editor-exports losses): add an
> `inlineStyles`-aggressive / `removeAttrs`(data-*) candidate to the auto
> search for style-heavy sources. Also parked for v2: dimensionless-SVG
> import relaxation (19 corpus files rejected by the inherited
> width/height/viewBox contract). Font-subsetting scope note: Frisp can
> never fetch remote fonts (privacy / offline), so subsetting only ever
> applies to fonts ALREADY EMBEDDED in the file — that bounds the design
> sharply and is why it stays deferred.

- **Font subsetting** for text-bearing SVGs (the one place nano keeps a real
  edge). Big: shaping, glyph closure, WOFF2, license flags (`fsType`). Needs
  WASM (HarfBuzz-class). Separate project.
- **Lossy curve refitting** (paper.js `simplify` / fit-curve) as an explicit
  "simplify paths" control — potentially beats nano on traced/over-sampled
  art; never part of default optimization.

### Verification

A small SVG corpus in the existing benchmark culture: stratified fixtures
(icons/logos/illustrations/editor-exports/adversarial), compare Frisp
conservative + auto vs saved nano and ImageOptim outputs (hash + settings
recorded — nano is a hosted moving target), report raw/gzip/Brotli + visual
status, win/tie/loss. This is what makes "matches or beats nano" a claim
instead of a hope.

## Decisions (all closed 2026-07-12)

1. **SVGO chunk loads on first SVG use** (runtime-cached by the SW from then
   on), NOT precached at install. Maintainer reversed the earlier precache
   call after discussion: first-use caching keeps the install lean and the
   offline story honest ("SVG optimizer is offline-ready after first use").
2. **Vector-true preview** (see Phase 1 above): SVG sides re-render at the
   current zoom; no frozen-bitmap scaling.
3. **Phases 1+2 ship together.** Phase 1 alone is not enough for the
   maintainer's daily SVG workflow — the auto candidate search is the point.
4. **Priority: above the queued codec batch** (jxl 0.12 → jpegli → transcode
   → auto-quality). The maintainer optimizes SVGs daily; the codec batch
   waits.
5. Executable spec:
   [specs/2026-07-12-svg-optimization.md](project/specs/2026-07-12-svg-optimization.md)
   — execution state lives THERE.

## Related

- [new-codec-investigation.md](new-codec-investigation.md) — the original SVGO
  candidate entry (this doc supersedes its "still open" verdict analysis-wise).
- [specs/2026-07-11-auto-quality-mode.md](project/specs/2026-07-11-auto-quality-mode.md)
  — raster sibling of the Phase-2 candidate-search concept.
- Agent reports (session scratchpad, 2026-07-12): nano published-technique
  analysis, optimizer landscape, techniques, integration audit — cited sources
  for every external claim above.
