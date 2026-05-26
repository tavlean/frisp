# SvelteKit migration seams review

Last updated: 2026-05-26.

This file packages the `code/sveltekit-migration-seams` branch for review. It
separates the source changes that can plausibly move toward `main` from the
prototype evidence that should stay disposable unless explicitly accepted.

## Review baseline

- Compare branch: `code/sveltekit-migration-seams`
- Stable base: `origin/main`
- Prototype evidence branch: `code/sveltekit-prototype`
- Current target: keep SvelteKit static output as viable, but do not start a
  production Svelte UI migration.
- Current codec priority: WebP first, AVIF second, JPEG XL advanced. WebP 2 is
  deprioritized and should not receive migration or roadmap effort unless the
  product direction changes.

## Production-safe seam candidates

These files should be reviewed as behavior-preserving source seams. They are
the candidate set to merge or cherry-pick into `main` after verification:

- `lib/feature-plugin.js`: emits framework-neutral shared metadata and
  encode-runtime metadata without pulling Preact option entries into every
  helper import. It also emits ignored generated worker-surface,
  active-worker-entry, and active bridge metadata outputs that separate active
  worker methods from blocked/deprioritized methods.
- `src/client/lazy-app/feature-meta/encoders.ts`: generated encode runtime map
  that keeps production compression helpers away from Preact option components.
- `src/client/lazy-app/feature-meta/processors.ts` and
  `src/client/lazy-app/feature-meta/preprocessors.ts`: generated
  framework-neutral processor/preprocessor metadata entrypoints that re-export
  shared metadata maps and defaults without importing Preact option components.
- `src/client/lazy-app/abort.ts` and
  `src/client/lazy-app/image-decode.ts`: narrow browser/runtime helper modules
  split from the broad `util` surface while keeping compatibility re-exports.
- `src/client/lazy-app/image-pipeline-shared.ts` and
  `src/client/lazy-app/image-pipeline.ts`: SvelteKit-importable decode,
  preprocess, process, SVG handling, and compression helper surface for the
  proven WebP path. The production wrapper reuses the shared implementation and
  keeps only the production encoder-map dispatch.
- `src/client/lazy-app/bulk/processor.ts`: structural
  `ImagePipelineWorkerBridge` boundary so bulk processing can use an injected
  worker bridge instead of importing the production Rollup adapter.
- `src/client/lazy-app/worker-bridge/runtime.ts`,
  `src/client/lazy-app/worker-bridge/bridge.ts`,
  `src/client/lazy-app/worker-bridge/active-bridge.ts`, and
  `src/client/lazy-app/worker-bridge/index.ts`,
  `src/client/lazy-app/worker-bridge/active-index.ts`: shared Comlink bridge
  factory, full production bridge, active-method bridge factory, production
  Rollup adapter for the existing `omt:` worker URL, and a parallel active
  Rollup adapter for the generated active worker entry.
- `src/client/lazy-app/sw-bridge/runtime.ts` and
  `src/client/lazy-app/sw-bridge/index.ts`: shared service-worker
  registration/update/share-target runtime plus production Rollup
  `service-worker:` adapter.
- `src/sw/cache-plan.ts`, `src/sw/to-cache.ts`, and
  `src/sw/active-to-cache.ts`: framework-neutral service-worker cache planning
  over `{ main, deps }` records, with Rollup virtual imports kept at the
  production boundary. `src/sw/processor-support.ts` owns shared thread, SIMD,
  WebP, and AVIF support detection for both cache boundaries. The active
  cache-planning helper and active cache boundary exclude WebP 2 while the
  current production cache path remains full for existing behavior.
- `src/shared/codec-assets.ts`: build-tool-neutral codec asset record contract
  and helper filters for canonical generated asset manifests. The SvelteKit
  prototype generator consumes this shared seam instead of defining a
  prototype-only `CodecAssetRecord` shape.
