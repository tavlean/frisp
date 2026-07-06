# First-Principles Review — Execution Plan & Specs

Status: **IN PROGRESS** (orchestrated session started 2026-07-07). Source
findings: [first-principles-review.md](../first-principles-review.md) (P1–P10).
This document is the **single source of truth for execution state** — each
workstream has a Status line; flip it as work lands. The review doc stays the
record of *why*; this is the *how*.

Working rules (bind every executor, human or model):

- One writer on the tree at a time. Verify with the gates listed per
  workstream. The orchestrator (or maintainer) commits — executors never do.
- Behavior-preserving unless the spec says otherwise. The protected path:
  import → decode → process → encode → preview → export → offline.
- After any `.svelte` edit, run the Svelte MCP autofixer on the file.
- Markdown is never auto-formatted.

Model ladder: **Fable/top-tier** = design decisions, final review (this
session). **Codex** = every implementation below (specs are written to be
Codex-executable), research, sweeps. **Opus** = only if a task turns out to
need visual/UX taste (none below should).

---

## WS-A Quick wins (P5 dead code · P6 dedup · P7 tooling) — Codex, 3 batches

**Status: A1 ✅ DONE (`85944296`) · A2 ✅ DONE · A3 ✅ DONE.**
A1 outcomes vs spec: pointer-tracker.d.ts KEPT (verified still required by
`npm run check`); canvasEncode KEPT (webp-pipeline-probe imports it),
canvasEncodeTest deleted; no committed .DS_Store existed. **Bonus find
(`db0a696a`): vitest.config.ts resolved no aliases — a 2026-07-05 import made
export.test.ts fail collection, silently dropping 10 tests and hiding a real
regression (bulk archives brand-prefixed against the documented contract).
Both fixed; vitest now reuses vite.config's exported `appAliases`. All 78
unit tests green.**

- **A1 — dead code (P5).** Exact file list in review §P5; brief includes
  verify-before-delete rules, the sync-script `source:` metadata fixups, the
  `src/features/README.md` worker-convention rewrite, `.DS_Store` purge +
  gitignore. Gates: `npm run sync` + `npm run check` + `npm run test:unit`.
- **A2 — duplicated utilities (P6).** After A1 lands:
  1. New `src/shared/stable-stringify.ts` (move the implementation +
     key-order-cache-miss comment from `editor-session.svelte.ts:82`); import
     it from `editor-session.svelte.ts`, `bulk/store.svelte.ts` (delete local
     copy at :121), and `client/lazy-app/bulk/settings.ts` (delete its local
     copy). All three are byte-identical semantics today — verify by reading
     before deleting, not assuming.
  2. Replace the inline SI size formatters in `Results.svelte:36`,
     `bulk/StripCell.svelte:29`, `bulk/FocusView.svelte:127` with
     `$lib/editor/pretty-size.ts` (compare output format first; if a call site
     truly needs a different precision, parameterize `prettySize`, don't fork).
  3. Delete `blobToArrayBuffer` from `client/lazy-app/image-decode.ts` OR
     `features/worker-utils/index.ts` — keep the worker-utils one only if
     worker code can't import from client (it can't cleanly; so keep both
     files' callers working by re-exporting from ONE canonical module under
     `src/shared/`).
  4. `abort.ts`: replace `assertSignal(signal)` bodies with
     `signal.throwIfAborted()` (keep the exported names/signatures — call
     sites untouched).
  5. **Skip** the ResultCache/BulkOutputCache LRU-core merge for now — the
     two caches' policies differ and WS-D changes what CompressOutcome holds;
     merging first would be churn. Noted as post-WS-D follow-up.
  - Gates: `npm run check` + `npm run test:unit`.
