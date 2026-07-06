# Frisp Status

Last updated: 2026-07-07.

Read this first. Frisp is a local-first image optimizer: image work stays in the
browser, the build is static, and offline reload must work after load.

## Current State

- **First-principles review executed (2026-07-07).** A whole-app review
  ([docs/first-principles-review.md](first-principles-review.md), P1–P10) was
  turned into an execution plan
  ([docs/specs/2026-07-07-first-principles-execution.md](specs/2026-07-07-first-principles-execution.md)
  — **execution state lives there**) and 7 of 8 day-one workstreams LANDED,
  each gated by check + unit + full e2e:
  - **Decoded-source cache** (`3a44a63d`): the editor decodes/rotates a photo
    ONCE per file; option tweaks no longer re-decode on the main thread.
  - **Bulk per-slot drain** (`116928aa`): a slow image no longer blocks the
    other worker slot.
  - **Codegen retired** (`2eefc99e`): `scripts/sync-sveltekit-app.mjs` deleted
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
  - In flight: WS-D(a) worker→main Comlink transfers (bench-gated). WS-G
    options-slice engine half is implemented in `ws-g-engine` but not landed:
    registry + sparse merge are done, Phase-3 UI wiring is still out of scope,
    and check + unit + full e2e are green in that worktree. Fully specced for
    later cheap sessions: D(b) composite worker op, D(c) worker-side decode,
    WS-G UI item (bulk dots/resets wiring; control tables in
    specs/2026-07-07-ws-g-control-inventory.md), WS-H `src/engine` rename
    (inventory in specs/2026-07-07-ws-h-rename-inventory.md — do LAST).

- **Rename-proofing landed (2026-07-05).** The brand now lives ONLY in
  `src/shared/brand.ts` (`APP_NAME`); every internal identifier is brand-free
  (`.editor-root`, `app-generated`, `__appEmscripten*`, `registerServiceWorker`,
  SW cache `app-${version}`, localStorage `app:*` — frozen schema,
  `static/wordmark.svg`). A future rename = brand.ts + package.json + art +
  prose docs (procedure: `docs/project-identity.md`). Verified: `npm run check`
  + full e2e (61 passed / 1 expected skip). **Open:** the sqush.app sunset
  Worker (`infra/sqush-sunset/`) is built but NOT deployed — user must run the
  deploy + disable the zone's Single Redirect Rule (runbook Phase F), else old
  sqush.app visitors stay pinned to the cached old app forever.

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
  [review-hardening-plan.md](review-hardening-plan.md). Four threads.
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

- **Preview toggles grouped into a "View options" popover (2026-06-28), landed on
  `main`.** The two preview-only display toggles — smoothing
  (`image-rendering: pixelated`) and the alternate background — no longer sit
  permanently on the output control bar next to zoom/rotate. A single **View
  options** pill (next to Rotate) now opens a small popover holding both. Both are
  preview-only (they change what you see, not the saved file) and low-frequency —
  smoothing is a no-op until you zoom past 1:1 — and grouping them also removes a
  cross-browser wart: the smoothing toggle is omitted on Safari, which used to give
  the bar a different button count there (the popover absorbs it). State and canvas
  wiring are unchanged; added a dirty dot on the trigger (so a changed setting
  stays visible while the popover is closed) plus light-dismiss (outside-
  `pointerdown` + Escape, focus returned to the trigger), each row reflecting state
  via `aria-pressed`. `Output.svelte` only; commit `cadfaa16`; deviation logged in
  [parity-audit.md](parity-audit.md) §A.15; user-guide + reference reconciled. `npm
  run check` 0/0; browser-verified desktop + mobile (toggles apply to both
  canvases, click-outside + Escape dismiss, no clipping at 375px, no console
  errors).

