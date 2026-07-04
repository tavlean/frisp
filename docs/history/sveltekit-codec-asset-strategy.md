# SvelteKit Codec Asset Strategy

Last updated: 2026-05-31.

This document records the root SvelteKit app's worker/WASM URL strategy. It is
not permission to rebuild, delete, or hand-edit codec artifacts.

## Decision

Use generated logical codec asset records as the canonical source of runtime
URLs. Keep committed `codecs/**` artifacts untouched. When a codec wrapper still
contains bundler-visible fallback `new URL('*.wasm', import.meta.url)` logic,
generate a patched wrapper copy under `.svelte-kit/presk-generated/codecs/*`
instead of editing the committed wrapper.

The generator is `scripts/sync-sveltekit-app.mjs`.

## Generated Outputs

`npm run sync` writes:

- `codec-assets/manifest.ts` — all logical codec asset records;
- `codec-assets/precache.ts` — records safe for service-worker precache;
- codec-specific URL modules such as `codec-assets/webp.ts` and
  `codec-assets/wp2.ts`;
- patched wrapper copies under `codecs/*`;
- `features-worker/webp.ts` — the generated SvelteKit worker entry;
- `service-worker/cache-plan.ts` — generated worker/cache records.

The manifest and precache files are both derived from the generator's single
`codecAssetRecords` source-of-truth array. The static-output audit is kept
separate on purpose: it is the independent oracle that checks the generated
contract.

## Runtime Flow

1. App code imports `svelteKitCodecAssetRecords` from generated codec assets.
2. `src/shared/codec-assets.ts` provides lookup and precache helpers.
3. `src/lib/sveltekit-worker-bridge.ts` resolves logical keys into URL maps for
   codec runtimes.
4. Generated worker code receives explicit WASM URLs or uses Emscripten
   `locateFile` through the shared worker utilities.
5. `src/lib/service-worker-codec-assets.ts` combines generated worker entries
   and generated precache URLs for `src/service-worker.ts`.

## Current Asset Surface

The launch parity surface includes:

- WebP decoder, baseline encoder, and SIMD encoder;
- WebP 2 decoder and baseline encoder;
- AVIF decoder and single-thread encoder;
- JPEG XL decoder and single-thread encoder;
- QOI decoder and encoder;
- MozJPEG encoder;
- OxiPNG single-thread encoder;
- ImageQuant processor;
- resize and HQX processor WASM;
- rotate preprocessor WASM.

Threaded AVIF/JPEG XL/OxiPNG/WebP 2 paths are future performance work, not
launch blockers.

## Audit Gate

Run:

```sh
npm run build
npm run audit:static-output
```

The audit verifies:

- expected logical keys exist;
- service-worker precache excludes runtime-only assets where required;
- each logical WASM asset emits exactly one physical file;
- accidental threaded/parallel helper assets do not leak into the launch build;
- the service worker references generated worker and codec assets.

## Rules

- Do not import the same WASM through parallel app/worker/service-worker graphs.
- Do not rely on service-worker URL dedupe to hide physical output duplication.
- Do not patch committed codec wrappers during migration cleanup.
- Do not remove WebP 2 assets yet; it is experimental parity.
- Do not touch `codecs/**` without following [codec-provenance.md](../codec-provenance.md).

## Open Follow-Up

If threaded codecs become a product/performance priority, add a separate plan
for COOP/COEP headers, nested worker loading, helper asset URLs, service-worker
caching, and browser QA. Keep that out of migration closeout.
