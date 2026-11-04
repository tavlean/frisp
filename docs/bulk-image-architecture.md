# Bulk image architecture

Last updated: 2026-11-04.

This document records the framework-neutral bulk engine model. Bulk Phase 2
shipped to production on 2026-07-03; current UI decisions and phased follow-ups
live in [bulk-ui-design-options.md](bulk-ui-design-options.md) and the executed
specs in [specs/](specs/).

The framework-neutral helper surface is exported from `src/client/lazy-app/bulk/index.ts`. UI code should prefer that entry point over deep imports when it needs several bulk helpers together.

The helper surface now includes pure strip item selectors, selected-job detail selectors, and a session summary selector. Future UI should consume those selectors instead of recomputing selected state, effective recipes, output state, export readiness, queue slots, override counts, or progress inside components.

Queue UI should consume the queue-state selector rather than calculating active jobs, open slots, or runnable jobs itself. That keeps concurrency behavior consistent between the runner and future controls.

Active bulk statuses are defined by the session model. Queue transitions and snapshot restore/counter logic should use that helper instead of duplicating `decoding`/`processing` checks.

The canonical bulk status list is also exported from the session model. Snapshot validation should use that list so new statuses cannot be added to runtime state without updating restore validation.

Queue status transitions should use the shared job counter delta helper when removing a job from an active or exported state. That keeps direct completion/failure/requeue and batch stale/incomplete/cancel transitions aligned if persisted session counters drift from the job list.

Bulk session mutations should normalize existing counters before applying job-list changes. This keeps appended jobs, removed jobs, and exported jobs from carrying forward stale persisted `activeJobs` or `exportedCount` values.

Queue retry, stale-output requeue, incomplete-job requeue, and active-job cancellation should use the shared queued reset helper so output/error cleanup stays consistent.

Import UI should create sessions through the import-to-session helper so rejected files are kept out of the live session consistently and the first accepted image is selected by the same session rules everywhere.

Import results keep the legacy rejected file list and also include structured rejection reasons. The import summary aggregates those reasons. Future UI should use those reasons to distinguish unsupported files from unreadable files instead of showing a generic failure.

Normal import and MIME-sniffed import record accepted jobs and rejected files through the same internal path. That keeps accepted job IDs, rejection lists, and structured rejection reasons aligned if future bulk import surfaces add drag-and-drop, directory import, or retry flows.

If users add more images after a batch already exists, UI should append through the import append helper. That keeps rejected files out of the session and reuses the same duplicate-safe job ID rules as normal session additions.

Export UI should create an export plan and then mark that plan exported through the plan helper after downloads are triggered. The helper reuses the stale-output guard, so a changed shared or own recipe cannot mark old output as exported.

Current-output, ready-for-export, and current-export predicates live in the session model. Queue, export summaries, export entries, and mark-exported flows should use those shared predicates so stale output handling stays consistent.

Processing code takes each job's recipe from `effectiveRecipe` and its output hash from `jobRecipeHash`, so the runtime, stale detection, and the focus view agree on what a job becomes.

Snapshot restore is metadata-only. It can restore the batch list, original file metadata, the shared recipe and SVG options, selection, errors, and own recipes, but it cannot restore live decoded images or optimized output blobs. Restored jobs that depended on live processing output return to `queued` so the app regenerates outputs before export. Use the serialized restore helper when loading a saved snapshot string so parsing and restoration share the same validation path.

## Product goal

The user should be able to:

1. import multiple images;
2. choose shared optimization settings;
3. see output size and percentage saved for every image;
4. select one image for detailed before/after review;
5. give that one image its own settings (including a rotation) without
   changing the shared settings;
6. export all optimized images.

## Core concepts

Every image becomes the result of one `ImageRecipe`
(`src/client/lazy-app/recipe.ts`): a rotation, the pixel processors (resize,
grain, palette), and an output, either a raster encoder state or SVG optimizer
options. The single editor uses the same type, and `recipeSignature` over it
is the one key for result caches, bulk output hashes, history dedupe, and
stale detection.

### Bulk session

A bulk session is the current batch of imported images and settings.

```ts
interface BulkSession {
  id: string;
  sharedRecipe: ImageRecipe;          // rotate is always 0
  sharedSvgOptions: SvgOutputOptions; // the shared output for SVG sources
  resizeReference?: BulkSourceDimensions;
  jobs: ImageJob[];
  selectedJobId?: string;
  activeJobs: number;
  exportedCount: number;
}
```

`resizeReference` is the size a shared resize was set against: a shared
resize that matches its 25, 50, or 100 percent preset means that fraction of
each source; any other size applies as given.

