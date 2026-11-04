# Spec: one recipe and one result owner per image

Last updated: 2026-11-04.
Status: done 2026-11-04, in five commits: `bb934039` (recipe module and
signature unification), `71cb2a7c` (`optimizeImage`), `581029ea` (bulk
engine and store on recipes), `4a848c00` (focus-view binding, Rotate, SVG
lane in bulk), and the docs commit that follows them.

Change A of [../reports/2026-11-02-first-principles-review.md](../reports/2026-11-02-first-principles-review.md),
approved by the maintainer on 2026-11-04 ("proceed"; keep the lab skins
working; the recommended override model).

## Deviations

Decided during execution and accepted by the maintainer on 2026-11-04:

- **Unknown source size counts a resize as real.** `recipeSignature` keys an
  enabled resize when the size is 0 or missing, as the spec says. The old
  editor signature folded it away there, which let a resized and an unresized
  result share a cache key. `resizeIsReal` keeps the old meaning for the
  "Resizing" badge and the grain preview.
- **A disabled palette folds out of the signature.** Changing palette options
  while palette reduction is off no longer makes a new cache key or undo step.
- **SVG output ignores rotation.** The vector lane never rotates its text, so
  rotation is dropped from SVG signatures. Production hides Rotate for SVG
  sources; the lab skins still offer it.
- **The transcode lane uses the real decoded size.** `chooseLane` decides the
  JPEG to JXL transcode from the prepared source's own size, not the editor's
  last result size, which can be 0 or stale right after a rotate.
  `transcodeBlocked` in the UI reads the editor's size and reports blocked
  when the size is unknown and a resize is on.
- **Image-scope edits are sent as changes.** The focus view sends
  `editSelected(t => applyRecipeChanges(t, before, after))` rather than
  `() => recipe`, so a multi-selection gets the changed part (rotation,
  output, or one processor) and keeps its other differences. With one image
  selected the result is the same.
- **Adoption goes through the in-flight map.** `EditorSession.adoptResult`
  registers the bulk output as an in-flight pass under the key `encodeSide`
  computes, so the encode effect piggybacks on it and the outcome lands in the
  `ResultCache`. The cache mints its own object URL. SVG outputs are not
  adopted: the focus view runs the vector lane itself.
- **Rotation with every image selected becomes own recipes.** An image-scope
  edit with the whole batch selected normally edits the shared recipe; a
  rotation instead gives each image its own recipe, so the shared recipe
  never rotates.
- **Bulk snapshots moved to version 2** (`sharedRecipe`, `sharedSvgOptions`,
  `resizeReference`, `ownRecipe`). Nothing in the app persists them.

## Objective

Frisp has two editing models for one job. The single editor runs two
`EditorSession` sides, each a (format, optionsByFormat, processorState) plus a
session-wide rotation; bulk runs `BulkImageSettings` plus sparse per-leaf
overrides (`BulkImageOverrides`, `encoderControls`, `DeepPartial`), and
`BulkMode.svelte` translates between them through a seeding bridge (about 250
lines of effects guarded by `seeding`, `pendingSeed`, `seedSerial`). The seam
leaks: bulk cannot rotate (the recipe has no rotation), a batch of SVGs is
rasterized while one SVG stays vector (bulk has no SVG lane), and every
recipe change must agree across two signature schemes.

Replace both with ONE typed `ImageRecipe` (rotation, processors, output kind),
ONE signature function over it, and ONE source-aware operation that runs it
(raster encode, SVG optimize, or JPEG to JXL transcode). Bulk stores a shared
recipe and, per image, either nothing (follows the shared recipe) or a full
own copy. The bulk focus view edits the image's effective recipe through the
existing `EditorSession` and previews the same result bulk exports.

## Non-goals

- Do not merge the single editor's two sides into one, and do not remove the
  two-sided compare. `EditorSession` keeps `sides`, `runtime`, history, and
  its public API (the lab skins call it). Compare-as-a-view is a later change.
- Do not move work into the worker or change the worker bridge (that is
  change B, a separate spec). Bulk may keep decoding per pass.
- Do not change the `app:settings:v3` storage key or its payload shape. The
  single editor still persists sides; recipes convert at the boundary.
- Do not touch `codecs/`, the WASM assets, the codec asset manifest, or the
  service worker.
- Do not redesign the bulk UI. Layout, strip, stack, and panels stay; only the
  data they bind to changes, plus the specific behaviors listed below.
- Do not add auto-quality, presets, or a format race.

## References

