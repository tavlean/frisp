# Road map

This road map is written for the Sqush fork, with bulk image optimization as the main reason for the project.

## Guiding direction

The project should become a focused, practical image optimizer for modern web formats. The most important promise is that image optimization works reliably on the user's machine: no upload requirement, no server dependency, and no internet dependency for the actual optimization work after the app is available.

Bulk image optimization exists because the single-image optimizer is useful enough that people want to use it repeatedly. Bulk must be built on top of that reliability, not at the cost of it.

The first new product milestone is to make a reliable bulk workflow:

- import many images;
- apply global optimization settings;
- show before/after size changes per image;
- allow per-image overrides;
- export all optimized images safely.

Everything else should support that goal while protecting the proven single-image workflow.

## Phase 1: stabilize the baseline

Do this before large feature work.

1. Document the supported local environment.

   - Confirm Node and npm versions.
   - Update the README with install, build, dev, and troubleshooting notes.

2. Add basic project checks.

   - Add a typecheck script.
   - Add a formatting or linting script.
   - Keep `npm run build` as the release check.

3. Add a manual QA checklist.

   - App loads.
   - Single-image compression works.
   - Optimization still runs locally without server processing.
   - WebP export works.
   - AVIF export works if enabled.
   - Download works.
   - Saved side settings work.
   - Production build works after clearing service-worker data.

4. Triage dependency risk.

   - The project has many audit findings because the build stack is old.
   - Upgrade carefully, one area at a time.
   - Do not do a full framework migration in this phase.

5. Completed: remove inherited analytics.
   - The old upstream Google Analytics setup has been removed.
   - Do not add analytics back without a separate privacy and consent decision.

## Phase 2: design the bulk-processing core

Build the feature as framework-neutral TypeScript first. The UI can stay in Preact initially.

1. Define the bulk job model.

   - `ImageJob`: one input file and its state.
   - `GlobalSettings`: the settings applied to all images by default.
   - `ImageOverrides`: only settings changed for a specific image.
   - `EffectiveSettings`: global settings plus that image's overrides.
   - `OutputResult`: output file, output size, percent saved, warnings, and errors.

2. Define processing states.

   - queued;
   - decoding;
   - processing;
   - encoded;
   - failed;
   - skipped;
   - exported.

3. Define memory rules.

   - Do not keep every full-resolution decoded image in memory forever.
   - Keep thumbnails/previews separately from full image data.
   - Revoke object URLs when no longer needed.
   - Limit concurrent processing.

4. Define override behavior.

   - Global settings affect every image that has not overridden that setting.
   - Per-image overrides survive later global setting changes.
   - The UI must clearly show which images have overrides.
   - The UI must allow clearing overrides for one image.

5. Define export behavior.
   - Export all outputs.
   - Export selected outputs.
   - Decide whether multi-file export uses individual downloads first or ZIP later.

See [Bulk image architecture](bulk-image-architecture.md) for the current first-pass model.

## Phase 3: minimum useful bulk feature

This is the first product milestone.

Status: do not implement this phase yet. The bulk editor UI should go through design discussion, idea iteration, and prototypes before production implementation.

1. Allow multiple image import.

   - File picker should accept multiple images.
   - Drag and drop should accept multiple images.
   - Keep the current single-image path working if possible.

2. Add a bottom image strip.

   - Show thumbnail.
   - Show file name or shortened file name.
   - Show status.
   - Show percent reduction after encoding.
   - Show an override indicator when applicable.

3. Add global settings.

   - Start with one target format.
   - Recommended first target: WebP.
   - Include quality and resize only if stable.

4. Add batch processing.

   - Process images with a small concurrency limit.
   - Show progress.
   - Allow cancel/retry.
   - Store errors per image instead of failing the whole batch.

5. Add bulk export.
   - First implementation can download files one by one.
   - ZIP export can come later if it adds too much complexity.

## Phase 4: per-image review and overrides

This is where the app becomes more powerful than a simple batch converter.

1. Selecting an image in the strip opens that image in the main comparison area.

2. The selected image shows before/after comparison.

   - Keep the existing two-up/slider behavior if it can be reused.
   - Show original size, output size, and percent saved.

3. Per-image settings override global settings.

   - Changing a setting while an image is selected creates an override only for that image.
   - Highlight overridden controls.
   - Add "reset this image to global settings".

4. Reprocess only affected images.

   - Changing global settings reprocesses images without overrides.
   - Changing one image override reprocesses only that image.

5. Persist bulk-session settings.
   - Save global settings.
   - Consider saving recent presets.
   - Do not persist huge image data in local storage.

