# Frisp Status

Last updated: 2026-07-12.

Read this first. Frisp is a local-first image optimizer: image work stays in the
browser, the build is static, and offline reload must work after load.

## Current State

- **Film grain v1.1 (2026-07-12, later).** Two same-day follow-ups: an
  **Advanced Size control** (1–4 px; size 2 at Amount 4–6 is the measured
  byte-efficient debanding recipe — the size experiment lives in the spec) and
  a **live scrub preview** (dragging Grain controls shows the exact
  pre-encode frame instantly; the settled encode replaces it; suppressed when
  resize/quantize would make it misleading). Gotcha that matters beyond
  grain: requestAnimationFrame never fires in non-compositing contexts —
  never use it to schedule state work.

- **Film grain SHIPPED (2026-07-12, `3db56a3e`–`7b548dea`).** New processor
  step (resize → **grain** → quantize) with a single calibrated **Amount**
  slider, live in the single editor, bulk global settings, and bulk per-image
  overrides. The grain model was measured from the maintainer's Luminar
  Neo/Pixelmator reference exports (20 synthetic + 3 real-photo pairs) and
  matches Luminar's default look 1:1 on its Amount scale: monochrome per-pixel
  white noise, σ = 0.44·amount at mid-gray, 4L(1−L) midtone parabola,
  flatter-than-gaussian samples, fixed-seed deterministic (cache/undo/bulk
  staleness contracts hold). Spec + calibration + decision record (baked
  uniform grain over codec-native synthesis, and why):
  [specs/2026-07-12-film-grain.md](specs/2026-07-12-film-grain.md). Old saved
  side-settings without `grain` default-fill on parse (`app:settings:v3`
  unchanged). Verified: unit suite (119, incl. 9 grain model tests), live
  browser check (lossless PNG output measures σ 5.31 vs 5.28 predicted at
  Amount 12; WebP/bulk/override flows exercised), full e2e both browsers.

- **Codec batch decided & specced (2026-07-11).** Four maintainer-approved
  features, each with a Codex-executable spec in docs/specs/ dated 2026-07-11:
  libjxl v0.8.5→v0.12.0 (public-API encoder rewrite — isolated branch, the one
  exception to commit-on-main), jpegli as a new codec, lossless JPEG→JXL
  transcode (blocked on the jxl upgrade), and auto-quality mode (new
  codecs/ssimulacra2 module + quality bisection to a SSIMULACRA2 target). The
  stale jpegli/transcode 'skip' verdicts in new-codec-investigation.md are
  superseded. A Frisp CLI was analyzed (docs/frisp-cli-analysis.md) —
  recommendation yes-but-after-the-batch, decision pending. Sequencing: behind
  bulk Phase 3, per docs/README.md priority table.

- **First-principles review executed (2026-07-07).** A whole-app review
  ([docs/first-principles-review.md](first-principles-review.md), P1–P10) was
  turned into an execution plan
  ([docs/specs/2026-07-07-first-principles-execution.md](specs/2026-07-07-first-principles-execution.md)
  — **execution state lives there**) and ALL day-one workstreams LANDED,
  each gated by check + unit + full e2e:
  - **Decoded-source cache** (`3a44a63d`): the editor decodes/rotates a photo
    ONCE per file; option tweaks no longer re-decode on the main thread.
  - **Bulk per-slot drain** (`116928aa`): a slow image no longer blocks the
    other worker slot.
  - **Codegen retired** (`2eefc99e`): `the retired generator script` deleted
    (net −2,357 lines); generated modules are committed source; the codec
    worker is `src/worker/codec-worker.ts`; ONE JSON record manifest
    (`src/shared/codec-asset-records.json`) feeds app + audit; `npm run sync`
    now only patches Emscripten wrappers.
  - **Dead code removed** (`85944296`), **utilities deduped** (`67b99863`),
    **tooling/CI fixed** (`5eca4145`: `typecheck` script, unit tests in CI and
    `npm test`, verbatimModuleSyntax), **Svelte idioms** (`e120b55b`:
    reactivity/window, MediaQuery, shared lightDismiss attachment).
  - **Regression found & fixed** (`db0a696a`): vitest resolved no aliases —
    10 tests silently dropped since 2026-07-05, hiding an accidental
    `frisp-` prefix on bulk ZIP names (contract restored).
  - **Worker transfers landed too** (`cf380396`, WS-D(a)): all 13
    codec-worker returns move via Comlink transfer (outputs byte-identical).
  - **WS-G engine half landed** (`ba6a4f8c`): per-codec control registries +
    per-control sparse overrides in the bulk engine — a per-image tweak no
    longer freezes the encoder's other options (91 unit tests). Phase-3 UI
    dots/resets wiring remains.
  - Fully specced for later cheap sessions (full designs in the execution
    spec): D(b) composite worker op, D(c) worker-side decode, WS-G UI item
    (control tables in specs/2026-07-07-ws-g-control-inventory.md), WS-H
    `src/engine` rename (specs/2026-07-07-ws-h-rename-inventory.md — do LAST).

