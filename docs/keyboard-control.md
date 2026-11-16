# Keyboard Control (design proposal)

Status: **Proposed — not started** (maintainer idea, 2026-07-02). Build AFTER
the bulk Phase-2 promotion + Phase-2b left panel land (they rewire the same
files a key layer hooks into). Inventory below was generated from code on
2026-07-03; re-verify line references before implementing.

Goal: operate the entire app with simple, Figma-style keys — single letters
for actions, typed digits for values (Photoshop-style "type 85 → Quality 85"),
no modifier gymnastics for common things — plus a discoverable "what does
what" overlay. Mouse-optional workflows for both the single editor and bulk.

## What exists today (inventory, 2026-07-03)

Global/window key handlers already in the code:

| Where | Keys | Notes |
| --- | --- | --- |
| `src/routes/+page.svelte` | Cmd/Ctrl+Z, ⇧Z, Ctrl+Y | undo/redo; guards typeable fields (skips `INPUT` except range/checkbox/radio, `TEXTAREA`, contenteditable) |
| `src/lib/editor/output/two-up.ts` | `1` `2` `3` | two-up divider: left/center/right; ignores focused controls |
| `src/lib/bulk/FocusView.svelte` | z/y (mod), Delete/Backspace, Escape, ←/→ | bulk undo/redo, remove selected, deselect/close sheet, prev/next selection; same typeable guard |
| `src/lib/bulk/StackStage.svelte` | ←/→ (window!) | cycles the stack's front card; **no typeable guard today** |
| `src/lib/bulk/StackStage.svelte` divider | ←/→/Home/End (+Shift) | `role="slider"` element handler |
| `src/lib/bulk/strip-selection.ts` | Enter/Space (+Shift/Meta) | select / range / toggle on strip cells |
| `src/lib/editor/output/Output.svelte` | Enter | zoom readout becomes a number input |
| popovers (Output, FocusView) | Escape | light-dismiss |
| `src/lib/editor/intro/Intro.svelte` | paste event | Cmd/Ctrl+V imports a clipboard image |

No `aria-keyshortcuts` anywhere yet. Every `Range` control renders a native
range + mirrored number input (native arrow-stepping preserved).

Formats (`src/lib/compress.ts` OUTPUT_FORMATS + identity): `webP` WebP ·
`avif` AVIF · `jxl` JPEG XL · `jpegli` JPEG · `oxiPNG` PNG · `identity`
Original. Quality fields: WebP 0–100; AVIF 0–99 lossy (100 = lossless);
JXL 0–99 (100 = lossless); jpegli 0–100; OxiPNG has NO quality (effort only).
WebP lossless mode's "Slight loss" is inverted (`near_lossless = 100 − v`).

## Proposed keymap v1 (draft — letters are maintainer decisions)

Single keys fire only when no typeable control is focused and no popover is
open; each handled key calls `preventDefault()`. All shortcuts live in ONE
registry module (see Architecture) — the overlay renders from it, so the
cheat-sheet can never drift from the code.

| Key | Single editor | Bulk mode |
| --- | --- | --- |
| `W` | right side → WebP | scope (global/selected) → WebP |
| `A` | right side → AVIF | scope → AVIF |
| `X` | right side → JPEG XL | scope → JPEG XL |
| `J` | right side → JPEG | scope → JPEG |
| `P` | right side → PNG | scope → PNG |
| `O` | left side → Original (identity) | — |
| `S` | save right side's output | Save all (ZIP) |
| `0–9` | quality entry (buffer, below) | quality entry for the scope |
| `R` | rotate | — (later: rotate selected) |
| `F` | reset view (fit) | reset stage view |
| `L` | toggle Lossless (if the codec has it) | same for scope |
| `C` | copy settings to other side | — |
| `?` (⇧/) | shortcut overlay | shortcut overlay |
| Esc | close popover/overlay | (existing) deselect / close sheet |

Notes on the maintainer's sketch: the original idea assigned `P` twice (AVIF
and PNG) — resolved here as `A`=AVIF, `P`=PNG. JPEG vs JPEG XL contend for
`J`; drafted as `J`=JPEG, `X`=JPEG XL (alternatives: `G`=JPEG… decide).

**Digit-entry semantics (Photoshop opacity model):** typing digits buffers
them for ~600 ms; two digits = exact value ("8","5" → 85), a single digit
followed by the timeout = ×10 ("7" → 70), "0" alone = 100 (Photoshop
convention) or 0 — decide. The value writes to the ACTIVE side's Quality
(single editor: right side; bulk: current scope), clamped to the codec's real
range (AVIF/JXL cap at 99), no-op for OxiPNG, with a small transient readout
near the affected control so the user sees what changed. While a number input
is focused, digits are native — the global layer stays out.