- Editor model: `src/lib/editor/editor-session.svelte.ts` (`SideState`,
  `SideRuntime`, `encodeSide` around lines 344 to 583, `#preparedSource`,
  `preprocessorState`, `rotate()`, `seedResizeDimensions`, the history
  watcher), `src/lib/editor/editor-history.svelte.ts`.
- Signature: `src/lib/editor/encode-signature.ts` (`sideRecipe`,
  `encodeSignature`, `resizeIsReal`, `resizeSignature`). Its header explains
  why every consumer must share one projection; keep that property.
- Lanes: `src/lib/compress.ts` (`compressPreprocessed`, `transcodeJpegToJxl`,
  `TranscodeUnsupportedError`, `OUTPUT_FORMATS`), `src/lib/svg/optimize.ts`
  (`optimizeSvgSide`, dynamic import only), `src/lib/svg/detect.ts`
  (`isSvgSource`), `preprocessingIsNeutral` in `editor-session.svelte.ts`.
- Bulk engine: `src/client/lazy-app/bulk/settings.ts` (whole file),
  `session.ts`, `processor.ts`, `export.ts` (`jobChangesPixels`), `index.ts`;
  `src/client/lazy-app/bulk/controls/` (only consumer is the sparse override
  code in `settings.ts`).
- Bulk store and UI: `src/lib/bulk/store.svelte.ts` (`globalSide`,
  `queueGlobalSideApply`, `queueSelectedOverridesApply`, `#flushSelectedApply`,
  `#restoreCachedOrQueueStale`, `#settingsHashForJob`,
  `processingGlobalSettingsForJob`, `seedGlobalResizeDimensions`,
  `requeueStale`), `src/lib/bulk/runtime.ts` (`#processOne`),
  `src/lib/bulk/BulkMode.svelte` (the whole seeding bridge, lines about 40 to
  490), `src/lib/bulk/FocusView.svelte`, `src/lib/bulk/GlobalOptionsPanel.svelte`.
- Tests that encode today's behavior: `tests/unit/settings.test.ts`,
  `controls.test.ts`, `session.test.ts`, `export.test.ts`, `runtime.test.ts`,
  `snapshot.test.ts`, `tests/e2e/bulk.spec.ts`,
  `tests/e2e/export-contract.spec.ts` (two `test.fixme` cases this spec lifts).
- House style: `src/lib/bulk/runtime.ts` and `src/lib/result-cache.ts` per
  `AGENTS.md`. Svelte files go through the Svelte MCP autofixer loop
  (`~/.agents/svelte-mcp.md`).

## Interfaces and data shapes

New framework-neutral module `src/client/lazy-app/recipe.ts`:

```ts
import type { EncoderState, ProcessorState } from 'client/lazy-app/feature-meta/shared';

/** Quarter turns, the same values PreprocessorState.rotate.rotate holds. */
export type Rotation = 0 | 90 | 180 | 270;

/** Options for the SVG lane; same shape as src/lib/svg/optimize-options.ts
 *  SvgOptimizeOptions. Declared structurally here so the engine never
 *  imports $lib. */
export type SvgOutputOptions = Record<string, unknown>;

export type RecipeOutput =
  | { kind: 'raster'; encoder: EncoderState }
  | { kind: 'svg'; options: SvgOutputOptions };

export interface ImageRecipe {
  rotate: Rotation;
  processors: ProcessorState;
  output: RecipeOutput;
}

export interface SourceDimensions { width: number; height: number }

/** The canonical, output-affecting projection: no-op steps fold to null, the
 *  SVG lane ignores rotation and processors, a resize at the (rotated) source
 *  size folds to null. Unknown dimensions (0 or missing) count a resize as
 *  real. */
export function normalizedRecipe(recipe: ImageRecipe, source?: SourceDimensions): unknown;

/** stableStringify(normalizedRecipe(...)). THE key for result caches, bulk
 *  output hashes, history dedupe, and stale detection. */
export function recipeSignature(recipe: ImageRecipe, source?: SourceDimensions): string;

/** Whether the recipe changes pixels (rotation, real resize, real grain,
 *  palette). Replaces settingsChangePixels and preprocessingIsNeutral. */
export function recipeChangesPixels(recipe: ImageRecipe, source?: SourceDimensions): boolean;
```

Rules the projection must keep (each is current behavior, now in one place):
grain counts only when `grainIsReal`; quantize counts only when enabled;
resize counts only when enabled and its target differs from the source
dimensions AFTER rotation (a 90 or 270 turn swaps width and height); for
`output.kind === 'svg'` rotation and processors are dropped entirely; for
raster output the JXL `jpegTranscode` flag stays inside `encoder.options`, so
a transcode result and a pixel result never share a signature.

