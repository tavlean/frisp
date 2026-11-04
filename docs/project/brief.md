# Project brief: Frisp

Last updated: 2026-11-04.

Intent, where things stand, and what is still undecided. Read this and
[../README.md](../README.md) (the docs index) before starting work.

## What this is

Frisp is a privacy-first, fully client-side image optimizer at
[frisp.app](https://frisp.app): a maintained modern fork of GoogleChromeLabs'
Squoosh, rebuilt on SvelteKit 2 and Svelte 5 as a static SPA under Apache-2.0.
Users drop, pick, or paste an image; the browser decodes, resizes, adds grain,
quantizes, and encodes locally through WASM codecs in workers, multi-core where
the browser allows. Nothing is ever uploaded. It installs as a PWA and works
offline after the first load.

The audience is everyday users optimizing images without a server, and the
maintainer's own daily work (single images and SVGs especially). Two planned
articles about the migration and the codec sweep are a side goal; the source
material is [../journey-and-article-notes.md](../journey-and-article-notes.md).

Hosting is a Cloudflare Worker named `frisp` serving static assets, configured
by the root `wrangler.jsonc`. Workers Builds CI is not connected, so deploys are
a manual `wrangler deploy`. The retired `sqush.app` and `presk.app` zones 301
here through a shared sunset Worker in `infra/sqush-sunset/`.

Brand identity lives in exactly one place, `src/shared/brand.ts`: `APP_NAME`
(`Frisp`) for anything a person reads, `APP_SLUG` (`frisp`) for identifiers such
as the CLI, package, domain, and filenames. Every internal identifier is
deliberately brand-free, so a future rename is a small task rather than a
project. Procedure: [../project-identity.md](../project-identity.md).

## Product thesis (maintainer, 2026-08-08)

Frisp is one optimization capability with two front doors, and the right door
depends on who is making the format and quality decisions:

- **An intelligence decides.** AI agents are increasingly the interface, and
  Frisp must be usable invisibly by them: headless and scriptable, running
  wherever the images already live. Locally through the CLI, programmatically
  as a library, and on the user's own servers, CI, or workers. Agents state
  targets ("visually lossless, smallest format that fits"); Frisp picks the
  knobs and verifies the outcome with a metric.
- **A human decides.** When a person picks the format and quality, Frisp is a
  beautiful, frictionless UI that makes the decision enjoyable, for single
  images and for bulk. That is frisp.app, and eventually thin native shells
  around the same build.

Both doors share one engine: the codecs, the pure bulk engine, and the
auto-quality brain. Integrations expose one or both doors; the planned Raycast
extension is the model case, with an automatic headless command and an
open-in-the-app handoff.

Priority between the doors (2026-08-08, refined 2026-11-04): the human
surface leads, and humans want outcomes too, not only knobs: "small enough
for this upload", "smaller without visible damage". So the human door moves
toward outcome-first defaults (a named quality and a maximum size up front,
codec knobs under Advanced) once auto-quality exists. The agent door is never
designed out: the engine keeps a framework-neutral boundary and change B
proves it runs in Node. But CLI, MCP, and Raycast distribution wait until a
real recurring workflow asks for them, because each is a surface one
maintainer has to keep working. When choosing agent surfaces (CLI, MCP, skills,
harness plugins), prefer the most universal one, so there are fewer surfaces
to maintain.

The privacy story holds in both worlds and gains a sharper wording: Frisp
never hosts a processing endpoint. The headless core travels to where the
images live; images never travel to Frisp.

## Architecture in brief

- SvelteKit 2.70 + Svelte 5.55 runes, Vite 8, adapter-static, `ssr = false`.
- Editor state: `src/lib/editor/editor-session.svelte.ts` (`EditorSession` plus
  two `SideRuntime`s), `editor-history.svelte.ts` for undo/redo,
  `src/lib/result-cache.ts` (LRU signature to result), `settings-storage.ts` for
  localStorage persistence. Every image is one `ImageRecipe`; its signature
  and folding rules live ONLY in `src/client/lazy-app/recipe.ts`
  (`recipeSignature`), which the editor reaches through
  `src/lib/editor/encode-signature.ts` and `side-recipe.ts` and bulk through
  its output hashes. `src/lib/optimize-image.ts` runs a recipe for both
  surfaces (SVG lane, JPEG to JXL transcode, or pixel encode).
- Framework-neutral headless pipeline under `src/client/lazy-app/image-pipeline*`,
  with a complete pure-reducer bulk engine in `src/client/lazy-app/bulk/` and its
  production store and UI in `src/lib/bulk/`.
- Codecs: committed WASM under `codecs/`, reached through Comlink workers via
  `src/lib/sveltekit-worker-bridge.ts`. Each side keeps a persistent bridge,
  in-flight encodes dedup, and one canonical recipe signature.
- Generated modules are committed source; `npm run sync` only patches the
  Emscripten wrappers. One JSON manifest, `src/shared/codec-asset-records.json`,
  feeds both the app and the static-output audit.
- Threading: COOP/COEP everywhere; oxipng, AVIF, and JXL run multi-core with a
  single-thread fallback intact.
- Service worker and PWA: `src/service-worker.ts`, variant-aware precache,
  prompt-to-refresh.

## Current state (2026-11-04)

The SvelteKit migration is concluded and `main` is the production app. All seven
WASM codecs were rebuilt from source natively in 2026-06, closing 14 CVEs, and
the multi-threaded runtime is verified in Chromium and WebKit. Gates are green:
`npm run check` reports 0 errors (57 warnings, all the same unknown CSS
`corner-shape` property), the unit suite passes, and Prettier is clean.

Shipped since then, newest first:

- **One recipe per image (2026-11-04, review change A).** The editor and bulk
  share one `ImageRecipe`, one signature, and one `optimizeImage`. Bulk keeps
  a shared recipe plus optional full own copies per image (the sparse
  overrides and the control registry are gone), gained Rotate, keeps SVGs
  vector, and its focus view adopts the current bulk output instead of
  re-encoding. Spec:
  [specs/2026-11-04-one-recipe-per-image.md](specs/2026-11-04-one-recipe-per-image.md).
- **Export-contract trust fixes (2026-11-04).** The 2026-11-02
  first-principles review found paths where the saved file disagreed with
  what the user asked for; each was reproduced and fixed with a regression
  test in `tests/e2e/export-contract.spec.ts`. The largest: no first offline
  encode worked at all, because the service worker never precached the
  worker chunks. Also jpegli became the one JPEG, WebP went back to method
  4, and production lost `/diagnostics`, dead code, and the per-side
  copy/save/import buttons. Record:
  [reports/2026-11-02-first-principles-review.md](reports/2026-11-02-first-principles-review.md).

- **Lossless JPEG to JXL transcode (2026-08-11).** A toggle on the JXL panel
  for JPEG sources repacks the existing DCT coefficients into a JXL container
  via `JxlEncoderAddJPEGFrame`: no re-encode, bit-for-bit reversible (proven
  by a byte-identical djxl reconstruction), 12 to 20 percent smaller. Gated on
  pixel-neutral preprocessing; falls back to a normal encode with a snackbar
  when a JPEG cannot be transcoded.
- **jpegli (2026-08-09).** A new encode-only codec from google/jpegli, shipped
  as "JPEG (jpegli)" beside MozJPEG with no default change: standard JPEG
  every decoder reads, from the tuned encoder extracted out of libjxl. Faster
  than MozJPEG on every bench fixture and about 7 percent smaller on photos at
  the shipped defaults. Same day: SvelteKit 2.61 to 2.70.2 plus nanoid and
  postcss bumps turned the CI audit gate green.
- **libjxl v0.12.0 (2026-08-08).** The encoder rewritten onto the public C API
  (the internal-API wall is gone; zero internal headers remain), a new
  fidelity-calibrated quality curve, RESAMPLING pinned so the quality slider
  can never silently halve resolution, and 3 CVE-fixing releases absorbed.
  This unblocked the whole 2026-07 codec batch. Same day: the benchmark
  methodology was fixed and re-baselined, and a ResultCache eviction bug
  (revoking the URL of a just-cached result under memory pressure) was fixed
  with the cache's first unit tests.
- **Search and link-preview metadata (2026-07-25).** The served HTML had no title,
  description, or Open Graph tags, because `ssr = false` keeps `<svelte:head>` out
  of the prerendered shell. Tags now live in `src/app.html`, with a generated
  social card, robots.txt, and sitemap. Reasoning: [../seo.md](../seo.md).
- **Lab restructure and design unification (2026-07-18).** `/lab` is a two-door
  index with a tab bar that flips skins in place, and all three editor skins got
  one bar system, docked zoom clusters, and a shared Nucleo icon set. The
  re-style direction is still undecided. Registry: [../lab.md](../lab.md).
- **Web Share for saved images (2026-07-17).** `src/lib/share-file.ts` plus a
  quiet Share button beside Save, rendered only when the OS sheet accepts the
  exact output file. Details: [../mobile-save-ux.md](../mobile-save-ux.md).
- **Rebrand and new landing (2026-07-15).** New logomark and theme-aware SVG
  favicon; the intro lab's `frame` design promoted to
  `src/lib/editor/intro/Intro.svelte`. Dev-only `/lab` and `/bench-svg` routes
  are stripped from production builds by the `app-strip-dev-only-routes` Vite
  plugin and guarded by `audit:static-output`.
- **SVG optimization (2026-07-12).** SVG sources get a first-class "SVG
  (optimized)" output: SVGO 4 in a lazy worker, Auto candidate search gated by
  pixelmatch, vector-true preview, gzip reporting. Stages S1 to S6 are done; the
  S8 competitive benchmark against nano and ImageOptim is the one open piece and
  its protocol is self-contained in the spec.
- **Film grain (2026-07-12).** A processor step between resize and quantize with
  a single Amount slider calibrated 1:1 against Luminar Neo reference exports,
  plus an Advanced grain-size control and live scrub preview.
- **First-principles review executed (2026-07-07).** Every day-one workstream
  landed: decoded-source cache, per-slot bulk drain, codegen retirement, worker
  transfers, dead-code removal, tooling and CI fixes. Remaining workstreams are
  fully specced.
- **Bulk Phase 2 and 2b (2026-07-03).** Production bulk on the main route with
  ZIP save-all, folder import, remove with Undo, and a shared image-info panel
  in the single editor plus an opt-in "Compare as..." second side.

Branch `claude/clever-swartz-2b34ed` is kept deliberately (maintainer,
2026-07-02). Its unmerged experiments (compare-size chips with a best badge,
fit-under-target binary search, shared Adjust state) are idea material for a
later phase. Do not delete it.

## Intentions and priorities

Set by the 2026-11-02 review and confirmed by the maintainer on 2026-11-04.
The full ordered plan is [roadmap.md](roadmap.md).

1. ~~**One recipe and one result owner per image.**~~ Done 2026-11-04
   (change A): single and bulk share one `ImageRecipe` and one
   `optimizeImage`; rotation and the SVG lane work in bulk because the recipe
   carries them.
2. **The worker-side pipeline and a bulk resource budget.** Performance,
   memory, and the honest headless boundary.
3. **Auto-quality on one codec, then outcome-first defaults.** The feature
   that makes Frisp more than a maintained Squoosh, in both doors.
4. **The UI revisit.** The maintainer revisits the editor re-style soon; the
   three lab skins stay until then.
5. **Close the SVG benchmark (S8)** with what it has.

The lab skins and the desktop-shell direction stay (maintainer, 2026-11-04).

## Hard open questions

- **Editor re-style direction.** Porcelain, darkroom, or hybrid, and how much of
  each survives contact with the production feature set.
- **Bulk scope switching.** How selection and global editing stay unambiguous.
- **Mixed-size batches.** Whether the global resize rule is a percentage or
  fixed dimensions.
- **Memory ceiling for N images.** Decode-on-demand, thumbnail strategy, LRU.
  Review change C measures and sets a supported batch size.
- ~~**Overrides inside the one recipe.**~~ Decided 2026-11-04: the own-copy
  model. An image follows the shared recipe or owns a full copy; a global
  edit stops reaching images with their own copy; multi-select edits carry
  the changed setting to each selected image.
- **A usage signal.** Nothing measures what anyone uses, so questions like
  "does anyone use the two-sided compare" have no answer. A cookieless
  counter (Cloudflare Web Analytics) would fit the privacy stance, but it is
  the maintainer's values call and is not built.
- **The agent surface.** The go decision was settled by the 2026-08-08 product
  thesis; [../frisp-cli-analysis.md](../frisp-cli-analysis.md) holds the design.
  Still open: the Node decode path and the format-race policy. Surface choice
  follows the 2026-08-08 universality preference: the fewest surfaces that
  reach the most agents.
- **HEIC.** Still undecided in
  [../new-codec-investigation.md](../new-codec-investigation.md).

## Constraints and non-goals

- The hosted app never uploads and Frisp never hosts a processing endpoint.
  Offline must keep working. The headless core running on a user's own server,
  worker, or CI is in scope: the tool moves to the images, never the reverse.
- The single-image workflow is protected. Bulk must never degrade it.
- The engine stays framework-neutral and pure. UI wraps it and never forks
  `EditorSession`.
- Never store live blobs or object URLs in localStorage; snapshots are
  metadata-only. The `app:settings:v3` key names are frozen (they never follow
  a rebrand); the payload under them extends in place, which is how grain and
  the 2026-11-04 MozJPEG-to-jpegli migration landed without a new key.
- Desktop shells are direction, not scheduled work: an Electron shell (macOS
  first, maintainer preference 2026-08-08) around the same static build, for
  OS integration, once PWA polish hits its ceiling. A separate product
  shipping native codec binaries for CPU speed is still not planned.

## Pointers

- [../README.md](../README.md) is the docs index; load only what a task needs.
- [../overview.md](../overview.md) for the architecture in one page,
  [../build-and-runtime.md](../build-and-runtime.md) for the build and asset
  wiring, [../gotchas.md](../gotchas.md) for silent traps.
- [worklog.md](worklog.md) for the session narrative,
  [issue-list.md](issue-list.md) for small fixes,
  [ledger.md](ledger.md) for when each heavy audit last ran.
- Style tie-breaker files are listed in [../../AGENTS.md](../../AGENTS.md), which
  is their single source of truth.
