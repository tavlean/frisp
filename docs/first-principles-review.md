# First-Principles Review — 2026-07-07

A whole-app review requested by the maintainer: re-examine every inherited
decision (Squoosh-era and migration-era) as if designing Frisp today. Produced
by one deep manual pass over the runtime core (session, pipeline, worker
bridge, caches, service worker, codegen) plus four independent read-only
sweeps (legacy/dead code, Svelte idioms vs current docs, build/tooling, and a
factual runtime inventory). This document is the single record of the review;
where a finding is already tracked elsewhere it says so instead of duplicating.

**Verdict first: the architecture is sound.** The brain / skin / codecs split
is real, not aspirational — the engine (`src/client/lazy-app/*`) is genuinely
framework-neutral, the same `imagePipeline` drives single and bulk, and the
hardest parts (MT threading, variant-aware SW precache, the undo ↔ result-cache
signature coherence in `editor-session.svelte.ts:107`) are engineered with
unusual care. Dependencies are current (only patch/minor bumps outstanding).
Nothing below is a rescue; it is ranked leverage.

---

## P1 — Every encode pass re-decodes the source image (performance, moderate effort)

`compressFile` (`src/lib/compress.ts:162`) calls `decodeSourceImage` on every
invocation, and `EditorSession.encodeSide` calls `compressFile` for every
settled option tweak. So a quality-slider change on a 24-megapixel photo pays:
full source decode → rotate (if any) → resize → quantize → encode, when only
the encode inputs changed. Upstream Squoosh kept the decoded source in app
state; that piece did not survive the port.

Worse, the built-in decode runs **on the main thread**: `builtinDecode`
(`src/client/lazy-app/image-decode.ts:110`) + `drawableToImageData`
(`src/client/lazy-app/util/canvas.ts:80`) use a DOM canvas + `getImageData`.
Every debounced tweak therefore blocks the UI for the decode+readback of the
full-size source.

**Direction:** cache the decoded source per file (keyed by `loadId`) in
`EditorSession`, and the preprocessed (rotated) buffer keyed by rotation
state; drop both on new file. Bulk (`processBulkImageJob`) has the same
shape — a per-job decoded cache matters once re-encodes (settings changes)
happen on large batches. Memory note: one decoded buffer per open file is
bounded and already dwarfed by the 256 MiB `ResultCache`.

## P2 — The worker boundary copies full-resolution pixels up to ~5× per pass (performance, larger effort)

The Comlink bridge (`src/client/lazy-app/worker-bridge/runtime.ts:93`) uses no
transferables — every `ImageData` crossing the boundary is structured-cloned.
A pass with rotate+resize+quantize ships the full RGBA frame: rotate (send +
return), resize (send + return), quantize (send + return), encode (send); each
encoder then copies the WASM heap output again
(`src/features/encoders/avif/worker/runtime.ts:66`), and the result is decoded
*back* for the preview (`src/lib/compress.ts:205`). At 24 MP each frame copy
is ~96 MB.

**Directions, in increasing ambition (benchmark each with `npm run bench`):**

1. `Comlink.transfer()` where ownership can move: the encoder's output
   `ArrayBuffer` back to the main thread; the processed `ImageData` buffer into
   encode when the caller keeps no reference.
2. A composite worker op: one round trip that runs
   rotate→resize→quantize→encode **inside** the worker and returns
   `{ encodedBuffer, previewBitmap }` with transfer. The pipeline stages
   already all live in the same worker; only the orchestration sits on the
   main thread (a Squoosh-era shape — its bridge was per-method). This
   eliminates all intermediate round trips, and pairs naturally with P1
   (worker keeps the decoded source hot per file).
3. Move built-in decode into the worker: `createImageBitmap` +
   `OffscreenCanvas` are Baseline in workers in all evergreen browsers, so the
   main-thread canvas path can go entirely. WebCodecs `ImageDecoder` is a
   further progressive enhancement (Chrome 94+, Firefox 133+, Safari 26+ —
   near-universal but not Baseline yet), not a requirement.

Keep as-is: the per-side warm bridges, the 60 s idle reclaim, terminate-on-
abort, and the cross-side in-flight dedup — those are all right.

## P3 — Retire most of the 2,006-line codegen script (maintainability, mechanical)

`scripts/sync-sveltekit-app.mjs` is the largest file in the app layer and it
generates ~480 lines of **static** TypeScript (`.svelte-kit/app-generated/*`:
feature-meta, worker entry, worker-bridge meta, codec-asset manifests) — a
surface that changes only when a codec is added or removed (~yearly). The
abstraction was scaffolding for the migration; the migration is over. Its
knock-on costs, confirmed by the tooling sweep:

- `check` runs `sync` twice (directly and via `build`) — `package.json:15`.
- Three Vite aliases exist only to point at generated files
  (`vite.config.ts:117`), duplicated again in `svelte.config.js`.
- `scripts/audit-static-output.mjs:244` hand-duplicates the generator's asset
  records — generator↔audit drift is a standing risk.
- The generated worker entry is named `features-worker/webp.ts` but has been
  the *all-codecs* worker for a long time; the misnomer leaks into
  `src/lib/sveltekit-worker-bridge.ts:23`.
- `src/features/README.md:12` documents a bundling convention (default-export
  worker wrappers) the generator no longer uses — which is why 12 dead wrapper
  files still exist (see P5).

**Direction:** commit the generated modules as ordinary source (rename the
worker entry `codec-worker.ts`), delete the enumeration half of the script,
and keep only the genuinely dynamic part — the Emscripten/wasm-bindgen
wrapper URL patching (`sync-sveltekit-app.mjs:1497`) — as a small focused
script (or commit the patched wrappers with an audit assertion that they match
`codecs/`). The regex patching is the fragile bit worth tests either way.
Follow `docs/codec-provenance.md` rules; the static-output audit is the safety
net for the whole move.

## P4 — The bulk options seam is WebP-shaped (already planned — this review endorses it)

`BulkStore` types global/override editing as `Partial<WebpEncodeOptions>`
(`src/lib/bulk/store.svelte.ts:527,550,933`) even though `setGlobalFormat`
accepts any format. Same workstream: the per-codec option panels still mutate
parent-owned `$state` props in place (documented Preact-era pattern,
`WebpOptions.svelte:2`; AVIF/JXL keep `getDerivedStateFromProps`-style local
mirrors, `AvifOptions.svelte:18`) — current Svelte docs say props should be
`$bindable` or updated via callbacks. Both are exactly what
[codec-options-model.md](codec-options-model.md) proposes to fix. **This
review's data strengthens the existing sequencing call: do the options-model
minimal slice before bulk Phase 3 overrides.**

## P5 — Dead code and stale shims (quick wins, safe batch)

