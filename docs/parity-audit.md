# Editor parity audit & deviation log

Last updated: 2026-06-01.

Goal: the Svelte editor must not **lose** any feature or gain any bug relative
to the original Preact Squoosh editor. This doc tracks (a) deliberate deviations
made during migration, (b) things that need the user's input/discussion before
acting, (c) the running gap list from the automated parity audit, and (d) items
deferred by explicit decision.

The audit is a multi-agent workflow (`editor-parity-audit`) that enumerates the
original editor's behaviors area-by-area, classifies each against the Svelte
source, then adversarially re-verifies every flagged gap to drop false
positives. Last run 2026-05-31: **107 behaviors audited, 41 confirmed gaps**
(9 major, 24 minor, 8 trivial). Re-run after significant editor changes.

**Re-run 2026-06-01** — regression-focused pass after the `EditorSession`
refactor (editor logic extracted from `+page.svelte`) and the repo "flip" to
root. Scoped to only the changed surfaces (4 finder agents + adversarial
verify; the byte-identical ~90% of the editor was skipped). **61 behaviors
verified, ZERO major regressions.** 8 minor/trivial gaps found and ALL FIXED
(commits "Fix editor-state parity regressions…" + "Restore Output touch/focus
workarounds…"); 1 dismissed:

- FIXED (minor): rotate 90/270 now swaps the Resize width/height (had left the
  fields + preset stale vs the rotated source); SVG sources default the resize
  method to "vector" again (had reverted to lanczos3); the encoder dropdown no
  longer momentarily lists unsupported browser encoders before `canvas.toBlob`
  detection; the Import button now validates the stored payload (was
  key-presence only); processor-state import validation rejects partial/null
  inner values, matching the original.
- FIXED (trivial): "settings saved" snackbar back to 1500ms; Android-Chrome
  `touchend` active-element blur restored; Firefox focus-reflow before the
  zoom-edit input restored.
- DISMISSED: the tab-title hourglass starts ~100ms earlier on option changes —
  cosmetic, sub-perceptible, clears correctly. Not a regression.

Rotate-swap and SVG-vector were browser-verified; the rest are code-level
parity restorations (svelte-check 0/0, build green).

---

## A. Deliberate deviations (done, no input needed)

Intentionally different from the original because Svelte offers a cleaner idiom;
behavior parity is preserved.

1. **Drag-to-replace = a Svelte attachment**, not the `file-drop-element`
   custom element. `lib/editor/file-drop.ts` `fileDrop(onFiles)` (`{@attach}`)
   on the app wrapper; reactive, auto-cleaned, no custom-element registration.
2. **Snackbar = a rune-backed store**, not the `<snack-bar>` custom element.
   `lib/editor/snackbar-store.svelte.ts` + `Snackbar.svelte`; `show()` returns a
   promise resolving with the chosen action (so Undo works exactly like Squoosh).
3. **Encoder panels re-sync via `{#key options}`** instead of Preact's
   `getDerivedStateFromProps`. Remounting on options-object identity change is
   the idiomatic Svelte way to re-seed a panel after copy/import.
4. **Post-rotation dims via a derived value** off a new `preprocessedWidth/Height`
   on `CompressOutcome`, instead of the original reading `source.preprocessed`
   live each render.
5. **Results-bubble metrics shrunk** slightly so the size + percent badge +
   download blob fit the 300px panel without overflowing the viewport.

> NOTE (import gotcha): shared `.svelte.ts` stores must be imported by the SAME
> specifier everywhere (we use `$lib/editor/snackbar-store.svelte`). A mix of
> `$lib/…` and relative `./…` makes Vite instantiate the store twice, so writes
> from one component never reach the other. Cost us a debugging cycle.

---

## B. Resolved decisions + still-open items

Resolved 2026-05-31 (user: "restore them; for the rest, make the best call"):

- **DONE — Browser-native encoders (Browser JPEG / PNG / GIF) restored** with
  runtime feature-detection (`getSupportedFormatIds()`); Browser GIF self-hides
  where canvas can't encode it. Browser JPEG got a 0–1 quality panel.
- **DONE — `contain` resize fitMethod** now letterboxes inside the original
  footprint (canvas object-fit), aligned at the two-up split.
- **DONE — History → SvelteKit shallow routing** (`pushState`/`page.state` from
  `$app/navigation`), replacing the raw `history` API (no more router warning).

Deliberate deviations (my call — re-open if you disagree):

1. **Pinch-zoom re-fits on a dimension change (rotate/resize)** rather than
   preserving the user's zoom/pan with the original's pan-compensation math.
   Re-fit is simpler and arguably nicer (re-centres the new framing); the
   compensation is risky for marginal benefit.
2. **`wp2` (WebP v2, "unstable") is experimental parity** — restored in the
   SvelteKit surface with generated single-thread encode/decode assets and a
   Svelte option panel. Chromium production-preview QA now covers online and
   offline `.wp2` encode; keep it experimental until maintainer/product testing
   says it is worth promoting.

Deferred to the post-migration roadmap (infra/product work, not migration
feature/bug parity):

3. **Shared decode.** Dual-side runs the full `compressFile` (incl. decode) per
   side — redundant on large images when comparing two encoders. Treat this as
   post-launch performance work.
4. **Share-target (PWA).** Needs an installable PWA + `share_target` manifest +
   a SW POST handler. Defer until the roadmap PWA track.
5. **`$app/*` type shim — DONE 2026-06-01.** `src/sveltekit-app.d.ts` was
   deleted. Root cause: the root `tsconfig.json` overrode `include`, which
   dropped the generated `ambient.d.ts` (it carries
   `/// <reference types="@sveltejs/kit" />`, the source of the real `$app/*`
   types). Fix: curate `include` to add the generated `ambient.d.ts` /
   `non-ambient.d.ts` / `$types` (a full inherit isn't possible — it pulls in
   `vite.config.ts` and crashes `svelte-check` with `forEachResolvedModule is
not a function`). The real types also caught a latent bug: `resolve('/logo.webp')`
   on a static asset — fixed to `asset('/logo.webp')` (`resolve()` is for routes).

---

## C. Verified parity gaps from the audit (status)

### Fixed in this pass (commit "Close audit parity gaps (batch 1)")

Major: browser/in-app Back (history+popstate) · copy-settings snackbar + Undo ·
AVIF & JXL panel re-sync on copy/import · Resize "Vector" method for SVG sources
(browser-verified: SVG decodes, Vector encodes) · post-rotation
`inputWidth/Height` · 500ms delayed loading spinner · SI (base-1000) filesize
formatting.

Minor/trivial: document-title filename + hourglass · open pushes a history entry
· Back uses `history.back()` · immediate first encode · non-image-file rejection
message · drop an image anywhere (not just the dropzone) · "Original Image
(filename)" option label · save-side snackbar (with try/catch) · import-side
snackbar + Undo · invalid-import message + basic validation · versioned saved
settings · 300ms reveal animations · zoom step 1.25 · download-icon rotate
animation · zoom readout width 7rem / grey · JXL "(beta)" label · 100ms debounce
· reset view on a new same-size file.

### Also fixed (second pass)

Browser JPEG/PNG/GIF encoders + feature-detection · `contain` fitMethod
alignment · history via SvelteKit shallow routing. (See §B "Resolved".)

### Deliberate deviations / deferred (see §B)

Pinch-zoom re-fits on dimension change · WebP 2 threaded/prominence decisions ·
shared decode (post-launch performance) · share-target (PWA).

### Deferred / N-A (see §D)

Mobile multi-panel accordion · `<two-up>` legacy `clip` fallback (modern desktop
only) · quantize "ZX" konami easter-egg (intentionally cut) · document-title
restore-on-unmount (vacuous — the route never unmounts) · share-target (B-7).

---

## D. Known-deferred (by user decision)

- **Mobile `<multi-panel>` accordion** from the original remains deferred. The
  SvelteKit editor now has a responsive lower-panel fallback instead; verify it
  before deciding whether the original accordion is still needed.
- Items above explicitly marked deferred/intentional.
