# Codec build notes — engineering log

Last updated: 2026-11-04.

> **STATUS: all codecs rebuilt natively (no Docker) and committed on branch
> `codec-rebuilds`.** imagequant 2.18.0, libwebp v1.6.0, libavif v1.4.2 +
> libaom v3.12.1, libjxl **v0.12.0** (was v0.8.5; bumped 2026-08-08 with the
> encoder wrapper rewritten onto libjxl's public C API), oxipng 10.1.1,
> mozjpeg v4.1.5, resize 0.8.9. All verified by the e2e suite + benchmark. The
> per-codec sections below are the engineering record of how each was built.

Deep technical record of **building the WASM codecs from source** — what works,
what breaks, and why. Distinct from the other codec docs:

- [the codec upgrade audit](project/reports/2026-06-02-codec-upgrade-audit.md) — *what* to upgrade and *why*.
- [codec-upgrade-runbooks.md](codec-upgrade-runbooks.md) — per-codec version
  targets + wrapper diffs.
- [codec-upgrade-runbooks.md](codec-upgrade-runbooks.md) — the operational
  build+verify+commit loop.
- **this doc** — the *build engineering knowledge*: toolchains, linker
  behaviour, the gotchas that cost hours, so the next codec update doesn't
  repeat them.

## TL;DR — the toolchain decision

The codecs were originally built (via `codecs/build-cpp.sh` → Docker) with
**Emscripten `emsdk:2.0.34`** (Oct 2021). You do **not** need Docker — install
Emscripten directly (no sudo).

**Toolchain version is mostly _not_ the thing that breaks a build.** We spent
hours blaming "emcc 5.x's linker strips the inner library" — that theory was
**wrong** (see the AVIF saga below; the real cause was a cmake option in the
*new library version*). Both emcc 3.1.0 and 5.x behaved identically. The linker
behaved correctly the whole time.

| Codec kind | Examples | Toolchain | Notes |
|---|---|---|---|
| Simple: single library, **direct** calls | libimagequant, libwebp | **emcc 5.x (latest)** | Clean; clang-16 is just stricter (`-Wno-error=…`, `-msimd128` for SIMD). |
| Complex: **multi-library** (libavif→libaom) | libavif+libaom, (likely) libjxl | **emcc 3.1.0** (arm64-native) — proven | 5.x probably also works now; 3.1.0 is what we verified. Era-matched to 2.0.34, arm64-native so no Rosetta. |

**Rule of thumb when a `.wasm` comes out _tiny_** (e.g. AVIF encoder 21 KB vs
2.8 MB): a whole library got dropped — but **don't assume it's the linker/DCE.**
First check **why nothing references it**: inspect the inner archive
(`emar t libavif.a | grep codec_aom`, `emnm libavif.a | grep aom_codec`). If the
glue object is *missing*, the library's **own build config** excluded it (our
AVIF bug) — the linker dropping an unreferenced archive is then *correct*. Only
if the glue is present and still dropped should you suspect the toolchain.

## Native build setup (no Docker, no sudo)

```sh
git clone --depth 1 https://github.com/emscripten-core/emsdk.git ~/emsdk
cd ~/emsdk
./emsdk install latest && ./emsdk activate latest    # emcc 5.x — simple codecs
./emsdk install 3.1.0                                 # arm64-native — complex codecs
brew install cmake                                    # avif/webp/jxl need it
```

Switch toolchains per codec with `./emsdk activate <ver> && source ~/emsdk/emsdk_env.sh`.

Per C/C++ codec, replicate `codecs/cpp.Dockerfile`'s env and run the Makefile
directly (bypassing the Docker wrapper):

```sh
source ~/emsdk/emsdk_env.sh
cd codecs/<codec>
rm -rf node_modules                 # force a fresh source download of the new version
export CFLAGS="-O3 -flto"
export CXXFLAGS="-O3 -flto -std=c++17"
export LDFLAGS="-O3 -flto -s FILESYSTEM=0 -s ALLOW_MEMORY_GROWTH=1 -s TEXTDECODER=2 -s NODEJS_CATCH_EXIT=0 -s NODEJS_CATCH_REJECTION=0"
emmake make                         # writes the new .js/.wasm into the codec dir
```

> On emcc 5.x, clang is v16+ and treats more warnings as errors; add
> `-Wno-error=implicit-function-declaration` (and for x86-SIMD code,
> `-msimd128`). On emcc 3.1.0 (clang 14) these are usually unnecessary — another
> reason the older toolchain is smoother for the legacy codec sources.

## Build-integration gotcha (all codecs) — the sync-script patch

`scripts/patch-codec-wrappers.mjs` rewrites each codec's `.js` to replace
Emscripten's `new URL("x.wasm", import.meta.url)` with a bare string (so Vite
doesn't emit a duplicate WASM). The suffix differs by toolchain
(`.toString()` on 2.0.x, `.href` on 5.x). **Fixed 2026-06-02** to be
toolchain-agnostic (regex matches both). Without this, a modern-emcc rebuild
fails `npm run check` with "Expected … wrapper fallback URL pattern".

## Per-codec build findings

### libimagequant — ✅ done (emcc 5.0.7)
2.12.1 → 2.18.0. Clean: simple C library, `./configure && make`. One harmless
`warn_unused_result` warning. No wrapper edits. Built fine on emcc 5.x.

### libwebp — ✅ done (emcc 5.0.7)
commit (pre-1.2.0) → v1.6.0 (CVE-2023-4863). Two real gotchas:
1. **libsharpyuv split** — since libwebp v1.3.0 `libsharpyuv` is a separate
   archive; the Makefile now links `libsharpyuv.a` **after** `libwebp.a` (it's a
   byproduct of the same cmake build).