**Conflict to resolve before building:** the two-up divider already owns
`1`/`2`/`3`. Digits-as-quality collides. Options: (a) move divider snapping
to `[`/`]`/`\` and free ALL digits for value entry (recommended); (b) reserve
1–3 for the divider and accept quality entry starting at 4 (bad); (c) require
a leading key for value entry, e.g. `Q` then digits (less Photoshop-like).

**Recommendations on the five open decisions (Fable, 2026-07-12 — each is a
yes/no for the maintainer, with reasoning):**

1. **Letters:** keep `J`=JPEG, `X`=JPEG XL. JPEG is the higher-frequency
   target and "X" is the natural JXL mnemonic; `G` for JPEG has no mental
   hook.
2. **Divider digits:** option (a) — move divider snapping to `[` / `]` / `\`
   and free ALL digits for quality entry. Digit-quality is the Photoshop
   muscle memory this feature exists for; divider snapping is low-frequency,
   and `[`/`]` are spatially better mnemonics for "split left/right" anyway.
3. **"0" alone:** = maximum quality (100, clamped to 99 on AVIF/JXL),
   matching Photoshop's opacity convention. Anyone typing a bare 0 at a
   quality control is reaching for that muscle memory; 0-as-minimum would be
   a rude surprise, and an explicit "0","1" still gives 1 if truly wanted.
4. **Save key:** plain `S`; do NOT intercept `Cmd+S`. The whole layer is
   bare-letter Figma-style — hijacking the browser's save shortcut buys
   nothing except broken user expectations in a web app.
5. **`S` in bulk = Save all (ZIP):** yes. One consistent meaning — "save
   what I'm looking at" — and in bulk what you're looking at is the batch.

**Browser-clash analysis:** bare letters/digits carry no browser default
outside inputs, so Figma-style keys are safe. Cmd/Ctrl combos stay untouched
(existing undo/redo pattern). `/` and `'` trigger Firefox quick-find —
`?` (shift+/) with preventDefault works, but verify on Firefox. Space scrolls
the page — don't bind it. `Cmd+S` COULD be intercepted for save (Figma does);
proposed here as plain `S` instead, keeping browser saves untouched — decide.

## Architecture (one registry, three contexts)

- New `src/lib/editor/keymap.svelte.ts`: a registry of
  `{ key, context: 'intro'|'single'|'bulk'|'global', when?, run, label,
  group }`. One window keydown listener; central typeable/popover guard; the
  digit buffer lives here too. The two existing global handlers
  (+page undo/redo, FocusView keys) MIGRATE into it — do NOT stack a third
  ad-hoc listener; StackStage's unguarded window arrows migrate as well and
  gain the guard (bug today, noted 2026-07-03).
- The overlay (`?`) renders the registry grouped by `group`, showing only
  entries whose `when()` is currently true; also add `aria-keyshortcuts` to
  the trigger buttons from the same data.
- Format keys call the SAME code paths as the pickers
  (`session.setFormat(1, id)` / bulk scope apply) so history/persistence/
  override signaling behave exactly as a mouse change.
- Framework truth pass required before build (Svelte MCP: current guidance on
  window listeners in runes modules, `aria-keyshortcuts` support).

## Phases

1. **K1 — core layer + format keys + S + overlay** (the registry, guards,
   migration of existing handlers; executable from the spec by a coding agent).
2. **K2 — digit value entry** (buffer, readout, per-codec clamps; needs the
   divider-key decision first).
3. **K3 — bulk depth + view keys** (L/F/R in bulk, strip size, scope tabs).

Dependency: none on the codec-options-model refactor (quality is a plain
field in every lossy codec today); K2's "which control owns the digits"
question grows richer after Phase 3 per-control overrides, but v1 targeting
Quality only is safe now.

## Open maintainer decisions

1. Letters: `J`=JPEG + `X`=JPEG XL, or another split?
2. Divider keys: free up `1/2/3` (move divider to `[`/`]`/`\`)? (Recommended.)
3. Single-digit semantics: Photoshop ×10, or exact-only with 2-digit commit?
4. Plain `S` vs intercepted `Cmd+S` for save?
5. Does `S` in bulk mean Save all, or save the SELECTED image (and ⇧S all)?