From the legacy sweep (verified against the generated worker's real imports):

- **12 orphaned worker wrapper files** — every
  `src/features/{encoders,decoders,processors}/*/worker/<name>{Encode,Decode,quantize,resize}.ts`
  default-export wrapper; the generated worker imports the `runtime.ts`
  factories directly. Also fix the stale instructions in
  `src/features/README.md:12` that keep spawning this pattern.
- **Stale type shims:** `src/lib/editor/theme.css.d.ts`,
  `output/two-up.css.d.ts`, `output/pinch-zoom.css.d.ts` (side-effect CSS
  imports don't need them); `src/pointer-tracker.d.ts` and
  `src/wasm-feature-detect.d.ts` (both packages now ship their own `.d.ts` —
  delete and verify with `svelte-check`).
- **Legacy util surface:** `src/client/lazy-app/util/index.ts` barrel
  (only `isSafari` is used; `preventDefault()` has no caller; `konami()` is a
  documented deliberate keep). Verify `canvasEncode`/`canvasEncodeTest` in
  `util/canvas.ts` — canvas encoders were removed 2026-06-27
  ([codec-surface-cleanup.md](codec-surface-cleanup.md)), so these may be
  orphans too (its Edge `toDataURL` fallback is dead regardless).
- **Repo artifacts:** committed `.DS_Store` files (add to `.gitignore`),
  `static/logo-light-gray.webp` (unreferenced), `static/wordmark.svg`
  (inlined in `Intro.svelte` — keep only if wanted as brand art).

## P6 — Duplicated utilities (small, consolidate opportunistically)

- `stableStringify` exists three times: `editor-session.svelte.ts:82`,
  `bulk/store.svelte.ts:121`, and the bulk settings hash path
  (`client/lazy-app/bulk/settings.ts`). One shared module; the comment about
  key-order cache misses should live with it.
- The SI size formatter: `$lib/editor/pretty-size.ts` exists, yet
  `Results.svelte:36`, `bulk/StripCell.svelte:29`, `bulk/FocusView.svelte:127`
  re-implement it inline.
- `blobToArrayBuffer` duplicated (`image-decode.ts:57`,
  `features/worker-utils/index.ts:35`).
- `ResultCache` and `BulkOutputCache` share LRU/pinning/URL-revocation
  mechanics — a common LRU core would leave each as a thin policy wrapper.
- `abort.ts` predates the platform: `signal.throwIfAborted()` replaces
  `assertSignal`; `AbortSignal.any` simplifies composition where it appears.

## P7 — Tooling and CI (fast wins, from the tooling sweep)

- **Unit tests don't run in CI** and `npm test` doesn't include them
  (`package.json:23`, workflow has no vitest job) — 78 tests exist; add a
  cheap job. Docs claim otherwise (`docs/README.md:134`) — reconcile.
- No fast `typecheck` script: `svelte-check` is only reachable through `check`
  which also does a full build; `npm test` builds **twice** (check +
  Playwright webServer).
- `npm audit` runs on all three OS runners; it's OS-independent.
- Playwright: `workers: 1` serializes Chromium+WebKit; split into two CI jobs
  if wall-clock starts to hurt.
- `tsconfig.json:13` `verbatimModuleSyntax: false` — try flipping to the
  modern default; `scripts/*.mjs` (the 2k-line generator included) are outside
  any typecheck today.
- Dev-middleware nit: `decodeURIComponent` outside try in `vite.config.ts:69`.

## P8 — Svelte idioms (fold into [svelte-hardening-plan.md](svelte-hardening-plan.md))

**Status: done via WS-F (2026-07-07).** Window reactivity, `MediaQuery`, and
shared light-dismiss attachment landed. The `StackStage` `{#key}` idea was
skipped because it would not remove both guard fields without a larger
component extraction.

The sweep verified against current Svelte docs; the codebase is already
rune-native with no Svelte-4 residue. Remaining polish:

- `svelte/reactivity/window` (`innerWidth.current`) replaces the repeated
  `<svelte:window bind:innerWidth>` + local `$state` in `FocusView`,
  `StackStage`, `Output`; `new MediaQuery('(prefers-reduced-motion: reduce)')`
  replaces the manual `matchMedia` effect in `ProcessingBadge.svelte:85`.
- A shared light-dismiss `{@attach}` factory replaces three hand-rolled
  global-listener effects (`ImageInfoPanel`, `Output`, `FocusView`).
- `StackStage`'s effect-resets-state guards (`lastSignature`,
  `lastSplitTopId`) could become `{#key}` blocks.
- Deliberately fine (checked, not flagged): imperative canvas painting,
  the `pinch-zoom`/`two-up` custom elements + `pointer-tracker`, and
  `EditorSession` owning its effects via `$effect.root`.

## P9 — Bulk runtime scheduling (note for Phase 3, not urgent)

`BulkRuntime.run` starts jobs in pairs and awaits `Promise.all` of the pair
(`src/lib/bulk/runtime.ts:103`) — a barrier: one slow 40 MP AVIF blocks the
next queued job even when the other slot is idle. Per-slot independent drain
loops fix head-of-line blocking. Concurrency is a hardcoded 2; revisit
(with the memory-ceiling question in the project brief) when bulk Phase 3
lands. Also platform-feature idea for bulk export: File System Access
`showDirectoryPicker` "save to folder" alongside ZIP (Chromium-only,
progressive).

## P10 — Layout naming (cosmetic, do after P3)

`src/client/lazy-app/` ("lazy-app" was Squoosh's lazily-loaded Preact chunk)
and the `client`/`features`/`shared`/`worker-shared` alias fan-out predate the
migration. After P3 removes the generated-file aliases, consolidating to e.g.
`src/engine/` (pipeline + bulk engine), `src/codecs-runtime/` (features/*),
with plain `$lib` for UI would cut the alias table to ~2 entries and kill the
duplication between `vite.config.ts` and `svelte.config.js`. Pure rename;
zero behavior; big greppability win.

---

## Suggested sequencing

1. **Quick-wins batch** (P5 + P6 + P7): dead files, shims, duplicate helpers,
   CI unit-test job, `typecheck` script. Low risk, Codex-executable, one
   afternoon.
2. **P1 decoded-source cache** — small diff, immediately felt on large images.
3. **P3 codegen retirement** — mechanical, guarded by the static-output audit.
4. **Options model** (already sequenced first in
   [codec-options-model.md](codec-options-model.md)) → bulk Phase 3 (+ P9).
5. **P2 worker-boundary rework** — the big engineering item; benchmark
   before/after with `npm run bench`, land in stages (transfer → composite op
   → worker-side decode).
