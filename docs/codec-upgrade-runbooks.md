# Codec Upgrade Runbooks — Per-Codec, Turnkey

Last updated: 2026-06-02. Status: **✅ DONE.** Every codec in the table below was
upgraded to the target version and committed on the **`codec-rebuilds`** branch,
built **natively with emsdk 3.1.0 + rustup nightly (no Docker, no sudo)** —
verified by the 17-test Playwright e2e suite + the benchmark with no regressions.
**These per-codec recipes are now historical**; the actual build record (toolchains,
gotchas, the bugs hit per codec) is in
[codec-build-notes.md](codec-build-notes.md). Note: libjxl shipped **Path A
(v0.8.5)** and libaom shipped **v3.12.1** (the audit cited later targets — the
landed versions in the table below are authoritative).

Turnkey, per-codec upgrade steps derived from the codec audit
([codec-upgrade-audit.md](codec-upgrade-audit.md)). **All of these were executed
on 2026-06-02** — built natively with emsdk 3.1.0 + rustup nightly (no Docker, no
sudo) and committed on `codec-rebuilds`. These recipes are kept as a reference for
future codec updates; the as-built record is in
[codec-build-notes.md](codec-build-notes.md).

Read [codec-provenance.md](codec-provenance.md) before touching `codecs/` and
follow its build / generated-metadata / service-worker / browser verification
rules.

Every runbook ends the same way: after rebuilding the codec artifacts, run the
app build gate `npm run check` (format:check → sync → svelte-kit sync →
svelte-check → vite build → audit:static-output). The regenerated `.wasm`/`.js`
are `?url`-imported through `src/shared/codec-assets.ts`, the worker bridge
(`src/lib/sveltekit-worker-bridge.ts`), and the SW precache plan
(`src/sw/cache-plan.ts`); `npm run check` confirms they still resolve. Because
`.wasm` sizes shift on every rebuild, **re-check the `audit:static-output` size
budget** if it asserts exact sizes.

## Toolchain note

- C/C++ codecs build via the repo's Docker wrapper: `codecs/build-cpp.sh` builds
  the `squoosh-cpp` image from `codecs/cpp.Dockerfile` (pins
  `emscripten/emsdk:2.0.34`), then runs `emmake make -j$(nproc)`.
- Rust codecs build via `codecs/build-rust.sh` + `codecs/rust.Dockerfile`
  (wasm-pack). The Rust Dockerfile's default `RUST_IMG` is **rust:1.47**, far too
  old for the modern Rust crates below — pass a newer `RUST_IMG` where noted.

## Suggested order

1. **libimagequant** — lowest-risk; warms up the Docker/emsdk pipeline first.
2. **libwebp**, then **libavif+libaom** — the CVE-urgent pair, done in one batch
   (libavif v1.4.2 itself pins libwebp v1.6.0 for sharpyuv).
3. **libjxl** — urgent but **isolate it** (Path A first); the wrapper uses
   libjxl-internal headers, not the public C API.
4. **oxipng**, **mozjpeg**, **resize** — gradual; defer each to its own session.

| Codec | Status | From → To (landed) | Wrapper edits |
|-------|--------|--------------------|---------------|
| libimagequant (`codecs/imagequant`) | ✅ done | 2.12.1 → 2.18.0 | none |
| libwebp (`codecs/webp`) | ✅ done | commit `d2e245ea` (pre-1.2.0) → v1.6.0 | none |
| libavif + libaom (`codecs/avif`) | ✅ done | avif 1.0.1 / aom 3.7.0 → avif 1.4.2 / aom 3.12.1 | likely none (verify) |
| libjxl (`codecs/jxl`) | ✅ done | commit `9f544641` (pre-0.7) → **v0.8.5 (Path A shipped)** | A: ~none; B: full encoder rewrite |
| oxipng (`codecs/oxipng`) | ✅ done | 9.0.0 → 10.1.1 | one line + one import |
| mozjpeg (`codecs/mozjpeg`) | ✅ done | v3.3.1 → v4.1.5 | none in `.cpp`; build-system rewrite (autotools → CMake) |
| resize (`codecs/resize`) | ✅ done | 0.5.5 → 0.8.9 | moderate rewrite |

---

## libimagequant (`codecs/imagequant`) — ✅ done (2.12.1 → 2.18.0)

- **Current pin:** 2.12.1 (2018).
- **Target:** 2.18.0 (the 2.x C branch; tag confirmed via the GitHub API). **Do
  NOT jump to 4.x** — that is a pure-Rust rewrite needing a wasm-bindgen
  toolchain (a separate project).

**Build-file change — ONE LINE.** In `codecs/imagequant/Makefile` line 1:

```make
CODEC_URL := https://github.com/ImageOptim/libimagequant/archive/2.18.0.tar.gz
```

(was `2.12.1.tar.gz`). Verified: 2.18.0 still ships the autotools `configure`
script and the C sources (`libimagequant.c`, `mediancut.c`, `kmeans.c`,
`blur.c`, `nearest.c`, `mempool.c`), so the existing `./configure --disable-sse`
rule (Makefile lines 29–31) and the `libimagequant.a` rule (lines 26–27) are
unchanged.