`src/lib/editor/encode-signature.ts` keeps its exports but implements them by
building an `ImageRecipe` from the side and calling `recipeSignature`, so the
editor's cache, history, and the bulk hash agree by construction. Remove
`sideRecipe` if nothing else needs it after the change.

New module `src/lib/optimize-image.ts` (lib level, because the SVG lane lives
in `$lib/svg`):

```ts
export interface OptimizeOptions {
  signal: AbortSignal;
  bridge: SvelteKitWorkerBridge;
  /** Decode the output back to ImageData for an on-screen preview. Bulk
   *  passes false: it never shows full-size output pixels. */
  preview: boolean;
}

/** Run one recipe on one source. The single dispatch point for the three
 *  lanes: SVG optimize when output.kind is 'svg' (source must be SVG), the
 *  JPEG to JXL transcode when the JXL flag is set, the source is a JPEG, and
 *  recipeChangesPixels is false (TranscodeUnsupportedError falls back to a
 *  pixel encode and is reported in the result), else the pixel pipeline. */
export async function optimizeImage(
  source: PreparedSource,          // decoded + rotated, as #preparedSource returns today
  recipe: ImageRecipe,
  options: OptimizeOptions,
): Promise<CompressOutcome & { transcodeFellBack?: true }>;
```

`EditorSession.encodeSide` calls `optimizeImage` instead of its inline
three-way branch; the "Couldn't transcode this JPEG losslessly" snackbar
moves to the caller and fires on `transcodeFellBack`. When
`preview` is false, `outputImageData` may be absent: make that field optional
on `CompressOutcome` only if a consumer needs it; otherwise return a separate
lightweight type for bulk.

Bulk engine (`src/client/lazy-app/bulk/`):

```ts
interface BulkSession {
  // replaces globalSettings: BulkImageSettings
  sharedRecipe: ImageRecipe;            // rotate is always 0 here
  sharedSvgOptions: SvgOutputOptions;   // the shared recipe's output for SVG sources
  resizeReference?: SourceDimensions;   // unchanged meaning: shared resize
                                        // targets are relative to this size
  jobs: ImageJob[];
  // ...existing fields unchanged
}
interface ImageJob {
  ownRecipe?: ImageRecipe;   // replaces overrides?: BulkImageOverrides
  // ...existing fields unchanged
}
export function effectiveRecipe(session: BulkSession, job: ImageJob): ImageRecipe;
```

`effectiveRecipe` returns `job.ownRecipe` when present. Otherwise it returns
the shared recipe, with `output` replaced by `{ kind: 'svg', options:
sharedSvgOptions }` when the job's source is an SVG, and with the shared
resize resolved per source through today's `resolveSettingsForSource` preset
logic (25, 50, 100 percent presets scale to each source; custom sizes apply
as given). `job.output.settingsHash` becomes `recipeSignature(effectiveRecipe,
sourceDims)`.

Delete: `BulkImageOverrides`, `BulkEncoderControlOverrides`, `DeepPartial`,
`mergeDeep`, `getEffectiveEncoderState`, `sparseEncoderControlsFromState`,
`normalizeImageOverrides`, `getSettingsOverridePaths` (if unused),
`hasSettingsOverrides` (replace with `!!job.ownRecipe`), and the
`controls/` registry with `tests/unit/controls.test.ts`, once nothing imports
them. Re-check with quoted-glob greps before deleting.

Store (`src/lib/bulk/store.svelte.ts`) public API, replacing
`globalSide`/`queueGlobalSideApply`/`queueSelectedOverridesApply`/
`applyAnchorOverrides`/`clearAnchorOverrides`/`clearSelectedOverrides`/
`resetAllOverrides`/`processingGlobalSettingsForJob`:

```ts
setSharedRecipe(recipe: ImageRecipe): void;      // global scope edits
setSharedSvgOptions(options: SvgOutputOptions): void;
/** Image-scope edit: apply `edit` to each selected job's effective recipe and
 *  store the result as its ownRecipe; a result equal (by signature) to what
 *  the job would inherit clears ownRecipe instead. One selected job is the
 *  common case; several is "apply to selected". */
editSelected(edit: (recipe: ImageRecipe) => ImageRecipe): void;
resetSelectedToShared(): void;
effectiveRecipeFor(jobId: string): ImageRecipe | undefined;
```