- **Undo/redo + instant result cache (2026-06-28), landed on `main`.** The editor
  gained backward/forward history over the editable document (`{ sides,
  preprocessorState }`) plus a shared, memory-bounded cache of finished encodes —
  so returning to any recipe you've tried (Undo/Redo, toggling Lossless back off,
  or one side matching the other) is **instant** instead of a re-encode. New
  `EditorHistory` (`src/lib/editor/editor-history.svelte.ts` — `$state.raw`
  history + derived `canUndo`/`canRedo`, signature-deduped) and `ResultCache`
  (`src/lib/result-cache.ts` — LRU keyed by the encode signature, **shared across
  both sides** since a result is a pure function of its inputs, byte-budgeted with
  displayed results pinned). `EditorSession` wires a debounced history watcher +
  `undo`/`redo`, and `encodeSide` serves cache hits synchronously (the old
  single-slot `encodedSig`/`lastUrls` are subsumed; the cache owns object-URL
  lifecycle). UI: Undo/Redo glass buttons beside Back + `⌘/Ctrl+Z` and
  `⇧⌘Z`/`Ctrl+Y`, suppressed in typeable fields. History is per-image (reset on
  load). Deviation logged in [parity-audit.md](parity-audit.md) §A.14; user-guide
  + reference reconciled. Svelte MCP docs consulted + autofixer clean. `npm run
  check` 0/0; browser-verified (≈470ms encode vs ≈20ms cached return; undo/redo +
  cross-side copy instant; no console errors).

- **Resize Method dropdown trimmed (2026-06-28), landed on `main`.** The Method
  picker dropped from nine options to four distinct scalers — **Lanczos3** (photos),
  **Mitchell** (graphics / less ringing), **hqx** (pixel-art upscale), **Browser
  pixelated** (nearest neighbour), plus **Vector** (auto for SVG). The three browser
  quality levels (`browser-low/medium/high`) were removed outright (lower quality
  than the worker filters, inconsistent across machines); Catmull-Rom and Triangle
  are no longer offered but stay in the worker code path (`catrom` finishes an hqx
  pass). Commits `d07aed17` (UI) + `5404d783` (types/code); deviation logged in
  [parity-audit.md](parity-audit.md) §A.13; user-guide + reference reconciled.
  `svelte-check` 0/0; browser-verified (dropdown shows exactly four options;
  Premultiply/Linear RGB show for Lanczos3, hide for Browser pixelated; a
  browser-pixelated resize re-encodes cleanly, no console errors).

- **Option-panel re-tiering (2026-06-28), landed on `main`.** Every encoder/
  processor panel now reads **headline knobs → Advanced** consistently: the mode
  toggle, Quality, and Effort stay up front; the expert surface folds under the
  shared `AdvancedSection`. JXL gained an Advanced fold it never had (all its
  lossy tuning was inline); WebP now leads Quality→Effort and tucks "Preserve
  transparent data" away in lossy mode; AVIF's Effort moved above Advanced; Resize
  folds Method + Premultiply + Linear RGB; OxiPNG leads with Effort. Ported from
  the "Modern UI redesign 2" branch idea but made consistent (the branch left AVIF
  out) and kept integer-only Quality. Commit `abebdfaf`; deviation logged in
  [parity-audit.md](parity-audit.md) §A.12; user-guide reconciled. `svelte-check`
  0/0; all panels browser-verified (collapsed + expanded).

- **Quality sliders integer + magnetic snapping (2026-06-28).** Landed on
  `main` via PR #6 (merge `b1effc61`; follow-ups `59781001`, `b9940949`). (1) The WebP, JXL, and generic-fallback
  Quality sliders dropped `step=0.1` → whole numbers (AVIF/MozJPEG were already
  integer); JXL Quality max is now **99** (was `99.9`); Lossless is still the only
  path to 100. (2) `Range.svelte` adds subtle magnetic snapping toward multiples
  of 5/10 while dragging, auto-enabled on wide sliders (`max − min ≥ 50`); the
  warp is monotonic so neighbours stay reachable and the number field is the exact
  escape hatch — narrow knobs keep the plain native drag. Commits `391b45d5` +
  `59781001`; deviation logged in [parity-audit.md](parity-audit.md) §A.11;
  user-guide reconciled. `npm run check` green; browser-verified (89.3→90,
  84.7→85, 83.0→83, no console errors).

