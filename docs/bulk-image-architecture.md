# Bulk image architecture

This document defines the first bulk image optimization design for SquooshPlus. The goal is to keep the processing model independent from Preact or a future Svelte UI.

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

### Per-image override change

When an override changes:

- update only the selected image job;
- mark that image output stale;
- reprocess only that image.

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

3. Add multi-file import.

   - Accept multiple files from file input and drag/drop.
   - Keep single-image behavior working.

4. Add basic queue processing.

   - Process WebP output for every imported image.
   - Store output size and percent change.

5. Add image strip.

   - Display thumbnails and batch status.

6. Add selected-image review.

   - Reuse the existing comparison component where possible.

7. Add per-image overrides.

   - Highlight overridden settings.
   - Add reset-to-global.

8. Add export-all.
   - Start with individual downloads.
   - Add ZIP later.

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