Keep the existing 200 ms coalescing for slider drags (today's apply timers)
so a drag does not requeue the batch on every input event.

Focus view binding (`BulkMode.svelte`, `EditorSession`):

- Add to `EditorSession` two pure converters, exported from a non-Svelte
  module (`src/lib/editor/side-recipe.ts`): `recipeFromSide(side,
  preprocessorState): ImageRecipe` and `applyRecipeToSide(recipe, side):
  PreprocessorState` (writes format, the active format's options, and
  processorState onto the side; returns the rotation to set).
- On selection, BulkMode loads the job's source into `focusSession` and
  applies its effective recipe to side 1 (side 0 stays Original). If the
  job's current output is valid for that recipe, put a `CompressOutcome` for
  it into the focus session's `ResultCache` under `recipeSignature` (decode
  the output file once for the preview) so the editor's own encode effect
  lands on a cache hit. Do not write `runtime.result`, `displayedSig`, or
  `status` from outside `EditorSession`; delete `seedHydratedRuntime`,
  `applyHydratedFocus`, `reconcileSeededOverrides`, `normalizeExistingOverrides`,
  `buildOverrideFrom*`, and the `seeding`/`pendingSeed`/`seedSerial` guards.
- Edits flow one way: an effect reads `recipeFromSide(focusSession.sides[1],
  focusSession.preprocessorState)` and, in image scope, calls
  `bulkStore.editSelected(() => recipe)`; in global scope the global panel
  calls `setSharedRecipe`. Guard the first emission after a load (the value
  just applied) by comparing signatures, not with a boolean latch.
- Restore Rotate in the bulk focus view (`onRotate={() =>
  focusSession.rotate()}` on `FocusView`'s `Output`), now that rotation is
  part of the image's recipe. Rotate is an image-scope edit.
- `GlobalOptionsPanel`: when every job is an SVG, show the SVG options bound
  to `sharedSvgOptions`; otherwise show the raster controls bound to
  `sharedRecipe` and add one line under the caption when the batch contains
  SVGs: "SVGs keep vector optimization. Open one to convert it." Copy may be
  tightened; no em dashes.

Bulk runtime: `#processOne` calls `optimizeImage(prepared, effectiveRecipe,
{ preview: false })` through the lib layer instead of
`processBulkImageJob`; keep the 2026-11-04 completion recheck
(`requeueStale`) and the cancel latch fix intact. `processBulkImageJob` may
remain as a thin engine-level wrapper for unit tests or be removed if unused.

## Edge cases

| Input | Required behavior |
|---|---|
| Rotate an image 90 in bulk, then export | The exported file is rotated (dimensions swapped). The job shows the override dot; Reset restores the shared recipe and an unrotated export. |
| Rotate, then a shared resize at 50 percent | Resize applies to the rotated dimensions (a 1024x683 photo rotated 90 resizes to 342x512). |
| Shared resize at a custom 800x600 in a mixed-size batch | Unchanged from today: custom sizes apply as given; preset percentages scale per source. |
| Batch of two SVGs | Each exports `.svg` from the SVG lane with `sharedSvgOptions`. |
| Mixed batch (PNG + SVG), shared output WebP | PNG exports `.webp`; SVG exports `.svg`. |
| Open an SVG in the focus view and pick WebP | The SVG gets an own recipe with raster output and exports `.webp`; Reset returns it to `.svg`. |
| JPEG with shared output JXL and transcode on | Transcodes losslessly; if a rotation or real resize is added to that image, it pixel-encodes instead (the toggle shows blocked, as in the single editor today). |
| A job edited to equal the shared recipe | `ownRecipe` is cleared and the override dot disappears. |
| Shared recipe edited while a job has an own recipe | The job keeps its own recipe (no per-leaf inheritance; this is the accepted model). |
| Several images selected, change quality in image scope | Each selected job gets an own recipe with that quality and its other values kept. |
| Settings change while a job is encoding | Still requeued after completion (runtime recheck). |
| Selecting an image whose output is current | The focus view shows it without a new encode (cache hit). |
| Selecting an image whose output is stale or missing | The focus view encodes it through `EditorSession` as today. |
| Single editor, any format, rotate, undo, redo | Unchanged behavior: undo still lands on a cache hit (shared signature). |
| Saved `app:settings:v3` payload from before this change | Loads unchanged (no storage change). |

## Test plan

Unit (Vitest, `tests/unit/`):

- `recipe.test.ts`: `recipeSignature` folds no-op grain, disabled quantize,
  identity resize; resize compares against rotated dimensions; SVG output
  ignores rotation and processors; the JXL transcode flag changes the
  signature; `recipeChangesPixels` truth table.
- Editor parity: for a matrix of side states, `encodeSignature` equals
  `recipeSignature(recipeFromSide(...))`, and `applyRecipeToSide` followed by
  `recipeFromSide` round-trips.
- Rewrite `settings.test.ts`, `session.test.ts`, `export.test.ts`,
  `snapshot.test.ts` for `sharedRecipe`/`ownRecipe`: effective recipe for
  plain, SVG, own-copy, and resize-preset jobs; `editSelected` creates and
  clears own recipes; stale detection uses `recipeSignature`; keep-original
  uses `recipeChangesPixels`. Delete `controls.test.ts` with the registry.
- Keep `runtime.test.ts` green (adapt the host shape only).

E2E (Playwright, both projects):

- Lift both `test.fixme` cases in `tests/e2e/export-contract.spec.ts`
  ("rotating an image in bulk rotates its exported file", "a batch of SVGs
  gets the same vector optimization as one SVG") to `test`, and delete the
  temporary "bulk offers no Rotate that its export would ignore" test.
- Add to the same file: mixed PNG + SVG batch exports `.webp` and `.svg`;
  rotate one image in bulk then Reset exports the unrotated size.
- `tests/e2e/bulk.spec.ts` stays green; update selectors only if markup
  changed, never weaken assertions.

## Acceptance criteria

1. `npm run check` exits 0 with 0 errors and no new warnings beyond the 57
   `corner-shape` warnings.
2. `npm run test:unit` exits 0; `tests/unit/recipe.test.ts` exists and passes.
3. `npm run test:e2e` exits 0 in Chromium and WebKit with the two lifted tests
   passing and no `test.fixme` left in `export-contract.spec.ts`.
4. `grep -rn "BulkImageOverrides\|encoderControls\|DeepPartial\|seedSerial\|pendingSeed\|seedHydratedRuntime" src tests --include='*.ts' --include='*.svelte'`
   prints nothing.
5. `src/lib/editor/encode-signature.ts` and the bulk hash both call
   `recipeSignature`; `grep -rn "recipeSignature" src` shows both.
6. `BulkMode.svelte` is at most 300 lines (today about 640).
7. The lab routes still render in `npm run dev` (`/lab/porcelain`,
   `/lab/hybrid`, `/lab/darkroom` load an image and encode); state how you
   checked.

## Verification

```bash
npm run check
npm run test:unit
npm run test:e2e
```

Pass means each exits 0. If the Chromium project fails at launch with
"Executable doesn't exist", run `npx playwright install chromium` (an
environment gap, not a regression; see `docs/gotchas.md`). Then run
`npm run bench` only if `optimizeImage` changed the raster path's work, and
report any size change.

## Guardrails

- Commit after each working phase, straight to `main`, one concern per
  commit (the maintainer reads the log as progress): 1) recipe module and
  signature unification with parity tests; 2) `optimizeImage` used by the
  single editor; 3) bulk engine and store on recipes with rewritten unit
  tests; 4) focus-view binding, Rotate restored, fixme tests lifted; 5) docs.
  If executing as a subagent, do not commit: stop after each phase and report
  so the driver reviews and commits.