**Wrapper API changes — NONE.** The C ABI (`liq_attr`,
`liq_image_create_rgba`, `liq_quantize_image` / `liq_image_quantize`,
`liq_set_dithering_level`, `liq_write_remapped_image`, `liq_get_palette`,
`liq_result_*`) is stable across all 2.x. `codecs/imagequant/imagequant.cpp`
needs no edits.

**Build:**

```sh
# emsdk 2.0.34 via codecs/cpp.Dockerfile
cd /Users/tav/Development/Tavlean/Frisp/codecs/imagequant
rm -rf node_modules            # purge old 2.12.1 source + build
../build-cpp.sh                 # docker build squoosh-cpp + emmake make -j$(nproc)
# Regenerates imagequant.js+.wasm and imagequant_node.js+.wasm.
```

**Verify:**

1. Do this **first** of the urgent items — lowest risk; warms up the Docker/emsdk
   pipeline before the harder webp/avif/jxl builds.
2. Confirm regenerated `imagequant.wasm` + `imagequant.js` in `git status`
   (committed `.wasm` is ~66 KB).
3. `npm run check` — imagequant is wired as a processor/quantizer; confirm
   codec-assets + worker bridge + SW plan still resolve it.
4. Functional: run "reduce palette" on a photo at several color counts and
   dithering levels in the dev preview; compare against pre-upgrade. 2.14's
   better remap-over-background and 2.18's few-pixel / diverse-color handling
   should give equal-or-better palettes. A memory-leak fix landed in 2.13–2.18.
5. Edge case: quantize a tiny image (a few pixels) and a very-many-color image to
   exercise the 2.18 improvements.

**Risks:** Low. Only realistic failure is a new-warning-as-error or a configure
quirk under emsdk 2.0.34, both unlikely (the build path is byte-identical to
today). `.wasm` size shifts slightly — re-check the audit budget.

---

## libwebp (`codecs/webp`) — ✅ done (→ v1.6.0)

- **Current pin:** commit `d2e245ea9e959a5a79e1db0ed2085206947e98f2` (Nov 24 2020,
  just before v1.2.0).
- **Target:** v1.6.0 (tag confirmed via the GitHub API).
- **Headline reason:** CVE-2023-4863 (`BuildHuffmanTable` OOB write, fixed in
  v1.3.2).

**Build-file change.** In `codecs/webp/Makefile` line 1, point `CODEC_URL` at the
v1.6.0 tag archive:

```make
CODEC_URL = https://github.com/webmproject/libwebp/archive/refs/tags/v1.6.0.tar.gz
```

(was the `d2e245ea…` commit archive). The `--strip 1` extraction in the
CMakeLists target (line 63) still works for a tag tarball. No other Makefile
lines change: the CMake flags (`WEBP_BUILD_CWEBP=0`, etc.), the `libwebp.a`
target, and the SIMD/baseline split are all version-stable.

**Wrapper API changes — NONE.** `codecs/webp/enc/webp_enc.cpp` uses only the
public, binary-stable API: `WebPConfig`, `WebPPicture`, `WebPPictureInit`,
`WebPPictureImportRGBA`, `WebPEncode`, `WebPMemoryWriter*`,
`WebPGetEncoderVersion`. Every `WebPConfig` field bound in
`EMSCRIPTEN_BINDINGS` (`lossless`, `quality`, `method`, `near_lossless`,
`use_sharp_yuv`, `qmax`, …) still exists in v1.6.0; `config.qmax = 100` (line 30)
is valid. The decoder wrapper `webp/dec/webp_dec.cpp` is also public-API only. No
`.cpp` edits needed.

**Build:**

```sh
# emsdk 2.0.34 via codecs/cpp.Dockerfile
cd /Users/tav/Development/Tavlean/Frisp/codecs/webp
rm -rf node_modules            # purge old vendored libwebp source + build dirs
../build-cpp.sh                 # docker build squoosh-cpp + emmake make -j$(nproc)
# Regenerates enc/webp_enc.js+.wasm, enc/webp_enc_simd.js+.wasm,
# dec/webp_dec.js+.wasm and the *_node_* variants.
```

**Verify:**

1. `git status` shows modified `enc/webp_enc.wasm`, `enc/webp_enc_simd.wasm`,
   `dec/webp_dec.wasm` and `.js` companions (sizes differ from the committed
   ~298 KB / ~371 KB / ~148 KB).
2. Sanity-check the baked-in encoder version: grep the regenerated
   `enc/webp_enc.js` for a version constant, or run the node variant and call
   `version()` (`WebPGetEncoderVersion`) — v1.6.0 returns `0x010600`.
3. `npm run check`.
4. Functional: encode a lossy and a lossless WebP, and decode a WebP input;
   compare to the pre-upgrade build. Lossless decode should be unchanged or
   slightly faster (v1.6.0 enables `VP8L_USE_FAST_LOAD` for WASM).
5. Security regression: optionally decode a known-malformed lossless WebP fuzz
   sample to confirm no crash (CVE-2023-4863).

**Risks:** Low-to-medium, mostly indirect. (1) **Coupling:** Frisp builds
libsharpyuv for AVIF from a *separate* libwebp checkout (`codecs/avif` Makefile,
`LIBWEBP_URL_WITH_SHARPYUV` pinned to commit `e2c85878`). That is independent of
this `webp/` dir, so this upgrade alone does **not** touch AVIF — but bump it in
the **same batch** (see the avif runbook) because libavif v1.4.2 itself pins
libwebp v1.6.0 for sharpyuv. (2) v1.6.0 raised its CMake minimum; emsdk 2.0.34's
bundled cmake is recent enough, but a cmake error is the signal. (3) Regenerated
`.wasm` size changes — review the audit budget.

