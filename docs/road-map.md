# Frisp Product Roadmap

Last updated: 2026-07-03.

The SvelteKit migration is now **closed** (`main` is the production app). This
roadmap is the product track that follows it — not a migration phase list. The
immediate post-migration engineering track is cleanup and Svelte hardening in
[svelte-hardening-plan.md](svelte-hardening-plan.md); product features below
come after that foundation pass. See [STATUS.md](STATUS.md) for live state,
[README.md](README.md) for the full docs map, and
[history/MIGRATION-PLAN.md](history/MIGRATION-PLAN.md) for the (concluded)
migration record.

> **2026-06-02 codec audit.** A full codec version + landscape audit
> ([codec-upgrade-audit.md](codec-upgrade-audit.md)) reset the codec strategy
> below. Headlines: urgent security-driven codec rebuilds, remove WebP 2,
> enable the already-built multithreading, and a new Multi-Format Compare
> feature. The dedicated plans are [codec-upgrade-audit.md](codec-upgrade-audit.md),
> [threading-enablement.md](threading-enablement.md), and
> [codec-surface-cleanup.md](codec-surface-cleanup.md).

Frisp remains local-first: no uploads, no server processing, and dependable
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

> **2026-07-02 — bulk is now the top product priority** (maintainer decision;
> it outranks Multi-Format Compare below). The design-first step is done as a
> written options document: **[bulk-ui-design-options.md](bulk-ui-design-options.md)**
> — UI layout options, left-panel rethink, override/reset signaling, export
> revision (ZIP proposed for v1), and the phased roadmap. That doc is the live
> plan for this milestone; the sections below remain the product intent it was
> built from.

> **2026-07-03 — Phase 2 shipped.** Minimum Useful Bulk is now production:
> multi-file and folder import, batch routing on the main route, global WebP
> settings + per-image tweaks, Stack resting stage, Save all as ZIP with the
> keep-original-when-larger guard, remove+Undo, and bulk e2e coverage. Next
> milestone: Phase 2b contextual left panel, then Phase 3 overrides polish.

> **Test note.** Phase 2 shipped with the focused unit-test subset for the bulk
> engine plus a production bulk e2e smoke suite. See [test-plan.md](test-plan.md)
> §4 for what landed and what remains.

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

Every codec is years behind its upstream — the
[codec-upgrade-audit.md](codec-upgrade-audit.md) is the authoritative plan for
version currency (which to upgrade, urgency, effort). Product focus:

- **WebP**: first production codec focus and first bulk target. Upgrade urgent
  (security CVE — see the audit).
- **AVIF**: second production codec focus after WebP bulk is stable. Upgrade
  urgent (security CVE + real compression gain).
- **JPEG XL**: advanced/power-user format; upgrade urgent (CVEs). Browser
  support is improving — recheck before making it prominent. A cheap bonus is
  lossless JPEG→JXL transcoding.
- **WebP 2**: **remove** (reverses the old "keep for parity" stance). Permanently
  experimental, no browser decodes it, non-final bitstream. Staged removal in
  [codec-surface-cleanup.md](codec-surface-cleanup.md).
- MozJPEG and OxiPNG: shipping output formats. The browser canvas encoders
  (JPEG/PNG/GIF) and QOI-as-output were removed from the picker on 2026-06-27 —
  QOI's decoder stays for import — and the dead `codecs/png/` dir was deleted
  (see [codec-surface-cleanup.md](codec-surface-cleanup.md)).
- **jpegli** (new): a libjxl-based encoder that outputs standard JPEG at ~30%
  better compression — the highest-ROI *new* codec to add. Needs a custom WASM
  build; tracked as investigate in the audit.

Deletion is a separate engineering decision. If the product hides codecs, leave
runtime code intact until build output, generated metadata, workers, WASM
assets, service-worker caching, and browser QA prove removal is safe. Follow
[codec-provenance.md](codec-provenance.md) before touching `codecs/`.

## Performance And Platform

- ✅ **Enable multithreading — DONE 2026-06-03.** oxipng/AVIF/JXL engage
  multi-core in Chromium + WebKit, single-thread fallback intact. Record:
  [threading-enablement.md](threading-enablement.md). This unblocked
  Multi-Format Compare below.
