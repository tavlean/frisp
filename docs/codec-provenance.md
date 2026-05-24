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

## Local build metadata

The top-level codec package files currently advertise these build entry points:

| Codec folder        | Package name | Build command                                                                                                                |
| ------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `codecs/avif`       | `avif`       | `../build-cpp.sh`                                                                                                            |
| `codecs/webp`       | `webp`       | `../build-cpp.sh`                                                                                                            |
| `codecs/jxl`        | `jxl`        | `../build-cpp.sh`                                                                                                            |
| `codecs/wp2`        | `wp2`        | `../build-cpp.sh`                                                                                                            |
| `codecs/qoi`        | `qoi`        | `../build-cpp.sh`                                                                                                            |
| `codecs/mozjpeg`    | not declared | `../build-cpp.sh`                                                                                                            |
| `codecs/oxipng`     | `oxipng`     | `RUST_IMG=rustlang/rust@sha256:5fd16a5576c22c8fdd5d659247755999e426c04de8dcf18a41ea446c5f253309 ../build-rust.sh ./build.sh` |
| `codecs/imagequant` | `imagequant` | `../build-cpp.sh`                                                                                                            |
| `codecs/resize`     | `resize`     | `../build-rust.sh`                                                                                                           |
| `codecs/hqx`        | `hqx`        | `../build-rust.sh`                                                                                                           |
| `codecs/rotate`     | `rotate`     | `../build-rust.sh ./build.sh`                                                                                                |
| `codecs/png`        | `oxipng`     | `../build-rust.sh`                                                                                                           |
| `codecs/visdif`     | `avif`       | `../build-cpp.sh`                                                                                                            |

Some package names are inherited and do not uniquely identify their folder, such as `codecs/png` declaring `oxipng` and `codecs/visdif` declaring `avif`. Use folder paths, feature imports, and generated asset references as the source of truth when planning codec cleanup.

## Local source references

The build recipes record these upstream source references. Treat them as the rebuild recipe inputs, not as proof that every committed `.wasm` was generated from exactly these inputs, because the repository still carries inherited generated artifacts.

| Codec folder        | Upstream source recorded locally                      | Reference recorded locally                                          | Notes                                                                                                  |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `codecs/avif`       | AOMediaCodec/libavif                                  | `v1.0.1` tarball                                                    | Uses libaom `v3.7.0` and libwebp commit `e2c85878f6a33f29948b43d3492d9cdaf801aa54` for libsharpyuv.    |
| `codecs/webp`       | webmproject/libwebp                                   | commit `d2e245ea9e959a5a79e1db0ed2085206947e98f2` tarball           | Builds baseline and SIMD browser artifacts plus Node encoder/decoder artifacts.                        |
| `codecs/jxl`        | libjxl/libjxl                                         | commit `9f544641ec83f6abd9da598bdd08178ee8a003e0`                   | Fetches submodules recursively and builds single-thread, multithread, SIMD, and Node-targeted outputs. |
| `codecs/wp2`        | Chromium libwebp2                                     | commit `413df7caeca5013fa9a51401660f7efd8572e0ae` archive           | Builds baseline, multithread, SIMD, and Node-targeted outputs.                                         |
| `codecs/qoi`        | phoboslab/qoi                                         | commit `8d35d93cdca85d2868246c2a8a80a1e2c16ba2a8` tarball           | Builds encoder and decoder outputs.                                                                    |
| `codecs/mozjpeg`    | mozilla/mozjpeg                                       | `v3.3.1` tarball                                                    | Configures with `--with-build-date=squoosh` for reproducible version strings.                          |
| `codecs/imagequant` | ImageOptim/libimagequant                              | `2.12.1` tarball                                                    | Configures with `--disable-sse`.                                                                       |
| `codecs/visdif`     | google/butteraugli                                    | commit `71b18b636b9c7d1ae0c1d3730b85b3c127eb4511` tarball           | Node-targeted visual-difference utility; not wired as a current app feature.                           |
| `codecs/hqx`        | CryZe/wasmboy-rs `hqx` crate                          | git tag `v0.1.3`                                                    | Rust wrapper package is `squooshhqx` `0.1.0`; lockfile should be preserved when rebuilding.            |
| `codecs/resize`     | crates.io `resize` crate                              | `0.5.5`                                                             | Rust wrapper package is `squoosh-resize` `0.1.0`; lockfile should be preserved when rebuilding.        |
| `codecs/png`        | crates.io `png`, `wasm-bindgen`, `web-sys`, and `rgb` | `png 0.16.7`, `wasm-bindgen 0.2.68`, `web-sys 0.3.45`, `rgb 0.8.25` | Rust wrapper package is `squoosh-png` `0.1.0`; active PNG optimization uses OxiPNG today.              |
| `codecs/oxipng`     | crates.io `oxipng`                                    | `9.0`                                                               | Builds normal and parallel wasm-pack outputs; uses a pinned Rust Docker image in `package.json`.       |
| `codecs/rotate`     | local Rust source                                     | local `squoosh-rotate` `0.1.0`                                      | Build uses `codecs/rotate/Dockerfile`, WABT `1.0.11`, and `wasm-opt`.                                  |

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

## Remaining provenance gaps

The repo now records the source references present in local build recipes, but it still does not prove that each committed `.wasm` file came from those exact inputs. Before upgrading or replacing any codec, add:

- upstream project URL;
- exact upstream commit/tag;
- build command;
- Docker image or Rust toolchain version;
- generated output files;
- manual test notes and sample images.