---

## libavif + libaom (`codecs/avif`) — ✅ done (avif → v1.4.2 / aom → v3.12.1)

- **Current pin:** libavif v1.0.1 + libaom v3.7.0; libsharpyuv from libwebp commit
  `e2c85878f6a33f29948b43d3492d9cdaf801aa54`.
- **Target:** libavif **v1.4.2** (tag confirmed) + libaom **v3.x latest** (the
  audit cites v3.14.1; pin to a tag `aomedia.googlesource.com` actually exposes,
  e.g. v3.10.0 / v3.11.0 — **verify the exact tag is downloadable before
  committing**) + libsharpyuv → libwebp v1.6.0. Constraint: aom tag **must be
  ≥ v3.9.1** (CVE fix, below).
- **Headline reason:** CVE-2024-5171 (CVSS 9.8, libaom `img_alloc_helper`
  integer overflow, fixed in aom v3.9.1).

**Build-file change — THREE lines** in `codecs/avif/Makefile`:

1. Line 2 — `LIBAVIF_URL = https://github.com/AOMediaCodec/libavif/archive/refs/tags/v1.4.2.tar.gz`
   (was v1.0.1).
2. Line 6 — `LIBAOM_URL = https://aomedia.googlesource.com/aom/+archive/<TAG>.tar.gz`
   where `<TAG>` is the chosen aom tag (was v3.7.0). **Verify the exact tag string
   resolves on aomedia.googlesource.com first.**
3. Line 17 — `LIBWEBP_URL_WITH_SHARPYUV = https://chromium.googlesource.com/webm/libwebp/+archive/refs/tags/v1.6.0.tar.gz`
   (was the `e2c85878` commit). This matches what libavif v1.4.2's own
   `ext/libsharpyuv.cmd` pins (verified: it `git clone -b v1.6.0`).

Add `-DCMAKE_C_STANDARD=11` to the libaom and libavif `emcmake` invocations
(helper.Makefile lines 52 and 65) if v1.4.0+ complains about C11 (libavif v1.4
wants C11 internally).

**Wrapper API changes — very likely NONE, but verify two spots in
`codecs/avif/enc/avif_enc.cpp`:** (1) it sets `encoder->quality` /
`encoder->qualityAlpha` (the modern quality API libavif kept after deprecating the
old quantizer fields in v1.2.0 — correct for v1.4.2). (2)
`avifEncoderSetCodecSpecificOption(encoder, "tune"/"sharpness"/
"color:enable-chroma-deltaq"/"color:denoise-noise-level", …)` — these libaom
passthrough keys are stable. `AVIF_MATRIX_COEFFICIENTS_IDENTITY/BT601`,
`AVIF_PIXEL_FORMAT_*`, `avifImageRGBToYUV`, `avifEncoderWrite`,
`AVIF_CHROMA_DOWNSAMPLING_SHARP_YUV` all persist in v1.4.2. The decoder wrapper
`avif/dec/avif_dec.cpp` (`avifDecoderReadMemory`, `avifRGBImage*`,
`avifImageYUVToRGB`) is also stable. No source edits expected; if the build errors
it will be on a codec-specific-option key name, not the core API.

**Build:**

```sh
# emsdk 2.0.34 via codecs/cpp.Dockerfile
cd /Users/tav/Development/Tavlean/Frisp/codecs/avif
rm -rf node_modules            # purge old libavif, libaom, libwebp ext, node_modules/build
../build-cpp.sh                 # docker build squoosh-cpp + emmake make -j$(nproc)
# Build order is enforced by the Makefile:
#   libsharpyuv (ST then MT) -> libaom -> libavif -> wrappers.
# Regenerates enc/avif_enc.js+.wasm, enc/avif_enc_mt.js+.wasm (+ worker),
# dec/avif_dec.js+.wasm, and *_node_* variants.
```

**Verify:**

1. Build completes through all three sequential targets (`OUT_ENC_JS`,
   `OUT_ENC_MT_JS` gated on `OUT_ENC_JS`, `OUT_DEC_JS`). The MT target depends on
   the ST target by design (libsharpyuv copy conflict) — both must succeed.
2. `git status` shows `dec/avif_dec.wasm`, `enc/avif_enc.wasm`,
   `enc/avif_enc_mt.wasm` + `.js` + `.worker.js`.
3. `npm run check` — verifies the worker bridge, codec-assets manifest, and SW
   cache plan still resolve the avif `_mt` / `_node` variants by `?url`.
4. Functional: encode a photo to AVIF at a few quality points and decode an AVIF
   input; compare against pre-upgrade. Expect ~12–17% better compression at equal
   quality for still images (libaom `AOM_TUNE_IQ`, on by default in libavif v1.4
   for still images) — a visible win.
5. Security regression: ensure the chosen aom tag is **≥ v3.9.1** (CVE-2024-5171).
6. Decode-path sanity: encoder uses `AVIF_CODEC_AOM` only; decoder uses libaom
   decode. The quality API survived the v1.2.0 quantizer→quality deprecation, so
   encode behaves identically apart from the tune/compression gains.

