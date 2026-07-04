# Review-hardening plan (2026-07-02)

Status: **done** — Phase 1 ✅ (`0f034a78`, `fdeb0625`, `5a10b838`+`74b87e0f`, `9ac1886f`; bonus e2e repair `1009a486` — resize.spec had been silently red since the abebdfaf re-tiering hid the Method select behind AdvancedSection) · Phase 2 ✅ (`cbb6c9a5` bridges, `be978a9c` in-flight dedup, `da273584` stable signature, `4217ef77` guard removal) · Phase 3 ✅ (`89e69bb0` settings-storage extraction, `5c68787d` per-side SideRuntime object) · Phase 4 ✅ (final verification: `npm run check` 0 errors, full Playwright suite green on both browsers — 35 passed / 1 known webkit offline-config skip; docs reconciled)
Last updated: 2026-07-02.

Source: a full code review of the June 11 – July 1 commit window (studio UI,
encoder-surface trim, resize UX, undo/redo + result cache, slider snapping,
SW update flow). Verdict: no crashing bugs; one significant architectural miss
(worker lifecycle), one correctness gap (unclamped number input), several
simplifications. This doc is the execution plan, written so any agent can pick
up any task cold. **Work top-to-bottom; commit after every task (code and docs
in separate commits); run the test gate before every commit.**

## Test gate (before every commit)

```sh
npm run check        # svelte-check + build + static-output audit — must be 0 errors
npx playwright test tests/e2e/<relevant>.spec.ts   # targeted suite(s) for the touched area
```

Full `npm run test:e2e` at phase boundaries (it's slow; targeted specs per-commit
are fine). The pre-commit hook auto-formats code (lint-staged); **never format
`*.md`**. Conventional-commit messages, imperative mood, body explains the why.

---

## Phase 1 — small independent fixes (delegable)

### T1. Clamp typed values in Range.svelte  ✅ = commit `fix(editor): clamp typed slider values to min/max`

File: `src/lib/editor/options/Range.svelte`.

Problem: `commit()` does `emit(Number(raw))` — the mirrored `<input
type="number">` can push out-of-range values (e.g. quality `400`) straight into
options state, the encode signature, localStorage, and the WASM encoder. The
drag path already clamps (`valueFromClientX`, line ~102); the typed path doesn't.

Spec:
- In `commit(raw)`: parse; if `NaN` return (unchanged); clamp to
  `[Number(min), Number(max)]` before `emit`.
- Do NOT round to `step` here — fractional steps are legitimate for some fields
  (`labelPrecision`); min/max clamping only.
- Do NOT touch the drag path or `magnetize()`.
- Note the callers that invert values (`WebpOptions.svelte`:
  `options.near_lossless = 100 - v`) — clamping happens before inversion, which
  is correct; no caller changes needed.
- Test: `tests/e2e/resize.spec.ts` + `codec-encode.spec.ts` (both drive Range
  inputs). Manual: type `400` into WebP quality → field and state settle to 100.

### T2. Single source of truth for the thumb inset  ✅ = commit `refactor(editor): derive thumb inset from one --thumb-half var`

File: `src/lib/editor/options/Range.svelte`.

`THUMB_HALF = 7` in the script silently pairs with `margin-left: -7px` and
`left: 7px; right: 7px` in the CSS. Add `--thumb-half: 7px` on `.range-input`,
use `calc()` in the three CSS spots, and read it in JS at drag start
(`getComputedStyle(inputEl.parentElement!).getPropertyValue('--thumb-half')`,
`parseFloat`, fall back to 7). Keep the JS constant as the fallback only.
Same test gate as T1. (Separate commit from T1 — fix vs refactor.)

### T3. Scope the two-up divider shortcuts  ✅ = commit `fix(editor): stop two-up divider keys firing from unrelated controls`

File: `src/lib/editor/output/two-up.ts` (`_onKeyDown`, ~line 91).