- `src/features/**/client/runtime.ts`: runtime-only encoder/processor clients
  split from Preact option controls for browser encoders, WebP, AVIF, JPEG XL,
  QOI, MozJPEG, OxiPNG, and resize.
- `src/features/decoders/webP/worker/webpDecode.ts`,
  `src/features/decoders/avif/worker/avifDecode.ts`,
  `src/features/decoders/avif/worker/runtime.ts`,
  `src/features/encoders/avif/worker/avifEncode.ts`,
  `src/features/encoders/avif/worker/runtime.ts`,
  `src/features/decoders/jxl/worker/jxlDecode.ts`,
  `src/features/decoders/jxl/worker/runtime.ts`,
  `src/features/encoders/jxl/worker/jxlEncode.ts`,
  `src/features/encoders/jxl/worker/runtime.ts`,
  `src/features/decoders/webP/worker/runtime.ts`,
  `src/features/encoders/webP/worker/webpEncode.ts`,
  `src/features/encoders/webP/worker/runtime.ts`,
  `src/features/decoders/qoi/worker/qoiDecode.ts`,
  `src/features/decoders/qoi/worker/runtime.ts`,
  `src/features/encoders/qoi/worker/qoiEncode.ts`,
  `src/features/encoders/qoi/worker/runtime.ts`,
  `src/features/encoders/mozJPEG/worker/mozjpegEncode.ts`,
  `src/features/encoders/mozJPEG/worker/runtime.ts`,
  `src/features/encoders/oxiPNG/worker/oxipngEncode.ts`,
  `src/features/encoders/oxiPNG/worker/runtime.ts`,
  `src/features/processors/resize/worker/resize.ts`,
  `src/features/processors/resize/worker/runtime.ts`,
  `src/features/processors/quantize/worker/quantize.ts`,
  `src/features/processors/quantize/worker/runtime.ts`, and
  `src/features/preprocessors/rotate/worker/runtime.ts`: narrow injected WASM
  URL or type seams needed by Vite/SvelteKit without moving the existing codec
  assets.
- `src/features/**/shared/meta.ts` updates for AVIF, QOI, MozJPEG, and WebP 2:
  metadata constants no longer require runtime imports from declaration-only
  codec values. WebP 2 stays legacy/deprioritized; these changes are only to
  keep shared metadata importable.
- Production helper imports under `src/client/lazy-app/Compress/**`,
  `src/client/lazy-app/bulk/**`, and `src/client/lazy-app/util/index.ts`: import
  rewiring to use the new shared seams while keeping the Preact app behavior.
  Pure `.ts` compression helpers now avoid the full generated `feature-meta`
  index unless they need runtime encoder client entries.
- `src/client/lazy-app/Compress/update-workflow.ts` and adjacent extracted
  compression workflow helpers: now have SvelteKit prototype evidence for the
  WebP path. The prototype runs `runCompressionUpdateWorkflow` with injected
  state patching, `ResultCache`, generated SvelteKit worker bridges, and the
  production `imagePipeline` helper bundle, without importing the Preact
  component shell.
- `lib/test-helpers.js` and `lib/smoke-build.js`: focused coverage for the new
  cache-plan, bridge, helper seams, generated worker files, and WebP 2 exclusion
  from the active worker-method surface, generated active bridge metadata, and
  generated active worker entry. Smoke coverage also guards that generated
  processor/preprocessor metadata entrypoints remain UI-free.
- `.prettierignore`: ignores disposable SvelteKit build output so root checks
  do not require destructive cleanup prompts.

## Suggested merge slices

Use these slices to review or cherry-pick the branch without treating the whole
prototype delta as one merge unit. Each slice should pass root `npm run check`
on its own after conflict resolution. Run production browser smoke for slices
that touch runtime, worker, codec, or service-worker behavior.

