# Film Grain processor (v1)

Last updated: 2026-07-12.
Status: done (shipped 2026-07-12, `3db56a3e`–`7b548dea` + e2e/docs follow-ups;
v1.1 same day: Advanced Size control + live scrub preview, see §Size and
§Live preview).

Maintainer-approved 2026-07-12 (design session; supersedes the road-map.md
"Film Grain / Debanding" idea sketch). Two use cases, one mechanism: a filmic
finishing touch for clean/AI-generated images ("de-plasticking"), and
noise-as-dither that masks gradient banding at low quality.

## Decision: baked pixels, not codec-native synthesis

Grain is **baked into pixels as a processor step** (resize → **grain** →
quantize), identical for every output format. Codec-native synthesis was
researched (2026-07-11 session) and rejected for v1:

- JPEG/WebP/PNG have no native mechanism at all — baking is the only universal
  path.
- AVIF's Film Grain Synthesis can only *preserve* noise measured from the
  source (libaom `denoise-noise-level`) or apply 1 of 16 fixed test tables; it
  cannot author arbitrary aesthetic grain. Whether Safari's AVIF decoder even
  applies FGS is unconfirmed.
- JXL's photon-noise is real and stays exposed (the existing advanced
  `photonNoiseIso` control), but JXL only decodes in Safari today.
- Baked grain is WYSIWYG: the compare view is the truth in every viewer,
  which is the product's core promise. Native grain is a decode-time promise
  kept inconsistently across viewers.

Known cost, accepted: grain is high-frequency noise, so it inflates lossy
output sizes, and very low quality smooths it away. The live preview makes
that trade visible; that is the feature working as intended.

## The grain model (measured, not invented)

Calibrated 2026-07-12 against 20 Luminar Neo / Pixelmator Pro exports on
known synthetic canvases plus 3 real-photo pairs (analysis script:
`analyze_grain.py`, session scratchpad; summary below). The maintainer's
preferred look is Luminar's default film grain; measurements decoded it as:

| Property | Measurement | Model |
|---|---|---|
| Chroma | R=G=B correlation 1.000 | monochrome: one noise value added to R, G and B |
| Spectrum | lag-1 autocorrelation ≈ 0 | per-pixel white noise, no filtering |
| Distribution | excess kurtosis ≈ −1.5 (uniform is −1.2) | `sign(u)·|u|^0.683` of uniform u — matches Luminar's default Roughness 30 |
| Luma response | symmetric midtone peak, →0 at both ends | amplitude × `4·L·(1−L)`, L = pixel luma/255 (Rec.709 weights, encoded/sRGB values) |
| Amount → σ | linear, σ_mid ≈ 0.437·Amount (8-bit) | `amplitude = 0.44 · amount · 4L(1−L)` |
| Resolution | same recipe at 1024² and 2048² | applied after resize, at output resolution |

Verified against real photos: predictions within ~5% at Amount 12 and 24
across three images (shadow/midtone/highlight bins). Luminar's Size slider was
measured to be nearly inert (white spectrum at S=0…100) — which is why v1 has
**no size control**. Pixelmator's grain (band-limited, σ scales with its Size)
was measured for contrast and not chosen.

Maintainer's reference points on this scale: Amount **12** = the everyday
default look for clean/AI images; ~24 = a deliberate creative look; 100 ≈
Luminar A100 (σ≈44, extreme).

## Implementation

New processor feature `src/features/processors/grain/`:

- `shared/meta.ts` — `Options { amount: number }` (0–100),
  `defaultOptions { amount: 12 }`.
- `shared/apply.ts` — the model above as a pure function over RGBA bytes
  (in-place on a caller-owned copy), plus an `applyGrain(ImageData)` wrapper
  for the worker. Deterministic: fixed-seed xorshift32, PRNG advances once per
  pixel (writes skipped where alpha = 0 so fully transparent pixels stay
  byte-identical and compressible). Same input + amount ⇒ identical bytes,
  which keeps the result cache, undo/redo and bulk staleness contracts exact.

Wiring (mirrors quantize everywhere):

- `feature-meta/shared.ts` — `grain: Enableable & Options` in
  `ProcessorState` + `defaultProcessorState` (+`ProcessorOptions`), and a
  `grainIsReal()` helper (enabled && amount > 0) shared by pipeline,
  signature, and bulk recipe so "enabled at 0" is a true no-op everywhere.
- `image-pipeline-shared.ts` — `ProcessWorkerBridge.grain`; `processImage`
  order: resize → grain → quantize. Grain runs at output resolution (stable
  grain scale) and BEFORE quantize (a 16-color request still yields 16
  colors; the quantizer dithers the grain into the palette).
- `codec-worker.ts` — `grain()` method (pure JS, no WASM URLs), Comlink
  transfer like the other 13 returns.
