# Codec Options Model (design proposal)

Status: **Proposed — not started.** This is a standalone project to be picked up
fresh _after_ the post-migration cleanup ([svelte-hardening-plan.md](svelte-hardening-plan.md))
is finished. It supersedes the deferred "collapse AVIF/JXL mirror-state" (Wave 3)
and "data-driven codec panels" items by treating them as one coherent piece of
work.

Goal: not just parity — make the codec UI a foundation that new features can be
built on cheaply, while genuinely simplifying the code. High one-time cost is
acceptable; a band-aid or a path-of-least-resistance flatten is not.

## The problem

A codec doesn't store user-facing concepts; it stores low-level numbers. Every
options panel therefore does a two-way translation between **raw codec fields**
and **human controls**, and today each panel solves it ad hoc, in a slightly
different style:

- **One toggle → many fields.** AVIF "Lossless" is not a field; turning it on sets
  `quality = MAX`, `subsample = 4:4:4`, and changes alpha handling. JXL "Lossless"
  forces `quality = 100` and couples `lossyPalette`/`lossyModular`.
- **Inversions / renames.** WebP/AVIF "Effort" is the inverse of the stored
  `speed`; WebP "Slight loss" is `100 - near_lossless`; "Filter sharpness" is
  `7 - filter_sharpness`.
- **Fake booleans.** WebP stores several flags as `0/1` integers, not booleans.
- **Inferred toggles.** AVIF/JXL infer "lossless" / "separate alpha" from the
  current field values at mount.
- **Inter-field rules.** JXL: `quality < 7` forces `lossyModular = true`. AVIF:
  `separateAlpha` decides whether `qualityAlpha` is `-1` or a real value.
- **Mode memory.** The single most important UX behavior: set quality to 60, flip
  Lossless **on** (stored quality becomes MAX), flip it **off** — the slider must
  return to **60**, not a default. Today a private "mirror" copy remembers it.

In AVIF/JXL this is implemented as the Preact idiom: snapshot the incoming options
once, keep a local mirror of every human value, and call an `apply()` that
recomputes the raw fields on every change. It is correct and parity-faithful, but
it is not idiomatic Svelte, it is duplicated reasoning across nine files, it needs
the `{#key options}` remount hack to re-seed on copy/import, and adding a control
means editing the mirror + `apply()` + the template.

## What a good model unlocks

- Expose codec knobs that already exist in the engine but aren't surfaced (e.g.
  MozJPEG arithmetic coding, the unexposed WebP knobs, the ZX quantize toggle).
- **Presets** and a **"target a file size"** mode, expressed once and reused.
- Consistent handling of inversions/inferred toggles/mode-memory instead of nine
  bespoke variants.
- **Testable** mappings — the field↔control translation can be unit-tested,
  which is impossible while it lives inside `.svelte` markup.
- **Pre-pays the bulk UI** ([road-map.md](road-map.md)): bulk needs "global
  settings + per-image overrides," which is exactly a clean options model applied
  N times. Doing this first makes bulk far smaller.

Explicit non-goal: this does **not** make compression faster or the output
smaller — that is a separate track (shared decode, threaded codecs, better
defaults). What it does is make every future UX/output feature cheap to add.

## Proposed shape (to be validated in design)

Per-codec **view-model** as a rune module (`*.svelte.ts`), e.g.
`createAvifModel(options)`, that:

- owns the human-facing values as `$state` (Lossless, Effort, Separate alpha, …)
  and the remembered-on-mode-switch values;
- exposes pure conversions as `$derived` (Effort ↔ speed);
- writes back to the `options` proxy through clear getters/setters (no scattered
  `apply()`), so the `.svelte` panel just binds to `model.effort`, etc.

Once the shape is proven on the two hardest codecs (AVIF for mode logic, WebP for
inversions + fake-booleans), consider generalizing the common cases into a small
**declarative descriptor** (field, control type, transform, default, dependencies)
so panels become largely data-driven — **but only if the descriptor genuinely
reduces total code.** A heavy bespoke DSL would be worse than the duplication; the
abstraction must earn its place.

## Behaviors to preserve (acceptance criteria)

Treat these as the regression checklist; re-run the editor parity expectations
([parity-audit.md](parity-audit.md)) and browser-verify each codec:

- Mode memory: toggling Lossless off restores the prior lossy quality (every codec
  that has Lossless).
- AVIF Lossless → `quality = MAX`, `subsample = 4:4:4`, alpha handling; Effort is
  `MAX_EFFORT - speed`.
- JXL Lossless ↔ `quality = 100`; `quality < 7` forces `lossyModular`; Slight loss
  ↔ `lossyPalette`.
- WebP inverted sliders (`near_lossless`, `filter_sharpness`), `0/1` flags, lossless
  Effort preset table.
- AVIF/JXL inferred toggles seed correctly at mount and after copy/import (the
  behavior the `{#key options}` remount currently provides).

## Suggested approach (multi-step, each independently verifiable)

1. **Design** the model shape against AVIF + WebP; decide data-vs-code boundary.
2. **Spike** one codec (AVIF) end-to-end; browser- and parity-verify every item
   above before going wider.
3. **Roll out** per codec, deleting the per-panel mirror/`apply()` and the
   `{#key options}` hack as each is migrated.
4. **Generalize** the common cases into a descriptor only if step 3 shows it pays
   off; fold in the data-driven-panels idea here.
5. Only then build on top (hidden knobs, presets, target-size) — and reuse the
   model for bulk per-image overrides when that lands.

## Risks

- Over-abstraction (a DSL that adds complexity instead of removing it). Mitigate by
  proving on real codecs first and keeping the smallest thing that works.
- Subtle regressions in mode/inference logic. Mitigate with the acceptance
  checklist + parity audit + per-codec browser verification.

## Sequencing vs bulk Phase 3 (analysis, 2026-07-02)

A read-only analysis pass settled the open question "does this refactor precede
the bulk per-image override UI (Phase 3)?" — verdict: **neither first-in-full.
Do a minimal middle slice, then Phase 3, and defer the full refactor.**

- The real Phase-3 blocker is **semantic sparsity**, not UI polish: bulk
  overrides store `encoderState` wholesale, so touching one per-image control
  freezes EVERY option of that encoder for that image — later global changes to
  untouched fields stop flowing through, contradicting the design promise that
  a touched control overrides just that control
  ([bulk-ui-design-options.md](bulk-ui-design-options.md) §"sparse overrides").
- Hand-rolling per-leaf logic without a model repeats the store's current
  quality/method special case per codec × per transformed control (inverted
  Effort, multi-field Lossless, inferred toggles…). Raw-field diffs cannot say
  which VISIBLE control deserves a dot or what "reset this control" means.
- The **minimal slice**: (1) per-leaf merge for same-format encoder overrides in
  the bulk engine (format override stays wholesale); (2) a small per-codec
  control registry — control id, raw-field dependencies, compare/apply/reset —
  covering only the currently visible controls of the 5 encoders; (3) bulk UI
  consumes it for dots/resets. Single-image panels stay untouched (their
  mirror/`apply()` pattern is unaffected), so the frozen localStorage wire
  format and parity are safe.
- Maintainer decisions needed before the slice: do Phase-3 dots/resets cover
  **all visible controls or only headline ones**, and is an "override path" a
  **human control id** (recommended) or a raw codec field?

The full model (steps 1–5 above) remains worthwhile but should follow Phase 3;
its blast radius (all five panels + OptionsPanel + history/persist behavior)
is not needed to unblock bulk.
