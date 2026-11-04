# Codec provenance

This document records what the current repository contains. It is not a guarantee that every codec output is reproducible today.

The original Squoosh project committed generated JavaScript and WebAssembly outputs under `codecs/`. Frisp still relies on those committed outputs during the SvelteKit/Vite build.

Current inventory note: `codecs/` contains 71 committed JavaScript/WebAssembly codec artifacts, including browser builds, Node-targeted builds, threaded builds, SIMD builds, and worker companions. That means codec cleanup can reduce repository weight, but it also has a high breakage risk.

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
| `codecs/jpegli`     | `jpegli`     | `../build-cpp.sh`                                                                                                            |
| `codecs/ssimulacra2` | `ssimulacra2` | `../build-cpp.sh` (built natively instead; see [codec-build-notes.md](codec-build-notes.md#ssimulacra2)) |
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
| `codecs/jxl`        | libjxl/libjxl                                         | `v0.12.0` (was `v0.8.5`, before that commit `9f544641ec83f6abd9da598bdd08178ee8a003e0`) | Fetches submodules recursively and builds single-thread, multithread, SIMD, and Node-targeted outputs. Encoder wrapper rewritten onto the public `JxlEncoder*` C API (2026-08-08), and given a second entrypoint `transcodeJPEG` for the lossless JPEG repack (2026-08-11, same version, no build change). Adds the 0.11.1 / 0.11.2 CVE fixes on top of CVE-2023-0645, CVE-2023-35790, CVE-2025-12474. **Output at a given quality slider position is larger than at v0.8.5**; see the note below. |
| `codecs/qoi`        | phoboslab/qoi                                         | commit `8d35d93cdca85d2868246c2a8a80a1e2c16ba2a8` tarball           | Builds encoder and decoder outputs. (Not upgraded — spec is frozen.)                                  |
| `codecs/mozjpeg`    | mozilla/mozjpeg                                       | `v4.1.5` tarball (was `v3.3.1`)                                     | Build moved autotools → CMake. 9 CVEs from the libjpeg-turbo 2.x base; compression intentionally unchanged = byte-identical. |
| `codecs/jpegli`     | google/jpegli                                         | commit `031a0077f5799a6041004267fc12b956c1f52a20` (2026-08-09 `main` HEAD) | **New 2026-08-09.** BSD-3-Clause. No release tags exist upstream, so the pin is a commit. Encode only, single variant, built with emsdk 3.1.0. |
| `codecs/ssimulacra2` | cloudinary/ssimulacra2, plus google/highway and mm2/Little-CMS | ssimulacra2 commit `81feacf6a5b0bbd7ec11b4a881a4615033ab0b10`; Highway commit `f670ea580bb70b4113b63b9cdaa42ba9b10cd13a` (1.0.2, the release libjxl 0.8 vendored); lcms2 tag `lcms2.16` | **New 2026-11-04.** The SSIMULACRA 2.1 perceptual metric behind auto-quality; it scores, never encodes. Licenses, checked against each fetched `LICENSE`: ssimulacra2 BSD-3-Clause (Cloudinary, plus its vendored libjxl slice under the JPEG XL Project's BSD-3-Clause, and an upstream `PATENTS` grant), Highway Apache-2.0, lcms2 MIT. Single variant, built with emsdk 3.1.0. |
| `codecs/imagequant` | ImageOptim/libimagequant                              | `2.18.0` tarball (was `2.12.1`)                                     | Configures with `--disable-sse`. Byte-identical; security/quality.                                    |
| `codecs/hqx`        | CryZe/wasmboy-rs `hqx` crate                          | git tag `v0.1.3`                                                    | Rust wrapper package is `squooshhqx` `0.1.0`; lockfile should be preserved when rebuilding. (Not upgraded — upstream abandoned, already on latest tag.) |
| `codecs/resize`     | crates.io `resize` crate                              | `0.8.9` (was `0.5.5`)                                               | Rust wrapper package is `squoosh-resize` `0.1.0`; lockfile should be preserved when rebuilding. Ahead of both Squoosh and jSquash (which pin 0.5.5). |
| `codecs/oxipng`     | crates.io `oxipng`                                    | `10.1.1` (was `9.0`)                                               | Builds normal and parallel wasm-pack outputs. Byte-identical at default preset; value is robustness + fast-mode/ICC fixes. |
| `codecs/rotate`     | local Rust source                                     | local `squoosh-rotate` `0.1.0`                                      | Build uses `codecs/rotate/Dockerfile`, WABT `1.0.11`, and `wasm-opt`.                                  |

> **libjxl v0.12.0 (2026-08-08): the quality slider was recalibrated.** The
> encoder wrapper is off libjxl's deleted internal C++ API and onto the public
> `JxlEncoder*` C API. libjxl also became accurate about hitting the butteraugli
> distance it is asked for, where v0.8.5 undershot, so the old curve's
> exponential low-quality tail no longer made sense and **the quality→distance
> mapping was redesigned** (`QualityToDistance` in `codecs/jxl/enc/jxl_enc.cpp`).
> The slider is calibrated against delivered SSIMULACRA2 instead of a nominal
> distance, and it deliberately stops at distance 15 so it never reaches
> libjxl's automatic downsampling zone. Compared at equal SSIMULACRA2 rather
> than equal distance, v0.12.0 is a wash on photographs and costs 18 to 29% more
> bytes on flat and text-heavy content; that is upstream behaviour, verified
> against a natively built v0.12.0 `cjxl` on identical pixels.
>
> Benchmark fixtures at default settings, against a control captured at the same
> commit (every other codec byte-identical):
>
> | Fixture | v0.8.5 | v0.12.0 retuned | Δ |
> |---|---|---|---|
> | photo | 56171 | 56395 | +0.4% |
> | illustration | 4915 | 6243 | +27.0% |
> | transparent | 5999 | 4747 | **−20.9%** |
> | gradient | 2378 | 2757 | +15.9% |
> | gradient-dithered | 2362 | 2811 | +19.0% |
> | hard-edges | 62846 | 62209 | **−1.0%** |
> | noise-synthetic | 99474 | 149563 | +50.4% |
> | screenshot | 9830 | 13030 | +32.6% |
> | photo-large | 376439 | 385858 | +2.5% |
>
> Photographs, the common case, are now a wash. The remaining cost is on
> synthetic content, where v0.12's VarDCT is genuinely less efficient than
> v0.8.5's, and it buys the 0.11.1 / 0.11.2 CVE fixes and a wrapper that no
> longer depends on libjxl internals.

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
| QOI encoder         | `src/features/encoders/qoi`         | `codecs/qoi/enc/qoi_enc.*`                                      | Dropped from the output picker 2026-06-27; no longer a user-selectable output. Still wired as an internal diagnostics probe (`src/lib/webp-pipeline-probe.ts`), so the encoder is not dead. |
| MozJPEG encoder     | `src/features/encoders/mozJPEG`     | `codecs/mozjpeg/enc/mozjpeg_enc.*`                              | Used by app today; not in the proposed focused codec list                  |
| jpegli encoder      | `src/features/encoders/jpegli`      | `codecs/jpegli/enc/jpegli_enc.*`                                | Used by app; added 2026-08-09 as a second JPEG encoder beside MozJPEG. Whether it replaces MozJPEG as the default JPEG is a later product decision. |
| OxiPNG encoder      | `src/features/encoders/oxiPNG`      | `codecs/oxipng/pkg*`                                            | Used by app today; not in the proposed focused codec list                  |
| SSIMULACRA2 metric  | `src/worker/codec-worker.ts` (`ssimulacra2Score`) | `codecs/ssimulacra2/ssimulacra2.*`                         | Wired into the codec worker and precached 2026-11-04. Nothing calls it yet; the auto-quality search will be its only caller |
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
[codec-surface-cleanup.md](history/codec-surface-cleanup.md) for the removal record and
[the codec upgrade audit](project/reports/2026-06-02-codec-upgrade-audit.md) §3 for the rationale.

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