- `sveltekit-worker-bridge.ts` — method name + both API interfaces (no
  subclass override needed: there are no asset URLs to close over).
- `encode-signature.ts` — `sideRecipe` gains `grain: grainIsReal(...) ?
  state.grain : null`. Session-local signatures only; nothing persisted.
- `editor-session.svelte.ts` — `snapshotProcessorStateForEncode` snapshots
  grain (tracked; toggling/sliding must re-encode).
- `settings-storage.ts` — `app:settings:v3` schema is FROZEN and the autosave
  payload never carried processorState (sides only persist format + options),
  so nothing changes there. The explicit per-side save slots DO carry
  processorState: `parseSavedSide` default-fills a missing `grain` so
  pre-grain saves keep importing (validator accepts absent-or-valid).
- Bulk: `bulk/settings.ts` `normalizedProcessorRecipe` gains
  `grain: grainIsReal ? clone : null`; `bulk/controls/grain.ts` registers the
  single `grain.amount` control ("Grain") in `processorControls` so per-image
  override dots/resets work via the WS-G registry.
- UI (`OptionsPanel.svelte` + `options/GrainOptions.svelte`): ToggleRow
  **"Film grain"** between Resize and Reduce palette (panel order = pipeline
  order), one **Amount** slider 0–100, no advanced section. Shared by single
  editor and bulk (same component).

## Size (v1.1, 2026-07-12)

`size` (1–4, default 1, Advanced reveal) sets grain particle scale. 1 keeps
the calibrated per-pixel path byte-identical. 2–4 bilinear-interpolate a
noise lattice with `size`-px spacing; each of the size² fractional phases
gets an exact `1/√(Σwᵢ²)` variance correction, so Amount means the same σ at
every size (unit-tested).

Why it exists — the debanding experiment (WebP, banding-prone dark gradient,
q30/50/75; band-limited noise = bilinear-upsampled gaussian, generated via
Pillow in the session scratchpad):

| Noise | Debands at q50? | Bytes vs clean |
|---|---|---|
| white σ≤2 (Amount ≤ ~4) | no — encoder deletes it | ~1–1.2× |
| white σ5.3 (Amount 12) | yes | 12.6× |
| 2px σ2 (Amount ~5) | yes | 2.1× |
| 4px σ2 | yes | 3.8× |

Lessons: sub-threshold fine noise is deleted by the encoder (pay nothing,
fix nothing); coarser grain survives quantization at low amplitude. The
byte-efficient debanding recipe is **Size 2, Amount 4–6**. (Multipliers are
worst-case: clean gradients compress to almost nothing.) Roughness was
deliberately NOT added: histogram-shape-only, no size/debanding effect.

## Live preview (v1.1, 2026-07-12)

While a pass is in flight and the side's grain recipe differs from the
displayed result's (`SideRuntime.displayedGrainSig`), the viewer shows the
preprocessed frame with the CURRENT grain applied — the same
`applyGrainToPixels`, same seed, so the scrub frame is the exact encoder
input. The settled encode replaces it (`grainPreview` cleared when status
leaves 'working' or recipes match). Honesty guards: engages only when grain
is the sole step between the preprocessed frame and the encoder — an active
(real) resize or palette reduction suppresses it.

Mechanics (`EditorSession.updateGrainPreview` / `#drainGrainPreview`):
latest-wins drain loop per side, full-res main-thread apply, yields between
renders. **Deliberately not requestAnimationFrame** — rAF stalls completely
in non-compositing contexts (background tabs, headless/e2e), which was
observed directly during verification. At rotation 0 the preprocessed frame
is `#decodedPromise`'s `.decoded` (`#preprocessedPromise` stays null by
design — see `#preparedSource`). Wired in `+page.svelte` and bulk
`FocusView.svelte` as `grainPreview ?? result?.outputImageData`.

## Tests

`tests/unit/grain.test.ts` against the pure byte function: determinism
(identical runs), amount-0/disabled no-op, σ at mid-gray ≈ 0.44·A (±5%),
midtone-parabola ratios at L≈0.1/0.5/0.9, monochrome deltas (R=G=B), alpha-0
pixels untouched, clamping at the byte edges. E2e: extend the existing editor
suite with grain-toggle → output-bytes-change (+ bulk override dot via the
registry test pattern if cheap).

## Verification gates

`npm run check` · `npm run test:unit` · `npm run test:e2e` · manual: grain on
a gradient at low WebP/JPEG quality visibly masks banding in the compare view
(synthetic check — encode the gradient fixture at q≈30 with amount 0 vs 12).

## Out of scope (v1)

Size/roughness controls (measured inert / pinned constants), chroma grain,
grain presets, AVIF FGS passthrough, CLI surface (inherits later via the
shared pipeline).
