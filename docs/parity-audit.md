# Editor parity audit & deviation log

Last updated: 2026-06-28.

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

**Follow-up 2026-06-01 (Svelte-hardening Wave 4, commit `d943b611`).** The
`EditorSession` reactivity was refactored (loadId-scoped guards replacing
prevFiles/dimsSeeded; `showSpinner` as a `$derived` AND-gate; encode/spinner
`$effect`s moved into the class via `$effect.root`). Behavior-preserving and
browser-verified that these four expectations still hold: immediate first
encode, 100ms-debounced option change, 500ms delayed spinner (seen appearing
mid-encode and clearing on done), and reset-view-on-a-new-file. No regressions.

**Re-run 2026-06-28 — targeted port-faithfulness re-audit + a found regression.**
A user report (resizing the output made the two-up "resize in place" so the split
stopped aligning) traced — via `git log -S` — to commit `6718bbc9` ("Align
contain-resized output…", §B): the port had **narrowed** the original's
*unconditional* canvas-box pinning to fire only when the resize fitMethod is
`contain`, so the default `stretch` downscale rendered the output canvas at its
intrinsic (smaller) size and the two halves no longer shared a footprint.
**Fixed (commit `596661e2`):** restored the original `getOutputPreviewImageState`
invariant — both canvases' CSS box is pinned to the preprocessed source dims
unconditionally (shared `$derived` box dims + `style:` directives), with
`object-fit: contain` added per-side only on a contain-resized side; `fitTarget`
degated in lockstep. Guarded by a new e2e
(`tests/e2e/resize-twoup-footprint.spec.ts`).

Three agents then re-audited the **display layer**, the **options/processor
surface**, and the **session state machine** against pristine upstream Squoosh —
**no other major regression.** Recommend-leave leftovers: `leftDraw/rightDraw`
borrows the sibling side rather than `source.preprocessed` (a documented
deviation, §A.6); `onScaleInput`'s stricter parse (unreachable behind
`<input type=number>`); the flex-center → JS-fit redesign. The cosmetic
preset-label rounding is **fixed** (commit `3341bdb0`: the `0.3333` preset shows
`33.33%`, not `33%`). The `two-up.ts` divider "2"-key value is the already-done
Wave-0 item, not a new gap.

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
6. **Preview in-progress UX — restored fallback + new per-side badge
   (2026-06-03).** Two parts:
   - *Parity restoration:* the original Squoosh Output falls back to
     `source.preprocessed` so a side is never blank while it encodes
     (`rightDrawable() = rightCompressed || source.preprocessed`). The Svelte
     port had **lost** this — the right panel sat BLANK through the whole first
     encode (very visible on slow codecs). Restored: each side now borrows the
     other side's image (`leftDraw/rightDraw = own ?? other`) until it has its
     own result. `Output.svelte`.
   - *Deliberate enhancement (beyond parity):* a per-side in-progress **badge**
     over the relevant half — **"Optimising…"** on the first encode,
     **"Re-optimising…"** once a result exists and a setting change re-runs the
     encoder (the prior result stays on screen, crisp, while the new one
     computes). The original showed no in-canvas indicator and swapped silently.
     Gated by the same 500ms `showSpinner` delay as the download spinner, so fast
     encodes never flash it. **Design decision:** the badge is the *single*
     consistent "this side is working" signal — an earlier draft also blurred the
     placeholder, but that was inconsistent (blur on first encode, none on
     re-encode) and read as a bug; a clear text label is more honest than a blur,
     and keeping the previous result crisp on a re-encode lets the user still see
     their current output. `Output.svelte`, `+page.svelte` (passes
     `leftWorking/rightWorking`).
7. **WebP default options diverge from upstream (2026-06-03):** quality **80**
   (was 75) and method **6** — highest effort / best compression (was 4) — set as
   the project's preferred default, since WebP is the default right-side encoder
   and stays sub-second even at method 6.
   `src/features/encoders/webP/shared/meta.ts`. The persisted-settings key was
   bumped `sqush:settings:v2 → v3` so pre-existing saved side-settings (which
   would otherwise mask the new default) are discarded and the fresh default
   (left = Original, right = WebP) loads.