- **Resize UX cleanup (2026-06-28).** Three small editor changes landed on `main`:
  (1) size presets are now **shrink-only** — `0.25 / 0.5 / 1` (25 / 50 / 100%); the
  enlarge presets (`200 / 300 / 400%`) and the awkward `33.33%` were dropped, since
  Frisp is an optimizer, not an upscaler (enlarging stays reachable via Custom
  Width/Height). (2) The in-progress pill reads **"Resizing…"** when a real resize
  drives the pass, vs "(Re-)optimizing" otherwise. (3) A resize at **100% is a true
  no-op** — `processImage` skips the identity resample and `encodeSide` skips the
  whole re-encode when the effective request is unchanged, so enabling Resize (or
  toggling Premultiply/Linear RGB, or switching method, Mitchell included) at 100%
  does nothing. Commits `6a50f8bb` / `3741fe2b` / `059251c5` / `4a2a4af6`;
  deviation logged in [parity-audit.md](parity-audit.md) §A.10; user-guide +
  reference reconciled. `svelte-check` green; browser-verified.

- **Editor port re-audit + resize-compare fix (2026-06-28).** A user-reported
  regression — resizing the output made the two-up compare "resize in place" so
  the split stopped aligning — traced to the contain-alignment commit narrowing
  the original's _unconditional_ canvas-box pinning to the `contain` fit method
  only. Fixed: the box is pinned to the source dims for _all_ resizes again, with
  `object-fit: contain` only on a Contain side (commit `596661e2`, + an e2e
  footprint guard `resize-twoup-footprint.spec.ts`). A 3-agent re-audit (display /
  options / session layers) found **no other major regression**. Also: the
  `0.3333` resize preset shows `33.33%` again (commit `3341bdb0`; that preset was
  **later removed** — see the resize-UX cleanup below), and the deliberate
  "in-place replace resets rotation + palette but keeps the encoder recipe"
  decision is pinned in a `pickFiles` comment (commit `984788b1`).
  Deviation + audit logged in [parity-audit.md](parity-audit.md) (§A.9 + the
  2026-06-28 re-run); user-guide reconciled. `svelte-check` green; resize e2e
  specs pass.

- **UI redesign (2026-06-11): the "studio" theme.** The whole interface was
  restyled — floating glass option panels, coral/azure per-side accents
  (replacing the ported Squoosh pink/blue), a results footer with a semantic
  size-delta badge + "Save" pill (replacing the speech-bubble/blob), glass
  toolbar + hairline two-up divider, Outfit Variable typography, and a new
  landing hero (gradient headline, coral browse disc, codec chips). Pure
  re-skin: no feature/behavior changes; the per-side
  `--main-theme-color`/`--hot-theme-color` contract and the 12px-root rem
  sizing are preserved. Deviation logged in
  [parity-audit.md](parity-audit.md) §A.8; user-guide visual references
  updated. `npm run check` green; browser-verified desktop + mobile.

- The SvelteKit 2 / Svelte 5 migration is **concluded**. `main` is the
  production app at the repo root (not in `prototypes/sveltekit/`).
- The original Preact/Rollup app is preserved on the `preact` branch (tag
  `preact-final`) for reference only — it is no longer a fallback for `main`.
  There is a single working tree at the repo root; the `svelte` branch and the
  `../Frisp-svelte` worktree are gone.
- The current track is **post-migration cleanup and Svelte hardening**: remove
  dead Preact-era code, make ported components fully idiomatic Svelte 5, and fix
  the defects found by the post-migration review. Prioritized backlog:
  [svelte-hardening-plan.md](svelte-hardening-plan.md).