- **Rename-proofing landed (2026-07-05).** The brand now lives ONLY in
  `src/shared/brand.ts` (`APP_NAME`); every internal identifier is brand-free
  (`.editor-root`, `app-generated`, `__appEmscripten*`, `registerServiceWorker`,
  SW cache `app-${version}`, localStorage `app:*` — frozen schema,
  `static/wordmark.svg`). A future rename = brand.ts + package.json + art +
  prose docs (procedure: `docs/project-identity.md`). Verified: `npm run check`
  + full e2e (61 passed / 1 expected skip). **Resolved:** the sqush.app sunset
  Worker (`infra/sqush-sunset/`) is deployed and serves the old zones with
  kill-switch service workers plus query-preserving 301s to `frisp.app`.

- **Phase 2b contextual left panel landed (2026-07-03, `06b33b3b`–
  `01bb3478`).** The single-image editor's left column now defaults to the
  shared image-info component extracted from bulk (`ImageInfoRows`: one source
  for filename-adjacent format, original size, dimensions, and inferred aspect).
  **Compare as…** summons the opt-in second encoder side; returning either by
  choosing **Original Image** in the left format select or by the close-compare
  button swaps the image-info panel back in. The mechanism is deliberately small:
  the left slot is an `ImageInfoPanel` while `sides[0].format === 'identity'`
  and the existing `OptionsPanel` otherwise — no new panel-mode state.

- **Bulk optimization Phase 2 shipped (2026-07-03, `678bb5f7`–`55c0da46`;
  spec `f341e212`).** Production bulk mode is now on the main route: picking or
  dropping 2+ supported images opens the batch editor, one image keeps the
  single-image editor unchanged, and additional imports append while bulk is
  active. The promoted engine now carries `restoreJob`, relative folder paths,
  and the keep-original-when-larger export option; the former lab modules live
  under `src/lib/bulk` as the production `BulkStore`; Stack is the only resting
  stage and `/lab/bulk` was deleted. Save all now creates a real client ZIP
  (`client-zip`) with **Keep originals when larger** on by default; folder
  import works from the picker and recursive dropped-folder traversal, preserves
  relative paths, skips dot-files, and handles >100-entry directories. Remove
  from batch offers snackbar Undo with URL revocation deferred until the removal
  settles. Tests: unit coverage grew from 63 to 76+ cases, including
  `restoreJob`, export guard, and `relativePath`; new
  `tests/e2e/bulk.spec.ts` covers multi-entry bulk, single-image regression,
  override dots, ZIP bytes, the keep-original toggle, and remove+Undo. Full
  Playwright suite green on Chromium + WebKit.

- **App typeface: Satoshi (2026-07-02, `c6ac6706`).** Chosen over Outfit and
  Geist via the bulk-lab font comparison. Self-hosted variable woff2
  (wght 300-900) + italic face in `static/fonts/`, same-origin + SW-precached
  as before; Outfit subsets removed.

- **Bulk optimization — design phase opened (2026-07-02).** Bulk is now the
  **top product priority** (maintainer decision; Multi-Format Compare moves
  after it). A full audit found the bulk **engine already complete and proven
  headless** (`src/client/lazy-app/bulk/` — ~15 pure modules: session, global
  settings + sparse per-image overrides, queue/runner, headless processor,
  import, stale-gated export, snapshots, strip/detail/summary view-models; the
  diagnostics probe runs `processBulkImageJob` end-to-end). Remaining production
  work is multi-file entry wiring (`pickFiles` keeps only `list[0]` today), ZIP,
  production-route integration, bulk e2e coverage, and promotion from the dev
  lab. **Phase 0 unit safety net landed 2026-07-02:** Vitest +
  `npm run test:unit`, scoped to `tests/unit/`, with 63 passing
  bulk-engine/helper cases covering the [test-plan.md](test-plan.md) §4 top-8
  targets plus the new normalized per-job staleness contract. UI design options
  + phased roadmap: [bulk-ui-design-options.md](bulk-ui-design-options.md).
  Current dev lab at `/lab/bulk`: one consolidated UI with the rich strip
  (L/M/S sizes) + Stack resting stage (grid mode was tried and removed,
  `a100891d`), one engine-backed store, two persistent WebP worker bridges,
  real encodes, per-image and multi-select overrides with dot signaling +
  per-control reset, and an image-info panel with inferred aspect ratio. The lab now
  mirrors the production editor's no-wasted-work discipline: normalized
  per-job recipe hashes, percentage resize resolved per image, per-job output
  cache, debounced override/global applies, and delayed working badges. **Phase
  2 has since shipped; see the 2026-07-03 entry above.** The promotion spec was
  written (2026-07-02):
  [specs/2026-07-02-bulk-phase-2-promotion.md](specs/2026-07-02-bulk-phase-2-promotion.md)
  and is now executed. **The Phase-2b spec is written too**
  ([specs/2026-07-02-phase-2b-contextual-left-panel.md](specs/2026-07-02-phase-2b-contextual-left-panel.md)):
  the single editor's left column becomes the shared image-info panel +
  "Compare as…" opt-in second side, reusing the bulk components — runs after
  Phase 2.

