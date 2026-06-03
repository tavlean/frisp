# Sqush Status

Last updated: 2026-06-03.

Read this first. Sqush is a local-first image optimizer: image work stays in the
browser, the build is static, and offline reload must work after load.

## Current State

- The SvelteKit 2 / Svelte 5 migration is **concluded**. `main` is the
  production app at the repo root (not in `prototypes/sveltekit/`).
- The original Preact/Rollup app is preserved on the `preact` branch (tag
  `preact-final`) for reference only — it is no longer a fallback for `main`.
  There is a single working tree at the repo root; the `svelte` branch and the
  `../Sqush-svelte` worktree are gone.
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
  (generic Squoosh-era templates). **Removed the Husky + lint-staged pre-commit
  hook entirely** (`.husky/`, the `husky`/`lint-staged` devDeps, the `prepare`
  script, and the `lint-staged` config): the hook auto-ran `prettier --write` on
  every commit and its **Markdown reflow** kept mangling docs (it caused the
  earlier fix `a196f252`). Also **dropped `md` from the `format`/`format:check`
  globs** in `package.json` so Prettier no longer reflows Markdown at all.
  Formatting is now manual via `npm run format` (or editor format-on-save);
  nothing rewrites files mid-commit. `.clang-format`, `.editorconfig`,
  `.gitattributes`, and `.nvmrc` were kept (small, conventional, and `.nvmrc` is
  used by CI). `npm run check` / `format:check` stay green.

- Codec audit (2026-06-02): a full codec version + landscape audit ran (see
  [codec-upgrade-audit.md](codec-upgrade-audit.md)). Several outcomes have now
  **landed on the `codec-cleanup-and-threading` branch** (not yet on `main`):
  - **Cross-origin isolation DONE & verified (commits `27ae8b88`, `09f08f22`).**
    COOP `same-origin` + COEP `require-corp` ship via a Vite middleware plugin
    (dev + preview) and `static/_headers` (host). Verified in the production
    preview: `self.crossOriginIsolated === true`, `SharedArrayBuffer` available —
    and the e2e suite now **asserts** it so it can't regress. NOTE: the threaded
    `_mt` runtime itself is still off — the code generator deliberately stubs it
    (`supportsThreads: () => false`), so re-enabling it is a separate focused
    subsystem task (Emscripten/Safari nested workers). See
    [threading-enablement.md](threading-enablement.md).
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
  and committed on the `codec-rebuilds` branch.** The audit's "do-now"
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
  oxipng, AVIF, JXL — LANDED & VERIFIED on `codec-rebuilds`.**
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
    `sqush-raw-threaded-codec-workers` Vite plugin that serves those workers raw.
    NOT a commit regression (dev-vs-prod; the live version under `vite dev` would
    behave the same). Detail: [threading-enablement.md](threading-enablement.md).
  - **Editor preview never goes blank + per-side "Optimising…/Re-optimising…"
    badge.** Restored the original source-fallback (a side shows the loaded image
    until it has its own result) and added a single consistent in-progress badge
    (no blur). See [parity-audit.md](parity-audit.md) §A.
  - **WebP default → Quality 80 / Effort (method) 6** (from upstream 75/4); the
    persisted-settings key was bumped `v2 → v3` so stale saved side-settings are
    discarded and the fresh default (left = Original, right = WebP) loads.
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
- WebP, AVIF, JPEG XL, MozJPEG, OxiPNG, QOI, and browser encoders.

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
  `.svelte-kit/sqush-generated/*`.
- `scripts/audit-static-output.mjs` — verifies emitted worker/WASM output.
- `src/service-worker.ts` — SvelteKit service worker.

Generated files live under `.svelte-kit/sqush-generated/` and are not
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

**Landed on `codec-rebuilds`** (the live branch; merging to `main`): all 7 WASM
codecs rebuilt natively; WebP 2 removed; dead code (`codecs/png/`,
`codecs/visdif/`, `storage.ts`) deleted; cross-origin isolation (COOP/COEP)
**and** the full MT threading runtime — oxipng, AVIF, JXL all verified threading
multi-core in Chromium + WebKit.

What's next, in short:

1. ✅ **Multithreading — DONE.** All three threaded codecs (oxipng, AVIF, JXL)
   thread multi-core in Chromium + WebKit, verified, single-thread fallback intact.
   [threading-enablement.md](threading-enablement.md).
2. ✅ **Codec security rebuilds + gradual upgrades — DONE** (all 7 codecs landed
   on `codec-rebuilds`; see the Current State entry above). Build details:
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
- Multithreading is **configured but unverified**: the COOP/COEP headers are set
  on the branch, but until a human confirms `crossOriginIsolated` and per-codec
  `_mt` loading in real browsers, do not assume threads are actually running.
- Do not touch `codecs/**` without codec provenance, build, service-worker, and
  browser verification. The 2026-06-02 codec rebuilds were built **natively with
  emsdk 3.1.0 + rustup nightly (no Docker, no sudo)** and landed on
  `codec-rebuilds` — the build record is in
  [codec-build-notes.md](codec-build-notes.md); the per-codec runbooks
  ([codec-upgrade-runbooks.md](codec-upgrade-runbooks.md)) are now historical.
- Preview browsers can keep old service workers. If behavior looks stale, clear
  site data or use a fresh context.