**Risks:** Medium. (1) **AOM TAG AVAILABILITY** is the single biggest gotcha:
`aomedia.googlesource.com` `+archive` URLs require an exact tag and the audit's
v3.14.1 may not be the literal tag name — resolve the real tag before editing
line 6. (2) **C11:** libavif v1.4 may need `-DCMAKE_C_STANDARD=11` added to the
helper.Makefile `emcmake` calls. (3) libsharpyuv coupling: now aligned (v1.6.0),
but the avif Makefile builds it from its OWN libwebp checkout under
`node_modules/libavif/ext/libwebp` — independent of `codecs/webp/`. (4) Build
time is long (libaom is large); AVIF-in-WASM encode of a 12 MP image stays
~60–140 s regardless (no SIMD: `AOM_TARGET_CPU=generic`) — this upgrade does not
change that. (5) Regenerated `.wasm` sizes change; re-check the audit budget.

---

## libjxl (`codecs/jxl`) — ✅ done (Path A shipped: → v0.8.5)

- **Current pin:** commit `9f544641ec83f6abd9da598bdd08178ee8a003e0` (Jan 2022,
  pre-0.7).
- **Target — TWO PATHS.**
  - **Path A (low-risk, recommended first): v0.8.5** — the highest tag that still
    ships the internal C++ headers this wrapper depends on.
  - **Path B (full target, requires a wrapper rewrite): v0.11.2.**

> **ISOLATE this upgrade in its own branch/session.** Both Squoosh and jSquash are
> STILL stuck on Frisp's exact pin — strong evidence of WASM build friction. Do
> not batch with the other three.

**Build-file change.** In `codecs/jxl/Makefile` line 2, change `CODEC_VERSION`
from the commit to a tag — Path A: `CODEC_VERSION = v0.8.5`; Path B:
`CODEC_VERSION = v0.11.2`. The Makefile fetches via
`git fetch <url> <CODEC_VERSION> --depth 1` + submodule update (lines 84–87), so
a tag works directly. For **both** paths: the skcms manual-compile step (lines
78–80) and the brotli/highway/skcms static-lib link list (lines 53–57) may need
path adjustments if libjxl's `third_party` layout changed — verify
`CODEC_BUILD_DIR/third_party/*` paths after the CMake configure.

**Wrapper API changes — THE CRITICAL FINDING, and it differs from the audit.**
The audit says the JXL break is "`JxlEncoderOptions*` removal in v0.9" — but
`codecs/jxl/enc/jxl_enc.cpp` does **NOT use the public `JxlEncoder*` C API at
all**. It uses libjxl's **internal C++ API**: it `#include`s `lib/jxl/enc_file.h`,
`lib/jxl/enc_color_management.h`, `lib/jxl/enc_external_image.h`,
`lib/jxl/base/thread_pool_internal.h`, and calls `jxl::CompressParams`,
`jxl::CodecInOut`, `jxl::PassesEncoderState`, `EncodeFile(...)`,
`jxl::GetJxlCms()`, `jxl::ConvertFromExternal(...)`.

Verified via the GitHub API: `lib/jxl/enc_file.h` and
`lib/jxl/enc_color_management.h` **exist at v0.8.2** but are **GONE (HTTP 404) at
v0.9.0, v0.9.2, v0.10.3, and v0.11.2** (replaced by a refactored
`enc_frame.h` / `enc_cache` flow). Consequences:

- **Path A (v0.8.5):** the internal headers and `EncodeFile`/`GetJxlCms` still
  exist, so the encoder wrapper compiles with **minimal or zero source edits**
  (CompressParams field names like `speed_tier`, `butteraugli_distance`,
  `modular_mode`, `responsive`, `color_transform`, `quality_pair`,
  `lossy_palette`, `photon_noise_iso`, `decoding_speed_tier` are stable across
  0.7→0.8). This is why **v0.8.5 is the pragmatic target.**
- **Path B (v0.11.2):** the encoder wrapper **must be REWRITTEN** onto the public
  `JxlEncoder*` C API (`jxl/encode.h`): `JxlEncoderCreate`,
  `JxlEncoderFrameSettingsCreate`, `JxlEncoderSetFrameDistance` /
  `JxlEncoderSetFrameLossless`, `JxlEncoderFrameSettingsSetOption`
  (`JXL_ENC_FRAME_SETTING_EFFORT`, `_DECODING_SPEED`, `_MODULAR`, `_RESPONSIVE`,
  `_PHOTON_NOISE`, …), `JxlEncoderAddImageFrame`, `JxlEncoderProcessOutput`. The
  custom modular/palette quality math in the current wrapper (quality↔butteraugli
  mapping, `lossy_palette` path) must be re-expressed via public setters or
  dropped. **A real porting job, not a rebuild.**
- **Decoder is fine for BOTH paths:** `jxl/dec/jxl_dec.cpp` uses the public C
  decoder API (`JxlDecoderCreate`, `JxlDecoderProcessInput`,
  `JxlDecoderGetBasicInfo`, `JxlDecoderSetImageOutBuffer`) plus one internal
  header `lib/jxl/color_encoding_internal.h` — **verified that header STILL EXISTS
  at v0.11.2**, so the decoder needs no rewrite either way (the skcms include path
  is the only thing to recheck).