### Image job

An image job represents one imported file.

```ts
interface ImageJob {
  id: string;
  sourceFile: File;
  relativePath?: string;
  status: ImageJobStatus;
  originalSize: number;
  sourceWidth?: number;
  sourceHeight?: number;
  previewUrl?: string;
  thumbnailUrl?: string;
  output?: ImageOutput;
  ownRecipe?: ImageRecipe; // absent: the job follows the shared recipe
  error?: string;
}
```

Statuses:

```ts
type ImageJobStatus =
  | 'queued'
  | 'decoding'
  | 'processing'
  | 'encoded'
  | 'failed'
  | 'skipped'
  | 'exported';
```

### Own recipes

A job either follows the shared recipe or has a full own copy. There is no
per-field inheritance: once a job has its own recipe, later shared edits do not
reach it. That is the accepted model; Reset to global clears the own recipe.

- `editJobRecipes(session, ids, edit)` applies an edit to each job's effective
  recipe and keeps the result as its own recipe. A result with the same
  signature as what the job would inherit clears the own recipe instead, so an
  edit that changes nothing leaves no override dot.
- `setJobOwnRecipe(session, id, undefined)` returns a job to the shared recipe.
- The strip's override dot and the selected-job detail read
  `job.ownRecipe !== undefined`.

### Effective recipe

Effective recipes are computed, not stored (`session.ts`):

- `inheritedRecipe(session, job)`: the shared recipe, with its output swapped
  for `{ kind: 'svg', options: sharedSvgOptions }` when the source is an SVG
  (a batch of SVGs stays vector), and its resize preset resolved against the
  job's own size (`resolveRecipeForSource` in `settings.ts`).
- `effectiveRecipe(session, job)`: `job.ownRecipe` when present, else the
  inherited recipe.
- `jobRecipeHash(session, job)`: `recipeSignature(effectiveRecipe, sourceSize)`,
  the hash a current output must carry.

### Image output
### Image output

```ts
interface ImageOutput {
  file: File;
  size: number;
  downloadUrl: string;
  percentChange: number;
  settingsHash: string;
}
```

`settingsHash` is the job's `jobRecipeHash` at the time the output was made,
so the app can tell whether the output is still valid after a recipe change.
It inherits the recipe signature's folding: only the output's own options
count, disabled resize and palette and grain at zero collapse out, an enabled
resize collapses out when it does not change that job's (rotated) size, an SVG
output ignores rotation and processors, and percentage presets resolve against
each job before hashing.

### Session snapshots

Bulk session snapshots are metadata records for handoff, diagnostics, and future persistence planning.

Current module: `src/client/lazy-app/bulk/snapshot.ts`.

Snapshot rules:

- Include durable metadata: session id, shared recipe, shared SVG options, resize reference, selected job id, job ids, file names, MIME types, sizes, last-modified timestamps, statuses, own recipes, errors, and output size summaries. The current snapshot version is 2.
- Exclude live browser objects: source `File`, output `File`, `ImageData`, `ImageBitmap`, object URLs, blob URLs, workers, and abort controllers.
- Do not store snapshots in `localStorage` as a complete restore mechanism. A snapshot alone cannot restore the user-selected source files after a page reload.
- If full bulk restore is added later, use a deliberate browser storage design such as IndexedDB for file/blob data and keep object URLs as runtime-only values.
- Normalize derived counters before creating a snapshot so persisted/debug metadata does not preserve stale active/exported counts.
- Parse serialized snapshots through the snapshot validator instead of using raw `JSON.parse` results. The parser accepts only the current snapshot version, rejects malformed file metadata, and recalculates derived counters from job statuses.

## Processing behavior

### Import

When files are imported:

1. filter unsupported files;
2. create one `ImageJob` per file;
3. create thumbnails lazily;
4. queue jobs for processing.

Do not decode every full-resolution image immediately if the batch is large.

### Shared recipe change

When the shared recipe or the shared SVG options change:

- mark an output stale only if that job's `jobRecipeHash` changed;
- reprocess the jobs whose hash changed;
- leave own recipes untouched.

The store (`src/lib/bulk/store.svelte.ts`) applies global-panel edits through
`setSharedRecipe` and `setSharedSvgOptions`, each coalesced over 200 ms so a
slider drag does not requeue the batch on every input event.

### Image-scope edit