2. **SIMD silently lost** — the `simd` variant needs **`-msimd128`** so emcc
   translates libwebp's SSE intrinsics to WASM SIMD. Without it the "simd" build
   compiles to the *non-SIMD baseline* (caught because `webp_enc_simd.wasm` came
   out the same size as `webp_enc.wasm`). Plus `-Wno-error=implicit-function-declaration`.

Output was byte-identical to the old build at default quality → pure security
upgrade, zero regression (benchmark-verified).

### libavif + libaom — ✅ DONE (emcc 3.1.0). Root cause was a cmake option, not the linker.
libavif **v1.0.1 → v1.4.2**, libaom **v3.7.0 → v3.12.1** (CVE-2024-5171, CVSS
9.8; aom must be ≥ v3.9.1). Built 2026-06-02 with **emsdk 3.1.0** (arm64-native).
**Result: zero size regression, 6–13 % _faster_ encode** (benchmark-verified, big
images gain most). Both the single-thread (`avif_enc` 2.79 MB) and threaded
(`avif_enc_mt` 2.85 MB) encoders + decoder (`avif_dec` 1.25 MB) rebuilt.

**Threaded (pthread) builds need a PRE-SPAWNED POOL — `PTHREAD_POOL_SIZE`
(2026-06-03).** When MT threading was actually wired + exercised for the first
time (it had always been disabled), AVIF *and* JXL `_mt`/`_mt_simd` **deadlocked**:
the encode loads + the threaded wasm runs, then hangs forever. Root cause: the
`_mt` Makefiles compile with `-pthread` but set **no `PTHREAD_POOL_SIZE`**, so
Emscripten creates pthreads **on-demand** during the encode via `getNewWorker` →
`allocateUnusedWorker` + `loadWasmModuleToWorker`. But the encode runs
**synchronously inside the codec worker and blocks on `Atomics.wait`** (waiting
for the pool) — so the blocked worker can never process the freshly-spawned
worker's `loaded` message → the new pthread never becomes ready → deadlock. (It
was latent for years because the threaded builds were never run.) **The fix:** add
`-sPTHREAD_POOL_SIZE=navigator.hardwareConcurrency` to the MT link (`OUT_FLAGS` in
`codecs/avif/Makefile`; the `enc/jxl_enc_mt.js enc/jxl_enc_mt_simd.js: CXXFLAGS+=`
line in `codecs/jxl/Makefile`) so the pool is spawned + loaded at init, *before*
the blocking encode — then `getNewWorker` returns a ready worker, no on-demand
spawn, no deadlock. This is a **link/JS-glue flag** only (no libaom/libjxl
rebuild): relink the `_mt` wrappers against the cached `.a`s. **Watch-out:** the
naïve relink must keep the original env flags (`CXXFLAGS="-O3 -flto -std=c++17"`,
`LDFLAGS="… -s ALLOW_MEMORY_GROWTH=1 …"`) — dropping them produces a fixed 16 MB
memory (`max=256` pages, OOMs real images) + an unoptimised 5× glue. With the
flags kept, the rebuilt `_mt` wasm is **byte-size-identical** to the old one plus
the pool. Verified: AVIF + JXL spawn the full worker pool (11 on an 11-core M-series)
and encode without falling back, in Chromium + WebKit. See
[threading-enablement.md](threading-enablement.md).

**THE ROOT CAUSE (the whole saga in one line):** libavif **v1.4 changed
`AVIF_CODEC_AOM` from a boolean to a string enum** (`OFF` / `SYSTEM` / `LOCAL`).
The old recipe passed `-DAVIF_CODEC_AOM=1`. To the new cmake, `1` is **not a
valid codec source**, so it silently built libavif **without the AOM codec** —
`libavif.a` contained **no `codec_aom.c.o`**, so nothing in the link referenced
libaom, so wasm-ld **correctly** dropped the unreferenced `libaom.a` → a 21 KB
encoder with no AV1 support.