**Build:**

```sh
# emsdk 2.0.34 via codecs/cpp.Dockerfile. JXL pulls submodules
# (brotli, highway, skcms) at the pinned tag.
cd /Users/tav/Development/Tavlean/Frisp/codecs/jxl
rm -rf node_modules            # purge old jxl checkout + build/{mt,mt-simd}
../build-cpp.sh                 # docker build squoosh-cpp + emmake make -j$(nproc)
# Regenerates enc/jxl_enc.js, enc/jxl_enc_mt.js, enc/jxl_enc_mt_simd.js
# (+ workers), dec/jxl_dec.js, and *_node_* variants.
# If the skcms manual compile (Makefile lines 78-80) fails, the skcms source
# path under third_party/skcms moved — adjust the emcc -I and the .cc path.
```

**Verify:**

1. **Path A first:** build at v0.8.5. If the encoder wrapper compiles unchanged,
   you have captured most of the security value (CVE-2023-0645, CVE-2023-35790 are
   fixed in the 0.8 line) with near-zero wrapper risk.
2. Confirm regenerated `enc/jxl_enc*.wasm`, `dec/jxl_dec.wasm` in `git status`;
   sizes differ from committed.
3. `npm run check` — the JXL `_mt` and `_mt_simd` variants are `?url`-referenced
   through codec-assets + worker bridge + SW cache plan; confirm all resolve.
4. Functional: encode lossy, lossless (quality 100 / lossyModular), and
   progressive JXL; decode a JXL input. Compare to pre-upgrade. v0.10+ gives
   5–10× faster lossless and 30–40% smaller progressive — measure to confirm you
   actually got 0.10+ behavior (**Path B only**).
5. **If pursuing Path B (v0.11.2):** after the encoder rewrite, re-verify the
   quality-slider mapping end-to-end (the old `butteraugli_distance` math must be
   reproduced via `JxlEncoderSetFrameDistance`) and confirm the JXL feature
   metadata in `src/features/encoders/*` still matches the rewritten wrapper's
   option set.

**Risks:** **HIGH for Path B, LOW-MEDIUM for Path A.** The decisive risk is the
internal-vs-public API mismatch above — the audit understates it.
**Recommendation:** ship Path A (v0.8.5) as the security-driven step now (minimal
wrapper risk, captures early CVEs), and treat Path B (v0.11.2 + public-API encoder
rewrite, which unlocks the big 0.10 lossless-speed and 0.11 progressive-size wins)
as a separate, isolated project. Secondary risks: submodule/`third_party` path
drift breaking the skcms hand-compile and the brotli/highway/skcms static-lib link
list (Makefile lines 53–80); Highway version bumps may reintroduce
`-Wdeprecated-declarations` warnings (already suppressed, line 33).

---

## oxipng (`codecs/oxipng`) — ✅ done (9.0.0 → 10.1.1)

- **Current pin:** 9.0.0
  (`oxipng = { version = "9.0", default-features = false, features = ["freestanding"] }`).
- **Target:** 10.1.1 (latest 10.x; tag + crate confirmed). MSRV rises to 1.85.1,
  edition 2024.

**Build-file change.** In `codecs/oxipng/Cargo.toml` line 15:

```toml
oxipng = { version = "10.1", default-features = false, features = ["freestanding"] }
```

(was `"9.0"`). **Verify the `"freestanding"` feature still exists at 10.1.1** (it
was the no-std/wasm feature; if renamed, adjust — `@jsquash/oxipng` 2.3.0 already
ships oxipng 10.x, so copy its Cargo.toml feature set if unclear). Let
`wasm-pack build` regenerate `Cargo.lock`, and bump the `wasm-bindgen` line (17)
only if 10.x's transitive bound forces it. The `rust-toolchain` file says
`nightly` — keep nightly (the parallel build uses `-Z build-std`), but ensure it
is **≥ 1.85.1** to satisfy oxipng 10's MSRV.

**Wrapper API changes — SMALL, ONE LINE + one import.** In
`codecs/oxipng/src/lib.rs` the wrapper currently sets
`options.interlace = Some(if interlace { Interlacing::Adam7 } else { Interlacing::None })`.
Verified via the GitHub API that the field **type changed**: v9.0.0 had
`pub interlace: Option<Interlacing>` (enum) whereas v10.1.1 has
`pub interlace: Option<bool>`. So the wrapper MUST become:

```rust
options.interlace = Some(interlace);
```

and the `use oxipng::{… Interlacing}` import (line 4) must **drop `Interlacing`**
(it no longer exists / is unused). The other v10 API breaks the audit lists
(`filter`→`filters` as `IndexSet<FilterStrategy>`, `deflate`→`deflater` as
`Deflater`) do **not** appear in this wrapper, so no edits there.
`Options::from_preset(level)`, `options.optimize_alpha = true`,
`RawImage::new(w,h,ColorType::RGBA,BitDepth::Eight,data)`, and
`raw.create_optimized_png(&options)` ALL still exist at v10.1.1
(`create_optimized_png` verified at `src/lib.rs:139`). `ColorType::RGBA` and
`BitDepth::Eight` are stable. So the **entire required wrapper diff** is: remove
`Interlacing` from the import, and replace the three-line interlace assignment
with the one-line bool form.

**Build:**