The store's `editSelected(edit)` applies an edit to every selected job through
`editJobRecipes`, with the same 200 ms coalescing (edits inside one window
compose in order). The focus view sends each edit as the change from the
recipe it last loaded or sent (`applyRecipeChanges` in `settings.ts`), so the
changed part (rotation, output, or one processor) lands on every selected
image and their other differences stay. With every image selected the edit
lands on the shared recipe instead, except a rotation, which always becomes
own recipes so the shared recipe never rotates. `resetSelectedToShared()`
clears the selection's own recipes and drops any queued edit.

### Processing

`BulkRuntime.#processOne` (`src/lib/bulk/runtime.ts`) decodes the source,
rotates it when the recipe says so, and runs `optimizeImage(prepared,
effectiveRecipe, { preview: false })`, the same dispatch the editor uses: the
SVG lane for SVG output, the JPEG to JXL transcode when its flag is set and
nothing changes pixels, else the pixel pipeline. The outcome's object URL
becomes the output's `downloadUrl`, so the store's revoke paths own it; a run
cancelled after the encode finished revokes it on the spot. Only the file and
its facts are kept: bulk never holds output pixels. Each completion is
rechecked against the live recipe, and a job whose recipe moved on while it
encoded is requeued.

### Focus view

Selecting one image loads its source into a real `EditorSession` and writes
its effective recipe onto side 1 (side 0 shows the original). When the job's
output is current, `EditorSession.adoptResult` offers it as the result: it
goes in as an in-flight pass under the exact key the encode effect computes,
so the editor lands on it instead of encoding again. Without a current output
(or for SVG output) the editor encodes as usual. Rotate in the focus view is
an image-scope edit; it is hidden for SVG sources, as in the single editor.

### Concurrency

Use a small processing concurrency limit.

Recommended initial limit: 2 jobs.

Reasons:

- image decoding can be memory-heavy;
- WASM codecs can use substantial CPU;
- browser tabs can become unresponsive if too many images process at once.

## Memory rules

Bulk mode must avoid keeping too much image data alive.

Rules:

- Store source `File` objects.
- Store object URLs for thumbnails/previews only when needed.
- Revoke object URLs when replacing or removing them.
- Shared cleanup helpers live in `src/client/lazy-app/bulk/urls.ts`.
- The store keeps a small per-job output cache keyed by `jobRecipeHash`, so
  returning to a prior recipe restores instantly. Cache eviction and reset
  revoke object URLs that are not currently displayed.
- Do not keep decoded `ImageData` for every image forever.
- Cache the selected image more aggressively than background images.
- Consider an LRU cache for decoded image data later.

## UI shape

Initial layout:

- main comparison area on top;
- global settings panel;
- bottom image strip;
- export controls.

Image strip item should show:

- thumbnail;
- status;
- output size;
- percentage saved or increased;
- override indicator;
- error marker if failed.

Selected image view should show:

- before/after comparison;
- original size;
- output size;
- percent change;
- the image's effective recipe;
- whether it follows the shared settings or has its own.

## Export behavior

First implementation:

- export all encoded outputs;
- skip failed images and report them;
- trigger individual downloads if ZIP is not implemented yet.

Later implementation:

- export ZIP;
- support naming templates;
- preserve relative folder paths if folder import is added.

## Current implementation record

The original implementation-order roadmap is superseded by the production bulk
ship. The useful current references are:

- [bulk-ui-design-options.md](bulk-ui-design-options.md) for shipped UI decisions
  and Phase 3+ follow-ups;
- [specs/2026-07-02-bulk-phase-2-promotion.md](project/specs/2026-07-02-bulk-phase-2-promotion.md)
  for the executed lab-to-production promotion;
- [specs/2026-07-02-phase-2b-contextual-left-panel.md](project/specs/2026-07-02-phase-2b-contextual-left-panel.md)
  for the contextual left-panel follow-up.

## Test plan

Unit tests (`tests/unit/settings.test.ts`, `session.test.ts`, `recipe.test.ts`):

- a plain job gets the shared recipe; an SVG job gets the SVG lane with the
  shared SVG options; an own recipe is used whole and is never resolved
  against the resize reference;
- percentage presets resolve per source, custom sizes apply as given;
- `editJobRecipes` keeps other values and clears an own recipe that keys the
  same as the inherited one;
- the output hash changes only when the normalized effective recipe changes.

Browser tests (`tests/e2e/bulk.spec.ts`, `export-contract.spec.ts`): import,
process, stale and requeue on a shared change, rotate one image and Reset, a
batch of SVGs exports `.svg`, a mixed PNG and SVG batch exports `.webp` and
`.svg`.

## Current follow-ups

Open bulk product work lives in [project/roadmap.md](project/roadmap.md) and
[bulk-ui-design-options.md](bulk-ui-design-options.md).