- Bulk UI is not part of this cleanup. Bulk and other product additions are
  tracked in [road-map.md](road-map.md).
- Repo hygiene (2026-06-01): the ambient Emscripten type declaration now lives
  at `src/emscripten-types.d.ts`, alongside the other `src/*.d.ts` ambient
  files, instead of sitting loose at the repo root (its `///` reference in
  `src/app.d.ts` was updated to match). Disposable local scratch
  (`.playwright-cli/`, `.tmp/`, stray `.DS_Store`) was also cleared. The type
  move is compile-time only, so build output is unchanged and `npm run check`
  stays green.
- Root cleanup (2026-06-02): pruned inherited-from-Squoosh and team-oriented
  cruft now that this is a solo project. **Removed:** `renovate.json` (a
  disabled Renovate-bot config that did nothing), `CONTRIBUTING.md` (Google's
  CLA boilerplate, inaccurate for this fork), and `.github/ISSUE_TEMPLATE/`
  (generic Squoosh-era templates). **Removed the old Husky + lint-staged
  pre-commit hook** (`.husky/`, the `husky`/`lint-staged` devDeps, the
  `prepare` script, and the `lint-staged` config): that hook auto-ran
  `prettier --write` on every commit and its **Markdown reflow** kept mangling
  docs (it caused the earlier fix `a196f252`). Also **dropped `md` from the
  `format`/`format:check` globs** in `package.json` so Prettier no longer
  reflows Markdown at all. Current state: commit `7b16e0ce` (2026-07-01)
  reinstated a **code-only** pre-commit hook via `simple-git-hooks` +
  `lint-staged`, installed by `scripts/install-git-hooks.mjs` on the npm
  `prepare` script. It runs `prettier --write` only on staged
  `*.{js,css,json,ts,tsx,svelte}` files; `*.md` remains deliberately excluded
  from the hook and all Prettier scripts. Markdown is hand-formatted. CI's
  `format:check` is now its own GitHub Actions job. `.clang-format`,
  `.editorconfig`, `.gitattributes`, and `.nvmrc` were kept (small,
  conventional, and `.nvmrc` is used by CI). `npm run check` / `format:check`
  stay green.

- Codec audit (2026-06-02): a full codec version + landscape audit ran (see
  [codec-upgrade-audit.md](codec-upgrade-audit.md)). Several outcomes have now
  **landed and are merged into `main`** (via the former
  `codec-cleanup-and-threading` / `codec-rebuilds` branches, now deleted):
  - **Cross-origin isolation DONE & verified (commits `27ae8b88`, `09f08f22`).**
    COOP `same-origin` + COEP `require-corp` ship via a Vite middleware plugin
    (dev + preview) and `static/_headers` (host). Verified in the production
    preview: `self.crossOriginIsolated === true`, `SharedArrayBuffer` available —
    and the e2e suite now **asserts** it so it can't regress. (The threaded
    `_mt` runtime was still stubbed at the time of this entry; MT threading has
    since landed and been verified — see the 2026-06-03 threading entry and
    [threading-enablement.md](threading-enablement.md).)
  - **WebP 2 removed completely (commit `962bdd0f`)** — encoder and decoder,
    `codecs/wp2/`, the features/options wiring, and all data-driven references.
    See [codec-surface-cleanup.md](codec-surface-cleanup.md).
  - **Dead code deleted (commit `7bd03980`)** — `codecs/png/`, `codecs/visdif/`,
    and the orphan `src/client/lazy-app/storage.ts`. See
    [codec-surface-cleanup.md](codec-surface-cleanup.md).

  - **Automated test harness added (commit `97eaaf3c`).** A Playwright e2e suite
    (`tests/e2e/`, `npm run test:e2e`) boots the production preview cross-origin
    isolated and encodes through every codec asserting valid output bytes, plus
    offline reload. This is the regression net for the codec rebuilds — run it
    after each one. `npm test` now runs `check` + e2e.

