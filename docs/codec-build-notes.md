# Codec build notes — engineering log

Last updated: 2026-06-02.

> **STATUS: all codecs rebuilt natively (no Docker) and committed on branch
> `codec-rebuilds`.** imagequant 2.18.0, libwebp v1.6.0, libavif v1.4.2 +
> libaom v3.12.1, libjxl v0.8.5, oxipng 10.1.1, mozjpeg v4.1.5, resize 0.8.9 —
> all verified by the 17-test e2e suite + benchmark (no regressions). The
> per-codec sections below are the engineering record of how each was built.

Deep technical record of **building the WASM codecs from source** — what works,
what breaks, and why. Distinct from the other codec docs:

- [codec-upgrade-audit.md](codec-upgrade-audit.md) — *what* to upgrade and *why*.
- [codec-upgrade-runbooks.md](codec-upgrade-runbooks.md) — per-codec version
  targets + wrapper diffs.
- [codec-upgrade-handoff.md](codec-upgrade-handoff.md) — the operational
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

`scripts/sync-sveltekit-app.mjs` rewrites each codec's `.js` to replace
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

### libjxl — ✅ DONE (emcc 3.1.0, Path A v0.8.5). The runtime bug was embind, not the codec.
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
  `patchWasmBindgenWrapperFallbackUrl` in `scripts/sync-sveltekit-app.mjs` to match
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
