# SvelteKit codec asset strategy

Last updated: 2026-05-26.

This document records the canonical worker/WASM asset URL strategy implied by
the SvelteKit prototype. It is a migration plan, not permission to move,
delete, or rebuild codec artifacts.

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
8. Keep WebP 2 out of the generated active asset surface unless product
   direction changes.

## Recommended branch work

Use `code/sveltekit-codec-assets` for this track after the safe migration seams
are reviewed.

Implementation order:

1. Generate a prototype manifest with logical `CodecAssetRecord` entries and
   codec-specific URL objects. Proven on `code/sveltekit-migration-seams`.
2. Replace prototype handwritten `codecAssetUrls` aggregation with records
   derived from that manifest. Proven on `code/sveltekit-migration-seams`.
3. Update `audit:static-output` to report duplicate physical outputs by logical
   asset, while still allowing known wrapper duplicates until the wrappers are
   patched or regenerated. Proven on `code/sveltekit-migration-seams`.
4. Keep a separate generated precache manifest that imports only assets marked
   `precache`, so runtime-only assets do not get inlined into the service-worker
   bundle. Proven on `code/sveltekit-migration-seams`.
5. Pick one Emscripten codec, preferably WebP, and prove a wrapper patch or
   generation option that removes worker-local `new URL("*.wasm",
import.meta.url)` references while preserving runtime `locateFile` behavior.
   Proven for the WebP encoder/decoder, AVIF decoder/single-thread encoder,
   JPEG XL decoder/single-thread encoder, QOI encoder/decoder, MozJPEG encoder,
   ImageQuant processor, resize/HQX wasm-bindgen wrappers, and the OxiPNG
   single-thread wasm-bindgen wrapper on `code/sveltekit-migration-seams` with
   prototype-generated patched wrapper copies plus injectable runtimes. Rotate
   is proven by passing the canonical URL through the SvelteKit worker bridge
   instead of importing a second worker URL.
6. Decide whether production should use an equivalent post-generation transform,
   a codec rebuild option, or a checked-in wrapper patch before broadening the
   approach to other Emscripten codecs.
7. Repeat only after root checks, prototype checks, service-worker cache audit,
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

- Should codec wrappers be patched in place, regenerated from source, or wrapped
  by a small post-generation transform that removes Vite-visible fallback URL
  references?
- Should threaded codec assets be generated in the same manifest with
  `threaded-only` cache status, or should they live in a separate manifest until
  the threaded-runtime branch proves headers and nested workers?
- Should production Rollup keep its current virtual import behavior until the
  SvelteKit migration, or should the generated logical asset records be made
  build-tool-neutral first?