- Codec rebuilds (2026-06-02): **✅ all 7 WASM codecs have been rebuilt/upgraded
  and merged into `main`.** The audit's "do-now"
  security-driven rebuilds and the gradual upgrades all landed in one sweep,
  built **natively with emsdk 3.1.0 + rustup nightly (no Docker, no sudo)**:
  - **imagequant** 2.12.1 → 2.18.0 (byte-identical; security/quality)
  - **libwebp** pre-1.2.0 commit → v1.6.0 (CVE-2023-4863; byte-identical output)
  - **libavif** 1.0.1 → 1.4.2 + **libaom** 3.7.0 → 3.12.1 (CVE-2024-5171 CVSS 9.8;
    zero size regression, 6–13% faster encode)
  - **libjxl** pre-0.7 commit → v0.8.5 (CVE-2023-0645, CVE-2023-35790,
    CVE-2025-12474; CVE-2026-1837 is LCMS2-only and the build uses skcms, so N/A;
    result: 3–6% smaller + 2–9% faster)
  - **oxipng** 9.0.0 → 10.1.1 (byte-identical at default preset; value is
    robustness + fast-mode/ICC fixes)
  - **mozjpeg** 3.3.1 → 4.1.5 (9 CVEs from the libjpeg-turbo 2.x base; compression
    intentionally unchanged = byte-identical; build moved autotools → CMake)
  - **resize** 0.5.5 → 0.8.9 (Rust; ahead of both Squoosh and jSquash, which pin
    0.5.5)

  **Verified by the full 17-test Playwright e2e suite + the benchmark
  (`npm run bench` / `bench:compare`) — no regressions.** The benchmark fixture
  corpus was expanded 4 → 9 (added gradient, gradient-dithered, hard-edges,
  noise-synthetic, screenshot). The deep engineering record of HOW each codec was
  built (toolchains, gotchas, bugs) lives in
  [codec-build-notes.md](codec-build-notes.md). The
  [new-codec-investigation.md](new-codec-investigation.md) records a
  researched-but-not-added shortlist (SVGO first, HEIC-decode later, jpegli /
  JPEG→JXL skip). Full docs map: [README.md](README.md).

- MT threading (2026-06-03): **ALL THREE threaded codecs now thread multi-core —
  oxipng, AVIF, JXL — LANDED, VERIFIED, and merged into `main`.**
  - **oxipng (wasm-bindgen-rayon):** the threaded `pkg-parallel` wasm now ships a
    shared+imported `WebAssembly.Memory` (`flags=0x03`). Fix = the full explicit
    linker set (`--shared-memory`/`--max-memory`/`--import-memory` + TLS exports +
    `__heap_base`); current nightlies no longer auto-emit shared memory from
    `+atomics` alone.
  - **AVIF + JXL (Emscripten pthreads):** the JS wiring (`?url` assets +
    `mainScriptUrlOrBlob`) PLUS a codec build fix — the `_mt` builds had **no
    pre-spawned pthread pool**, so the encode deadlocked spawning threads
    on-demand while blocked on `Atomics.wait`. Fix = relink the `_mt` wrappers with
    `-sPTHREAD_POOL_SIZE=navigator.hardwareConcurrency`.
  - Verified by `tests/e2e/oxipng-threads.spec.ts` +
    `tests/e2e/emscripten-threads.spec.ts`: **full worker pool in Chromium (11 on
    an 11-core machine for each codec), no fallback in WebKit**, single-thread
    fallback intact (full e2e green in both engines). Diagnosis + recipes:
    [threading-enablement.md](threading-enablement.md),
    [codec-build-notes.md](codec-build-notes.md).

