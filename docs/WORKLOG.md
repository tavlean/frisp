# Worklog

Short session-by-session build log: what changed, why, and the gotchas a future
session must know. Newest first. (Live project state stays in
[STATUS.md](STATUS.md); this is the narrative trail.)

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
