# Sqush Product Roadmap

Last updated: 2026-06-01.

The SvelteKit migration is now **closed** (`main` is the production app). This
roadmap is the product track that follows it — not a migration phase list. The
immediate post-migration engineering track is cleanup and Svelte hardening in
[svelte-hardening-plan.md](svelte-hardening-plan.md); product features below
come after that foundation pass. See [STATUS.md](STATUS.md) for live state and
[MIGRATION-PLAN.md](MIGRATION-PLAN.md) for the (concluded) migration record.

Sqush remains local-first: no uploads, no server processing, and dependable
browser/offline behavior after the app loads. New features must protect the
single-image optimizer before expanding the surface area.

## Roadmap Principles

1. Preserve the single-image workflow before adding modes.
2. Prefer framework-neutral helpers and measured browser behavior over UI-only
   prototypes.
3. Keep heavy browser objects (`File`, `Blob`, `ImageData`, workers, WASM,
   object URLs) out of broad app state unless there is a measured reason.
4. Hide or de-emphasize product surface before deleting codec/runtime code.
5. Treat large features as design + prototype + verification work, not as
   migration cleanup.

## Cutover Aftermath

These are allowed immediately after migration if they are needed to stabilize
the launch:

- the post-migration cleanup and Svelte hardening pass
  ([svelte-hardening-plan.md](svelte-hardening-plan.md)) — dead-code removal,
  idiomatic Svelte 5, and the confirmed defect fixes;
- maintainer acceptance notes from real daily use;
- browser support QA on the chosen release browsers;
- build/dependency modernization that reduces launch risk;
- documentation cleanup for the new production app layout;
- small editor fixes discovered during launch validation.

Do not use this bucket to smuggle in bulk UI, codec pruning, or new workflows.

## Bulk Optimization

Bulk optimization is a product milestone, not part of the Svelte migration. The
existing framework-neutral helper surface lives under
`src/client/lazy-app/bulk/`; [bulk-image-architecture.md](bulk-image-architecture.md)
is the technical reference.

### Design First

Resolve the product shape before implementation:

- whether bulk is a separate screen, a mode inside the editor, or a route that
  shares the same editor core;
- how the bottom image strip, selected-image preview, global settings, and
  per-image overrides fit on desktop and mobile;
- which formats appear in the first bulk release;
- how much per-image review is required before "export all";
- how errors, warnings, and stale outputs are communicated.

### Minimum Useful Bulk

First implementation target:

- multi-file picker and drag/drop import;
- bottom strip with thumbnail, file name, status, output size change, and
  override badge;
- global settings, starting with WebP and a small stable option set;
- batch processing with bounded concurrency, progress, cancel/retry, and
  per-image errors;
- selected-image preview using the existing before/after comparison where
  practical;
- individual downloads for ready outputs.

### Overrides And Review

Second layer:

- selecting an image opens it for detailed comparison;
- editing a control while an image is selected creates a per-image override;
- overridden controls are highlighted;
- "reset to global" is available per image;
- global changes reprocess only images without relevant overrides;
- per-image changes reprocess only that image.

### Export Evolution

Later bulk export work:

- ZIP export when memory behavior is understood;
- duplicate-safe naming templates;
- suffix and extension rules;
- presets for common WebP/AVIF workflows;
- warnings for larger output, unsupported formats, decode failures, and
  memory-heavy batches;
- summary totals for original size, output size, bytes saved, failed/skipped
  count, and pending work.

## Codec Strategy

Keep the SvelteKit parity surface broad until usage/runtime evidence supports a
change:

- **WebP**: first production codec focus and first bulk target.
- **AVIF**: second production codec focus after WebP bulk is stable.
- **JPEG XL**: advanced/power-user format; support should be rechecked before
  making it prominent.
- **WebP 2**: keep included as experimental parity. Do not promote it as a
  primary format until maintainer testing proves it is useful.
- Browser JPEG/PNG/GIF, MozJPEG, OxiPNG, and QOI: keep available while parity is
  being validated; decide later whether they are visible, advanced, or hidden.

Deletion is a separate engineering decision. If the product hides codecs, leave
runtime code intact until build output, generated metadata, workers, WASM
assets, service-worker caching, and browser QA prove removal is safe. Follow
[codec-provenance.md](codec-provenance.md) before touching `codecs/`.

## Performance And Platform

Possible post-launch tracks:

- shared decode between the two comparison sides for large-image performance;
- threaded AVIF/JXL/OxiPNG with COOP/COEP, nested-worker, helper-asset, and
  service-worker proof;
- static-host header strategy if threaded codecs become important;
- browser support matrix refresh before changing runtime assumptions;
- build/dependency modernization now that Vite/SvelteKit owns production.

Single-thread codecs are the launch baseline. Threaded codecs are performance
work, not a migration blocker.

## PWA, Import, And Persistence

Future workflow ideas:

- installable PWA polish;
- share target for images from the OS/browser;
- folder import where browser support allows it;
- target file-size mode;
- metadata stripping controls;
- project/session files for saving a batch plan;
- IndexedDB-backed restore only if the product needs persisted source blobs.

Do not store live image blobs or object URLs in `localStorage`.

## UI And Product Polish

Deferred polish/features:

- intro or marketing route redesign;
- mobile multi-panel accordion decision if the current responsive editor is not
  sufficient;
- visual difference metrics;
- stronger preset and warning language;
- keyboard shortcut discoverability;
- advanced codec grouping once product format focus is decided.

## Upstream Mining

The upstream Squoosh repository has many abandoned pull requests. Mine them
after migration and launch stabilization, especially for codec fixes, browser
compatibility fixes, service-worker fixes, build updates, and small UI
improvements. Avoid merging stale PRs wholesale; extract small patches with
tests or focused browser verification.

## Reference Docs

- [bulk-image-architecture.md](bulk-image-architecture.md) — bulk model,
  helpers, snapshots, queue/export behavior.
- [manual-qa.md](manual-qa.md) — release and browser QA checklist.
- [codec-provenance.md](codec-provenance.md) — codec origin and safety rules.
- [browser-support.md](browser-support.md) — browser support assumptions.
- [parity-audit.md](parity-audit.md) — Svelte editor parity decisions and
  deferred items.