- Dev-env + editor UX (2026-06-03):
  - **Threaded codecs now work under `vite dev`.** They were ~50× slower / stalled
    in the dev server (fast in prod) because `vite dev` injects an ESM
    `/@vite/client` import into the **classic** Emscripten pthread worker
    (`*_mt.worker.js`), breaking the pool. Fixed with a dev-only
    `presk-raw-threaded-codec-workers` Vite plugin that serves those workers raw.
    NOT a commit regression (dev-vs-prod; the live version under `vite dev` would
    behave the same). Detail: [threading-enablement.md](threading-enablement.md).
  - **Editor preview never goes blank + per-side "Optimising…/Re-optimising…"
    badge.** Restored the original source-fallback (a side shows the loaded image
    until it has its own result) and added a single consistent in-progress badge
    (no blur). See [parity-audit.md](parity-audit.md) §A.
  - **WebP default → Quality 80 / Effort (method) 6** (from upstream 75/4); the
    persisted-settings key was bumped `v2 → v3` so stale saved side-settings are
    discarded and the fresh default (left = Original, right = WebP) loads.
- Performance pass (2026-06-10), all landed on `main`:
  - **Variant-aware service-worker precache** — first-visit payload **14.27 MB →
    6.82 MB** (52% less). The SW used to blanket-cache every Vite-emitted asset
    (both MT and single-thread codec builds, SIMD and baseline, all decoders);
    it now feature-detects at install (threads/SIMD via `wasm-feature-detect`,
    native AVIF/WebP decode via tiny `createImageBitmap` probes) and precaches
    only the variants that browser runs. Unselected variants stay runtime-cached
    on first use. `src/sw/cache-plan.ts` was rewritten as the selection module
    (the dead Squoosh entry-data modeling is gone). Details in
    [build-and-runtime.md](build-and-runtime.md).
  - **Duplicate SW-build worker chunks eliminated** — the SW import graph had
    `?worker&url` imports that made the SW Vite build re-emit the 232 kB
    features-worker + probe workers as dead `assets/*.js` (precached, never
    fetched by the page). The SW now consumes a curated generated records module
    (`codec-assets/service-worker.ts`); `audit:static-output` asserts no such
    duplicates. **Gotcha discovered:** SvelteKit's SW build ignores the app's
    `assetsInlineLimit`, so sub-4 kB assets imported into the SW graph inline as
    `data:` URLs (which `cache.addAll` rejects) — that's why the rotate WASM and
    pthread `*_mt.worker.js` stubs are excluded from the records and precache
    with the app shell instead.
  - **svelte-check 4.3.4 → 4.6.0** — 4.3.4's bundled volar calls the removed
    internal `program.forEachResolvedModule` under TypeScript 6 and crashes with
    `TypeError: forEachResolvedModule is not a function` whenever a diagnostic's
    code-fix path runs (e.g. a bad named import anywhere). 4.6.0 fixes it.
  - **Landing/runtime smoothness:** `logo.webp` 512 px/56 kB → 176 px/7 kB
    (renders at 88 CSS px); the blob animation no longer does per-frame layout +
    style reads or per-frame canvas reallocation (geometry cached, refreshed by
    ResizeObserver); the codec worker idle-terminate went 10 s → 60 s so slider
    tweaks after a pause don't pay a WASM + pthread-pool cold start.
  - **Dead sw-bridge surface deleted** — `createServiceWorkerBridge`
    (`share-ready`/`skip-waiting`/`cache-all`) and `sw-bridge/support.ts` had no
    callers and no SW message handlers; only `registerServiceWorkerUrl`
    survives. This closes the "Legacy service-worker / cache surfaces" deferred
    item in [svelte-hardening-plan.md](svelte-hardening-plan.md).
  - Verified end to end: `npm run check` green, full Playwright e2e (41 passed,
    1 pre-existing WebKit offline-harness skip), preview cache audit confirming
    the 6.82 MB selection in Chromium.
- **Writing the articles** (migration + codec sweep): the task/problem/solution
  source material is in [journey-and-article-notes.md](journey-and-article-notes.md).