```sh
# Rust nightly (>=1.85.1) + wasm-pack 0.12.1, via codecs/rust.Dockerfile
# (or local emsdk-less wasm-pack).
cd /Users/tav/Development/Tavlean/Frisp/codecs/oxipng
rm -rf pkg pkg-parallel target
./build.sh
#   wasm-pack build -t web
#   then RUSTFLAGS='-C target-feature=+atomics,+bulk-memory' \
#        wasm-pack build -t web -d pkg-parallel . -- \
#          -Z build-std=panic_abort,std --features=parallel
# Regenerates pkg/ (single-thread) and pkg-parallel/ (rayon/threaded).
```

**Verify:**

1. Cargo resolves oxipng 10.1.x and compiles for `wasm32-unknown-unknown` with
   the (now `bool`) interlace field — a clean build proves the wrapper edit.
2. Confirm regenerated `pkg/` and `pkg-parallel/` artifacts
   (`squoosh_oxipng_bg.wasm` + JS glue in both).
3. `npm run check` — OxiPNG loads `pkg` (ST) or `pkg-parallel` (`_mt`) by thread
   detection; both are `?url`-referenced. Confirm both variants resolve.
4. Functional: optimize PNGs at the levels Frisp exposes, with interlace toggled
   both ways; compare size/correctness to pre-upgrade. v10.1.1's Bigrams change
   should be notably faster at low presets, with a fast-mode correctness fix for
   small indexed images.
5. Regression: optimize a small indexed (palette) PNG and an ICC-profile image
   (v10 improves ICC recompression); confirm round-trip correctness.

