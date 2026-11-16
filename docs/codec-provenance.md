# Codec provenance

This document records what the current repository contains. It is not a guarantee that every codec output is reproducible today.

The original Squoosh project committed generated JavaScript and WebAssembly outputs under `codecs/`. Frisp still relies on those committed outputs during the SvelteKit/Vite build.

Current inventory note: `codecs/` contains 93 committed codec build products (`.wasm`, JS glue, pthread workers and type declarations), including browser builds, Node-targeted builds, threaded builds, SIMD builds, and worker companions. Every one is listed with its SHA-256 in `codecs/artifacts.sha256` (see [Artifact checksum manifest](#artifact-checksum-manifest)). That means codec cleanup can reduce repository weight, but it also has a high breakage risk.

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
| `codecs/ssimulacra2` | cloudinary/ssimulacra2, plus google/highway and mm2/Little-CMS | ssimulacra2 commit `81feacf6a5b0bbd7ec11b4a881a4615033ab0b10`; Highway commit `f670ea580bb70b4113b63b9cdaa42ba9b10cd13a` (1.0.2, the release libjxl 0.8 vendored); lcms2 commit `453bafeb85b4ef96498866b7a8eadcc74dff9223` (tag `lcms2.16`) | **New 2026-11-04.** The SSIMULACRA 2.1 perceptual metric behind auto-quality; it scores, never encodes. Licenses, checked against each fetched `LICENSE`: ssimulacra2 BSD-3-Clause (Cloudinary, plus its vendored libjxl slice under the JPEG XL Project's BSD-3-Clause, and an upstream `PATENTS` grant), Highway Apache-2.0, lcms2 MIT. Single variant, built with emsdk 3.1.0. |
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

## Source pins and how they are verified

Since 2026-11-17 no codec build fetches anything it does not verify. Tarballs
go through `codecs/fetch-verified.sh`, which keeps a download only if its
SHA-256 matches the pin in the Makefile. Git sources go through
`codecs/fetch-git.sh`, which takes only a full 40-character commit SHA, fetches
that commit, and fails unless `HEAD` is that commit; a tag can be moved, a
commit id cannot. Submodules need no pins of their own, because the pinned
commit records each submodule's commit id. Every hash below was computed from
a fresh download on 2026-11-17.

| Source | Used by | Pin | Verified by |
| --- | --- | --- | --- |
| libavif v1.4.2, GitHub tag tarball | `codecs/avif` | sha256 `2b645287340ba5a631d268b551dc2d72bd73ac33335962dd36dcdb6d8366921d` | `fetch-verified.sh` |
| libaom v3.12.1, `storage.googleapis.com/aom-releases/libaom-3.12.1.tar.gz` | `codecs/avif` | sha256 `9e9775180dec7dfd61a79e00bda3809d43891aee6b2e331ff7f26986207ea22e` | `fetch-verified.sh` |
| libwebp v1.6.0, GitHub tag tarball | `codecs/webp`, and `codecs/avif` for libsharpyuv | sha256 `93a852c2b3efafee3723efd4636de855b46f9fe1efddd607e1f42f60fc8f2136` | `fetch-verified.sh` |
| mozjpeg v4.1.5, GitHub tag tarball | `codecs/mozjpeg` | sha256 `9fcbb7171f6ac383f5b391175d6fb3acde5e64c4c4727274eade84ed0998fcc1` | `fetch-verified.sh` |
| qoi `8d35d93c`, GitHub commit tarball | `codecs/qoi` | sha256 `00f10a37021d1f75c78a94a95cf45500177b6f78e9a9b27cef49237798bd4db4` | `fetch-verified.sh` |
| libimagequant 2.18.0, GitHub tag tarball | `codecs/imagequant` | sha256 `790d2593a587f9a27cec6245ee7a212b34b0aa63cac6383e550eda01236be636` | `fetch-verified.sh` |
| libjxl v0.12.0 | `codecs/jxl` | commit `a7a9c787341cf703dede03c2009fa460cae5e5df`, submodules by gitlink | `fetch-git.sh --submodules` |
| google/jpegli | `codecs/jpegli` | commit `031a0077f5799a6041004267fc12b956c1f52a20`, submodules by gitlink | `fetch-git.sh --submodules` |
| cloudinary/ssimulacra2 | `codecs/ssimulacra2` | commit `81feacf6a5b0bbd7ec11b4a881a4615033ab0b10` | `fetch-git.sh` |
| google/highway 1.0.2 | `codecs/ssimulacra2` | commit `f670ea580bb70b4113b63b9cdaa42ba9b10cd13a` | `fetch-git.sh` |
| mm2/Little-CMS lcms2.16 | `codecs/ssimulacra2` | commit `453bafeb85b4ef96498866b7a8eadcc74dff9223` | `fetch-git.sh` |
| Rust crates (oxipng, resize, hqx, rotate) | Rust codecs | each codec's committed `Cargo.lock` | cargo checks every crates.io download against the lock's checksum; hqx's git dependency is locked to commit `d7cbae67906796928c8e451b186f3c653924beb8` (tag `v0.1.3`) |
| wasm-pack v0.12.1 linux-musl release | `codecs/rust.Dockerfile` | sha256 `7339ba3ad776bd5fc04dd5d6b9babe952648050a54226c08206fab4ffeec621f` | `sha256sum -c` in the Dockerfile |
| WABT 1.0.11 linux release | `codecs/rotate/Dockerfile` (unused by the current build) | sha256 `a6126f277aef7ef3dd78466db58ae11488e72cb7d762f6ffb5599c9ad4866753` | `sha256sum -c` in the Dockerfile |

Two sources changed URL on 2026-11-17, without changing what is compiled.
libaom and the libsharpyuv copy of libwebp used to come from googlesource
`+archive` URLs. Those tarballs are generated on every request: two downloads
of the libaom v3.12.1 archive minutes apart hashed `78f958c4…` and `0cb4c808…`,
so they cannot be pinned. The libaom release tarball extracts to a tree
identical to the `+archive` tree (`diff -r` is empty). The GitHub libwebp
tarball differs from the googlesource tree only in `.gitattributes`,
`.gitignore`, `.mailmap`, `m4/.gitignore` and `gradlew.bat`, none of which the
sharpyuv build reads.

The SHA-1 commit pins rely on git's object ids. Git computes them with
collision detection, and a commit pin also fixes every file and submodule
gitlink in that commit.

## Toolchain per artifact

This table is the one record of what built each committed artifact. The
evidence column says how it is known: a Rust `.wasm` names its compiler in its
`producers` section, and the Emscripten glue differs between emsdk 3.1.0 and
5.x (3.1.0 resolves the `.wasm` URL with `.toString()`, 5.x with `.href` and
also emits `moduleRtn` / `wasmExports`). The Emscripten `.wasm` files carry no
producers section.

| Artifacts | Toolchain | Evidence |
| --- | --- | --- |
| `avif/enc/avif_enc.*`, `avif_enc_mt.*` (+ worker), `avif/dec/avif_dec.*` | emsdk 3.1.0 (release `562e3a0af169e6dea5e6dbecac2255d67c2c8b94`), native | 3.1.0 glue; build notes, 2026-06-02 |
| `avif/*/avif_node_*` | Inherited from upstream Squoosh (2024-01-24, the `cpp.Dockerfile` of that commit named emsdk 2.0.34); not rebuilt, not in the Makefile's `all` | git history; nothing in the app imports them |
| `jxl/**` (all six) | emsdk 3.1.0, native | 3.1.0 glue; build notes, 2026-08-08 and 2026-08-11 |
| `mozjpeg/**`, `jpegli/**`, `ssimulacra2/**` | emsdk 3.1.0, native | 3.1.0 glue; build notes |
| `webp/**`, `imagequant/**` | emsdk 5.0.7 (release `6cd98e86d7749ff98b82b7f2ae78eb4f01942788`), native | 5.x glue; build notes, 2026-06-02 |
| `qoi/**` | Inherited from upstream Squoosh (2023-10-20, the `cpp.Dockerfile` of that commit named emsdk 2.0.23); not rebuilt | git history |
| `oxipng/pkg/*`, `oxipng/pkg-parallel/*` | rustc nightly-2026-06-02 (`1.98.0-nightly (6bdf43094 2026-06-01)`), wasm-bindgen 0.2.122, emsdk 3.1.0's clang 14 (LLVM `1a929525`) for libdeflate | producers section names all three; the clang commit matches emsdk 3.1.0's `clang --version` |
| `resize/pkg/*` | rustc nightly-2026-06-02, wasm-bindgen 0.2.122 | producers section |
| `hqx/pkg/*` | rustc 1.47.0, wasm-bindgen 0.2.74, via `codecs/rust.Dockerfile` with emsdk 2.0.8 | producers section; git history |
| `rotate/rotate.wasm` | rustc 1.47.0 via `codecs/rust.Dockerfile` | producers section |

How the recipes match this record:

- **Native builds are the recipe of record** for every C/C++ codec, using the
  emsdk release named above and the flags in
  [codec-build-notes.md](codec-build-notes.md#native-build-setup-no-docker-no-sudo).
- **`codecs/cpp.Dockerfile`** defaults to `emscripten/emsdk:3.1.0` pinned by
  digest `sha256:a4500d8b42b09a255c9517a06b019de52334b0f05af3f0b62529f27e83ff5247`
  and sets the same flags as the native recipe. For webp and imagequant, set
  `EMSDK_IMG=emscripten/emsdk:5.0.7@sha256:4e332f7343b6f66320bf72f7ecc01a3d9f3866721a13b0e5c7b96505d6ab148a`.
  `build-cpp.sh` mounts all of `codecs/` so the fetch scripts are reachable.
  The Docker route has not been used to produce any committed artifact; it is
  kept as a pinned alternative, not as proof of reproducibility.
- **`codecs/rust.Dockerfile`** defaults to `rust:1.47.0`
  (`sha256:48f4b36c3f3492b82a5e14b2fc991d3163c1d2ce18ac1f0561e9657103192713`)
  and `emscripten/emsdk:2.0.8`
  (`sha256:68672cb7faba80d4bb3d93d7f3df9f7543b2b91878bd673f0057a49485ceb1f4`),
  which built hqx and rotate.
- **`codecs/oxipng/rust-toolchain` and `codecs/resize/rust-toolchain`** pin
  `nightly-2026-06-02` with `rust-src` and the `wasm32-unknown-unknown` target.
  Current rustup reads them; run `rustup toolchain install` in the codec
  folder first if your rustup does not install a missing toolchain on its own.

## Artifact checksum manifest

`codecs/artifacts.sha256` lists the SHA-256 of every committed build product
under `codecs/`: each `.wasm`, its JS glue, pthread worker scripts and the
`.d.ts` declarations beside them (`codecs/rotate/benchmark.js` is source and is
excluded by name). `npm run verify:codecs` (`scripts/verify-codec-artifacts.mjs`)
hashes the tree and fails on any artifact that changed, is missing, or is not
listed. `npm run check` runs it first, so the CI build job enforces it on
Linux, macOS and Windows. The file is in `sha256sum` format, so
`shasum -a 256 -c codecs/artifacts.sha256` from the repo root checks it
without Node.

What it protects against: a stray or partial rebuild, a mis-built artifact
committed by accident, and a tool or merge that rewrites a binary. It does not
protect against someone who can commit, because they can update the manifest
too; there the manifest diff is what the reviewer reads.

**Updating it after a deliberate rebuild:**

1. Rebuild only the codec you mean to change.
2. Run `npm run verify:codecs`. It should list exactly the artifacts that
   rebuild produces, as `changed`. Anything else listed means the rebuild
   touched more than intended: restore it with `git checkout -- <path>`.
3. Run `npm run verify:codecs -- --update`, then read
   `git diff codecs/artifacts.sha256`: every changed line must be an artifact
   of that codec.
4. Commit the manifest in the same commit as the artifacts, and name the
   toolchain in the message. Update the toolchain table above if it changed.

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

Every source fetch is now pinned and verified, every toolchain is recorded, and
every committed artifact is checksummed. What is still not proven, as of
2026-11-17:

- **Reproducibility.** Nothing rebuilds the artifacts in CI and compares them
  with the manifest. The one recorded byte-for-byte reproduction is the libjxl
  decoder relink (build notes, gotcha 24). A rebuild check would need emsdk
  and the Rust nightly on a runner and roughly 40 minutes per full build.
- **webp's SIMD flags.** The 2026-06-02 webp build passed `-msimd128` and
  `-Wno-error=implicit-function-declaration` through the environment, and
  `codecs/webp/Makefile` does not record which variant got which flag. A
  rebuild of `webp_enc_simd.wasm` from the Makefile alone may not match.
- **Inherited artifacts.** `qoi/**`, `avif/*/avif_node_*`, `hqx/pkg/*` and
  `rotate/rotate.wasm` were built upstream by Squoosh. Their recipes are
  recorded and pinned, but nobody here has rebuilt them from those inputs.
- **Host tools.** The `apt-get` packages in `cpp.Dockerfile` (autoconf,
  libtool, pkg-config) are unpinned. They are build helpers, not linked into
  any codec.
