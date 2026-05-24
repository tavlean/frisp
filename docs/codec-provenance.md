# Codec provenance

This document records what the current repository contains. It is not a guarantee that every codec output is reproducible today.

The original Squoosh project committed generated JavaScript and WebAssembly outputs under `codecs/`. Sqush still relies on those committed outputs during the Rollup build.

Current inventory note: `codecs/` contains 80 committed JavaScript/WebAssembly codec artifacts, including browser builds, Node-targeted builds, threaded builds, SIMD builds, and worker companions. That means codec cleanup can reduce repository weight, but it also has a high breakage risk.

## Important rule

Do not delete or rebuild codec files casually. A codec change can affect:

- generated feature metadata;
- worker bundles;
- service-worker cache lists;
- browser support for threaded or SIMD WebAssembly;
- image quality and output size.

When changing a codec, rebuild only that codec first, run the full check, then manually test that codec in the browser.

## Build model

The inherited codec README says each codec subproject is built from its own folder:

```sh
npm install
npm run build
```

Most C/C++ codecs use Docker-based Makefiles. Rust codecs use `wasm-pack`-style package outputs. Some codec packages have their own `package-lock.json` or `Cargo.lock`; leave those alone unless actively rebuilding that codec.

## App codec inventory

| Area                | Feature path                        | Codec assets                                                    | Current status                                                             |
| ------------------- | ----------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------- |
| AVIF decoder        | `src/features/decoders/avif`        | `codecs/avif/dec/avif_dec.*`                                    | Used by app                                                                |
| AVIF encoder        | `src/features/encoders/avif`        | `codecs/avif/enc/avif_enc.*`, `avif_enc_mt.*`                   | Used by app; threaded path exists                                          |
| WebP decoder        | `src/features/decoders/webp`        | `codecs/webp/dec/webp_dec.*`                                    | Used by app                                                                |
| WebP encoder        | `src/features/encoders/webP`        | `codecs/webp/enc/webp_enc.*`, `webp_enc_simd.*`                 | Used by app; SIMD path exists                                              |
| JPEG XL decoder     | `src/features/decoders/jxl`         | `codecs/jxl/dec/jxl_dec.*`                                      | Used by app; strategy still undecided                                      |
| JPEG XL encoder     | `src/features/encoders/jxl`         | `codecs/jxl/enc/jxl_enc.*`, `jxl_enc_mt.*`, `jxl_enc_mt_simd.*` | Used by app; strategy still undecided                                      |
| WP2 legacy decoder  | `src/features/decoders/wp2`         | `codecs/wp2/dec/wp2_dec.*`                                      | Used by app today; not in the proposed focused codec list                  |
| WP2 legacy encoder  | `src/features/encoders/wp2`         | `codecs/wp2/enc/wp2_enc.*`, `wp2_enc_mt.*`, `wp2_enc_mt_simd.*` | Used by app today; not in the proposed focused codec list                  |
| QOI decoder         | `src/features/decoders/qoi`         | `codecs/qoi/dec/qoi_dec.*`                                      | Used by app today; likely removable later if the codec surface is narrowed |
| QOI encoder         | `src/features/encoders/qoi`         | `codecs/qoi/enc/qoi_enc.*`                                      | Used by app today; likely removable later if the codec surface is narrowed |
| MozJPEG encoder     | `src/features/encoders/mozJPEG`     | `codecs/mozjpeg/enc/mozjpeg_enc.*`                              | Used by app today; not in the proposed focused codec list                  |
| OxiPNG encoder      | `src/features/encoders/oxiPNG`      | `codecs/oxipng/pkg*`                                            | Used by app today; not in the proposed focused codec list                  |
| Quantize processor  | `src/features/processors/quantize`  | `codecs/imagequant/imagequant.*`                                | Used by app today; keep until processing strategy is decided               |
| Resize processor    | `src/features/processors/resize`    | `codecs/resize/pkg`, `codecs/hqx/pkg`                           | Used by app today                                                          |
| Rotate preprocessor | `src/features/preprocessors/rotate` | `codecs/rotate/rotate.wasm`                                     | Used by app today                                                          |

## Codec assets not directly wired as current features

| Path                | Notes                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `codecs/png/`       | Rust PNG helper package. The active PNG encoder feature uses browser PNG; active PNG optimization uses OxiPNG. Verify before deleting.                       |
| `codecs/visdif/`    | Visual-difference support utility. Not currently referenced from `src/features/`; verify before deleting.                                                    |
| `codecs/*/*_node_*` | Node-targeted builds used by codec examples or package tests. They are not imported by browser features, but may be useful when rebuilding/verifying codecs. |

## Current product direction

The focused codec list being considered is:

- WebP 1
- AVIF
- JPEG XL

To reduce risk, first hide unwanted codecs from product UI after design discussion. Delete codec code only after:

1. The focused bulk workflow works.
2. Browser smoke tests cover at least WebP and AVIF.
3. A build confirms generated feature metadata and service-worker caching still work.
4. A branch or tag preserves the pre-deletion codec state.

Before deleting any codec family, also record:

- which `src/features/**` modules import it;
- whether it is an input decoder, output encoder, processor, or build-only helper;
- whether service-worker cache generation references its output files;
- whether browser smoke covers an equivalent replacement path;
- the exact files removed and the post-removal `npm run check` result.

## Missing provenance

The repo does not currently record exact upstream codec commits for most committed `.wasm` files. Before upgrading or replacing any codec, add:

- upstream project URL;
- exact upstream commit/tag;
- build command;
- Docker image or Rust toolchain version;
- generated output files;
- manual test notes and sample images.