## Product Scope For Launch

The root app preserves the existing single-image optimizer:

- import by file picker or drag/drop;
- local decode, preprocess, resize, quantize, encode, preview, and download;
- two-up before/after output with zoom, pan, split, backgrounds, and rotate;
- per-side output format and option panels;
- saved per-side encoder settings;
- static output through SvelteKit adapter-static;
- SvelteKit-native service worker and codec/WASM precache;
- WebP, AVIF, JPEG XL, MozJPEG, and OxiPNG.

WebP remains the first production focus, AVIF second, JPEG XL advanced. **WebP 2
has been removed** (branch commit `962bdd0f`) — the codec audit confirmed it is a
permanently-experimental format no browser can decode, so it was dropped end to
end rather than kept for the now-closed migration parity (see
[codec-surface-cleanup.md](codec-surface-cleanup.md)).

## Active Architecture

- `src/routes/+page.svelte` — single-image optimizer route.
- `src/routes/diagnostics/+page.svelte` — runtime diagnostics for generated
  workers, WASM assets, pipeline probes, and shared helpers.
- `src/lib/editor/editor-session.svelte.ts` — rune-backed editor state and
  encode orchestration.
- `src/lib/editor/editor-history.svelte.ts` — undo/redo history stack
  (signature-deduped snapshots in `$state.raw`).
- `src/lib/result-cache.ts` — LRU cache of finished encodes, shared across sides;
  makes undo/redo and revisiting a recipe instant.
- `src/lib/editor/options/` — Svelte option controls and per-format panels.
- `src/lib/editor/output/` — two-up output view and local pointer/zoom helpers.
- `src/lib/compress.ts` — Svelte adapter over the shared image pipeline.
- `src/lib/sveltekit-worker-bridge.ts` — SvelteKit worker bridge over generated
  worker metadata.
- `src/client/lazy-app/image-pipeline*` — framework-neutral single-image engine.
- `src/client/lazy-app/bulk/` — framework-neutral bulk helpers for future work.
- `src/features/**` — codec metadata, client runtimes, and worker runtimes.
- `src/shared/codec-assets.ts` — build-tool-neutral codec asset records.
- `scripts/sync-sveltekit-app.mjs` — generates
  `.svelte-kit/app-generated/*`.
- `scripts/audit-static-output.mjs` — verifies emitted worker/WASM output.
- `src/service-worker.ts` — SvelteKit service worker.

Generated files live under `.svelte-kit/app-generated/` and are not
committed. Run `npm run sync` or `npm run check` to regenerate them.

## Commands

From the repo root:

```sh
npm install
npm run dev
npm run build
npm run preview
npm run check       # static gate
npm run test:e2e    # browser regression (Playwright; builds + previews)
npm test            # check + e2e together
npm run audit
```

`npm run check` is the static gate: formatting check, generator sync, SvelteKit
sync, `svelte-check`, production build, and static-output audit. `npm run
test:e2e` is the browser regression net (`tests/e2e/`): it boots the production
preview cross-origin isolated and encodes through every codec asserting valid
output, plus offline reload — **run it after any codec or build change.**

## Verification State

Current local verification:

- `npm install` pruned the old Rollup/Preact graph and produced a clean audit.
- `npm run sync` regenerates the SvelteKit metadata and codec wrapper copies.
- `svelte-check --tsconfig ./tsconfig.json` is green after the root move.
- `npm run check` passes: formatting, generator sync, SvelteKit sync,
  `svelte-check`, production build, and static-output audit.
- `npm run audit` reports 0 vulnerabilities.
- Production preview smoke on `http://127.0.0.1:5189/` passes with Playwright:
  PNG to WebP, JPEG/SVG/WebP inputs to WebP, desktop load, `390 x 844` mobile
  viewport with no horizontal overflow, controlled service worker, offline
  reload, and no console/page errors. (This smoke predates the WebP 2 removal;
  the old "PNG to WebP 2" case no longer applies.)