**THE FIX** (three lines in `helper.Makefile`, all on the libavif cmake):
```
-DAVIF_CODEC_AOM=SYSTEM          # was =1. Use the libaom WE build (AOM_LIBRARY/AOM_INCLUDE_DIR).
-DAVIF_LIBYUV=OFF                # libavif v1.4 newly *requires* libyuv unless disabled.
-DAOM_LIBRARY=$(LIBAOM_OUT) -DAOM_INCLUDE_DIR=$(LIBAOM_DIR)   # point SYSTEM at our archive.
```
Plus, in `Makefile`, bump the sharpyuv source to libwebp **v1.6.0** (matches
libavif v1.4.2's own `ext/libsharpyuv.cmd`). With `=SYSTEM`, cmake compiles
`codec_aom.c` into `libavif.a` (`U aom_codec_encode`); that undefined ref pulls
`libaom.a` into the link → 2.79 MB. **Verify the fix landed before linking:**
`emar t …/libavif.a | grep codec_aom` must print `codec_aom.c.o`.

**Then one honest link warning remains — `undefined symbol: setjmp`.** libaom's
objects emit a *raw* `setjmp` (not Emscripten's lowered form), so it can't be
satisfied at link time — it must be a **runtime import** Emscripten provides.
The original 2.0.34 recipe already handled this with **`-s ERROR_ON_UNDEFINED_SYMBOLS=0`**,
which we kept. (Tried `-s SUPPORT_LONGJMP=1` instead — does **not** help, because
the raw `setjmp` never goes through Emscripten's setjmp lowering.) This flag is
**safe here**: now that `=SYSTEM` makes libaom genuinely link, the *only* symbol
it leaves undefined is that intentional setjmp import — it is **not** masking a
missing library. (It was dangerous *before* the real fix precisely because it
hid the missing-libaom link error.)

**Dead ends — do NOT retry these (all failed):** `-Wl,--start-group`; *removing*
`ERROR_ON_UNDEFINED_SYMBOLS=0`; separate-compiling `avif_enc.cpp` first;
swapping emsdk 3.1.0 ↔ 5.0.7 (both behaved identically — toolchain was never the
cause); `-Wl,--whole-archive -Wl,--no-gc-sections` to force-include libaom (→
2.57 MB binary that **traps at runtime** — of course: forcing in a libaom that
`codec_aom.c` never wired up leaves the codec registry uninitialised). Every one
of these was treating the symptom. The lesson: **when a sub-library vanishes,
first prove _whether it's referenced at all_ (inspect the glue object in the
inner archive) before blaming the linker.**

> Threaded `avif_enc_mt`: built fine on 3.1.0 (`-pthread` sets atomics/bulk-memory
> automatically). The "`--shared-memory` disallowed … not compiled with
> 'atomics'/'bulk-memory'" error was **emcc-5.x-only**. The app dynamically
> imports `avif_enc_mt` and instantiates it when `supportsThreads()` is true —
> which is now the case: threading landed 2026-06-03 (merged to `main`), so the MT
> path IS exercised at runtime, and the artifact is correct and on the secure
> libaom.

### libjxl (✅ DONE, emcc 3.1.0, now v0.12.0 on the public C API)

**v0.8.5 → v0.12.0, 2026-08-08 (Path B).** The encoder wrapper was rewritten from
libjxl's internal C++ API onto the public `JxlEncoder*` C API, which is what
v0.9.0 forced when it deleted `enc_file.h` / `enc_color_management.h`. Both the
build and the wrapper needed real work; the gotchas below are on top of the six
0.8.5-era ones that follow, which all still apply.

**A second entrypoint landed on 2026-08-11**: `transcodeJPEG`, the lossless
JPEG-to-JXL repack via `JxlEncoderAddJPEGFrame`. Same libjxl version, no build
changes, `+38868` bytes on the encoder wasm (2485851 → 2524719) for libjxl's
JPEG parser and reconstruction encoder. Its gotchas are 20–26 below.

**Artifact size is the accepted cost of v0.12.** The encoder grew from 1402981 to
2485851 bytes (+77%), the decoder from 858216 to 1030281 (+20%). Split: CODE
+665 KB, DATA +418 KB, the latter entirely libjxl's own static tables. Every
reduction was measured and rejected. Turning off `TRANSCODE_JPEG`, `BOXES`,
`TOOLS` and `SJPEG` changes nothing (+3319 bytes) because wasm-ld already
dead-strips code the encoder never calls. `JPEGXL_ENABLE_SKCMS=0` is 156 KB
*worse* (lcms2 is bigger). Disabling the `WASM_EMU256` highway target is 19 KB
worse, and it was never compiled anyway (highway gates it behind
`HWY_WANT_WASM2`, which nothing defines). A `wasm-opt -Oz` post-pass saves 7 KB,
because emcc already ran wasm-opt. Colour management costs 171 KB and cannot be
dropped: `JxlEncoderCreate` calls `JxlGetDefaultCms()` unconditionally, and that
one symbol is the *only* thing `libjxl.a` needs from `libjxl_cms.a`. The single
real lever is compiling libjxl at `-Os`, worth 392 KB (−15.8%) with
byte-identical encoder output, at roughly 20% slower encode; **we keep `-O3`**
and accept the size. Do not re-litigate this without new measurements.

7. **The static CMake targets were renamed.** `jxl-static` and
   `jxl_threads-static` are gone; the targets are now plain `jxl` and
   `jxl_threads` (with `BUILD_SHARED_LIBS=0` they produce the same archives).
   `make jxl-static` fails with "No rule to make target".
8. **Colour management split out into `libjxl_cms.a`, and it now owns skcms.**
   `JPEGXL_BUNDLE_SKCMS` no longer exists. `jxl_cms` compiles the skcms sources
   into itself, `libjxl.a` no longer contains them, and `libjxl.a` needs
   `libjxl_cms.a` on the link line. This **deletes** the 0.8.5-era problem
   (gotcha 5) and the Makefile's hand-rolled `emcc` + `llvm-ar` skcms compile:
   the decoder's direct `skcms_*` calls resolve out of `libjxl_cms.a`. Worth
   knowing if you ever do rebuild skcms by hand: 0.12's skcms is two
   translation units (`skcms.cc` plus `src/skcms_TransformBaseline.cc`), not
   the single self-contained file it was at 0.8.
9. **Brotli's archives lost their `-static` suffix**: `libbrotlidec.a`, not
   `libbrotlidec-static.a`. A stale path here fails at link, not at configure.
10. **`JxlEncoderSetFrameDistance` rejects distance > 25.** The v0.8.5 wrapper
    wrote `cparams.butteraugli_distance` directly and was unbounded, so its curve
    ran out to ~45.5 at quality 0. Fed to the public API that is not a clamp, it
    is an encode failure: `val::null()`, which the app shows as "no download".
    The v0.12.0 curve tops out at 15, so the limit is now unreachable by
    construction rather than clamped.
11. **v0.11 added a streaming encode mode and turns it on by default.** With
    `buffering = -1` (the default) libjxl streams any frame with more than 8
    groups, trading compression for peak memory. On
    `tests/fixtures/screenshot.png` (1280×800) at the default quality that costs
    **28702 bytes vs 14064** with streaming off. The wrapper sets
    `JXL_ENC_FRAME_SETTING_BUFFERING = 0` to keep the whole-image behaviour
    v0.8.5 had. Small fixtures (512×512, four groups) never trip it, so this is
    invisible until you benchmark something big.
12. **`JxlDecoderGetICCProfileSize` / `JxlDecoderGetColorAsICCProfile` lost their
    `JxlPixelFormat*` first argument** in v0.9. Two call sites in `dec/jxl_dec.cpp`.
    The decoder also carried `lib/jxl/color_encoding_internal.h`, the last
    internal header anywhere in `codecs/`; it still exists at v0.12.0, but it was
    never actually used, and dropping it produces byte-identical artifacts.
    **`codecs/jxl` now compiles against libjxl's public headers only**, which is
    what makes the next version bump a one-line change.
13. **v0.12 spends more bits for the same requested distance than v0.8.5 did.**
    This is not a wrapper bug and it is not a build flag. At `-d 2.35 -e 7` on
    `illustration.png`, v0.8.5 produced 4915 bytes / 41.88 dB PSNR and v0.12.0
    produces 6401 bytes / 43.11 dB. A **natively built v0.12.0 `cjxl`** on the
    identical pixels produces 6354 bytes, so the wasm wrapper is faithful. The
    fastest way to settle "is this my wrapper or is this libjxl" is exactly that:
    `cmake -B <dir> <libjxl src> && cmake --build <dir> --target cjxl`, dump the
    fixture to a binary PPM (cjxl reads PPM without libpng), and compare.
    The cause is accuracy, not efficiency: v0.12 hits the distance it is asked
    for, where v0.8.5 undershot. **This is why the quality→distance curve was
    redesigned rather than ported** (see `QualityToDistance` in
    `enc/jxl_enc.cpp`). Measured at equal SSIMULACRA2 rather than equal
    distance, v0.12 is a wash on photographs (+0.9% / −0.3% bytes on `photo`)
    and genuinely worse on synthetic content (+18 to +23% on `illustration`,
    +29% on `screenshot`), so the upstream "smaller files" headline does not
    hold for flat or text-heavy images.
14. **Iterate the wrapper with a hand-rolled single link, not `make`.** The
    library build is ~20 minutes; relinking one wrapper against the cached
    `build/mt/lib/*.a` is ~40 seconds. Same trick as the 2026-06 sweep, and the
    reason bisecting gotchas 11 and 13 was tractable at all.
15. **The `*_node_*` artifacts cannot be loaded by modern Node.** `EXPORT_ES6=1`
    plus `ENVIRONMENT=node` on emcc 3.1.0 emits ESM glue that calls `require()`
    and `__dirname`, so Node ≥ 20 throws `ERR_AMBIGUOUS_MODULE_SYNTAX`. It also
    reaches for global `fetch` to load the `.wasm`. Pre-existing, and nothing in
    the app imports them, but if you want a Node harness: convert to CommonJS
    (replace `import.meta.url` with `pathToFileURL(__filename).href`, swap the
    `export default` for `module.exports`), pass `wasmBinary` explicitly, and
    polyfill `ImageData` for the decoder.
16. **libjxl silently encodes at half resolution above a distance threshold, and
    v0.9 moved that threshold from 20 to 10.** `enc_frame.cc`: when
    `butteraugli_distance >= 10` and the frame was not already downsampled it
    sets `resampling = 2` and rescales the distance to `d * 0.25 + 0.25`. The
    output decodes back to full size, so nothing errors and no test notices; the
    image is just soft. Frisp's ported v0.8.5 curve crossed 10 at slider quality
    13, so **quality 0 to 13 shipped half-resolution images** until this was
    caught. The wrapper now pins `JXL_ENC_FRAME_SETTING_RESAMPLING = 1`. Pinning
    is better on both axes anyway: `screenshot.png` at distance 10 gives 11161
    bytes at SSIMULACRA2 8.56 when libjxl downsamples, against 6393 bytes at
    56.80 pinned. Downsampling only starts to pay off past distance 20 on
    photographic content, and never on screenshots.
17. **The v0.12 rate curve is not monotonic at low distance on flat content, and
    it has cliffs.** `illustration.png` at distance 0.5 is *larger* than at 1.0
    for 0.85 SSIMULACRA2, and the resampling switch in gotcha 16 is a
    discontinuity in both size and quality. Consequence for methodology:
    **do not bisect on output size** to find "the distance that matches N bytes",
    because it lands inside a cliff and silently reports a wildly wrong answer.
    Measure a dense distance ladder once per fixture and interpolate in
    log(size); that is also reusable for every later question.
18. **`ssimulacra2` and `butteraugli_main` need `-DJPEGXL_ENABLE_DEVTOOLS=1`.**
    They are not in the default target set, so a stock `cmake --build . --target
    ssimulacra2` fails with no such target. They read PPM, so a fixture dumped
    as binary P6 needs no image libraries. PSNR alone is not enough to judge a
    libjxl change: libjxl optimises butteraugli, and the two metrics disagree
    about which encoder wins.
19. **Node harness quirks, all three of which cost time.** (a) A `package.json`
    containing `{"type":"module"}` anywhere above the probe files makes `require()`
    of emscripten MODULARIZE glue fail with `ERR_AMBIGUOUS_MODULE_SYNTAX`; copy
    the glue to `.cjs`. (b) Pulling a 12 MP `getImageData` back from Chromium in
    one `page.evaluate` exhausts the Node heap; stash it in a page global and
    read it in slices. (c) Chromium is the right decoder for fixture pixels
    anyway, because it handles the JPEG fixtures and matches what `npm run bench`
    actually measures.

20. **The libjxl checkout is gitignored, so a fresh worktree has no build tree
    and the one in the main checkout may be any version.** `codecs/jxl/node_modules`
    holds both the source and the two build dirs, and neither is tracked. The
    v0.12.0 upgrade ran in a worktree that was later removed, which left the
    main checkout still on v0.8.5 while the Makefile said `v0.12.0`. The
    Makefile only re-fetches when `CMakeLists.txt` is absent, so a stale tree is
    silently reused. **Check `lib/CMakeLists.txt`'s `JPEGXL_*_VERSION` before
    trusting a checkout**, and `rm -rf node_modules` to force a clean fetch.
    Budget ~15 minutes for the fetch plus both library builds, then ~4 minutes
    to link all six wrappers.
21. **`JxlEncoderStoreJPEGMetadata` must be called before
    `JxlEncoderAddJPEGFrame`, not after.** `AddJPEGFrame` is where libjxl reads
    the flag and builds the reconstruction record (`encode.cc`, the
    `store_jpeg_metadata` branch). Set it afterwards and it is silently ignored:
    the output still decodes to the right pixels, so nothing errors and no test
    notices, but `djxl` can no longer rebuild the original `.jpg`. The only
    thing that catches it is an actual round-trip.
22. **The transcode needs container output, and it gets it for free.** The
    reconstruction record lives in a `jbrd` box, which exists only in the
    container format, but `MustUseContainer` (`encode_internal.h`) already
    returns true whenever `store_jpeg_metadata` is set. The wrapper calls
    `JxlEncoderUseContainer` anyway, as cjxl's JPEG-input path does, so the
    requirement is stated rather than inherited.
23. **Do NOT copy the pixel path's `BUFFERING` and `RESAMPLING` pins onto the
    transcode settings.** Both are dead there and one is misleading:
    `CanDoStreamingEncoding` (`enc_frame.cc`) returns false outright for
    `frame_data.IsJPEG()`, so gotcha 11's streaming default cannot fire on a
    JPEG frame whatever `BUFFERING` says, and resampling belongs to a pixel
    encode the path never runs. The transcode sets **no** frame options at all;
    the JPEG supplies the basic info, the colour encoding and the coefficients.
24. **Two cheap fidelity checks, both worth running on a transcode change.**
    (a) Homebrew's `cjxl` transcodes the same fixture natively:
    `tests/fixtures/photo.jpg` gives 74576 bytes on v0.11.2 against our wasm
    v0.12.0's 74604, a 0.04% gap that says the wrapper is faithful. Same
    technique as gotcha 13, and it costs seconds. (b) Relinking the *decoder*
    from a clean checkout reproduced the committed artifacts byte for byte,
    which is the fastest confirmation that a re-fetched tree really is the
    pinned version.
25. **The ~20% headline is a full-size-photo number.** On the 4000×3000
    `photo-large.jpg` the transcode saves 19.9% (661605 → 529848); on the
    1024×683 `photo.jpg` it saves 12.2% (84947 → 74604). Smaller images have
    proportionally more header and less entropy-coded data to win on, so a
    benchmark built only on the small fixture will look like a regression
    against the advertised figure when nothing is wrong.
26. **`djxl` dropped `--reconstruct_jpeg`.** Homebrew ships v0.11.2, where
    reconstruction is implied by a `.jpg` output extension: `djxl out.jxl
    back.jpg` prints "Reconstructed to JPEG." The old flag now fails with
    "Unknown argument".

**The 0.8.5-era record (still current for gotchas 1–6 and the embind bug).**
pre-0.7 commit → **v0.8.5** (CVE-2023-0645, CVE-2023-35790, CVE-2025-12474;
CVE-2026-1837 is LCMS2-only and we link skcms → N/A). **Result: 3–6 % smaller +
2–9 % faster** across all image types (benchmark-verified). Complex multi-library
C++ (brotli/highway/skcms + libpng/zlib/sjpeg/lcms submodules) using libjxl's
**internal** C++ API — Path A (v0.8.5) keeps that API; v0.9+ removed it (would
need a public-C-API rewrite). Six native-build gotchas, in the order you hit them:

1. **`nproc` is Linux-only.** The Makefile's submodule fetch used `--jobs \`nproc\``;
   on macOS → `sysctl -n hw.ncpu` fallback (committed in the Makefile).
2. **Submodules must be populated.** `git submodule update --init --recursive`
   pulls them; we fetch the ones cmake configure checks for — highway, brotli,
   skcms, **plus libpng, zlib, sjpeg, lcms, googletest** — and skip the large
   test-only `testdata` (fine with `-DBUILD_TESTING=0`). If make already created
   `node_modules/jxl/CMakeLists.txt` from a failed run it will **skip** the whole
   fetch target, so submodule dirs stay empty — populate them by hand or wipe
   `node_modules/jxl` to force a clean fetch.
3. **cmake 4.x vs brotli's 2019 CMakeLists.** `cmake_minimum_required < 3.5` is
   rejected → pass **`-DCMAKE_POLICY_VERSION_MINIMUM=3.5`** (via the Makefile's
   `$(CMAKE_FLAGS)` hook). cmake suggests this itself.
4. **`llvm-ar` not on PATH.** The Makefile's manual skcms compile calls `llvm-ar`;
   native emsdk doesn't PATH the LLVM bins → add `…/emsdk/upstream/bin` to PATH.
5. **skcms double-link (duplicate symbols).** v0.8.5 defaults
   `JPEGXL_BUNDLE_SKCMS=ON`, archiving `skcms-obj` **into** `libjxl.a`, which
   collides with the Makefile's standalone `libskcms.a` (the decoder uses skcms
   directly so it pulls both) → pass **`-DJPEGXL_BUNDLE_SKCMS=0`** so libjxl links
   skcms externally. The encoder linked anyway (it never referenced the standalone
   archive); only the decoder surfaced the duplicate.
6. **Wrapper port for the 0.7→0.8 internal API** (`enc/jxl_enc.cpp`):
   `CompressParams::quality_pair` was removed — v0.8 drives **both** VarDCT and
   modular from `butteraugli_distance` (quality 100 → distance 0 → lossless;
   modular lossless = kNone, lossy = kXYB). `ConvertFromExternal` now takes a
   `JxlPixelFormat` (4ch/UINT8/LE) instead of has_alpha/endianness/float_in.

**THE BUG THAT COST THE MOST (read this — it'll bite any embind codec on a newer
emcc):** the wrappers captured the JS constructors in **namespace-scope
`thread_local`s** — `thread_local const val Uint8Array = val::global("Uint8Array")`
(and `ImageData`/`Uint8ClampedArray` in the decoder). In a *large* module on emcc
3.1.0 those static-init handles are created **before the JS runtime is ready**,
producing an **invalid emval handle** that throws `TypeError: Cannot read
properties of undefined (reading 'value')` at `toValue` **only when the result is
marshalled**. So the encoder ran fine and produced a valid 56 KB JXL
(`EncodeFile ok=1`), but `Uint8Array.new_(...)` threw on the way out → the app saw
no output and the e2e "encodes JPEG XL" failed with "no download". **avif and webp
use the identical pattern and work** — their smaller static-init chains happen to
survive it, which is why it looked codec-specific. **Fix: resolve `val::global(...)`
at call time**, inside the function. Don't pre-cache JS globals in a `thread_local`
in a big module.
   - How it was found: `compressFile` (`src/lib/compress.ts`) decodes the encoded
     output for the preview *before* it creates the download URL, so an encoder
     OR decoder failure both show as "no download". `EM_ASM({console.warn(...)})`
     probes in the wrapper (visible via Playwright `worker.on('console')`, since
     the codec worker is the bundled `webp-*.js` worker) pinpointed the throw to
     the return marshalling. A fast manual relink (reusing the built `libjxl.a`,
     ~30 s vs a 20-min `make`) made the iterate-debug loop tractable —
     see `/tmp/jxl-fastlink.sh` pattern.

### mozjpeg — ✅ DONE (emcc 3.1.0). v3.3.1 autotools → v4.1.5 CMake.
9 CVEs (rebased onto libjpeg-turbo 2.x). **Compression is intentionally unchanged
vs v3.3.1** — security/robustness rebuild only; a large size delta would signal a
wiring bug, not an improvement. The whole effort is the build-system rewrite, not
the wrapper (which uses the stable public libjpeg API). Three gotchas:

1. **autotools → CMake.** v4 removed `configure.ac`. The Makefile now does
   `emcmake cmake -DENABLE_SHARED=0 -DENABLE_STATIC=1 -DWITH_TURBOJPEG=0
   -DWITH_SIMD=0 -DWITH_ARITH_ENC=0 -DWITH_ARITH_DEC=0 -DPNG_SUPPORTED=0` then
   `make jpeg-static` → `libjpeg.a`. `jconfig.h`/`jconfigint.h` are generated into
   the build dir at configure time → add `-I <build-dir>`.
2. **`check_type_size(size_t)` is broken on emsdk 3.1.0 + `-flto`.** It mis-detects
   `SIZEOF_SIZE_T` (9 without an emulator, 1 with `CMAKE_CROSSCOMPILING_EMULATOR=node`;
   correct is 4). Emscripten's `CheckTypeSize.cmake` greps an `INFO:size[N]`
   sentinel out of the compiled object, but `-flto` makes that object LLVM bitcode
   (sentinel unreadable). jchuff.c then `#error`s "Cannot determine word size".
   **Fix: pre-seed `-DSIZE_T=4 -DHAVE_SIZE_T=1` (+ `-DUNSIGNED_LONG=4
   -DHAVE_UNSIGNED_LONG=1`)** so CMake skips the broken probe. (Bug class fixed
   upstream in emscripten 3.1.28+; jSquash sidesteps it by using autotools
   `--host=wasm32`. Don't pass the node emulator — it makes it worse here.)
3. **`config.h` and `set_quality_ratings`/`rdswitch.o`.** The wrapper `#include
   "config.h"` only for `MOZJPEG_VERSION` (autotools-only header) → drop the
   include, pass `-DMOZJPEG_VERSION=4.1.5`. The wrapper also calls
   `set_quality_ratings()` — a *cjpeg helper* in `rdswitch.c`, not in `libjpeg.a`.
   v4's CMake only compiles it into the `cjpeg` exe, so compile `rdswitch.c`
   ourselves (`emcc -c rdswitch.c -o rdswitch.o`) and link it **before**
   `libjpeg.a`. Its unused file-I/O helpers resolve against emscripten libc stubs.

### jpegli (✅ DONE, emcc 3.1.0, google/jpegli `031a0077`, new codec 2026-08-09)

A new encode-only single-variant codec, `codecs/jpegli/`. It built first try, so
this section is short by comparison; what follows is the knowledge that would
have cost time to rediscover, not a war story.

1. **Do not build jpegli out of libjxl.** It lived in the libjxl tree until
   v0.12.0 deleted it. `github.com/google/jpegli` is the only source, it has no
   release tags, and the pin is therefore a commit SHA (in the Makefile header
   and `codec-provenance.md`), fetched the way `codecs/jxl` fetches libjxl.
2. **The API is `jpegli_*`, not `jpeg_*`.** jpegli ships a libjpeg62 ABI shim
   (`jpegli-libjpeg-obj` in `lib/jpegli.cmake`) that would restore the classic
   names, but that target is explicitly skipped on Emscripten, Apple and Windows.
   So the wrapper includes `lib/jpegli/encode.h` and calls `jpegli_set_defaults`,
   `jpegli_start_compress` and friends. The compress *sequence* is byte for byte
   libjpeg's, which is why `mozjpeg_enc.cpp` remains the template.
3. **Two include dirs, and the second is in the build tree.** `encode.h` includes
   its siblings by in-tree path (`"lib/jpegli/common.h"`), so the source root is
   an include dir; `jpeglib.h` / `jconfig.h` / `jmorecfg.h` are configured out of
   `third_party/libjpeg-turbo` into `<build>/lib/include/jpegli` at configure
   time, so that directory is the other one.
4. **`jpegli-static` is `EXCLUDE_FROM_ALL`.** A bare `make` builds the tools
   instead; name the target. Highway is a separate archive (`make hwy` →
   `<build>/third_party/highway/libhwy.a`) and both go on the link line.
5. **`JPEGLI_ENABLE_WASM_THREADS` defaults ON and puts `-pthread` on every
   translation unit** under Emscripten. This codec has one single-threaded
   variant, so it is off. Turning it on would need the pre-spawned
   `PTHREAD_POOL_SIZE` pool from the AVIF/JXL section or it would deadlock the
   same way.
6. **Quality is a distance, not a libjpeg quality.** `jpegli_set_quality` exists
   and works, but it scales the *standard* Annex K tables and throws away the
   tuned tables that are the entire reason to use jpegli. The wrapper goes
   through `jpegli_set_distance(jpegli_quality_to_distance(q))`, which is what
   `cjpegli -q` does.
7. **jpegli's library default is 4:2:0, but `cjpegli`'s default is 4:4:4.**
   `jpegli_set_colorspace` sets the luma sampling factors to 2×2 for YCbCr, and
   `lib/extras/enc/jpegli.cc` then overrides them to 1×1 when no subsampling was
   requested. Reading the tool and assuming it shows the library default gets
   this backwards. The wrapper's `chromaSubsample: 0` means "touch nothing",
   which is 4:2:0.
8. **`jpegli_set_defaults` leaves progression at level 0** (sequential), where
   `cjpegli`'s own default is level 2. `jpegli_simple_progression` is level 2, so
   the mozjpeg wrapper's progressive branch ports across unchanged and its
   `num_scans = 0` else-branch has nothing to undo.
9. **The `-flto` `check_type_size` pre-seed is not needed here.** jpegli
   configures `jconfig.h` from a `.in` with the sizes set in cmake rather than
   probing for them, so the mozjpeg `-DSIZE_T=4` workaround has no equivalent.

The artifact is 155151 bytes, smaller than mozjpeg's 276382 despite jpegli
carrying highway, because the build is encode-plus-decode-minus-tools and
wasm-ld strips everything the wrapper never reaches. That is expected here, not
the "a whole library got dropped" symptom from the AVIF saga: the jpegli error
strings (`Unsupported color transform`, `Invalid sampling factor`) are present in
the `.wasm`, which is the cheap way to prove the library actually linked.

### ssimulacra2

Done 2026-11-04 with emcc 3.1.0: cloudinary/ssimulacra2 `81feacf6`, Highway
1.0.2 (`f670ea58`), lcms2 `lcms2.16`. This is the SSIMULACRA 2.1 metric
behind auto-quality, not a codec: one export, `score(ref, dist, width,
height)` on RGBA8 bytes, and one single-threaded variant used everywhere. The
pins and licenses are in [codec-provenance.md](codec-provenance.md).

Build it with the toolchain from "Native build setup" above, using the emsdk
at `~/Development/emsdk`:

```sh
cd ~/Development/emsdk && ./emsdk activate 3.1.0 && source ./emsdk_env.sh
cd <repo>/codecs/ssimulacra2
export CFLAGS="-O3 -flto"
export CXXFLAGS="-O3 -flto -std=c++17"
export LDFLAGS="-O3 -flto -s FILESYSTEM=0 -s ALLOW_MEMORY_GROWTH=1 -s TEXTDECODER=2 -s NODEJS_CATCH_EXIT=0 -s NODEJS_CATCH_REJECTION=0"
emmake make
```

What would cost time to rediscover:

1. **No CMake.** Upstream's CMake wants a system Highway and lcms2 and builds
   image loaders the wrapper never calls. The Makefile compiles the metric,
   its vendored libjxl slice, two Highway files, and lcms2 (as its own C
   archive) directly.
2. **`include/jxl/jxl_export.h` is a hand-written stub.** libjxl's CMake
   generates that header (GenerateExportHeader). Everything here links into
   one static WASM module, so the export macros are empty.
3. **The source lists are globbed in the shell, not with `$(wildcard)`.**
   make expands a `$(wildcard)` when it reads the Makefile, before the fetch
   rules have populated `node_modules/`, so on a clean build the list comes
   back empty. The backtick `ls` runs at recipe time, after the fetch.
4. **lcms2, not skcms.** The slice's `enc_color_management.cc` has a skcms
   branch, but it needs a header the slice does not ship, so the build sets
   `-DJPEGXL_ENABLE_SKCMS=0`.
5. **Pass byte views, never strings.** `score` takes `std::string` in C++,
   and embind accepts a `Uint8Array` or `Uint8ClampedArray` for it. A JS
   string gets UTF-8 encoded, which changes its length, and the length check
   then returns -1000.

The Node build (`ssimulacra2_node.js`) is for checking scores outside the
browser. Two traps on Node 24:

- **Emscripten 3.1.0's Node glue tries the global `fetch` on a file path**,
  because Node now has a global `fetch` and the glue only checks that one
  exists. Read the `.wasm` yourself and pass it as `wasmBinary` to the
  factory.
- **The ES module build still calls `require` and reads `__dirname`.** Define
  both before importing it: `globalThis.require =
  createRequire(<codec dir>)` from `node:module`, and `globalThis.__dirname`
  set to the codec directory.

With both in place, identical inputs score 100 and a 4x4 input returns
-1000 (checked on Node 24.12.0).

### Rust codecs (oxipng ✅, resize ✅, hqx) — emsdk clang for the C deps
Need `rustup` + nightly (`-Z build-std` for the parallel/threaded variant) +
`rustup target add wasm32-unknown-unknown` + `rust-src` + `wasm-pack`. **Put
`~/.cargo/bin` FIRST on PATH** so the rustup shim wins over a Homebrew `cargo`
(which can't do `+nightly`/`-Z build-std`).

**oxipng 9.0.0 → 10.1.1 — done.** Byte-identical output at default preset (the
value is robustness + fast-mode/ICC fixes). Wrapper: `Options.interlace`
`Option<Interlacing>` → `Option<bool>`. Three build fixes:
- oxipng 10 pulls **libdeflate-sys (C)**; the `cc` crate's default Apple clang has
  no WebAssembly backend (`No available targets … wasm32`). Point it at emsdk's
  clang (which has it) + emscripten's libc headers — this is exactly what
  `codecs/rust.Dockerfile` does by COPYing emsdk's clang + libc:
  `CC_wasm32_unknown_unknown=<emsdk>/upstream/bin/clang`,
  `AR_wasm32_unknown_unknown=<emsdk>/upstream/bin/llvm-ar`,
  `CPATH=<emsdk>/upstream/emscripten/cache/sysroot/include`.
- **wasm-bindgen 0.2.73 is too old for nightly 1.98** ("update to v0.2.88"). Bump
  the dep to `"0.2"` *and DELETE `Cargo.lock`* — the lock pinned 0.2.74, which
  still satisfied `"0.2"`, so cargo kept it; a fresh resolve picks 0.2.122.
- **The sync script's wasm-bindgen wrapper patch broke** on the new glue:
  wasm-bindgen ≥0.2.9x renamed the loader var `input` → `module_or_path`. Fixed
  `patchWasmBindgenWrapperFallbackUrl` in `scripts/patch-codec-wrappers.mjs` to match
  the `new URL('<asset>', import.meta.url)` expression (variable-name-agnostic),
  same approach as the emscripten patch.

**oxipng threaded build (`pkg-parallel`, wasm-bindgen-rayon) — shared memory
(2026-06-03).** The `parallel` feature build must ship a **shared + imported**
`WebAssembly.Memory` (`flags=0x03`) so rayon's `startWorkers` can `postMessage`
it to the worker pool; a non-shared memory (`flags=0x0`) throws `DataCloneError:
#<Memory> could not be cloned` and silently falls back to single-thread. On the
**old** toolchains (jSquash's oxipng-parallel: wasm-bindgen-rayon 1.2.1 /
wasm-bindgen 0.2.92) bare `-C target-feature=+atomics,+bulk-memory` +
`-Z build-std` auto-emitted a shared+imported memory. On the **current nightly**
(1.98, 2026-06) that implicit behavior is **gone** — `+atomics` alone emits a
*non-shared* memory and you must pass the full linker set explicitly. The working
`pkg-parallel` `RUSTFLAGS` (see `codecs/oxipng/build.sh`):
`+atomics,+bulk-memory` + `--shared-memory` + `--max-memory=1073741824` (a shared
memory MUST declare a max) + `--import-memory` + the five exports
`--export=__wasm_init_tls,__tls_size,__tls_align,__tls_base,__heap_base`. The
exports are load-bearing for wasm-bindgen's threading pass — **dead-ends not to
retry:** `--shared-memory --max-memory` *without* the TLS exports → wasm-bindgen
errors `failed to prepare module for threading`; *without* `__heap_base` →
`failed to find __heap_base for injecting thread id`. `+mutable-globals` is no
longer needed. Keep `wasm-opt = ["-O", "--no-validation"]` (it preserves the
shared memory). Verified threading engages multi-core in Chromium + WebKit; the
full threading story is in [threading-enablement.md](threading-enablement.md).

**resize 0.5.5 → 0.8.9 — done. We're AHEAD of both upstreams (Squoosh + jSquash
pin 0.5.5), so there's no reference build — verify it directly.** Pure Rust (no C
dep, so no emsdk clang needed); reuses oxipng's toolchain notes (rustup nightly,
`~/.cargo/bin` first, bump wasm-bindgen + delete `Cargo.lock`). Wrapper rewrite:
`Pixel::RGBA` → `Pixel::RGBA8`; 0.8.x resizes **typed pixel slices**
(`rgb::RGBA<u8>`/`<f32>`) not raw `&[u8]`, so feed them via the `rgb` crate's
`FromSlice` (`.as_rgba()` / `.as_rgba_mut()`, add `rgb = "0.8.52"`); `resize::new`
and `.resize` now return `Result`. Disable defaults + `features=["std"]` (0.8.x
default-enables `rayon`, which can't target wasm32). The crate is **edition 2015**,
so a new dep needs `extern crate rgb;`, and an `extern crate` *inside a module*
(`utils.rs`) is referenced as `self::…` in a `use`. Dropped the abandoned
`wee_alloc` + `cfg-if`. Verified two ways: a UI-driven e2e (`tests/e2e/resize.spec.ts`
— resize to 256px, decode, check dimensions + non-garbage) **and** a direct
harness (`wasm-pack build -t nodejs` to a temp dir, then call `resize()` for both
the RGBA8 and the RGBAF32 premultiply/linear paths — solid colour preserved,
gradient interpolates monotonically). A processor has no encode-e2e coverage, so
that functional test is the only guard.

## Verification loop (every codec)

`npm run check` (integration) → `npm run test:e2e` (does it *encode*? — the
AVIF/quantize tests caught silent breakage) → `npm run bench` + `npm run
bench:compare` (improvement, not regression; size is exact, time is noisy).
**A build that "succeeds" can still produce a broken codec** — always run the
e2e + benchmark, never trust the build exit code alone.
