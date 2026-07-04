# SvelteKit migration seams exit audit

Last updated: 2026-05-26.

> Historical exit audit. The migration-seams track is no longer the active
> branch; the root SvelteKit app now lives on `svelte`. Use
> [STATUS.md](../STATUS.md), [MIGRATION-PLAN.md](MIGRATION-PLAN.md), and
> [road-map.md](../road-map.md) for current state and next actions.

This audit summarizes whether `code/sveltekit-migration-seams` has done enough
to stop broadening this branch and move remaining work to focused follow-up
branches. It does not replace the detailed file inventory in
[SvelteKit migration seams review](sveltekit-migration-seams-review.md).

## Current answer

SvelteKit static output still looks viable for Presk's local-first optimizer,
provided the migration remains seam-first rather than a direct app-shell
rewrite. The current branch now proves enough reusable seams for a future
minimal SvelteKit single-image slice to start after focused codec asset and
threaded-runtime risks are handled.

Do not keep expanding this branch into production UI work. Use it as a review
branch for behavior-preserving shared seams plus disposable prototype evidence.

## Roadmap status

1. Split generated metadata into framework-neutral data and UI option entries.

   Status: mostly proven for the runtime metadata surfaces needed by the
   prototype.

   Evidence:
   - Generated `feature-meta/shared`, `feature-meta/encoders`,
     `feature-meta/processors`, and `feature-meta/preprocessors` keep
     SvelteKit-safe metadata and runtime maps away from Preact option entries.
   - Root smoke guards verify the generated processor/preprocessor metadata
     entrypoints remain UI-free.

   Remaining:
   - UI option entry generation itself is not solved. Keep that out of this
     branch unless a future production Svelte UI branch needs it.

2. Replace Rollup virtual import assumptions with Vite/SvelteKit-compatible
   seams.

   Status: proven as reusable boundaries, not as a full build replacement.

   Evidence:
   - `omt:` is isolated behind shared worker-bridge factories and active bridge
     metadata.
   - `url:` has injectable runtime seams for rotate and codec WASM paths.
   - `entry-data:` service-worker cache planning now accepts plain `{ main,
deps }` records.
   - `service-worker:` registration behavior lives in a shared runtime helper.

   Remaining:
   - A production SvelteKit adapter for the full active worker/cache surface is
     still a follow-up, because threaded runtime behavior and generated Vite
     asset records must be resolved together.

3. Create or document canonical codec worker/WASM asset URL strategy.

   Status: prototype strategy proven and documented; production strategy still
   needs a follow-up branch.

   Evidence:
   - `src/shared/codec-assets.ts` defines the build-tool-neutral
     `CodecAssetRecord` contract and precache helpers.
   - The prototype generator emits logical codec asset records and a
     precache-only manifest.
   - The static-output audit validates logical keys, cache classes, URL binding
     uniqueness, runtime-only exclusions, and one physical WASM output per
     active single-thread asset.

   Remaining:
   - Production still needs a decision between post-generation wrapper patching,
     rebuild options, or checked-in wrapper patches.
   - Threaded assets should remain separate until COOP/COEP, nested workers,
     helper URLs, and service-worker caching are proven.

4. Re-attempt importing the real single-image pipeline from SvelteKit.

   Status: proven for the WebP path and the extracted update orchestration.

   Evidence:
   - The prototype imports production `imagePipeline`, `processBulkImageJob`,
     and `runCompressionUpdateWorkflow`.
   - Browser verification shows the rendered prototype reaches `RIFF/WEBP` and
     completes `runCompressionUpdateWorkflow` through generated SvelteKit worker
     bridges.
   - Root smoke now guards that the Preact shell and bulk processor consume the
     shared `imagePipeline` bundle.

   Remaining:
   - Real user-selected file UI is intentionally not implemented on this
     branch.
   - AVIF, JPEG XL, and OxiPNG threaded runtime parity remain separate risks.

5. Document what can merge to `main` and what remains prototype-only.

   Status: documented.

   Evidence:
   - `docs/sveltekit-migration-seams-review.md` lists source-safe merge slices,
     prototype-only evidence, verification gates, and follow-up tracks.

   Remaining:
   - Actual merge/cherry-pick review still needs maintainer approval and CI on
     the selected subset.

6. Prepare the next branch plan for a minimal SvelteKit single-image slice.

   Status: branch order documented, but the single-image slice should not start
   directly from this branch unless the asset/threaded risks are explicitly
   scoped.

   Recommended order:
   1. `code/sveltekit-codec-assets`: productionize the canonical codec
      worker/WASM asset URL strategy.
   2. `code/sveltekit-threaded-codecs`: prove or document threaded AVIF,
      JPEG XL, and OxiPNG behavior under static SvelteKit output.
   3. `code/sveltekit-single-image-slice`: build one real-file SvelteKit
      single-image path after the asset and threaded-runtime decisions are
      clear.

## Exit criteria for this branch

This branch is ready for review when these are true:

- Root `npm run check` passes.
- Prototype `npm run check`, `npm run build`, `npm run audit:static-output`,
  and `npm audit --audit-level=low` pass after prototype changes.
- Browser/runtime proof passes after worker, WASM, service-worker, or pipeline
  behavior changes.
- `docs/sveltekit-migration-seams-review.md` remains accurate for the final
  diff.
- CI is visible and green for the branch.

As of this audit, the local gates above have passed on the latest checkpoints.
After merging latest `main`, PR #1 reports a clean merge state and GitHub
Actions passed the `Node.js CI` matrix on Ubuntu, Windows, and macOS for the
latest migration-seams head.