- **Review-hardening follow-ups (2026-07-02), landed on `main`.** Closes the
  gaps the batch below exposed. (1) **CI now runs the full Playwright e2e suite**
  on every push/PR (`156b1bf0`, new `e2e` job, ubuntu, chromium + webkit with
  browser caching; the webServer builds + previews the production app itself) —
  this is the fix for the resize.spec silent-red failure mode. (2) `npm run
  check` is fully clean: `@types/node@24` installed to satisfy the generated
  tsconfig's `"types": ["node"]` (`9f9a82a4`) — 0 errors, 0 warnings. (3) New
  `tests/e2e/editor-interactions.spec.ts` (`ed1b4d7e`) locks in the batch's
  invariants: undo restores the EXACT prior blob URL (cache hit, not re-encode),
  typed slider values clamp to min/max, divider keys ignore focused controls —
  3/3 both browsers; full suite 41 passed / 1 known webkit-offline skip.
  (4) **Benchmark verdict: no codec regressions from the encode-core changes** —
  vs the post-threading capture (results/threaded.json), AVIF/JXL/MozJPEG/OxiPNG
  are byte-identical on all 9 fixtures and real encode times are within the
  harness's 12% noise; all `bench:compare` "regressions" trace to last month's
  intentional WebP defaults change (`e184882f`) and AVIF threading tiling
  (`e9b1be6c`) against the STALE committed baseline (2026-06-02 — the
  README-mandated post-threading re-baseline never happened). **Known gap:** the
  bench's warm runs now hit the in-session ResultCache (uniform 9ms poll ticks,
  not encodes), so the harness can't measure warm encodes — or the
  persistent-bridge win — until it busts the cache (e.g. vary a no-op option per
  run or reload between runs). Fix the methodology first, THEN re-baseline;
  baseline was deliberately NOT refreshed (it would bake cache-hit artifacts
  into the timing reference).

- **Review-hardening batch (2026-07-02), landed on `main`.** A full code review
  of the June 11 – July 1 window, executed via
  [history/review-hardening-plan.md](history/review-hardening-plan.md). Four threads.
  _(1) Encode-core performance:_ each side now keeps a **persistent worker
  bridge** (`cbb6c9a5`) — no more tearing down and rebuilding a Worker + WASM
  instance + pthread pool on every debounced slider tweak — and the two sides
  **dedup in-flight encodes** (`be978a9c`): when both sides request the same
  signature, they share one job, and a completed-but-aborted pass now feeds the
  result cache instead of racing a URL revoke. _(2) Correctness:_ typed slider
  values clamp to `[min, max]` before they reach options state / the signature /
  localStorage / the WASM encoder (`0f034a78`); the two-up divider `1`/`2`/`3`
  keys no longer fire from unrelated focused controls — they act only when focus
  is on the viewer or nowhere and no modifier is held (`5a10b838`, logged in
  [parity-audit.md](parity-audit.md) §A.16); the service worker ignores
  cross-origin GETs so third-party requests pass straight through (`9ac1886f`).
  _(3) Robustness / structure:_ one canonical stable-stringify signature is now
  **shared by the cache and the history** so "undo is instant" can't drift out of
  sync (`da273584`); a redundant `restoringHistory` guard was removed
  (`4217ef77`); `localStorage` persistence was extracted to
  `settings-storage.ts` with frozen wire formats (`89e69bb0`); and a per-side
  `SideRuntime` object replaced eight parallel same-shape tuples (`5c68787d`).
  _(4) Test debt:_ `resize.spec.ts` had been silently red since `abebdfaf` (the
  option re-tiering hid the Method select behind AdvancedSection); repaired
  (`1009a486`). Verification: `npm run check` 0 errors; full Playwright suite
  green on both browsers (35 passed, 1 known webkit offline-config skip); scripted
  interactive smoke — slider spam re-encodes responsively, undo restores instantly
  from the cache, no console errors.

- Older entries were moved to [history/status-archive-pre-2026-07.md](history/status-archive-pre-2026-07.md).