Problem: a window-level keydown moves the divider on `1`/`2`/`3` whenever the
target isn't inside an `<input>` — pressing "2" while focused on any button,
select, or the zoom `<span role="button">` recenters the split.

Spec — handle the key ONLY when ALL of:
- `!event.defaultPrevented` and no modifier held
  (`ctrlKey/metaKey/altKey` — leave `shiftKey` irrelevant, Digit codes ignore it);
- target is `document.body` OR `this.contains(target)` (keeps the shortcut
  working when nothing is focused, and when interacting with the viewer);
- keep the existing `closest('input')` guard (redundant after the above but
  harmless).
Do not change the `_position` math. This diverges from upstream Squoosh
deliberately — log it in `docs/parity-audit.md` under a new §A.16 (one short
paragraph, same style as §A.15).
Test: `resize-twoup-footprint.spec.ts`; manual: focus a toolbar button, press
"2" → divider must NOT move; click the canvas background, press "2" → it must.

### T4. Service worker: ignore cross-origin GETs  ✅ = commit `fix(sw): pass cross-origin requests through untouched`

File: `src/service-worker.ts` (fetch handler, ~line 153).

Problem: the handler calls `respondWith` for EVERY GET including cross-origin,
and the network-first fallback runtime-caches any `ok` response; the
`assetPathnames` check also compares pathname without origin, so a cross-origin
URL with a colliding pathname would be served from the app cache.

Spec: at the top of the fetch listener, after the method check:
```ts
if (new URL(event.request.url).origin !== worker.location.origin) return;
```
(plain `return` before `respondWith` — the browser handles it natively). Reuse
the parsed URL rather than parsing twice. No other behavior changes: same-origin
runtime caching stays (offline-first requires it).
Test: `offline.spec.ts` + `app-shell.spec.ts` MUST pass (they exercise the SW
precache/offline path).

---

## Phase 2 — encode core (main agent; specs here for the record/resume)

Order matters; each step its own commit. All in `src/lib/compress.ts`,
`src/lib/editor/editor-session.svelte.ts`, `src/lib/result-cache.ts`.

### T5. Per-side persistent worker bridges  ✅ = commit `perf(encode): reuse a persistent per-side worker bridge`

Today `compressFile()` news up a `SvelteKitWorkerBridge` and disposes it in
`finally` — every debounced slider tweak pays Worker startup + WASM/Emscripten
init + (for AVIF/JXL) pthread-pool spawn, then throws the warm worker away. The
bridge runtime (`client/lazy-app/worker-bridge/runtime.ts`) is *designed*
long-lived: lazy `_startWorker()`, idle-timeout reclaim, terminate-on-abort with
lazy restart (this is how upstream Squoosh used it — one bridge per side).

Spec:
- `compressFile(file, request, signal, bridge: SvelteKitWorkerBridge)` — bridge
  becomes a required param; delete the internal `new`/`dispose`.
- `EditorSession` owns `#bridges: [SvelteKitWorkerBridge, SvelteKitWorkerBridge]`,
  created lazily per side on first encode, passed into `compressFile`, disposed
  in `session.dispose()`.
- Abort semantics are already correct: the runtime terminates the worker on
  abort and restarts on next call; per-SIDE bridges mean one side's abort never
  kills the other side's in-flight job. Do not share one bridge across sides.
- `webp-pipeline-probe.ts` (diagnostics) keeps its own bridge — untouched.

### T6. In-flight encode dedup  ✅ = commit `perf(encode): share in-flight encodes between sides`

When both sides run the same recipe ("Copy settings across"), both run the
identical multi-second encode and one result is discarded. Add
`#inflight = new Map<string, Promise<CompressOutcome>>()` keyed by `encodeSig`:
- Before starting a pass, if the sig is in-flight, await that promise instead.
- If the awaited promise rejects with AbortError (the OWNING side's recipe
  changed) while THIS side still wants the result (own controller not aborted),
  fall back to running its own pass.
