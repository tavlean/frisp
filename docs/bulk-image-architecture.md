# Bulk image architecture

This document defines the first bulk image optimization design for Sqush. The goal is to keep the processing model independent from Preact or a future Svelte UI.

The framework-neutral helper surface is exported from `src/client/lazy-app/bulk/index.ts`. UI code should prefer that entry point over deep imports when it needs several bulk helpers together.

The helper surface now includes pure strip item selectors, selected-job detail selectors, and a session summary selector. Future UI should consume those selectors instead of recomputing selected state, effective settings, output state, export readiness, override counts, or progress inside components.

Snapshot restore is metadata-only. It can restore the batch list, original file metadata, settings, selection, errors, and overrides, but it cannot restore live decoded images or optimized output blobs. Restored jobs that depended on live processing output return to `queued` so the app regenerates outputs before export.

## Product goal

The user should be able to:

1. import multiple images;
2. choose global optimization settings;
3. see output size and percentage saved for every image;
4. select one image for detailed before/after review;
5. override settings for that one image without changing the global settings;
6. export all optimized images.

## Core concepts

### Bulk session

A bulk session is the current batch of imported images and settings.

It owns:

- global settings;
- the ordered list of image jobs;
- the selected image id;
- batch progress;
- export state.

### Image job

An image job represents one imported file.

Suggested fields:

```ts
interface ImageJob {
  id: string;
  sourceFile: File;
  status: ImageJobStatus;
  originalSize: number;
  previewUrl?: string;
  thumbnailUrl?: string;
  output?: ImageOutput;
  overrides?: ImageSettingOverrides;
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

### Global settings

Global settings are the defaults for every image in the batch.

Initial recommended scope:

```ts
interface BulkGlobalSettings {
  encoder: BulkEncoderSettings;
  resize?: BulkResizeSettings;
}
```

Start with WebP as the first encoder target. Add AVIF after the WebP batch flow is reliable.

### Per-image overrides

Overrides should store only values that differ from global settings.

```ts
interface ImageSettingOverrides {
  encoder?: Partial<BulkEncoderSettings>;
  resize?: Partial<BulkResizeSettings> | null;
}
```

Rules:

- If a field is absent, use the global value.
- If a field is present, use the image-specific value.
- If resize is `null`, resizing is disabled for that image even if global resize is enabled.
- The UI should highlight every control with an override.
- The UI should support clearing all overrides for the selected image.

### Effective settings

Effective settings are computed, not stored.

```ts
function getEffectiveSettings(
  globalSettings: BulkGlobalSettings,
  overrides?: ImageSettingOverrides,
): BulkGlobalSettings;
```

This should be a pure function and should have unit tests.

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

`settingsHash` lets the app decide whether an image output is still valid after settings change.

### Session snapshots

Bulk session snapshots are metadata records for handoff, diagnostics, and future persistence planning.

Current module: `src/client/lazy-app/bulk/snapshot.ts`.

Snapshot rules:

- Include durable metadata: session id, global settings, selected job id, job ids, file names, MIME types, sizes, last-modified timestamps, statuses, overrides, errors, and output size summaries.
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

### Global setting change

When global settings change:

- mark outputs stale if their effective settings changed;
- reprocess images whose effective settings changed;
- preserve image-specific overrides.
- Use `src/client/lazy-app/bulk/changes.ts` helpers when UI code wants the safe default behavior: update settings and requeue only outputs that became stale.

### Per-image override change

When an override changes:

- update only the selected image job;
- mark that image output stale;
- reprocess only that image.
- Use `applyJobOverrides` or `applyClearJobOverrides` so future UI code does not forget the stale-output requeue step.

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
- active effective settings;
- overridden controls.

## Export behavior

First implementation:

- export all encoded outputs;
- skip failed images and report them;
- trigger individual downloads if ZIP is not implemented yet.

Later implementation:

- export ZIP;
- support naming templates;
- preserve relative folder paths if folder import is added.

## Suggested implementation order

1. Extract pure settings helpers.

   - `getEffectiveSettings`
   - settings hashing
   - override detection
   - Initial module: `src/client/lazy-app/bulk/settings.ts`

2. Add bulk session state types.

   - Keep them framework-neutral.
   - Do not bind them to Preact lifecycle.
   - Initial module: `src/client/lazy-app/bulk/session.ts`
   - Session helper can create a batch, append imported jobs, select an image, and report progress.

3. Add multi-file import.

   - Accept multiple files from file input and drag/drop.
   - Keep single-image behavior working.
   - Initial helper module: `src/client/lazy-app/bulk/import.ts`

4. Add basic queue processing.

   - Process WebP output for every imported image.
   - Store output size and percent change.
   - Initial queue helper module: `src/client/lazy-app/bulk/queue.ts`
   - Queue helper can detect stale outputs from effective settings hashes.

5. Add image strip.

   - Display thumbnails and batch status.

6. Add selected-image review.

   - Reuse the existing comparison component where possible.

7. Add per-image overrides.

   - Highlight overridden settings.
   - Add reset-to-global.

8. Add export-all.
   - Start with individual downloads.
   - Export helper module: `src/client/lazy-app/bulk/export.ts`
   - Export helper can list ready jobs and report ready, failed, skipped, pending, and total size-change counts.
   - Stale outputs are not exportable.
   - Export entries include duplicate-safe file names derived from the source image name and output extension.
   - Add ZIP later.

## UI implementation hold

Do not implement the production bulk UI yet. The workflow needs design discussion, iteration, and possibly prototypes first.

When implementation resumes, the safest technical path is:

1. Extract the existing single-image processing pipeline from `Compress/index.tsx` into a shared non-UI module.

   - Keep the current single-image editor importing the same functions back.
   - Preserve one-file behavior before adding any bulk screen.
   - Shared module: `src/client/lazy-app/image-pipeline.ts`
   - Current status: extracted without changing the UI route.

2. Add a bulk processor module separate from the current `Compress` component.

   - It should consume `ImageJob`, effective settings, `WorkerBridge`, and `AbortSignal`.
   - It should produce `ImageOutput`.
   - It should not call or fork `Compress.updateImage()` because that method is tied to the two-side UI state machine.
   - Initial module: `src/client/lazy-app/bulk/processor.ts`
   - Current status: processor orchestration exists and is covered with injected-pipeline tests.

3. Keep worker usage bounded.

   - `WorkerBridge` queues work per bridge.
   - Bulk mode should use a small pool aligned with `defaultBulkConcurrency`.
   - Initial runner module: `src/client/lazy-app/bulk/runner.ts`
   - Current status: runner processes queued jobs up to the concurrency limit, stores per-job failures, and propagates aborts.

4. Detect multi-file import at the app boundary later.

   - A one-file import should keep using the current single-image `Compress` path.
   - A multi-file import can route to a separate lazy bulk component after the design is agreed.

5. Treat the existing `Options`, `Output`, and `Results` components as reference material, not as a direct bulk UI.

   - They are built around two comparison sides.
   - Bulk settings need global defaults, selected-image overrides, and clear override indicators.

Important open design decision: resize behavior for mixed-size batches. The current single-image editor resets resize defaults from the decoded source dimensions. Bulk mode needs a clear global rule before implementation.

## Test plan

Start with pure unit tests:

- global settings apply when no overrides exist;
- overrides replace only specified fields;
- clearing overrides restores global values;
- settings hash changes only when effective settings change.

Then add browser smoke tests:

- import two images;
- verify two image strip items appear;
- verify at least one output is generated;
- change global quality;
- verify outputs become stale/reprocess;
- override one image;
- verify only that image shows override state.

## Open decisions

- Should bulk mode replace the existing single-image editor or sit beside it first?
- Should WebP be the only first milestone output?
- Should resize be part of milestone one or milestone two?
- Should export-all use individual downloads first, or should ZIP be included in the first release?
- How many images should the first version officially support in one batch?
