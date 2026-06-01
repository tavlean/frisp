# Sqush Post-Migration Cleanup & Svelte Hardening Plan

Last updated: 2026-06-01.

Read [STATUS.md](STATUS.md) first for live state. The SvelteKit 2 / Svelte 5
migration is **concluded** — `main` is the production app and the retired
Preact/Rollup app lives on the `preact` branch (tag `preact-final`). This
document is the next track: **clean up, simplify, and make the codebase fully
idiomatic Svelte 5** without changing user-facing behavior.

The components are line-by-line ports of the original Squoosh Preact `.tsx`
files, so the residue is concentrated at component _boundaries_ (raw-event
props, mirrored form state) and in the _reactivity mindset_ (effect-set-state,
mutable "previous value" guards) — not in Svelte-4 syntax. There is **no**
`createEventDispatcher`, no `on:` directives, no `export let`, no `$:`, and no
`writable()` stores anywhere. This is hardening, not rescue.

Findings below were produced by two independent read-only reviews (Claude's
multi-agent audit + a second AI's pass) and cross-checked. Each item notes its
source and whether it was verified against the code.

## Working rules for this phase

- Behavior-preserving only. Protect import → decode → process → encode →
  preview → export → service-worker/offline. Regressions there are blockers.
- Use the Svelte MCP docs and run the Svelte autofixer after meaningful Svelte
  edits. Keep `npm run check` green and browser-verify UI changes.
- Land in small, reviewable tranches (one wave or a few related items per
  commit). Re-run the parity expectations from
  [parity-audit.md](parity-audit.md) after editor changes.
- Keep `File`, `Blob`, `ImageData`, workers, WASM, and object URLs out of broad
  reactive state (existing rule — Wave 0 enforces it).

---

## Wave 0 — Confirmed defects & rule violations (do first; small, high value)

> **Done 2026-06-01** (commit `c11544dc`). Gate green, autofixer clean,
> browser-verified (encode + re-encode render, divider centers at 0.5, settings
> persist, no console errors).

- [x] **Fix the two-up divider "2" key bug.** `_relativePosition` is set to
      `0.25` instead of `0.5` because of a stray `/ 2`
      ([two-up.ts:105](../src/lib/editor/output/two-up.ts:105)). `_setPosition()`
      paints 50% immediately, but `_resetPosition()` (on orientation change /
      resize, [two-up.ts:125](../src/lib/editor/output/two-up.ts:125)) recomputes
      from the stored `0.25`, so the divider jumps to 25%. Fix: drop the trailing
      `/ 2` so it matches the `Digit3` branch shape
      ([two-up.ts:113](../src/lib/editor/output/two-up.ts:113)). _Source: second AI;
      verified. Effort: trivial._
- [x] **Get browser host objects out of deep `$state`.**
      `results = $state<[CompressOutcome | null, …]>`
      ([editor-session.svelte.ts:181](../src/lib/editor/editor-session.svelte.ts:181))
      deep-proxies objects that hold `File`, `ImageData`, and a Blob-URL string
      ([compress.ts:152](../src/lib/compress.ts:152)). This violates the project's
      own "no heavy browser objects in reactive state" rule. The reactive UI only
      needs sizes, percent, dimensions, the URL string, and `isOriginal`; the
      `ImageData`/`File` are consumed imperatively by the canvas in `Output`. Fix:
      use `$state.raw` on `results` (reassign on update), or split a plain-data
      result DTO from a non-reactive store of the host-object refs. _Source: both;
      verified. Effort: medium._
- [x] **Debounce `persistSettings()`.** It runs from a bare `$effect` with no
      throttle ([editor-session.svelte.ts:321](../src/lib/editor/editor-session.svelte.ts:321),
      [+page.svelte:37](../src/routes/+page.svelte:37)), serializing and writing
      JSON to `localStorage` on every reactive tick — ~60×/sec while dragging a
      quality slider. Fixed: payload is serialised synchronously (so the `$effect`
      still tracks its deps) but the `localStorage` write is deferred 200 ms;
      `dispose()` flushes any pending write so the last edit is never dropped.
      _Source: Claude; verified. Effort: small._

## Wave 1 — Dead-code purge (pure subtraction; verify with `npm run check`)

> **Done 2026-06-01** (commit `25fe0669`). 187 lines removed; gate green;
> browser-verified (clean reload boots + encodes + settings persist).

All low-risk deletions. The `src/client/lazy-app/*.ts` logic tree is **live** —
only the items below are dead.

- [x] Delete `src/shared/missing-preact-types.d.ts` — dead `preact` module shim;
      nothing imports `preact`. It also actively suppresses the type error that
      would catch a stray `import … from 'preact'`. _Source: both; verified._
- [x] Delete `src/client/lazy-app/util/clean-modify.ts` — `cleanMerge`/`cleanSet`
      are Preact's immutable copy-on-write helpers; **zero callers** repo-wide and
      conceptually obsolete under `$state` in-place mutation. _Source: Claude;
      verified zero callers._
- [x] Remove dead React-onChange helpers from `src/client/lazy-app/util/index.ts`:
      `inputFieldValueAsNumber`, `inputFieldChecked`, `inputFieldCheckedAsNumber`,
      `inputFieldValue` (plus unused `shallowEqual`, `transitionHeight`). Kept
      `isSafari` (live). Also-dead but kept (out of scope): `konami` (the
      deliberate ZX easter-egg) and the trivial `preventDefault`. _Source: Claude;
      verified no callers._
- [x] Delete the stale CSS-module `*.css.d.ts` stubs and the dirs that hold only
      them (`src/client/lazy-app/Compress/**`, `src/shared/prerendered-app/**`,
      `src/shared/custom-els/**`, `src/client/initial-app/**`,
      `src/static-build/**`, plus `theme.css.d.ts`, `output/two-up.css.d.ts`,
      `output/pinch-zoom.css.d.ts`). **Note:** `*.css.d.ts` is gitignored, so
      these were never committed — removed from the working tree only; a fresh
      clone never had them. The side-effect `import './x.css'` resolves via
      `vite/client`'s ambient `*.css` declaration. _Source: Claude; verified._

## Wave 2 — The dominant Preact-ism: controlled-component event boundary

> **Done 2026-06-01** (commits `89e710a2` 2a Checkbox/Toggle, `216292e9` 2b
> Select, `f04e55e2` 2c Range/number inputs). Every `currentTarget as HTML…`
> cast helper is gone from the panels (verified zero). Gate green throughout;
> browser-verified WebP/AVIF lossless toggles, MozJPEG enum select, format
> switch, and resize aspect-ratio.

Highest leverage — one change at the primitives ripples through every panel.

- [x] **Narrow the form-primitive event contracts.** `Select`, `Checkbox`,
      `Toggle`, and `Range` currently expose `onchange?: (event: Event) => void`
      (raw DOM event up), forcing every caller to re-implement
      `Number((e.currentTarget as HTMLSelectElement).value)` /
      `(e.currentTarget as HTMLInputElement).checked`. Type callbacks as the _value_
      (`(value: string) => void`, `(checked: boolean) => void`) doing the one cast
      inside the primitive, or lean on the `$bindable()` already declared and let
      callers `bind:value` / `bind:checked` (`Wp2Options` already proves this with
      `bind:value={options.uv_mode}`). Deletes the `numValue` / `checked()` cast
      helpers from every panel. _Source: both; verified. Effort: medium._
- [~] **Make `options` ownership explicit.** _Partially done:_ plain fields now
  flow through `bind:`/`$bindable`, making ownership explicit; the
  mirror-state panels (AVIF/JXL) still mutate via `apply()` and are addressed
  in Wave 3. Children currently mutate fields of a mutable proxy passed
  down one-way
  ([OptionsPanel.svelte:151](../src/lib/editor/OptionsPanel.svelte:151),
  [ResizeOptions.svelte:41](../src/lib/editor/options/ResizeOptions.svelte:41),
  [WebpOptions.svelte:47](../src/lib/editor/options/WebpOptions.svelte:47)). It
  works (mutating a passed `$state` proxy is reactive) but ownership is implicit;
  prefer `$bindable`/`bind:` or explicit setter methods. Pairs with the item
  above. _Source: second AI; verified. Effort: medium._

## Wave 3 — Promoted to its own project

> **Out of cleanup scope.** The AVIF/JXL mirror-state + `apply()` is the most
> Preact-flavored code left, but it also encodes real UX (e.g. Lossless mode
> remembers your lossy quality, inter-field rules, inferred toggles), so it can't
> be flattened to plain `bind:` without regressions. Rather than a minimal
> collapse, this is being treated as a forward-looking investment: a shared
> **codec options model** that maps raw codec fields ↔ human controls in one
> place, makes panels thin and testable, and pre-pays presets / target-size /
> bulk per-image overrides. Design + plan: [codec-options-model.md](codec-options-model.md).
> To be started fresh after Waves 4–6. (This also absorbs the old "data-driven
> codec panels" deferred item.)

## Wave 4 — Reactivity-model cleanups (retire React-style guards)

- [ ] Replace the `prevFiles` mutable "previous value" ref
      ([editor-session.svelte.ts:203](../src/lib/editor/editor-session.svelte.ts:203))
      and the `dimsSeeded` one-shot boolean
      ([editor-session.svelte.ts:201](../src/lib/editor/editor-session.svelte.ts:201))
      with `loadId`-scoped reactivity (capture `loadId` in the effect closure).
      These currently must be hand-reset in `pickFiles`/`clearFile`. _Source: both._
- [ ] `showSpinner`: keep only the 500 ms delayed flip as an effect and expose
      the value as `$derived` AND-gated with status
      ([editor-session.svelte.ts:292](../src/lib/editor/editor-session.svelte.ts:292)).
      _Source: Claude._
- [ ] Move the encode/spinner `$effect`s into `EditorSession` (via
      `$effect.root()` or a constructor setup) so the class owns its reactive
      lifecycle, instead of `+page.svelte` forwarding cleanup-returning methods
      ([+page.svelte:30](../src/routes/+page.svelte:30),
      [editor-session.svelte.ts:237](../src/lib/editor/editor-session.svelte.ts:237)).
      _Source: both. Effort: medium._
- [ ] Diagnostics page: convert the `onMount` probes + manual `cancelled` guard
      to per-probe `$effect`s with cleanup
      ([diagnostics/+page.svelte:42](../src/routes/diagnostics/+page.svelte:42)).
      _Source: Claude. Low priority (dev tool)._

## Wave 5 — Output attachments & small idiom wins

- [ ] Convert the last `use:focusOnMount` action to `{@attach}` for consistency
      with `file-drop.ts` ([Output.svelte:195](../src/lib/editor/output/Output.svelte:195)).
- [ ] Extract the imperative event-retargeting `$effect` into a parameterized
      `{@attach}` attachment ([Output.svelte:147](../src/lib/editor/output/Output.svelte:147));
      optionally the canvas-draw/fit setup too. Localizes setup/teardown. _Source:
      both._
- [x] Replace the `downloadAttributes` `$derived`-object spread on `<a>` with
      conditional attributes (`href={disabled ? undefined : …}`)
      ([Results.svelte](../src/lib/editor/Results.svelte)). **Done** (`780ad8af`).
- [x] Wrap the inline `determineLosslessQuality(...)` template call in a
      `$derived` ([WebpOptions.svelte](../src/lib/editor/options/WebpOptions.svelte)).
      **Done** (`780ad8af`).
- [x] Drop the shallow `$derived` aliases over the non-reactive diagnostics model
      and the `onInput` wrapper. **Done** (`780ad8af`).
- [x] Guard `customElements.define` with `if (!customElements.get(name))`
      ([pinch-zoom.ts](../src/lib/editor/output/pinch-zoom.ts),
      [two-up.ts](../src/lib/editor/output/two-up.ts)) to avoid HMR / double-eval
      `NotSupportedError`. **Pulled forward and done 2026-06-01** (it was breaking
      dev HMR for these modules and would have dogged Waves 2–6). _Source: second
      AI; verified. Dev-only impact._

## Wave 6 — Structural simplification (readability ROI)

- [ ] Extract a shared "Advanced settings" snippet/component — the
      `<Revealer> + {#if showAdvanced}<div transition:slide>` scaffold is duplicated
      verbatim across AVIF/WebP/WP2/MozJPEG, each re-declaring `showAdvanced`.
      _Source: Claude. Best bang-for-buck simplification._
- [ ] Extract `OptionRow` / `ToggleRow` snippets to replace the ~87 repeated
      `<div class="option-one-cell">` / `<label class="option-toggle">` wrappers
      across the nine panels. _Source: Claude._
- [ ] Add a root `src/routes/+layout.svelte` (or `app.css`) for the shared body
      font stack + reset, currently duplicated in both route pages
      ([+page.svelte:156](../src/routes/+page.svelte:156),
      [diagnostics/+page.svelte:287](../src/routes/diagnostics/+page.svelte:287)).

## Deferred — bigger / design-dependent (do after the waves above)

- **Konami → "ZX" palette easter-egg (revisit together).** Upstream Squoosh hid a
  ZX-Spectrum-style palette behind the Konami code (↑↑↓↓←→←→BA). The **engine is
  still intact** — `quantize/worker/runtime.ts` honours `opts.zx` via
  `zx_quantize` — but the Svelte UI omitted the unlock trigger, so `konami()`
  (`client/lazy-app/util/index.ts`) currently has no caller. **Decision: keep it**
  (deliberately retained; see the code comment on `konami()`), and later put our
  own spin on it so it reads as "noticed and evolved," not untouched. Re-wiring
  would mean: on Konami in the Reduce-palette panel, reveal a control that sets
  `options.zx = 1`. To discuss before implementing.
- **Context API for `OptionsPanel`.** Pass `EditorSession` / per-side state via
  `setContext`/`getContext` to collapse the ~15-prop interface
  ([+page.svelte:119](../src/routes/+page.svelte:119)). Matter of taste given the
  singleton is already reactive; do it _after_ Wave 2 so the boundary is clean
  first.
- **Data-driven codec panels.** Folded into the codec options model project —
  see [codec-options-model.md](codec-options-model.md).
- **Legacy service-worker / cache surfaces.** A second AI flagged `skip-waiting`,
  `share-ready`, `cache-all` in `src/client/lazy-app/sw-bridge/runtime.ts` and
  old app-chunk modeling in `src/sw/cache-plan.ts` as possible dead surface.
  **Unverified** and outside the Svelte-idiom scope. This needs its own
  SW-focused pass with build + offline verification — the service worker is
  protected; do not lump it into idiom cleanup.

## Explicitly not in scope

- Production bulk UI (roadmap; needs design — see [road-map.md](road-map.md)).
- Codec pruning / visibility changes (separate engineering decision; follow
  [codec-provenance.md](codec-provenance.md)).
- Server-side processing or upload paths.
- `class:` → `class={…}` object-form conversion — low value; current `class:`
  usage is fine. Skip unless it demonstrably improves a specific component.

## Dropped after verification

- "Unguarded `localStorage` reads in `hasSavedSide`/`importSide`" (second AI) —
  **refuted**: both early-return behind `canUseLocalStorage()`
  ([editor-session.svelte.ts:121](../src/lib/editor/editor-session.svelte.ts:121),
  [editor-session.svelte.ts:450](../src/lib/editor/editor-session.svelte.ts:450)).
  Only a marginal stylistic inconsistency remains (existence-check vs the write
  paths' `try/catch`); not worth a dedicated change.