- **A3 — tooling/CI (P7).** After A2:
  1. `package.json`: add `"typecheck": "npm run sync && svelte-kit sync && svelte-check --tsconfig ./tsconfig.json"`;
     make `check` reuse it and stop double-running sync (`check` =
     `typecheck && vite build && audit:static-output` — `build` script keeps
     its own sync for standalone use).
  2. Add vitest to the chain: `"test": "npm run check && npm run test:unit && npm run test:e2e"`.
  3. CI (`.github/workflows/node.js.yml`): add a `unit` job (ubuntu,
     `npm ci && npm run test:unit`); move `npm audit` out of the OS matrix
     into one job.
  4. Playwright double-build: set `webServer.reuseExistingServer` locally
     only; leave CI as-is (isolation is fine, it's the local `npm test`
     that double-builds — building once via `check` then
     `playwright test` with a preview server pointed at `build/` is the fix;
     implement by having the Playwright `webServer` command run
     `vite preview` when `build/` already exists — keep it simple, and if it
     isn't simple, just document the cost and move on).
  5. `vite.config.ts:69`: wrap `decodeURIComponent` in the existing try.
  6. `tsconfig.json`: try `"verbatimModuleSyntax": true`; if the fallout is
     >~20 mechanical `import type` fixes, apply them; if it surfaces anything
     non-mechanical, revert and report.
  7. Fix `docs/README.md:130-134` claims to match the new script reality; fix
     the `docs/build-and-runtime.md:12` prettier claim (tooling sweep §3).
  - Gates: `npm run check`, `npm run test:unit`, and CI green on push.

## WS-B Decoded-source cache (P1) — design fixed, Codex implements

**Status: ✅ DONE (`3a44a63d`). Amendment during review: #preparedSource takes the pass's own preprocessor snapshot (no live re-read after the decode await). Bulk per-job decode caching remains out of scope (Phase-3 memory design).**

Design (decided, do not re-litigate):

1. `src/lib/compress.ts`: split `compressFile` —
   - New exported `compressPreprocessed(source: { file: File; decoded: ImageData; vectorImage?: HTMLImageElement; preprocessed: ImageData }, request, signal, bridge)`:
     contains everything from the identity branch onward (identity return,
     `processImage`, encode, decode-back, outcome assembly). Unchanged logic.
   - `compressFile` keeps its exact signature and behavior (decode +
     preprocess + delegate) — the bulk path and any other caller stay
     untouched.
2. `EditorSession` gains non-reactive fields:
   - `#sourceAbort: AbortController | null`
   - `#decodedPromise: Promise<DecodedSourceImage> | null` (keyed by
     `#decodedLoadId: number`)
   - `#preprocessedPromise: Promise<ImageData> | null` (keyed by
     `#preprocessedLoadId` + `#preprocessedRotate: 0|90|180|270`)
   - Method `#preparedSource(bridge): Promise<{decoded…, preprocessed}>`:
     - If `#decodedLoadId !== this.loadId`: abort + replace `#sourceAbort`
       with a fresh controller, start `decodeSourceImage(sourceAbort.signal,
       file, bridge)` **under the session-level signal, not the pass signal**
       (a pass abort must never poison the shared decode), store promise + id.
     - Preprocessed: for `rotate === 0` reuse `decoded.decoded` (no rotate
       call, no copy — matches today's `preprocessImage` behavior); else if
       the cached rotation ≠ current, run `preprocessImage` under the
       session signal and cache. Only ONE rotation is cached (replace on
       change) — undoing a rotate re-pays one rotate pass; that's fine.
   - `encodeSide` passes go: `const prepared = await abortable(passSignal, this.#preparedSource(bridge))`
     then `compressPreprocessed(prepared, …, passSignal, bridge)` — the pass
     signal still governs everything downstream, so abort semantics for
     resize/quantize/encode are unchanged.
   - Invalidation: `pickFiles` and `clearFile` abort `#sourceAbort` and null
     the promises (add to the existing reset blocks); `dispose` likewise.
3. Error handling: if the shared decode rejects (bad file), each awaiting pass
   surfaces the error exactly as today (the rejection propagates through
   `abortable`). Do NOT cache a rejected promise across passes — on rejection
   null out `#decodedPromise` so a retry (new pass) re-attempts.
4. Memory: at most one decoded frame + one rotated frame per open file, both
   released on new-file/close. No config knobs.
5. Out of scope: bulk per-job decode caching (revisit with the Phase-3 memory
   ceiling design — noted in review §P1).

Gates: `npm run check`, `npm run test:unit`, `npm run test:e2e` (both
browsers), plus a manual before/after timing note: open a large (≥12 MP)
photo, drag quality, confirm passes no longer re-decode (network/CPU profile
or timestamped logging removed before commit).

## WS-C Codegen retirement (P3) — target shape fixed, Codex executes

**Status: queued (after WS-B; independent of it, but one writer at a time).**

Target shape (decided):

1. **Records become data.** Move the codec-asset record list (logicalKey,
   codec, role, variant, relative asset path, cache class) into
   `src/shared/codec-asset-records.json` — the ONE source of truth. The
   TS side gets a thin typed wrapper module; `scripts/audit-static-output.mjs`
   reads the same JSON (kills the hand-duplicated list at audit:244).
2. **Generated static modules become committed source.** Promote, as plain
   files (adjust import paths, drop the "autogenerated" headers):
   - `feature-meta/{shared,encoders,index}.ts` → `src/client/lazy-app/feature-meta/`
     (the three vite aliases for feature-meta die; keep the `client` alias).
   - `features-worker/webp.ts` → `src/worker/codec-worker.ts` (**rename**, it
     serves all codecs); `src/lib/codec-assets.ts` imports
     `src/worker/codec-worker.ts?worker&url`.
   - `worker-bridge/meta.ts` and `worker-surface/ready.ts` → merge into the
     worker/bridge source where used (methodNames is a 1-array module).
   - `codec-assets/*.ts` (the `?url` import modules + manifest/precache/
     service-worker selections) → `src/shared/codec-assets/` as source; add
     an audit assertion that every JSON record has a matching `?url` import
     and vice versa (this replaces the generator's guarantee).
3. **The only codegen that remains** is the Emscripten/wasm-bindgen wrapper
   patching → new `scripts/patch-codec-wrappers.mjs` (extract the patch
   functions verbatim from sync-sveltekit-app.mjs, unchanged regexes), still
   writing to `.svelte-kit/app-generated/codecs/**`; `app-generated` alias
   shrinks to that. `npm run sync` runs only this (fast).
4. Delete `scripts/sync-sveltekit-app.mjs`. Update `tsconfig.json` include,
   both alias tables (`vite.config.ts`, `svelte.config.js`), and
   `docs/build-and-runtime.md`.
5. **Invariant:** the built output must be byte-identical-in-structure —
   verify by running `npm run check` (the static-output audit is the net) and
   `npm run test:e2e` in both browsers, then compare the emitted asset list of
   `build/` before/after (same set of codec assets, same SW precache
   manifest content modulo hashes).

Risk note: the patched-wrapper regexes are the fragile part — they move
verbatim. If any promoted module turns out to embed build-time-computed
values beyond static imports (it shouldn't — verified 2026-07-07 that outputs
are static), stop and report rather than hand-patching.

## WS-D Worker-boundary copies (P2) — staged; (a) today, (b)/(c) specced

**Status: (a) queued · (b) specced · (c) specced.**

- **(a) Worker→main transfers.** In the worker entry (post-WS-C:
  `src/worker/codec-worker.ts`), wrap every returned fresh buffer in
  `Comlink.transfer`:
  - encoders returning `ArrayBuffer` → `transfer(buf, [buf])` (the runtimes
    already copy out of the WASM heap, so the buffer is owned and dies
    otherwise);
  - decode/rotate/resize/quantize returning fresh `ImageData` →
    `transfer(imageData, [imageData.data.buffer])`.
  Main→worker argument transfer is **deliberately NOT done** — with WS-B the
  decoded/preprocessed frames are cached on the main thread and reused, and
  the processed frame doubles as `sourceImageData` for the UI. Do not
  "optimize" sends.
  Gates: `npm run check` + full e2e both browsers (WebKit especially —
  transfer + COEP interactions), `npm run bench` before/after recorded in
  this doc.
- **(b) Composite pipeline op (next session).** New worker method
  `processAndEncode(signal, preprocessed, processorState, encoderState, urls…)`
  running worker-resize → quantize → encode → decode-back in ONE round trip,
  returning `{ file bytes, processedImage, outputImage }` with transfer.
  Main-thread fallback path (stepwise, exactly today's) remains for: vector
  (SVG) resize and `browser-pixelated` resize — both need the main thread.
  `compressPreprocessed` picks composite vs stepwise. The UI contract
  (`CompressOutcome`) is unchanged. Requires (a) + WS-B landed; benchmark
  gate ≥15% wall-clock improvement on the bench suite's large-image encodes,
  else don't merge complexity.
- **(c) Worker-side built-in decode (next session).** Add `builtinDecode` to
  the codec worker using `createImageBitmap(blob)` + `OffscreenCanvas`
  (Baseline). `decodeImage` prefers the worker path, falls back to the
  main-thread canvas path on error (keep the code; Safari SVG quirks stay
  main-thread — SVG never goes through builtinDecode anyway).
  WebCodecs `ImageDecoder` explicitly deferred (not Baseline; re-check
  mid-2027).

## WS-E Bulk per-slot drain (P9) — design fixed, Codex implements

**Status: ✅ DONE (`116928aa`). Known micro-limitation (not a regression — old code behaved the same): a job imported mid-drain waits for the current outer round before an idle slot picks it up.**

Replace `BulkRuntime.run`'s pair-barrier with two independent drain loops:

```
async run(host):
  guard #running as today; create controller
  await Promise.all([this.#drainSlot(host, 0, signal), this.#drainSlot(host, 1, signal)])
  // outer while: if #rerunRequested flipped during the drains, loop again
async #drainSlot(host, slot, signal):
  while (!signal.aborted):
    const [job] = getRunnableJobs(host.session, defaultBulkConcurrency)
    if (!job) return
    host.session = startJob(host.session, job.id)   // sync claim — no race in single-threaded JS
    await this.#processOne(host, job, slot, signal)
```

`getRunnableJobs` already subtracts active jobs, so each drain claims one at a
time and total concurrency stays 2 (= number of drain loops). Keep
`#rerunRequested` for the settings-change-mid-drain case; `#processOne`,
cancellation, and session-reassign semantics are unchanged. Add/adjust the
bulk unit tests: slow-job-doesn't-block (fake bridge with per-job latency),
cancel-mid-drain returns jobs to queued, rerun-requested drains new jobs.
Gates: `npm run test:unit` + bulk e2e specs.

## WS-F Svelte idioms (P8) — Codex + Svelte MCP autofixer

**Status: ✅ DONE (2026-07-07, uncommitted per executor instructions).** Done:
window reactivity switched to `svelte/reactivity/window` in `FocusView`,
`StackStage`, and `Output`; `ProcessingBadge` now uses `MediaQuery`; shared
`lightDismiss` `{@attach}` factory is used by `ImageInfoPanel`/`Output`/
`FocusView`. `{#key}` for `StackStage` was skipped because it would not remove
both script-level guard fields without a larger component extraction. Svelte
MCP/autofixer was not available in this run. Gates: `npm run check` ✅,
`npm run test:unit` ✅, `npm run test:e2e` ✅ (61 passed / 1 known WebKit
offline skip).

## WS-G Options-model minimal slice (P4) — decisions made; spec here, build next session

**Status: specced — decisions recorded; implementation follows Phase-3 kickoff.**

The two pending maintainer decisions in
[codec-options-model.md](../codec-options-model.md) §Sequencing are resolved
as follows (maintainer may veto; rationale recorded):

1. **Dots/resets cover ALL visible controls.** Partial coverage makes the
   override model unexplainable ("why does Quality get a dot but Effort
   not?"), and the registry must enumerate every visible control anyway to
   merge correctly — headline-only saves no code, only consistency.
2. **Override path = human control id** (e.g. `avif.lossless`), as the doc
   already recommended. Raw fields can't represent multi-field controls
   (Lossless) or inverted ones (Effort) without re-deriving the mapping at
   every consumer.

Slice spec (engine-first, UI-second):

- `src/client/lazy-app/bulk/controls/<codec>.ts` — per-encoder registry:
  `{ id, label, fields: string[], equal?(a,b), apply(source→target) }` for
  every currently visible control of the 5 encoders. **The complete control
  inventory (fields, transforms, couplings, per-panel tables) is in
  [2026-07-07-ws-g-control-inventory.md](2026-07-07-ws-g-control-inventory.md),
  including four binding reviewer directives** (mode-overlap rule, UI-only
  exclusion, shared-field couples, no QOI). Pure data + functions, no UI
  imports, unit-tested (equal/apply round-trips per control).
- Engine: same-format encoder overrides become per-control sparse — stored as
  `{ controlIds: string[] }` + the owned raw-field values; merge =
  global options, then apply each overridden control's fields. Format
  override stays wholesale (as decided in the sequencing analysis).
- Bulk UI: dot when `controlIds` contains the control; reset-one removes it;
  reset-all clears. Single-image panels untouched.

## WS-H Layout rename (P10) — spec fixed, execute LAST

**Status: blocked until WS-A…F land (it conflicts with everything).**
Mapping: `src/client/lazy-app/` → `src/engine/`; `src/features/` →
`src/engine/features/` (or keep top-level `src/features` — executor's choice
is NO, keep the decided mapping); aliases shrink to `engine`, `shared`,
`app-generated`; `worker-shared/` merges into `shared/worker/`. Pure
`git mv` + import rewrite + alias-table updates in both configs + tsconfig +
docs sweep (`docs/build-and-runtime.md`, `AGENTS.md` paths). Gates: full
`npm run check` + `npm run test:e2e` + `npm run test:unit`. Trivially
Codex-executable in a fresh session; needs no top-tier presence.
**The full paint-by-numbers inventory (git-mv list, alias end-state, sed
patterns, every doc reference) is in
[2026-07-07-ws-h-rename-inventory.md](2026-07-07-ws-h-rename-inventory.md) —
apply its delta header (post-A1/post-C state) before starting.**

---

## Day-1 execution order (this session)

| # | WS | Writer | Reviewer |
|---|----|--------|----------|
| 1 | A1 dead code | Codex (running) | Fable |
| 2 | A2 dedup → A3 tooling | Codex | Fable |
| 3 | B decoded-source cache (+E bulk drain) | Codex (high effort) | Fable |
| 4 | C codegen retirement | Codex (medium) | Fable |
| 5 | D(a) transfers + bench | Codex (medium) | Fable |
| 6 | F Svelte idioms | Codex + autofixer | Fable |
| 7 | Commit ledger + doc reconciliation | Fable | — |

Left deliberately for later cheap sessions: D(b), D(c), G implementation,
H rename, the LRU-core merge (A2.5). Every one of them is specced above to
be executable without top-tier judgment.