## Phase 5: focused codec strategy

The current app supports many formats. For this fork, a smaller codec surface probably helps, but it should be done carefully.

### Recommended product formats

1. WebP 1

   - Keep as the default first-class output.
   - It is widely supported and practical for current web work.
   - This should be the first bulk-export target.

2. AVIF

   - Keep as a first-class modern output.
   - It has broad modern browser support, but encoding can be slower than WebP.
   - Add after WebP bulk flow is stable.

3. JPEG XL

   - Keep as an experimental or advanced output at first.
   - JPEG XL support has improved recently, including renewed Chromium work, but support and default enablement still need careful tracking.
   - Good candidate for power users and future-proof workflows.

4. WebP 2
   - Do not treat as a production format.
   - The current libwebp2 project says WebP 2 will not be released as an image format and is used as an experimental compression playground.
   - Remove it from the default UI, or hide it behind an experimental/dev flag if useful for research.

### Formats to consider removing from the main UI

- Browser JPEG
- Browser PNG
- Browser GIF
- MozJPEG
- OxiPNG
- QOI
- WP2/WebP 2 from the normal user-facing UI

Removing them from the visible product will simplify user decisions. Removing the code entirely is a separate technical decision.

### Should we remove codec code?

Short answer: not immediately.

Hiding codecs from the UI is low risk and gives quick product focus. Deleting codec code may reduce maintenance later, but it can also break build assumptions because codecs are tied into generated feature metadata, workers, WASM assets, service-worker caching, and tests we do not have yet.

Recommended sequence:

1. First hide non-target formats from the UI.
2. Verify the build and single-image workflow.
3. Verify the bulk workflow.
4. Remove unused codec files only after the focused product works.
5. Keep a branch or tag before deleting codecs.

## Phase 6: better exports and production workflows

Add after the basic bulk workflow is reliable.

1. ZIP export.

   - Export all optimized images as one archive.
   - Preserve names safely.
   - Avoid loading the whole archive into memory if possible.

2. Naming templates.

   - Preserve original names.
   - Add suffixes such as `-optimized`.
   - Change extensions based on output format.

3. Presets.

   - WebP balanced.
   - WebP small.
   - AVIF balanced.
   - AVIF high quality.
   - Custom saved presets.

4. Warnings.

   - Output is larger than input.
   - Format may not be supported everywhere.
   - Image failed to decode.
   - Image too large for current memory limits.

5. Summary view.
   - Total original size.
   - Total optimized size.
   - Total bytes saved.
   - Failed/skipped count.

## Phase 7: migration decision

Do not migrate the whole app before the bulk model exists.

After Phase 3 or Phase 4, decide whether to migrate the UI to Svelte.

Recommended migration approach:

1. Keep processing logic framework-neutral.
2. Use [Svelte migration context](svelte-migration-context.md) as the working guide for Svelte 5 and SvelteKit decisions.
3. Move the app shell and bulk UI to Svelte or SvelteKit only after the workflow is proven.
4. Prefer a static/offline SvelteKit build or Svelte + Vite unless a concrete server-side need appears.
5. Preserve worker/WASM/service-worker behavior before rewriting every component.

Svelte will likely help future feature development, but a migration should not block the main bulk feature.

## Phase 8: pull request mining

The upstream Squoosh repository has many abandoned pull requests. Review them after the first bulk milestone is working.

Look for:

- codec fixes;
- browser compatibility fixes;
- service-worker fixes;
- dependency/build updates;
- UI improvements that support bulk workflows;
- performance improvements;
- bug reports with reproduction cases.

Avoid merging large stale PRs blindly. Extract small patches that still apply cleanly and test them.

## Future ideas

- Side-by-side visual difference metrics.
- Target file size mode.
- Folder import where browser support allows it.
- Image dimension constraints for common platforms.
- Metadata stripping options.
- Lossless mode for selected formats.
- CLI or desktop wrapper later, if browser limitations become painful.
- Project files for saving a batch session.

## Current external format notes

These notes should be rechecked periodically because format support changes.

- WebP 1 is mature and widely supported.
- AVIF is broadly supported in current major browsers.
- JPEG XL has improved momentum in 2026, including Chromium work, but exact default browser support should be checked before making it the default output.
- WebP 2 should not be promoted as a production format because the official libwebp2 project describes it as experimental and not intended for release as an image format.

References:

- WebP 2 official repository: https://chromium.googlesource.com/codecs/libwebp2/
- AVIF browser support: https://caniuse.com/avif
- JPEG XL software support: https://jpegxl.info/resources/supported-software.html
