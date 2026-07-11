# Worklog

Short session-by-session build log: what changed, why, and the gotchas a future
session must know. Newest first. (Live project state stays in
[STATUS.md](STATUS.md); this is the narrative trail.)

## 2026-07-12 (later) — Grain v1.1: Size control + live scrub preview

Same session, maintainer go on both follow-ups. (1) **Advanced Size (1–4)**:
band-limited grain via a bilinear noise lattice with exact per-phase variance
correction (Amount = same σ at every size; unit-tested at 2/3/4). Motivated
by a measured debanding experiment (results in the spec §Size): the encoder
DELETES faint fine noise (sub-threshold 1px grain = pay nothing, fix
nothing), while 2px grain at Amount ~5 debands like 1px at Amount 12 for
~1/6 the bytes. Roughness deliberately not added. (2) **Live grain preview**:
while an encode is in flight and the grain recipe differs from what's on
screen, the viewer shows the preprocessed frame with the CURRENT grain
applied (same function/seed = exact encoder input); the settled encode
replaces it. Guards: suppressed when a real resize or quantize is active
(the frame would mislead). **Gotchas:** (a) do NOT throttle with
requestAnimationFrame — it never fires in non-compositing contexts
(headless/e2e, background tabs); a latest-wins drain loop with setTimeout
yields is used instead (this failure was hit live during verification);
(b) at rotation 0 `#preprocessedPromise` is deliberately null — the
preprocessed frame is `#decodedPromise.decoded` (see `#preparedSource`);
(c) `SideRuntime.displayedGrainSig` records the grain recipe baked into the
displayed result — bulk focus hydration self-heals it via the encode
effect's redundant-pass branch. Verified live: preview lands <100ms after a
scrub while the encode is still in flight, settles to encoded truth; unit
122, check 0 errors, full e2e green.

## 2026-07-12 — Film grain shipped (measured model, single slider)