- ✅ **Variant-aware service-worker precache — DONE 2026-06-10.** First-visit
  payload 14.3 MB → 6.8 MB: the SW feature-detects threads/SIMD/native decode
  at install and precaches only the codec variants that browser runs. See
  [STATUS.md](STATUS.md) / [build-and-runtime.md](build-and-runtime.md).
- shared decode between the two comparison sides for large-image performance;
- browser support matrix refresh before changing runtime assumptions;
- build/dependency modernization now that Vite/SvelteKit owns production
  ([dependency-modernization.md](dependency-modernization.md)).

A native wrapper (e.g. Tauri) shipping native codec binaries is the only path to
true native-CPU performance, but it is a separate product (loses the zero-install
browser advantage) — not planned, noted for completeness.

## Multi-Format Compare

New feature surfaced by the codec audit. **Now sequenced after bulk
optimization** (maintainer decision 2026-07-02); the bulk worker-bridge pool is
the same substrate this feature needs, so bulk-first builds its foundation.
On import, encode the image across
several formats at once (MozJPEG / WebP / AVIF / JXL / OxiPNG) in parallel
workers and present a size (and ideally quality) comparison table, so the user
picks by *result* instead of guessing a format up front.

- **Depends on** multithreading ([threading-enablement.md](threading-enablement.md))
  to spread the parallel encodes across cores.
- Design notes: use *fast presets* for the compare pass (AVIF/JXL at high effort
  take tens of seconds on large images), then a full-quality encode once the user
  commits; bound concurrency to `navigator.hardwareConcurrency`.
- Pairs naturally with the bulk work and the shared image-pipeline helpers.

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

- intro/onboarding route redesign;
- mobile multi-panel accordion decision if the current responsive editor is not
  sufficient;
- visual difference metrics;
- stronger preset and warning language;
- app-wide keyboard control (single-key actions, digit value entry, shortcut
  overlay) — now a concrete proposal: [keyboard-control.md](keyboard-control.md)
  (maintainer priority, 2026-07-02; build after bulk Phase 2 + 2b);
- advanced codec grouping once product format focus is decided.

## Testing

The app today has a strong Playwright E2E suite (codec/threading/offline) but
**no unit-test layer**, and the ~2,000-line framework-neutral bulk engine under
`src/client/lazy-app/bulk/` has no automated coverage. The full strategy —
two layers (fast unit tests run always; expensive E2E runs only when codec/build
files change), the gap analysis, the per-module unit-test plan, E2E additions,
and CI changes — lives in **[test-plan.md](test-plan.md)**. That doc is the
single reference for all test work.

Sequencing is deliberately flexible: the plan can be picked up as a dedicated
pass later. The one exception worth weighing **before** building bulk is a small
unit-test subset for the bulk engine's core logic (queue counters, stale-output
requeue, snapshot parse/restore) — see the note under Bulk Optimization.

## Upstream Mining

The upstream Squoosh repository has many abandoned pull requests. Mine them
after migration and launch stabilization, especially for codec fixes, browser
compatibility fixes, service-worker fixes, build updates, and small UI
improvements. Avoid merging stale PRs wholesale; extract small patches with
tests or focused browser verification.

The current triage ledger is [upstream-signals.md](upstream-signals.md). Treat
it as external evidence and idea intake, not as a second roadmap; promote items
into this roadmap or a dedicated plan only after local repro, design discussion,
or implementation intent.

## Reference Docs

- [bulk-image-architecture.md](bulk-image-architecture.md) — bulk model,
  helpers, snapshots, queue/export behavior.
- [test-plan.md](test-plan.md) — test strategy & plan (unit + E2E layers, gaps,
  CI cadence).
- [manual-qa.md](manual-qa.md) — release and browser QA checklist.
- [codec-provenance.md](codec-provenance.md) — codec origin and safety rules.
- [browser-support.md](browser-support.md) — browser support assumptions.
- [parity-audit.md](parity-audit.md) — Svelte editor parity decisions and
  deferred items.
