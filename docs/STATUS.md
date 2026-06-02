# Sqush Status

Last updated: 2026-06-02.

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

  Still outstanding from the audit (not started): the **urgent** security-driven
  codec rebuilds (libwebp, libavif/libaom, libjxl) + the easy libimagequant bump.
  These only need **Docker** to build — [codec-upgrade-handoff.md](codec-upgrade-handoff.md)
  is the build+verify+commit loop (with a fresh-session prompt), backed by the
  per-codec [codec-upgrade-runbooks.md](codec-upgrade-runbooks.md). The
  [new-codec-investigation.md](new-codec-investigation.md) records a
  researched-but-not-added shortlist (SVGO first, HEIC-decode later, jpegli /
  JPEG→JXL skip). Full docs map: [README.md](README.md).

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

**Already landed on the `codec-cleanup-and-threading` branch** (pending merge to
`main`): WebP 2 removed; dead code (`codecs/png/`, `codecs/visdif/`,
`storage.ts`) deleted; multithreading **config** in place (COOP/COEP) but its
in-browser verification is still open.

What's next, in short:

1. **Finish multithreading** — the headers are set; do the in-browser
   verification (crossOriginIsolated, the three seams, per-codec `_mt` loading,
   cross-browser). [threading-enablement.md](threading-enablement.md).
2. **Urgent — codec security rebuilds** (libwebp, libavif/libaom, libjxl) + the
   trivial libimagequant bump. Turnkey steps:
   [codec-upgrade-runbooks.md](codec-upgrade-runbooks.md) (the WASM toolchain is
   not installed here, so they run later locally/CI).
   Audit/why: [codec-upgrade-audit.md](codec-upgrade-audit.md).
3. **Gradual codec upgrades** (OxiPNG, mozjpeg, resize) — runbooks in
   [codec-upgrade-runbooks.md](codec-upgrade-runbooks.md).
4. **Investigate new codecs** — researched, not added:
   [new-codec-investigation.md](new-codec-investigation.md) (SVGO first,
   HEIC-decode later, jpegli / JPEG→JXL skip).
5. **Product features** — Multi-Format Compare, then bulk — see
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
  browser verification. The codec rebuilds need the WASM toolchain (emcc / cmake
  / wasm-pack / docker), which is **not installed in this repo** — run the
  [codec-upgrade-runbooks.md](codec-upgrade-runbooks.md) locally/CI.
- Preview browsers can keep old service workers. If behavior looks stale, clear
  site data or use a fresh context.
