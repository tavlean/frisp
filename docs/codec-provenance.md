# Codec provenance

This document records what the current repository contains. It is not a guarantee that every codec output is reproducible today.

The original Squoosh project committed generated JavaScript and WebAssembly outputs under `codecs/`. Presk still relies on those committed outputs during the Rollup build.

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
| `codecs/qoi`        | `qoi`        | `../build-cpp.sh`                                                                                                            |
| `codecs/mozjpeg`    | not declared | `../build-cpp.sh`                                                                                                            |
| `codecs/oxipng`     | `oxipng`     | `RUST_IMG=rustlang/rust@sha256:5fd16a5576c22c8fdd5d659247755999e426c04de8dcf18a41ea446c5f253309 ../build-rust.sh ./build.sh` |
| `codecs/imagequant` | `imagequant` | `../build-cpp.sh`                                                                                                            |
| `codecs/resize`     | `resize`     | `../build-rust.sh`                                                                                                           |
| `codecs/hqx`        | `hqx`        | `../build-rust.sh`                                                                                                           |
| `codecs/rotate`     | `rotate`     | `../build-rust.sh ./build.sh`                                                                                                |

Some package names are inherited and do not uniquely identify their folder. Use folder paths, feature imports, and generated asset references as the source of truth when planning codec cleanup. (Historically `codecs/png` declared `oxipng` and `codecs/visdif` declared `avif`; both were dead inherited dirs and were deleted in the codec-cleanup pass.)

## Local source references

The build recipes record these upstream source references. For the **seven codecs
rebuilt on 2026-06-02** (avif, webp, jxl, mozjpeg, imagequant, resize, oxipng),
the committed `.wasm`/`.js` were regenerated from exactly the pins below. For the
codecs not rebuilt in that sweep (qoi, hqx, rotate), treat the references as the
rebuild recipe inputs, not as proof that the inherited committed `.wasm` was
generated from exactly these inputs.

> **Updated 2026-06-02 — codec rebuilds landed (merged into `main`).** Seven codecs
> were upgraded and committed; the version column below reflects the **new pins**.
> All were built **natively with emsdk 3.1.0 + rustup nightly (no Docker, no
> sudo)**, and verified by the 17-test Playwright e2e suite + the benchmark with no
> regressions. Build details (toolchains, gotchas, bugs):
> [codec-build-notes.md](codec-build-notes.md).

| Codec folder        | Upstream source recorded locally                      | Reference recorded locally                                          | Notes                                                                                                  |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `codecs/avif`       | AOMediaCodec/libavif                                  | `v1.4.2` tarball (was `v1.0.1`)                                     | Uses libaom `v3.12.1` (was `v3.7.0`) and libwebp `v1.6.0` for libsharpyuv. CVE-2024-5171; zero size regression, 6–13% faster encode. |
| `codecs/webp`       | webmproject/libwebp                                   | `v1.6.0` tarball (was commit `d2e245ea9e959a5a79e1db0ed2085206947e98f2`) | Builds baseline and SIMD browser artifacts plus Node encoder/decoder artifacts. CVE-2023-4863; byte-identical output. |
| `codecs/jxl`        | libjxl/libjxl                                         | `v0.8.5` (was commit `9f544641ec83f6abd9da598bdd08178ee8a003e0`)   | Fetches submodules recursively and builds single-thread, multithread, SIMD, and Node-targeted outputs. CVE-2023-0645, CVE-2023-35790, CVE-2025-12474; 3–6% smaller + 2–9% faster. |
| `codecs/qoi`        | phoboslab/qoi                                         | commit `8d35d93cdca85d2868246c2a8a80a1e2c16ba2a8` tarball           | Builds encoder and decoder outputs. (Not upgraded — spec is frozen.)                                  |
| `codecs/mozjpeg`    | mozilla/mozjpeg                                       | `v4.1.5` tarball (was `v3.3.1`)                                     | Build moved autotools → CMake. 9 CVEs from the libjpeg-turbo 2.x base; compression intentionally unchanged = byte-identical. |
| `codecs/imagequant` | ImageOptim/libimagequant                              | `2.18.0` tarball (was `2.12.1`)                                     | Configures with `--disable-sse`. Byte-identical; security/quality.                                    |
| `codecs/hqx`        | CryZe/wasmboy-rs `hqx` crate                          | git tag `v0.1.3`                                                    | Rust wrapper package is `squooshhqx` `0.1.0`; lockfile should be preserved when rebuilding. (Not upgraded — upstream abandoned, already on latest tag.) |
| `codecs/resize`     | crates.io `resize` crate                              | `0.8.9` (was `0.5.5`)                                               | Rust wrapper package is `squoosh-resize` `0.1.0`; lockfile should be preserved when rebuilding. Ahead of both Squoosh and jSquash (which pin 0.5.5). |
| `codecs/oxipng`     | crates.io `oxipng`                                    | `10.1.1` (was `9.0`)                                               | Builds normal and parallel wasm-pack outputs. Byte-identical at default preset; value is robustness + fast-mode/ICC fixes. |
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
| `codecs/*/*_node_*` | Node-targeted builds used by codec examples or package tests. They are not imported by browser features, but may be useful when rebuilding/verifying codecs. |

The dead `codecs/png/` (Rust `image-png` wrapper) and `codecs/visdif/` (butteraugli visual-diff utility) directories were deleted in the codec-cleanup pass; the active PNG path is OxiPNG (the canvas browser-PNG encoder was itself removed on 2026-06-27), and `visdif` was never wired as an app feature.

## Current product direction

The focused codec list being considered is:

- WebP 1
- AVIF
- JPEG XL

WebP 2 was **removed entirely** (encoder and decoder) on 2026-06-02 — it was a
permanently-experimental format no browser can decode. See
[codec-surface-cleanup.md](codec-surface-cleanup.md) for the removal record and
[codec-upgrade-audit.md](codec-upgrade-audit.md) §3 for the rationale.

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