1. Generated metadata seams

   - `lib/feature-plugin.js`
   - `.gitignore`
   - `.prettierignore`
   - `src/client/lazy-app/feature-meta/encoders.ts`
   - generated processor/preprocessor entrypoint names and smoke guards in
     `lib/smoke-build.js`

   This slice is the lowest-risk foundation. It separates framework-neutral
   feature metadata from Preact option entries and keeps generated SvelteKit
   support outputs ignored.

2. Shared image-pipeline helpers

   - `src/client/lazy-app/abort.ts`
   - `src/client/lazy-app/image-decode.ts`
   - `src/client/lazy-app/image-pipeline-shared.ts`
   - `src/client/lazy-app/image-pipeline.ts`
   - import rewiring under `src/client/lazy-app/Compress/**`,
     `src/client/lazy-app/bulk/**`, and `src/client/lazy-app/util/index.ts`
   - focused helper/smoke coverage in `lib/test-helpers.js` and
     `lib/smoke-build.js`

This slice keeps the current Preact shell but makes decode/preprocess/process
and WebP compression helpers importable without UI ownership. The prototype
also proves the extracted compression update workflow can consume this
injected `imagePipeline` shape for the WebP side.

3. Worker bridge and active worker boundaries

   - `src/client/lazy-app/worker-bridge/runtime.ts`
   - `src/client/lazy-app/worker-bridge/bridge.ts`
   - `src/client/lazy-app/worker-bridge/active-bridge.ts`
   - `src/client/lazy-app/worker-bridge/index.ts`
   - `src/client/lazy-app/worker-bridge/active-index.ts`
   - active worker metadata generation in `lib/feature-plugin.js`
   - worker runtime seams under `src/features/**/worker/runtime.ts`
   - corresponding production worker entry rewires

   This slice keeps Rollup `omt:` at the production boundary while exposing a
   Vite/SvelteKit-compatible bridge shape for later adapters.

4. Service-worker cache boundaries

   - `src/shared/codec-assets.ts`
   - `src/client/lazy-app/sw-bridge/runtime.ts`
   - `src/client/lazy-app/sw-bridge/index.ts`
   - `src/sw/cache-plan.ts`
   - `src/sw/processor-support.ts`
   - `src/sw/to-cache.ts`
   - `src/sw/active-to-cache.ts`
   - service-worker and cache-plan guards in `lib/smoke-build.js`

   This slice keeps current production service-worker behavior while separating
   cache planning from Rollup `entry-data:` and `service-worker:` assumptions.

5. Codec client/runtime splits

   - `src/features/**/client/runtime.ts`
   - corresponding `src/features/**/client/index.*` re-exports
   - `src/features/**/shared/meta.ts` importability updates

   This slice is useful after the metadata and pipeline slices because it keeps
   option UI components separate from runtime encoder/processor clients.

Do not include `prototypes/sveltekit/**` in any source-safe merge slice unless
the explicit decision is to carry prototype evidence on `main`. Do not stage
`prototypes/sveltekit/.svelte-kit/` or `prototypes/sveltekit/build/` under any
circumstance.

## Review commands

- `git diff --name-status origin/main...HEAD`: confirm the branch still has the
  expected source/docs/prototype split.
- `git diff origin/main...HEAD -- src/client/lazy-app src/features src/sw lib`:
  review production-source seams without prototype files.
- `git diff origin/main...HEAD -- prototypes/sveltekit`: review disposable
  SvelteKit evidence separately.
- `npm run check`: verify any source-safe slice at the repo root.
- `npm run smoke:browser`: run after runtime, worker, WASM, image-pipeline, or
  service-worker slices.
- From `prototypes/sveltekit`: run `npm run check`, `npm run build`,
  `npm run audit:static-output`, and `npm audit --audit-level=low` only when
  changing prototype files.
- `gh run list --branch code/sveltekit-migration-seams --limit 10`: check
  whether remote CI exists for this branch. As of this update, GitHub has not
  reported runs for the branch.

## Prototype-only evidence

Keep this set out of `main` by default. It proves SvelteKit behavior but is not
production app code:

- `prototypes/sveltekit/**`: disposable SvelteKit app, package files,
  generated-manifest sync script, static-output audit script, diagnostic route,
  prototype service worker, and browser/runtime probes.
- Prototype-generated files under `prototypes/sveltekit/.svelte-kit/` and
  `prototypes/sveltekit/build/`: never stage these outputs.
- `docs/sveltekit-prototype-handoff.md` and `prototypes/sveltekit/README.md`:
  evidence records. Keep them on the branch unless `main` should carry the full
  prototype narrative.
- Prototype-specific package dependency decisions, including local SvelteKit
  overrides, should not become production dependencies without a separate
  migration decision.

## Needs another branch

Do not merge these as solved just because the single-thread prototype passes:

- Threaded AVIF/JPEG XL/OxiPNG runtime parity under static SvelteKit output:
  still needs COOP/COEP, nested-worker, helper-asset, and service-worker cache
  proof.
- Canonical codec worker/WASM asset URL strategy: the prototype controls
  runtime URLs and now removes physical duplication for the active single-thread
  static-output paths with generated patched wrapper copies. Production still
  needs a source/build strategy for equivalent wrapper patching or regeneration.
  Use
  [SvelteKit codec asset strategy](sveltekit-codec-asset-strategy.md) as the
  implementation plan for this follow-up.
- Full production `features-worker` import from SvelteKit: the generator now
  emits `src/features-worker/active.ts` and
  `src/client/lazy-app/worker-bridge/active-meta.ts`, which exclude blocked
  WebP 2 methods. `worker-bridge/active-bridge.ts` can construct a bridge over
  that active method list, and `worker-bridge/active-index.ts` proves the
  equivalent Rollup adapter shape for the generated active worker entry. A
  SvelteKit adapter is still not wired, and the active worker still needs
  threaded asset/runtime proof before it can replace the prototype's
  intentionally narrowed worker entry.
- Full production service-worker codec cache import from SvelteKit: the shared
  cache planner can now compute an active non-WebP-2 cache list, and
  `src/sw/active-to-cache.ts` proves the matching Rollup `entry-data:` boundary
  over `features-worker/active` without WebP 2 imports. A SvelteKit
  service-worker boundary still needs generated Vite asset records before this
  can replace the prototype's cache manifest.
- Processor/preprocessor UI option entry splits beyond the generated
  framework-neutral metadata entrypoints.
- Minimal SvelteKit single-image editor slice with real user-selected files.
  Start this only after the above build/runtime risks are either proven or
  explicitly scoped.

## Verification before merging seams

Use these as the minimum gates for any source-safe subset:

- Root `npm run check` passes.
- Production browser smoke passes when worker, codec, service-worker, or runtime
  behavior changed.
- Prototype checks pass when changing `prototypes/sveltekit/**`: `npm run
check`, `npm run build`, `npm run audit:static-output`, and
  `npm audit --audit-level=low` from `prototypes/sveltekit`.
- Svelte MCP autofixer runs for changed `.svelte` files.
- CI is green for the branch or for the cherry-picked subset.
- Review confirms the current Preact app still owns production routing,
  service-worker behavior, and user-facing single-image optimization.

## Recommended next branch

After the production-safe seam subset is reviewed, branch from updated `main` if
those seams land. If review is still in progress, branch from
`code/sveltekit-migration-seams` and rebase or cherry-pick later.

Recommended order:

1. `code/sveltekit-codec-assets`: decide canonical codec worker/WASM asset URL
   generation or wrapper externalization, following
   [SvelteKit codec asset strategy](sveltekit-codec-asset-strategy.md).
2. `code/sveltekit-threaded-codecs`: prove threaded AVIF, JPEG XL, and OxiPNG
   runtime behavior under static SvelteKit output.
3. `code/sveltekit-single-image-slice`: build the minimal real-file SvelteKit
   single-image path after asset and threaded-runtime risks are clear.