8. **Full visual redesign — the "studio" theme (2026-06-11).** The editor no
   longer mimics Squoosh's pink/blue look. New design system in
   `lib/editor/theme.css`: floating glass option panels (inset, blurred,
   bordered) instead of edge-flush black cards; per-side accents are now
   **coral (left, the brand squeeze-orange) / azure (right)** instead of
   pink/blue; section headers are uppercase labels with an accent tick instead
   of full-width colored bars; the Results speech-bubble + download blob were
   replaced by a panel footer (filesize + a semantic green/red delta badge + a
   "Save" pill button); the back blob is a round glass "X"; the two-up divider
   is a hairline with a glass scrubber; the zoom/tool buttons are glass pills;
   typography moved to the self-hosted **Outfit Variable** font (root stays
   12px rem-based). The landing page gained a gradient headline, a coral
   browse disc, codec chips, and staggered entrance reveals. **Behavior parity
   is untouched** — every control, shortcut, state machine, and the
   `--main-theme-color`/`--hot-theme-color` per-side variable contract remain
   (only the resolved values changed). `npm run check` green; verified in the
   browser at desktop + mobile widths.

9. **In-place file replace resets per-image state but keeps the encoder
   (2026-06-28).** Dropping a new image over the open editor (or opening a fresh
   one) keeps each side's `format` + `optionsByFormat` (quality/effort/…) but
   **resets rotation and the whole processorState** — resize *and* palette
   reduction. Upstream Squoosh preserved rotation + palette across an in-place
   replace; resetting them is a deliberate product decision (user, 2026-06-28):
   palette reduction is per-image and often *increases* size, so silently carrying
   it onto an unrelated image is a footgun, and deliberate cross-image palette work
   will live in bulk edit. The rationale is pinned in a `pickFiles` code comment
   (commit `984788b1`) so a future audit doesn't "restore" the upstream behavior.
   (A future Undo should make open/replace one checkpoint that snapshots the full
   session, so the reset is recoverable in a single step.)

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
  **Superseded 2026-06-27:** these were removed again — they only duplicated the
  WASM codecs for the same formats (MozJPEG for JPEG, OxiPNG for PNG) and made
  larger files, so they were never useful in a compression tool. The
  feature-detection (`getSupportedFormatIds`) went with them. See
  [codec-surface-cleanup.md](codec-surface-cleanup.md) §3.
- **DONE — `contain` resize fitMethod** letterboxes inside the original footprint
  (canvas `object-fit: contain`), aligned at the two-up split. **Correction
  (2026-06-28):** the commit that added this over-narrowed the box-pinning to the
  `contain` case only, regressing the default `stretch` downscale; the box is now
  pinned for *all* resizes, with `object-fit: contain` layered on only for Contain
  (see the 2026-06-28 re-run at the top).
- **DONE — History → SvelteKit shallow routing** (`pushState`/`page.state` from
  `$app/navigation`), replacing the raw `history` API (no more router warning).

Deliberate deviations (my call — re-open if you disagree):

1. **Pinch-zoom re-fits on a dimension change (rotate/resize)** rather than
   preserving the user's zoom/pan with the original's pan-compensation math.
   Re-fit is simpler and arguably nicer (re-centres the new framing); the
   compensation is risky for marginal benefit.
2. **`wp2` (WebP v2, "unstable") was experimental parity — now RESOLVED by
   removal (2026-06-02).** It was restored in the SvelteKit surface for migration
   parity, but the maintainer testing that decision called for was done (see
   [codec-upgrade-audit.md](codec-upgrade-audit.md) §3) and concluded WebP 2 is a
   permanently-experimental format no browser can decode, so it was removed
   entirely — see [codec-surface-cleanup.md](codec-surface-cleanup.md). This
   parity item is closed.

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

Pinch-zoom re-fits on dimension change · WebP 2 removed entirely (2026-06-02) ·
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
