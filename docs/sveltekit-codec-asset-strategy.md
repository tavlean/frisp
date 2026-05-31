# SvelteKit codec asset strategy

Last updated: 2026-05-31.

This document records the canonical worker/WASM asset URL strategy implied by
the SvelteKit prototype. It is a migration plan, not permission to move,
delete, or rebuild codec artifacts.

> **Phase 1 status (2026-05-31): done.** The strategy below is implemented and
> green. The generator (`scripts/sync-sqush-prototype.mjs`) now derives both the
> canonical manifest (`codec-assets/manifest.ts`) and the service-worker precache
> manifest (`codec-assets/precache.ts`) from a single source-of-truth
> `codecAssetRecords` array, so the two generated manifests can no longer drift.
> The precache manifest stays a physically separate file (it imports only
> `precache` codec modules, keeping the runtime-only rotate WASM out of the
> service-worker graph) but its contents are now a filtered projection of the one
> list. `audit:static-output` keeps an independent expected-record oracle on
> purpose — it is the test, not a re-export of the source. Verified
> 2026-05-31: `npm run sync` is deterministic and re-runnable, generated output
> is byte-identical across the refactor, `npm run check`/`build` pass, and
> `npm run audit:static-output` confirms exactly one physical WASM per logical
> asset (all 15 logical assets = 1 copy).

## Production decision

Use generated logical codec asset records as the canonical production source of
runtime URLs, and use a build-time wrapper transform for wrappers that still
contain bundler-visible fallback `new URL("*.wasm", import.meta.url)`
references.

Do not patch committed codec wrappers in place for the SvelteKit migration, and
do not rebuild codecs just to change wrapper URL discovery. A rebuild can be a
future provenance task, but it is too broad for the migration asset seam. The
safe production path is:

1. generate one typed `CodecAssetRecord` per logical committed asset;
2. derive app, worker, and service-worker URLs from those records;
3. route Emscripten runtime loading through injected URL maps or `locateFile`;
4. copy transformed wrapper modules into generated build output when a wrapper
   has fallback URL references that would otherwise create duplicate physical
   WASM outputs;
5. leave the committed codec artifacts untouched.

The current Rollup/Preact app can keep its virtual import boundaries until a
SvelteKit slice needs the generated manifest. The shared source seam should be
build-tool-neutral: records and lookup helpers live in normal TypeScript, while
Rollup or Vite-specific URL imports stay at generated or adapter boundaries.

## Problem

The current Rollup build hides several asset decisions behind virtual imports
and codec wrapper behavior. SvelteKit/Vite can emit the same committed workers
and WASM files, but the prototype found two production risks:

- app code, workers, and service-worker manifests can import the same WASM
  through different graph roots and receive different emitted URLs;
- Emscripten wrappers still contain `new URL("*.wasm", import.meta.url)` fallback
  references, so Vite may emit worker-local physical duplicates even when
  runtime loading is redirected through `locateFile`. The prototype now proves
  WebP-only post-generation wrapper patches can strip those fallback references
  without editing committed codec artifacts.

The migration goal is one generated URL record per logical codec asset, consumed
by the app worker bridge, codec workers, and service-worker cache plan.

## Prototype evidence

The prototype already proves the useful shape:

- `prototypes/sveltekit/scripts/sync-sqush-prototype.mjs` generates
  `sqush-generated/codec-assets/*` modules with Vite `?url` imports.
- `prototypes/sveltekit/src/lib/codec-assets.ts` re-exports those generated URL
  records for app code and the SvelteKit worker bridge.
- `prototypes/sveltekit/src/lib/service-worker-codec-assets.ts` feeds the same
  generated precache records into `src/sw/cache-plan.ts` before the prototype
  service worker de-dupes install URLs. Runtime-only records, such as the tiny
  rotate WASM that Vite can inline in the service-worker graph, stay out of the
  service-worker imports.
- `src/shared/codec-assets.ts` now owns the build-tool-neutral
  `CodecAssetRecord` contract plus helper filters for precache records and
  URLs. The prototype generator imports those shared helpers instead of
  defining a SvelteKit-only record shape.
- `prototypes/sveltekit/scripts/audit-static-output.mjs` parses the generated
  manifest and precache manifest, then verifies exact logical keys, cache
  classes, URL binding uniqueness, and runtime-only exclusions. This makes the
  canonical manifest contract part of the static-output audit instead of a
  prose-only convention.
- `src/features/worker-utils/index.ts` passes
  `globalThis.__squshEmscriptenLocateFile` into Emscripten modules, letting the
  prototype route WebP, AVIF, QOI, JPEG XL, MozJPEG, and ImageQuant runtime
  fetches to generated URLs.
- `src/features/preprocessors/rotate/worker/runtime.ts` and
  `src/features/processors/resize/worker/resize.ts` show the cleaner long-term
  model: pass explicit WASM URLs into runtime factories or wasm-bindgen init
  functions instead of relying on wrapper-local URL discovery.

The prototype also deliberately audits duplicate assets. `audit:static-output`
now expects WebP encoder/decoder, QOI encoder/decoder, MozJPEG encoder,
AVIF decoder/single-thread encoder, JPEG XL decoder/single-thread encoder,
OxiPNG single-thread encoder, ImageQuant processor, resize/HQX processor, and
rotate preprocessor WASM to be emitted once from the canonical generated URL
records after the generated wrapper patches and worker-bridge URL injection.

## Canonical manifest shape

A production SvelteKit generator should emit a typed manifest with logical asset
records, not loose arrays:

```ts
export interface CodecAssetRecord {
  codec:
    | 'webp'
    | 'avif'
    | 'jxl'
    | 'qoi'
    | 'mozjpeg'
    | 'oxipng'
    | 'imagequant'
    | 'resize'
    | 'rotate';
  role: 'decoder' | 'encoder' | 'processor' | 'preprocessor' | 'worker-helper';
  variant:
    | 'baseline'
    | 'simd'
    | 'single-thread'
    | 'multi-thread'
    | 'hqx'
    | 'default';
  url: string;
  cache: 'precache' | 'runtime' | 'threaded-only';
}
```

The generated module should also expose codec-specific typed objects for worker
runtime calls, for example `webpWasmUrls`, `avifWasmUrls`, and
`resizeWasmUrls`. App code and service-worker code should consume generated
records from the same source of truth, but the service-worker graph should
import only records whose `cache` status is `precache`.

For production source, prefer deriving those codec-specific objects from the
record list by logical key rather than maintaining separate loose imports in app
code. `src/shared/codec-assets.ts` provides build-tool-neutral helpers for
precache filtering, URL de-duplication, and logical-key lookup. The SvelteKit
prototype worker bridge now uses this pattern so worker runtime URL maps are
owned by `svelteKitCodecAssetRecords`, not by a parallel handwritten URL list.

## Migration rules

1. Generate codec asset URLs from the codec inventory, not from route or
   service-worker code.
2. Keep one logical record per committed WASM or worker-helper asset.
3. Pass explicit URLs into codec runtimes wherever the wrapper API allows it.
4. For Emscripten modules that only support `locateFile`, keep URL mapping at
   the worker boundary, but treat it as an interim adapter.
5. Do not import worker URLs from both app code and service-worker code unless
   the build proves they resolve to the same emitted URL.
6. De-dupe service-worker install URLs defensively, but do not treat de-duping
   as a fix for physical output duplication.
7. Keep threaded assets separate from single-thread assets until COOP/COEP,
   nested-worker loading, helper URLs, and service-worker caching are proven.
8. Keep WebP 2 in the generated asset surface as experimental parity, but keep
   threaded WebP 2 and any product-promotion/removal decision separate from the
   baseline single-thread migration path.

## Recommended branch work

Use `code/sveltekit-codec-assets` for this track after the safe migration seams
are reviewed.

Implementation order:

1. Define a shared source `CodecAssetRecord` contract plus precache URL helpers.
   Proven on `code/sveltekit-migration-seams`.
2. Generate a prototype manifest with logical `CodecAssetRecord` entries and
   codec-specific URL objects. Proven on `code/sveltekit-migration-seams`.
3. Replace prototype handwritten `codecAssetUrls` aggregation with records
   derived from that manifest. Proven on `code/sveltekit-migration-seams`.
4. Update `audit:static-output` to report duplicate physical outputs by logical
   asset and validate the generated manifest contract, while still allowing
   known wrapper duplicates until the wrappers are patched or regenerated.
   Proven on `code/sveltekit-migration-seams`.
5. Keep a separate generated precache manifest that imports only assets marked
   `precache`, so runtime-only assets do not get inlined into the service-worker
   bundle. Proven on `code/sveltekit-migration-seams`.
6. Pick one Emscripten codec, preferably WebP, and prove a wrapper patch or
   generation option that removes worker-local `new URL("*.wasm",
import.meta.url)` references while preserving runtime `locateFile` behavior.
   Proven for the WebP encoder/decoder, AVIF decoder/single-thread encoder,
   JPEG XL decoder/single-thread encoder, QOI encoder/decoder, MozJPEG encoder,
   ImageQuant processor, resize/HQX wasm-bindgen wrappers, and the OxiPNG
   single-thread wasm-bindgen wrapper on `code/sveltekit-migration-seams` with
   prototype-generated patched wrapper copies plus injectable runtimes. Rotate
   is proven by passing the canonical URL through the SvelteKit worker bridge
   instead of importing a second worker URL.
7. Use an equivalent post-generation transform for production SvelteKit wrapper
   copies. Checked-in wrapper patches and codec rebuilds are rejected for this
   migration track because they either mutate inherited artifacts or broaden the
   work into codec provenance.
8. Repeat only after root checks, prototype checks, service-worker cache audit,
   and browser runtime verification pass.

## Acceptance gates

The strategy is ready for a minimal SvelteKit single-image slice only when:

- app code, worker code, and service-worker code consume the same generated
  logical asset records;
- `npm run audit:static-output` can distinguish intentional threaded/helper
  assets from accidental duplicate WASM emissions;
- WebP runtime encoding still produces a valid `RIFF`/`WEBP` output, AVIF
  runtime encoding still produces an `ftyp` output and decode round trip, JPEG
  XL runtime encoding still produces an `ff 0a` output and decode round trip,
  QOI runtime encoding still produces a valid `qoif` output, MozJPEG runtime
  encoding still produces a valid JPEG header, OxiPNG runtime encoding still
  produces a valid PNG header, ImageQuant runtime processing still returns image
  data, resize runtime processing still returns resized image data, and rotate
  preprocessing still returns rotated image data through the generated URLs;
- service-worker Cache Storage contains the intended canonical WebP, AVIF,
  JPEG XL, QOI, MozJPEG, OxiPNG, ImageQuant, resize, HQX, and rotate assets
  after a controlled-page reload;
- root `npm run check` and prototype `npm run check`, `npm run build`,
  `npm run audit:static-output`, and `npm audit --audit-level=low` pass.

## Open questions

- Should threaded codec assets be generated in the same manifest with
  `threaded-only` cache status, or should they live in a separate manifest until
  the threaded-runtime branch proves headers and nested workers?
- Should production Rollup keep its current virtual import behavior until the
  SvelteKit migration, or should the generated logical asset records be made
  build-tool-neutral first?