- Never touch `codecs/`, workers, the service worker, or the asset manifest.
- Never change the `app:settings:v3` key or payload shape.
- Keep every lab skin compiling and working; they use `EditorSession`'s
  public API (`sides`, `runtime`, `rotate`, `copyToOther`, `saveSide`,
  `importSide`, `canImport`, `downloadName`, `exportable`).
- `svgo`/`fflate` must stay out of the main bundle: reach the SVG lane only
  through a dynamic `import('$lib/svg/optimize')` inside `optimizeImage`.
- If the editor parity test cannot be made to pass without changing what the
  single editor caches or encodes, stop and report rather than loosening it.
- If a bulk behavior in `tests/e2e/bulk.spec.ts` must change, stop and ask.
- No em dashes in code comments or docs you write. Never auto-format `*.md`.

## Codebase assumptions to re-verify before starting

Check each; if one is false, adapt and say so in the report.

1. `BulkMode.svelte` hydrates the focus session by writing `runtime.result`
   and related fields from outside (`seedHydratedRuntime`).
2. Bulk has no rotation in `BulkImageSettings` and no SVG lane in
   `processor.ts`; `FocusView.svelte` passes no `onRotate` (removed
   2026-11-04, commit `3b6fe559`).
3. The only importer of `client/lazy-app/bulk/controls` is `settings.ts`;
   the lab skins import only `isSupportedBulkImage` from the bulk engine.
4. `encodeSignature` is the editor's cache and history key, and BulkMode's
   hydration relies on matching it.
5. `ResultCache.set` accepts an externally built `CompressOutcome` and pins
   by `outputUrl` (`src/lib/result-cache.ts`).
6. `tests/e2e/export-contract.spec.ts` holds the two `test.fixme` cases named
   above.