- Svelte MCP docs were consulted for project structure, adapter-static,
  service workers, `$service-worker`, config, `.svelte.ts` modules, and Svelte 5
  best practices.
- Svelte MCP autofixer reports no hard issues for the edited route/editor
  components. Remaining suggestions are DOM/canvas effects that are intentional
  side effects.

A post-migration read-only review (two independent passes) confirmed the
migration is idiomatic at the surface — no `createEventDispatcher`, `on:`
directives, `export let`, `$:`, or `writable()` stores. The remaining work is
hardening, captured in [svelte-hardening-plan.md](svelte-hardening-plan.md).

## Next Actions

The Svelte hardening waves are essentially **done** (Waves 0–2, 4–6 landed;
Wave 3 promoted to the [codec-options-model.md](codec-options-model.md) project).
Only Wave 2b (explicit `options` ownership) and a few deferred items remain in
[svelte-hardening-plan.md](svelte-hardening-plan.md). The active priority order
is now the codec-audit fallout — see [README.md](README.md) for the one-screen
priority view.

**Merged into `main`** (from the former `codec-rebuilds` /
`codec-cleanup-and-threading` branches, now deleted): all 7 WASM codecs rebuilt
natively; WebP 2 removed; dead code (`codecs/png/`, `codecs/visdif/`,
`storage.ts`) deleted; cross-origin isolation (COOP/COEP) **and** the full MT
threading runtime — oxipng, AVIF, JXL all verified threading multi-core in
Chromium + WebKit. (Active uncommitted/branch work is the
`dev-threading-and-editor-ux` branch: the `vite dev` threaded-worker fix, the
editor preview UX, and the WebP 80/6 default.)

What's next, in short:

1. ✅ **Multithreading — DONE.** All three threaded codecs (oxipng, AVIF, JXL)
   thread multi-core in Chromium + WebKit, verified, single-thread fallback intact.
   [threading-enablement.md](threading-enablement.md).
2. ✅ **Codec security rebuilds + gradual upgrades — DONE** (all 7 codecs merged
   into `main`; see the Current State entry above). Build details:
   [codec-build-notes.md](codec-build-notes.md). Audit/why:
   [codec-upgrade-audit.md](codec-upgrade-audit.md).
3. **Investigate new codecs** — researched, not added:
   [new-codec-investigation.md](new-codec-investigation.md) (SVGO first,
   HEIC-decode later, jpegli / JPEG→JXL skip).
4. **Product features** — Multi-Format Compare, then bulk — see
   [road-map.md](road-map.md).

## Gotchas

- Do not add bulk UI as part of migration cleanup.
- WebP 2 is **gone** (branch commit `962bdd0f`, encoder + decoder); do not
  resurrect it. The removal record is in
  [codec-surface-cleanup.md](codec-surface-cleanup.md).
- Multithreading is **done and verified** (Chromium + WebKit, e2e-protected) —
  COOP/COEP isolation + all three threaded codecs engaging multi-core. One
  caveat: under `vite dev` the classic Emscripten pthread workers must be served
  raw, or they stall (~50× slower). The `presk-raw-threaded-codec-workers` plugin
  in `vite.config.ts` handles this; don't remove it. See
  [threading-enablement.md](threading-enablement.md).
- Do not touch `codecs/**` without codec provenance, build, service-worker, and
  browser verification. The 2026-06-02 codec rebuilds were built **natively with
  emsdk 3.1.0 + rustup nightly (no Docker, no sudo)** and are now merged into
  `main` — the build record is in
  [codec-build-notes.md](codec-build-notes.md); the per-codec runbooks
  ([codec-upgrade-runbooks.md](codec-upgrade-runbooks.md)) are now historical.
- Preview browsers can keep old service workers. If behavior looks stale, clear
  site data or use a fresh context.