**Risks:** Medium, but lower than the audit implies for THIS wrapper. Real risks:
(1) the `"freestanding"` feature name must still exist at 10.1.1 (verify against
`@jsquash/oxipng`'s Cargo.toml). (2) MSRV 1.85.1 + edition 2024 — the nightly in
`rust-toolchain` must be new enough; the parallel `-Z build-std` needs a matching
`rust-src` component. (3) `wasm-bindgen-rayon` (Cargo.toml line 18) pin
compatibility with the new wasm-bindgen. The interlace edit itself is trivial and
`create_optimized_png` is unchanged, so wrapper risk is small; the
toolchain/feature-flag plumbing is where time goes. **jSquash 2.3.0 is a
proven-buildable reference.**

---

## mozjpeg (`codecs/mozjpeg`) — ✅ done (v3.3.1 → v4.1.5)

- **Current pin:** v3.3.1 (2018), built with autotools.
- **Target:** v4.1.5 (Oct 2023; tag confirmed). **CMake-only** (`configure.ac`
  removed). **Compression is UNCHANGED vs 3.3.1** — the value is purely the
  rebased libjpeg-turbo 2.x base (9 CVEs). This is a security/robustness rebuild
  only, correctly "gradual" behind the four CVE-urgent codecs.

**Build-file change — the heavy one:** the build system must move from autotools
to CMake. In `codecs/mozjpeg/Makefile`:

1. Line 1: `CODEC_URL := https://github.com/mozilla/mozjpeg/archive/v4.1.5.tar.gz`.
2. **REPLACE** the autotools configure rule (lines 39–57:
   `./configure --disable-shared --without-turbojpeg --without-simd
   --without-arith-enc --without-arith-dec --with-build-date`) with an `emcmake`
   CMake configure. Verified v4.1.5 CMake options that mirror the old flags:
   `-DENABLE_SHARED=0 -DENABLE_STATIC=1 -DWITH_TURBOJPEG=0 -DWITH_SIMD=0
   -DWITH_ARITH_ENC=0 -DWITH_ARITH_DEC=0 -DPNG_SUPPORTED=0` plus
   `-DCMAKE_BUILD_TYPE=Release`. The source marker becomes
   `$(CODEC_DIR)/CMakeLists.txt` (replaces `configure.ac`). Example build-dir
   target:

   ```make
   emcmake cmake -DENABLE_SHARED=0 -DENABLE_STATIC=1 -DWITH_TURBOJPEG=0 \
       -DWITH_SIMD=0 -DWITH_ARITH_ENC=0 -DWITH_ARITH_DEC=0 -DPNG_SUPPORTED=0 \
       -DCMAKE_BUILD_TYPE=Release -B <builddir> $(CODEC_DIR) \
     && emmake make -C <builddir> jpeg-static
   ```

3. **FIX THE OUTPUT TARGETS** (lines 3–4, 33–37): autotools produced
   `.libs/libjpeg.a` + `rdswitch.o`. Under CMake the static lib is `libjpeg.a` in
   the build dir (target `jpeg-static`), and `rdswitch.o` (a CLI helper object the
   wrapper links for scan-script / quant-slot parsing) is no longer emitted as a
   standalone object. Either (a) compile `rdswitch.c` yourself with emcc into
   `rdswitch.o` and keep linking it, or (b) confirm whether the wrapper still
   needs it (see wrapper notes). Drop the `--with-build-date=squoosh`
   reproducibility flag (CMake has its own; or set `-DWITH_BUILD_DATE` if
   exposed).

**Wrapper API changes.** `codecs/mozjpeg/enc/mozjpeg_enc.cpp` uses the **stable
public libjpeg API** (`jpeg_compress_struct`, `jpeg_create_compress`,
`jpeg_set_defaults`, `jpeg_set_colorspace`, `jpeg_c_set_int_param` with
`JINT_BASE_QUANT_TBL_IDX`, `jpeg_c_set_bool_param` with
`JBOOLEAN_USE_SCANS_IN_TRELLIS`, `cinfo.arith_code`, `cinfo.smoothing_factor`)
plus `#include "cdjpeg.h"`. All of these persist in v4.1.5 — **no core API
edits.** THE ONE ISSUE: `cdjpeg.h` and `rdswitch.o` are CLI-helper artifacts; the
wrapper links `rdswitch.o` for `read_scan_script` / quant-table-slot helpers used
by trellis multi-scan. Under CMake-only v4 these helpers are compiled into the
`cjpeg` executable, not a freestanding object/lib. **ACTION:** grep the wrapper +
`cdjpeg.h` usage to find which symbols it actually pulls from rdswitch; if it only
needs `read_scan_script` / `set_quant_slots`, compile `rdswitch.c` + `cdjpeg.c`
manually with emcc into objects and add them to the link line (the Makefile
`$(CXX) … $+` rule). **The wrapper `.cpp` body itself should not need edits.**

**Build:**

```sh
# emsdk 2.0.34 via codecs/cpp.Dockerfile. v4 needs cmake (bundled in emsdk).
cd /Users/tav/Development/Tavlean/Frisp/codecs/mozjpeg
rm -rf node_modules
../build-cpp.sh   # AFTER the Makefile is converted to emcmake
# Regenerates enc/mozjpeg_enc.js+.wasm, enc/mozjpeg_node_enc.js+.wasm,
# dec/mozjpeg_node_dec.js+.wasm.
# References for the autotools->CMake WASM migration: jSquash's mozjpeg
# build and the mozjpeg-wasm project.
```

**Verify:**

1. Defer to its own focused session (do **not** batch with the security
   rebuilds) — the build-system rewrite is the cost, not the code.
2. CMake configure + `jpeg-static` build produces `libjpeg.a`; the wrapper links
   cleanly (resolve rdswitch/cdjpeg symbols first).
3. Confirm regenerated `enc/mozjpeg_enc.wasm` + `.js` in `git status`.
4. `npm run check`.
5. Functional: encode JPEGs across quality, with trellis / `optimize_coding` /
   quant-table options toggled; output should be **byte-similar** to v3.3.1
   (compression is intentionally UNCHANGED) — a large size delta signals a wiring
   bug (e.g. missing rdswitch scan script), not an improvement.
6. Security regression: optionally run a malformed-JPEG decode through the node
   decoder to confirm no crash (libjpeg-turbo 2.x CVEs: CVE-2020-13790,
   CVE-2021-20205, …).

**Risks:** Medium; **effort-bound not API-bound.** The blocker is the
autotools→CMake Makefile rewrite and the `rdswitch.o`/`cdjpeg.h` helper
relinking, not the wrapper logic (stable public-API). Reproducible-build
determinism (the old `--with-build-date` trick) may need re-solving under CMake.
Budget 0.5–1 day. Honest framing: **zero compression gain** — security/robustness
only.

---

## resize (`codecs/resize` Rust crate) — ✅ done (0.5.5 → 0.8.9)

- **Current pin:** `resize` 0.5.5, `wasm-bindgen` 0.2.38, `wee_alloc`, 2015-style
  edition.
- **Target:** 0.8.9 (latest; crate confirmed). Now edition 2024, rust-version
  1.85, and **default features include `rayon` (must be disabled for WASM)**.

> Neither Squoosh nor jSquash upgraded this crate (both pin 0.5.5) — you will be
> **ahead of both upstreams**, so verify carefully with no reference build to
> copy.

**Build-file change.** In `codecs/resize/Cargo.toml`:

1. Line 17:
   `resize = { version = "0.8.9", default-features = false, features = ["std"] }`
   (was `resize = "0.5.5"`). **`default-features = false` is MANDATORY** — 0.8.9's
   defaults are `["std", "rayon"]` and rayon CANNOT compile to
   `wasm32-unknown-unknown`. Enabling only `"std"` gives the single-threaded path.
2. Add the `rgb` crate as a direct dependency:
   `rgb = { version = "0.8.52", default-features = false }` — needed to
   reinterpret `&[u8]` as `&[Rgba<u8>]` (see wrapper).
3. Lines 12 + 30: drop `wee_alloc` from default features and remove the
   `wee_alloc` dependency (abandoned; the `cfg_if` wee_alloc block in `lib.rs`
   goes too). New: `default = ["console_error_panic_hook"]`.
4. Line 16: bump `wasm-bindgen` from 0.2.38 to a current 0.2.x compatible with the
   toolchain (e.g. 0.2.9x).

Regenerate `Cargo.lock` via the build.

**Wrapper API changes — MODERATE rewrite of `codecs/resize/src/lib.rs`**, verified
against resize 0.8.9 source via the GitHub API:

- **Pixel format rename:** `resize::Pixel::RGBA` → `resize::Pixel::RGBA8`;
  `resize::Pixel::RGBAF32` stays (both confirmed as consts in `pub mod Pixel`).
  Import becomes `use resize::Pixel::{RGBA8, RGBAF32};`.
- **Pixel TYPING:** in 0.8.x the resizer is generic over pixel structs, not raw
  bytes. `resize::new(...)` and `.resize(src, dst)` take typed slices: for RGBA8
  that is `&[rgb::Rgba<u8>]` / `&mut [rgb::Rgba<u8>]`; for RGBAF32 it is
  `&[rgb::Rgba<f32>]`. The wrapper's `output_image: Vec<u8>` and
  `preprocessed_input_image: Vec<f32>` must be reinterpreted via the `rgb` crate's
  bytemuck-backed casts, e.g. `input_image.as_rgba()` / `output_image.as_rgba_mut()`
  (u8) and the f32 equivalents, OR build `Vec<Rgba<u8>>` / `Vec<Rgba<f32>>`
  directly. (README confirms: "use `.as_rgb()`/`.as_rgb_mut()` to reinterpret
  `Vec<u8>` as a slice of pixels" — the RGBA analogue applies.)
- **Result handling:** `resize::new(...)` now returns `Result<Resizer>` (verified
  `src/lib.rs:459`) and `.resize(src, dst)` returns `Result<()>` (verified
  `src/lib.rs:603`). The wrapper must handle these — `.unwrap()` (matches the
  existing panic-on-bad-input style) or propagate. Both call sites change (the
  fast path lines 86–94 and the f32 path lines 117–128).
- **Type filters:** `Type::Triangle`, `Type::Catrom`, `Type::Mitchell`,
  `Type::Lanczos3` ALL still exist (verified) — the existing `typ_idx 0..3` match
  arms are unchanged. (Box/Hermite/Lagrange are NOT in the `Type` enum at 0.8.9 —
  only via `Filter::new_box`/`new_hermite`/`new_lagrange`. The enum gained
  `BSpline` and `Gaussian`. You COULD surface BSpline/Gaussian as new
  `typ_idx 4/5`, but that is additive, not required.)
- Remove the `wee_alloc` `cfg_if` block (`lib.rs` lines 16–24).

**Build:**

```sh
# Rust (>=1.85, edition 2024) + wasm-pack, via codecs/rust.Dockerfile.
# NOTE the repo's rust.Dockerfile default is rust:1.47 (ARG RUST_IMG) which is
# FAR too old for resize 0.8.9 (needs 1.85). Pass a newer RUST_IMG.
cd /Users/tav/Development/Tavlean/Frisp/codecs/resize
rm -rf pkg target Cargo.lock
RUST_IMG=rust:1.85 ../build-rust.sh
#   builds squoosh-rust-1.85 image then
#   wasm-pack build --target web -- --verbose && rm pkg/.gitignore
# Regenerates pkg/ (squoosh_resize_bg.wasm + JS glue).
```

**Verify:**

1. Defer to its own session.
2. Cargo resolves resize 0.8.9 with `default-features = false` + `std` (and **NO
   rayon** in the tree — confirm `cargo tree` shows no rayon, else the wasm build
   fails or bloats).
3. Wrapper compiles for `wasm32-unknown-unknown` with the typed-pixel + Result
   API; a clean build validates the rgb-crate casts and unwrap handling.
4. Confirm regenerated `pkg/squoosh_resize_bg.wasm` + JS in `git status`.
5. `npm run check`.
6. **Functional (CRITICAL for correctness):** resize with each filter
   (Triangle/Catrom/Mitchell/Lanczos3), AND exercise both the fast path
   (premultiply=false, color_space_conversion=false → RGBA8) and the f32 path
   (premultiply and/or sRGB conversion → RGBAF32). Compare pixel output to the
   pre-upgrade build — the premultiply/sRGB math is hand-rolled and the RGBA8 vs
   RGBAF32 routing must stay correct. Verify alpha edges (premultiplied path) look
   identical.
7. Spot-check that output dimensions and the `Clamped<Vec<u8>>` return shape are
   unchanged so the JS/worker side needs no edits.

**Risks:** Medium, ~half a day. Biggest gotchas: (1) forgetting
`default-features = false` leaves rayon in the tree and breaks/bloats the wasm
build (the #1 trap). (2) the repo's `rust.Dockerfile` default (rust:1.47) is
incompatible with MSRV 1.85 / edition 2024 — you MUST supply a newer `RUST_IMG`.
(3) the typed-pixel API (`Rgba<u8>`/`Rgba<f32>` via the `rgb` crate) is the
substantive code change; getting the `as_rgba`/`as_rgba_mut` casts and the f32
path right is where correctness bugs hide. (4) the `wasm-bindgen` 0.2.38 → current
bump may ripple into the JS glue. Upside if done right: OOM-safe Result API,
no_std-friendly, single-thread perf gains (dropped transpose pass), and optional
new BSpline/Gaussian filters.

---

## Related

- [codec-upgrade-audit.md](codec-upgrade-audit.md) — the audit these runbooks
  execute (the "why now / later" framing and CVE evidence).
- [codec-provenance.md](codec-provenance.md) — codec origins + safety rules; read
  before touching `codecs/`.
- [codec-source-references.md](codec-source-references.md) — codec upstream pins.
- [new-codec-investigation.md](new-codec-investigation.md) — *new* codec/processor
  candidates (a separate, not-yet-decided track).
- [threading-enablement.md](threading-enablement.md) — the `_mt` variants these
  rebuilds keep producing only run multi-core once COOP/COEP is on.