- Entries remove themselves on settle; clear the map in `pickFiles`/`clearFile`
  (sig doesn't include file identity — same guard reason the cache is cleared).
- The existing "duplicate landed first" revoke-and-discard stays as a backstop.

### T7. One canonical recipe signature  ✅ = commit `refactor(editor): single stable signature for cache + history`

`encodeSig`, `docSig`, and `resizeSig` are three hand-rolled
`JSON.stringify` fingerprints whose mutual consistency is load-bearing (the
"undo hits the cache" guarantee) but unenforced, and `JSON.stringify` is
key-order-sensitive (works today only because options are always built by
spreading defaults first; `importSide` could break it silently → permanent
cache misses). Spec:
- Add `stableStringify(value)` (sorted object keys, recursive; arrays in order)
  — small local helper, no dependency.
- Add `sideRecipe(side, {resizeIsReal})` returning the canonical
  output-affecting shape: `{format, options: active format's options, quantize,
  resize: resizeIsReal ? resize : null}`.
- `encodeSig = stableStringify({pre, recipe: sideRecipe(side)})`;
  `docSig = stableStringify({pre, sides: [sideRecipe(0), sideRecipe(1)]})`;
  `resizeSig` derives from the same recipe's resize component.
- Sigs are in-memory only — no persistence/migration concerns.

### T8. Delete the `restoringHistory` flag  ✅ = commit `refactor(editor): drop redundant restoringHistory guard`

The signature dedupe in `EditorHistory.commit()` already makes the restore-write
loop impossible (the comment at editor-session.svelte.ts:619 admits the flag
only saves a wasted debounce cycle). Remove the flag + `queueMicrotask`; keep
`flushHistory()` before undo/redo. Verify with the manual undo/redo smoke below.

---

## Phase 3 — structural refactors (delegable, AFTER Phase 2 lands)

### T9. Extract `settings-storage.ts`  ✅ = commit `refactor(editor): extract localStorage persistence module`

Move from `editor-session.svelte.ts` into a new
`src/lib/editor/settings-storage.ts`: `STORAGE_KEY`, `SAVE_VERSION`,
`sideSaveKey`, `canUseLocalStorage`, `readSaved`, `parseSavedSide`,
`hasSavedSide`, `sanitizeSavedOptions`, `isValidFormat`,
`isValidProcessorState`, plus thin `writeSettings(payload)` /
`writeSideSettings(index, payload)` wrappers owning the try/catch.
**HARD CONSTRAINT: byte-identical wire formats.** The stored payload shapes and
keys (`presk:settings:v3`, `presk:side-settings:left/right`) must not change —
this is a code move, not a schema change. `EditorSession` keeps the debounce
timers and snackbar UX; only pure parse/validate/serialize moves.
Gate: `npm run check` + full `test:e2e`; manual: save side → reload → import
still enabled and applies.

### T10. Group per-side runtime state into `SideRuntime`  ✅ = commit `refactor(editor): per-side runtime object replaces parallel tuples`

`EditorSession` tracks sides across ~8 parallel 2-tuples (`results`, `statuses`,
`activities`, `spinnerDelayPassed`, `errors`, `displayedSig`, `encodedLoadId`,
`lastResizeSig`); every operation must touch the right index of the right tuple
(`pickFiles` hand-resets five). Spec:
- New class (same file) with per-side fields:
  `status = $state<SideStatus>('idle')`, `activity = $state<SideActivity>('optimize')`,
  `spinnerDelayPassed = $state(false)`, `error = $state('')`,
  `result = $state.raw<CompressOutcome | null>(null)`,
  `showSpinner = $derived(this.status === 'working' && this.spinnerDelayPassed)`,
  plus NON-reactive bookkeeping: `displayedSig`, `encodedLoadId = -1`,
  `lastResizeSig`, and a `reset()` for the new-file path.
- `session.runtime: readonly [SideRuntime, SideRuntime]` — plain tuple, never
  reassigned (instances are internally reactive; do NOT wrap the tuple in $state).
- Keep thin `$derived` compatibility accessors on `EditorSession` ONLY where a
  template consumes a tuple today (`+page.svelte` reads
  `session.results[index]`, `session.showSpinner[index]`, `session.statuses[index]`,
  `session.activities[index]`, `session.firstError`, `naturalWidth/Height`,
  `docTitle`) — or update the template to `session.runtime[index].result` etc.
  and delete the tuples outright. Prefer the latter; the accessor route is the
  fallback if the diff balloons.
- `results` reassignment pattern dies: each side's `result` is its own
  `$state.raw` field now — assignment per side replaces the copy-both-and-
  reassign dance in `showResult`.
- The cache-pinning call (`pinDisplayedResults`) reads both sides' displayedSig
  — unchanged logic, new field paths.
Gate: `npm run check` 0 errors + FULL `test:e2e` + manual smoke (undo/redo
instant, badge wording, spinner delay, error pill).

---

## Phase 4 — verification + docs

- Full `npm run check` + `npm run test:e2e` (all projects incl. WebKit).
- Interactive smoke (dev server or `vite preview`): load a fixture from
  `tests/fixtures/`, spam the quality slider (encodes stay responsive), copy
  settings across (second side resolves from the shared in-flight pass), undo ×5
  / redo ×5 (instant, no re-encode flash), type `400` in quality (clamps to 100),
  focus a toolbar button and press "2" (divider still), Escape/light-dismiss on
  View options.
- Docs to reconcile per the registry: `STATUS.md` (new Current State entry),
  `parity-audit.md` (§A.16 divider-keys deviation, T3), this doc's Status line,
  registry row already added. Separate docs commit(s).

## Svelte-docs research brief (2026-07-02, via Svelte MCP)

Rules that govern Phases 2–3 (source: official Svelte 5.42+ docs):

- **Debounced effects:** only *synchronously-read* reactive values become
  dependencies — anything read inside `setTimeout`/after `await` is untracked.
  The existing pattern (serialize/snapshot synchronously, then schedule) is the
  documented-correct one; every new debounce MUST keep it. [$effect › deps]
- **Effects must not write state they also read** (`effect_update_depth_exceeded`);
  `untrack` is the sanctioned escape hatch. The existing `untrack` uses in
  `encodeSide`/`snapshotProcessorStateForEncode` are idiomatic — preserve them
  through T5–T7. [$effect › when-not-to-use]
- **`$state.raw` is reassign-only** (mutation is a silent no-op). T10's per-side
  `result = $state.raw<...>(null)` field is assigned wholesale per side — valid,
  and simpler than today's copy-both-reassign tuple dance. [$state.raw]
- **`$state`/`$derived` class fields are the blessed store pattern**; they
  compile to non-enumerable accessors, so `Object.keys`/spread/`structuredClone`
  of an *instance* won't see them — keep snapshotting plain-object subtrees
  (as `captureDocument` does), never class instances. [$state › Classes]
- **Cross-module sharing** (T9/T10): export class instances or never-reassigned
  `$state` objects; getters keep reactivity across boundaries, plain
  destructuring snapshots it. A bare `export let x = $state()` reassigned across
  modules does not work. [$state › passing state across modules]
- **`$state.snapshot` before `postMessage`/worker calls** — proxies don't
  survive structured clone. Already done in `encodeSide`'s request build; keep.
- **Attachments re-run when any state read inside them changes** — pass getters
  (`{@attach retargetViewEvents(() => pinchLeft)}` already follows this). [{@attach}]
- Available-but-not-adopted (noted for later): `$derived` override (5.25+),
  `getAbortSignal()` (could replace manual AbortControllers inside effects),
  `settled()`/`flushSync()` as test/history sync points, `SvelteMap/Set`,
  `$inspect.trace()` for debugging effect re-runs.