Designed and shipped the film-grain processor in one session, pulled ahead of
the 2026-07 codec batch by the maintainer. The design question ("use
JXL/AVIF's native grain synthesis or bake uniform grain?") was resolved by
research + measurement: **baked pixels won** (native paths can't author
aesthetic grain on AVIF, only decode in Safari for JXL, and don't exist at all
for JPEG/WebP/PNG; baked is WYSIWYG everywhere). Full rationale in
`docs/specs/2026-07-12-film-grain.md`.

The grain model was **measured, not invented**: the maintainer exported 20
calibration images from Luminar Neo + Pixelmator Pro onto known synthetic
canvases plus 3 real-photo pairs; analysis (numpy, session scratchpad)
decoded Luminar's default look — monochrome per-pixel white noise (lag-1
autocorr ≈ 0; Luminar's Size slider is measurably inert), flatter-than-
gaussian samples (kurtosis ≈ −1.5 ⇒ `sign(u)·|u|^0.683`), amplitude =
`0.44·amount · 4L(1−L)` (midtone parabola over the pixel's own sRGB luma).
Verified against the real photos within ~5%, then verified again END-TO-END in
the browser: lossless PNG output measures σ 5.31 vs 5.28 predicted at the
default Amount 12. Frisp's slider is 1:1 on Luminar's Amount scale
(maintainer's taste: 10–12 everyday, ~24 creative).

Implementation mirrors quantize everywhere: `features/processors/grain/`
(pure-JS apply, fixed-seed xorshift32, one PRNG step per pixel, alpha-0 pixels
untouched), pipeline order resize → grain → quantize (grain scale stable at
output resolution; palette contract preserved), `grainIsReal()` folds
"enabled at 0" out of the encode signature / bulk recipe (toggle-off = cache
hit, asserted by the new `tests/e2e/grain.spec.ts`), UI = one "Film grain"
ToggleRow + Amount slider shared by both editors. **Gotchas:** (1) per-side
saved settings default-fill a missing `grain` on parse — `app:settings:v3`
frozen, do NOT bump; (2) `BulkMode.svelte`'s per-image override diff loop
hardcodes the processor key list — new processors must be added there
(`['grain', 'resize', 'quantize']`) or per-image edits silently drop; (3) the
bulk `processorControls` registry has no consumer yet (WS-G UI half pending) —
the grain entry is registered for when the dots/resets wiring lands. Gates:
check 0 errors, 119 unit (9 new), full e2e 61+2 passed both browsers.

## 2026-07-11 (later) — CLI scope notes, npm name, film-grain idea

Follow-up in the same session. The maintainer agreed with the CLI direction;
scope notes captured in `docs/frisp-cli-analysis.md` §3a: manual `--quality`
stays first-class (never auto-only), the preset ladder gains a lossy-tolerant
**Compact** target (SSIMULACRA2 ≈ 60, also added to the auto-quality spec so
app and CLI share one vocabulary), and agent experience is a v1 requirement
with a concrete bar (teaching `--help`, fix-stating errors, stable NDJSON,
determinism, fast `npx` start, `frisp mcp`).

The `frisp` npm name looked unclaimed (404) but publishing it is **blocked by
npm's typosquat filter**: 403 "too similar to existing package fresh". No CLI
workaround exists; the moniker rule is enforced server-side on PUT. A support
ticket requesting an exception was submitted 2026-07-11 via npmjs.com/support
("problem with the npm registry" category, from tav@artusion.com; sent-
confirmation banner received). The placeholder package (`packages/cli/`, bin
stub + README, deliberately NOT a workspace yet) stays named `frisp`; publish
is on hold for npm's reply. Maintainer ruled out `@tavlean/frisp`; `frisp-cli`
verified unclaimed as the fallback. **Gotchas for the eventual publish:** the
web-2FA flow needs a TTY (`script -q /dev/null npm publish` from a sandboxed
shell, then approve the printed npmjs.com/auth/cli URL in the maintainer's
browser — npm masks the URL in non-TTY error output but prints it plainly
under a pty).

New idea recorded in the roadmap ("Film Grain / Debanding"): subtle grain to
mask gradient banding at low quality and to de-plastick AI images. Key
findings: grain must be baked pre-encode for WebP/JPEG (costs bytes, and very
low quality smooths it — preview shows the sweet spot), but JXL already has
decode-time noise (`photonNoiseIso` — shipped in Frisp's advanced options
today) and AVIF/AV1 has in-format Film Grain Synthesis worth investigating.

## 2026-07-11 — Codec landscape guidance + four-feature batch

Guidance session on the codec landscape: Frisp is current on WebP and AVIF,
but behind on JPEG XL (libjxl v0.8.5 versus v0.12.0). The maintainer approved
four features, each now captured in a Codex-executable spec:

- `docs/specs/2026-07-11-libjxl-0-12-upgrade.md` — libjxl v0.12.0 upgrade
  with a public-API encoder rewrite, isolated on its own branch;
- `docs/specs/2026-07-11-jpegli-codec.md` — new encode-only jpegli codec from
  google/jpegli;
- `docs/specs/2026-07-11-jpeg-to-jxl-transcode.md` — lossless JPEG→JXL
  transcode, blocked on the libjxl upgrade;
- `docs/specs/2026-07-11-auto-quality-mode.md` — SSIMULACRA2-targeted
  auto-quality search plus a new `codecs/ssimulacra2` metric module.

Also written: `docs/frisp-cli-analysis.md`, decision material for a possible
Frisp CLI; recommendation yes-but-sequenced after the codec batch, decision
pending. The jpegli and JPEG→JXL skip verdicts in
`docs/new-codec-investigation.md` are now superseded.

**Gotcha:** the libjxl v0.8.5 pin is an internal-API wall: `enc_file.h` was
deleted upstream at v0.9, so this is a wrapper rewrite rather than a routine
version bump. Cross-doc claims about the pin and upgrade were reconciled today.

## 2026-07-10 (later) — intro-page lab: five landing variants

Maintainer-requested lab experiment: the landing screen as a minimal
full-viewport single section (drop area + tiny header/footer, light+dark).
Scaffold (orchestrator-authored): `src/lib/lab/intro/` tokens + IntroDropDemo
(REAL production import path, reactive dragActive, stubbed editor handoff) +
ThemeToggle + Nucleo duotone icon set (`Icon.svelte`, currentColor exports
from the local Nucleo library). Variants (parallel delegated builds, each one
self-contained +page.svelte, orchestrator-reviewed + icon-retrofitted):
`/lab/intro/billboard` (statement headline + floating card), `frame`
(viewport-as-drop-zone viewfinder, marching dashes), `split` (editorial
asymmetry + canvas-generated try-a-sample PNGs), `ledger` (typographic
privacy ledger). Design grounded in Mobbin references (V7/Shuttle/Shade).
All four verified live in both modes; split's sample click produced a real
507 kB PNG through the accept path. Doc: `docs/lab-intro-page.md`
(registry row added). Decision PENDING; commits `477c2f1d` + `01ed6333`.
Gotchas: the /lab index's old `labRoute` type-widening hack died once all
routes existed — plain `resolve()` literals now; an SVG used as a full-bleed
frame needs an explicit CSS box (inset alone leaves it at intrinsic 300×150);
the Nucleo "photos" pinwheel reads as the Apple Photos brand at display sizes
— use the plain image glyph instead.

Round 2 (same day): maintainer supplied a Vercel-style three-zone reference →
fifth variant `/lab/intro/prism` (Opus build, orchestrator-reviewed): headline
+ actions left, prismatic-glow drop stage starring the origami bird centre,
vertical trust column right, format row as footer; real canvas sample via
"Try a sample". Brand lockup componentized (`Brand.svelte`: /logo.webp coral
bird — the ONLY logo asset with alpha; logo-light-mode.webp has an opaque
tile) and adopted by all five headers. Ledger re-composed onto a single
560px spine (header/column/footer share one left edge; dot accent dropped;
200px tray). Verification gotcha: Svelte 5 flushes class bindings async —
a synchronous DOM read right after .click() misses the update and fakes a
"broken toggle"; wait a tick before asserting.

Round 3 (same day): (1) GRAPHITE identity — new `/logo-dark-mode.webp` steel
bird adopted as the main mark in Brand.svelte for BOTH modes (light mode
darkens it via `--il-bird-brightness` filter token); permanent coral demoted
to grey in billboard ("Nothing uploaded.") and split ("locally."); ledger's
"never" + drag ignitions stay as the rare accents. Prism: bird removed from
the drop stage (header-only), lockup gap tightened. (2) SIXTH variant
`/lab/intro/showcase` (Opus build, orchestrator-verified end-to-end): hero
features a CSS-mock app window that is a live drop target; on accept it
feeds the REAL EditorSession and FLIP-morphs (measured rect → fullscreen,
480ms) into the production editor composition (Output + panels + undo/redo,
styles ported from routes/+page.svelte) — encode runs DURING the animation;
Back fades home and clears the session. Verified personally: synthetic drop
→ morph → real 265 kB PNG → 1.70 kB WebP ↓99% → Back restores the hero.
Gotcha: full-page screenshots composite fixed overlays at partial opacity
(ghost header) — trust elementFromPoint over the stitched capture.

## 2026-07-10 — Whole-project quality pass (fable-pass)

Deep senior pass over the production code (labs excluded by design — decision
pending, losers get deleted): every file judged against its spec/decision
docs, most-central first. Headline: the codebase is in strong shape — editor
core, bulk engine, worker layer, and service worker all read at exemplar
standard; most areas needed nothing.

**What changed (each commit gated by typecheck + 110 unit tests; full e2e
61-passed/1-skip both browsers before and after):**

- `c6cfdd86` — **one canonical encode-signature projection.** BulkMode's
  focus-hydration had reimplemented the editor's encode/resize signature
  construction (4 helpers + a fourth private `stableStringify`) — the exact
  drift class the 2026-07-02 hardening batch (`da273584`) eliminated. Now
  `src/lib/editor/encode-signature.ts` (sideRecipe / resizeIsReal /
  encodeSignature / resizeSignature) feeds both `EditorSession.encodeSide`
  and BulkMode.
- `da58751b` — **fix:** `BulkStore.reset()/dispose()` now clear BOTH debounced
  apply timers (+ the pending payload); before, a pre-reset global-apply
  snapshot could re-apply onto the fresh session ~200ms after reset.
- `5d88754b` / `284871c0` / `9fadb1fb` — craft: `formatLabel` deduped into
  `src/lib/editor/format-label.ts`; self-only exports un-exported; unused
  `BulkRuntime.cancel/dispose` aliases deleted; `cloneOrNull`→`clone`;
  OptionsPanel's dead `sourceName` prop removed from all 4 call sites;
  pinch-zoom/two-up/Snackbar comment rot fixed (headers now admit the real
  local features).

**Verified-refuted (no change, worth remembering):** the JXL panel's
unguarded `lossyModular = quality < 7` under lossless is output-inert —
`codecs/jxl/enc/jxl_enc.cpp:63` sets `modular_mode = (lossyModular ||
quality == 100)` and quality 100 forces distance 0. Upstream parity kept;
the bulk registry's extra guard is equally correct.

**Flagged, not fixed:** engine-barrel pruning, drag-teardown micro-gaps, and
the intentional coarse override-path seam → [issue-list.md](issue-list.md)
items 5–7. Both memory-flagged must-dos (two-up divider, host-objects-in-
$state) were confirmed long since fixed.

## 2026-07-05 — Rename-proofing + sqush.app sunset Worker

**Why:** the maintainer may rename the app again; a rename must be a small task,
not a project. Also fixed the zombie-service-worker trap on the old domain.

**What changed:**

- **Rename-proofing refactor** (delegated implementation, orchestrator-reviewed): `src/shared/brand.ts` (`APP_NAME`) is now the only place the name
  lives in code; every internal identifier de-branded (`.editor-root`,
  `app-generated` alias, `__appEmscripten*` globals, `registerServiceWorker`,
  SW cache `app-${version}`, localStorage `app:*` keys — FROZEN schema now,
  renamed one final time while the domain cutover had client storage reset
  anyway; bulk ids `bulk-N`; `static/wordmark.svg`). Bulk ZIP download name
  still branded, derived from `APP_NAME`. Full details: runbook Phase E.
- **`infra/sqush-sunset/`**: Cloudflare Worker for the sqush.app zone — serves
  a self-destructing service worker at `/service-worker.js` and 301s all else
  to frisp.app. NOT yet deployed (needs user: deploy + disable the zone's
  Single Redirect Rule — redirect rules run before Workers, so the rule must go
  for the Worker to see traffic). Steps: runbook Phase F.
- Living docs re-pointed at the new identifiers; `project-identity.md` now
  documents the (cheap) future-rename procedure; runbook gained Phases E/F and
  a reconciled user-action checklist.

**Verification:** `npm run check` green; full Playwright e2e 61 passed /
1 expected WebKit skip, both browsers (verified independently by the orchestrator).

**Gotchas:**

- `wasm-bindgen` bakes Rust crate names into `.wasm` import strings — the
  `squoosh_*` codec artifacts CANNOT be renamed without a rebuild (runbook
  Phase B; fold into the next codec upgrade; build-green is NOT sufficient,
  only e2e catches it).
- The Codex sandbox can't bind the Playwright preview-server port; e2e must be
  run outside it.

## 2026-07-05 (later) — Presk → frisp rename + Pages→Workers move

Full cutover executed in one session (naming decision + infra). See the
Postscript in `docs/presk-rename-runbook.md` for the complete record.
Key state: app lives at **frisp.app** on Cloudflare **Worker `frisp`**
(static assets, root `wrangler.jsonc`); both sqush.app and presk.app 301 to
it via the shared sunset Worker; old Pages project dormant. Brand casing:
lowercase `frisp` in UI/wordmark, "Frisp" in prose.

**Gotchas:**

- Cloudflare Pages projects can't change their `*.pages.dev` subdomain —
  that plus Workers being the recommended platform drove the move.
- Workers static assets: `_headers`/`_redirects` work as on Pages (verified
  live), but SPA fallback is `not_found_handling` serving `/index.html` —
  the adapter's `200.html` ships unused.
- Workers Builds CI not yet connected (manual `wrangler deploy` until the
  user finishes the dashboard connect step).

## 2026-07-05 (later) — E2E CI flakiness hardening

Two-layer fix after the rename push surfaced flaky e2e failures on GitHub
runners (all passed locally):
- **Systemic net** (`playwright.config.ts`): `retries: 2` on CI (0 locally, so
  real flakes still surface in dev); per-test `timeout` 90s→120s on CI for
  webkit WASM codec cold-starts.
- **Root-cause fix** (`bulk.spec.ts:166`): the "per-image override" test raced
  the options-panel re-render — selecting a cell flips the scope tab's
  aria-selected BEFORE the panel rebinds the Quality input to per-image scope,
  so a setQuality() fired in that window drops its `input` event on a
  being-replaced node (override never registers → override-dot never appears →
  full-timeout failure). Wrapped set+assert in `expect(...).toPass()` so the
  idempotent quality change re-fires once the panel settles. Verified: 12
  consecutive passes with retries OFF (was flaking ~every CI run).

Not touched: the ~15 other sub-20s per-assertion timeouts in the suite — most
are intentional stability checks (assert a value did NOT change), and retries
covers any genuine environmental flake. Don't lengthen them.

## 2026-07-07 — First-principles whole-app review

Maintainer asked for a from-scratch re-examination of every inherited decision
(Squoosh-era and migration-era). One deep manual pass over the runtime core +
four independent read-only sweeps (legacy/dead code, Svelte idioms vs current
docs, build/tooling, runtime inventory — automated read-only sweeps). Output:
`docs/first-principles-review.md` (registered in the README registry), ranked
P1–P10 with a suggested sequence. Headlines: every encode pass re-decodes the
source on the main thread (P1); the Comlink boundary structured-clones
full-res pixels up to ~5×/pass, no transferables (P2); the 2,006-line
sync-sveltekit-app.mjs generates ~480 lines of static TS and can mostly retire
(P3); bulk options seam is WebP-typed, endorsing the codec-options-model
sequencing (P4); 12 orphaned worker wrappers + 5 stale d.ts shims (P5); unit
tests don't run in CI (P7). No code changed — review only.

## 2026-07-07 — First-principles execution day (orchestrated)

The P1–P10 review became specs (WS-A…H in
docs/specs/2026-07-07-first-principles-execution.md) and 7 of 8 day-one
workstreams landed same-day, delegated implementation, orchestrator-reviewed, every one
gated by check + unit + full e2e (Chromium+WebKit):
dead code `85944296` · dedup `67b99863` · tooling/CI `5eca4145` ·
decoded-source cache `3a44a63d` · bulk drain `116928aa` · codegen retirement
`2eefc99e` (−2,357 lines net) · Svelte idioms `e120b55b` (worktree, merged
`7fd0b3d5`). Bonus regression fix `db0a696a` (vitest aliases; ZIP name).

Gotchas for future sessions:
- `codex exec` in a compound background command MUST end with `</dev/null`
  (stdin never closes → hangs at "Reading additional input from stdin...";
  the command hangs until stdin closes).
- vitest.config.ts does NOT inherit vite.config aliases — it imports the
  exported `appAliases`; keep them in sync via that export only.
- Playwright local build reuse is opt-in via PLAYWRIGHT_SKIP_BUILD=1 (`npm
  test` sets it); never make it inferred — stale build/ would test old code.
- The bench's photo-large fixture is 1 cold run — regression signal only.
- WS-H rename must go LAST (conflicts with everything); its inventory doc has
  a delta header to apply first.

## 2026-07-07 (later) — WS-D(a) + WS-G engine half land; day-one board complete

WS-D(a) transfers landed (`cf380396`; outputs byte-identical, timing deltas =
known single-cold-run bench variance, no regression). BONUS beyond day-one
scope: the WS-G options-slice ENGINE half landed (`ba6a4f8c`/`d3dd6177`) —
per-codec control registries + per-control sparse overrides; the "one tweak
freezes every option" Phase-3 blocker is fixed at the engine level, 91 unit
tests. D(b)/D(c) got FULL designs in the spec (`0d687b97`) — every remaining
review item is now zero-judgment executable: D(b), D(c), WS-G UI wiring,
WS-H rename (LAST). Deploy note: nothing deployed today; `main` is ahead of
production — `wrangler deploy` when ready.

## 2026-07-07 (later) — editor re-style lab: porcelain + darkroom experiments

Two dev-only lab routes exploring a full editor re-skin from two maintainer-
supplied reference screenshots; both are REAL editors (production
EditorSession + Output + option components under new chrome), zero
production-file changes, dev-gated like the old bulk lab. `/lab/porcelain`
(`4e0cff81`): light/airy squircle style — floating top toolbar, Image|Compare
+ Edit|Compress segmented tabs, Variations-style format grid, custom format
dropdown, `corner-shape: squircle` progressive enhancement. `/lab/darkroom`
(`7827b86f`): dense pro-tool IA — top nav bar, left icon rail opening
flyouts, inspector with eye-icon-as-enable sections (Resize/Reduce palette),
chip dropdowns, and a real session FILMSTRIP (multi-image gallery, click to
switch) previewing the bulk direction. Both theme-dynamic via
`color-scheme: light dark` + `light-dark()` tokens over the existing
`.editor-root` var contract (manual force switch included) — the blueprint
for app-wide light mode. Design doc + harvested feature ideas + pending
decision: `docs/lab-editor-restyle.md` (registry row added, `791104cd`).
Gotchas: both labs override COMPILED component class selectors under their
root class (`.controls .button`, `.results .download`, `.option-text-first`…)
— refactors of those components can silently drift the labs; check the labs
after touching editor components while the experiments live. Decision is
PENDING (maintainer to pick a direction/hybrid); losing lab code should be
deleted on promotion.

## 2026-07-07 (round 2) — hybrid experiment, /lab index, control docking, light purity

Maintainer follow-up on the re-style lab: (1) `/lab/hybrid` (`fe578225`) —
darkroom's IA in porcelain's skin; inspector uses STACKED eye-enable
sections (no tabs) and the canvas zoom cluster is CSS-docked into the bottom
filmstrip bar (one bar, no stray floating panels). (2) `/lab` card-gallery
index (`f1c44129` + squircle cards `544726d7`) — pure-CSS vignette cards
linking all three experiments. (3) Porcelain: zoom cluster moved INTO the
top toolbar (view-options popover flips downward), theme pill relocated
top-right. (4) Light-mode purity in both parents (`ac2d992a`): two-up
scrubber, snackbar, ProcessingBadge de-hardcoded via light-dark(); darkroom
range track was invisible — a bare color in a non-final background layer
invalidates the whole shorthand at computed-value time; fixed with a
flat-gradient fill layer (gotcha worth remembering). Squircle convention
confirmed by maintainer: @supports (corner-shape: squircle) + re-tuned
larger radius, plain rounding as fallback. All verified in dev preview both
modes; check clean. Decision still PENDING (start at /lab; recommendation:
hybrid). Verification gotcha: getComputedStyle sweeps right after a
color-scheme flip or HMR reload can return stale values — re-query after
settling before trusting a dark-background audit.

## 2026-07-07 (later) — porcelain lab: full Pixelmator-style CROP TOOL

Maintainer-requested crop tool, built in `/lab/porcelain` (dev-only; zero
production changes). Spec + coordinate model + API contract:
`docs/specs/2026-07-07-porcelain-crop-tool.md` (registry row added). Commits
`46cc7e27` (core) + `3c7c97b9` (panel + wiring). What shipped: crop rect
with 8 handles; rotate by dragging OUTSIDE the corners (custom cursor, 0.25°
snap, shift=15°, sticky 0); straighten slider ±45° that folds into 90°
orientation steps; rotate-90/flip buttons; move/out-of-canvas crop
(unclamped by design); Constrain menu (free, custom ratio w/ editable
fields, Original, 13 ratio presets, 2 size presets — ratio switch is
area-preserving); W/H px fields; empty-area fill (transparent default,
white/gray/black, any-color picker, sample-from-image click); 7 guide
overlays × auto/always/never (rotating auto-shows Grid); Reset/Cancel/Apply,
Esc/Enter, arrow-key nudge. Architecture: crop is a LAB-PAGE-LEVEL source
transform upstream of EditorSession — Apply renders a PNG (alpha kept) and
feeds `session.pickFiles`, so WebP/AVIF/PNG outputs keep transparency and
encoder recipes survive; NON-destructive: the page keeps `original` +
`CropSnapshot`, re-opening restores the crop over the original pixels.
Key invariants (tested, 19 new unit tests): world = R(θ)·F·(p−center),
rect axis-aligned in world AND on screen (the IMAGE rotates); rotation
pivots on the crop center (c′=R(Δ)c); apply-time pixel snap at angle 0 keeps
pure crops resample-free; `CropTool.transformEpoch` lets the stage keep the
crop center screen-anchored across rotation/flip remaps (without it the
composition jumps — see spec "If things break"). Deferred (discuss):
Perspective sliders (needs homography resampling), Auto Crop, Auto
Straighten; slider granularity is 0.5° while gesture rotation is 0.25°.
Delegation notes: Codex built overlays + geometry tests (one stdin stall —
relaunch with `< /dev/null`; it also correctly REJECTED a wrong test
assertion I suggested, matching the documented model instead); Opus built
CropPanel to the spec contract with zero API mismatches. Verified live in
preview: gestures, out-of-canvas + fills, 16:9 refit, apply→re-encode,
re-edit restore, light+dark. Gates: check 0 errors, 110 unit tests green.
