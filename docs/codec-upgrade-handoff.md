# Codec-Upgrade Handoff

Last updated: 2026-06-02. Status: **✅ DONE — the 2026-06-02 sweep is complete.**

> ## ✅ DONE — all 7 codecs upgraded
>
> This handoff's build + verify + commit loop was executed for **every** codec.
> All 7 (imagequant 2.18.0, libwebp v1.6.0, libavif v1.4.2 / libaom v3.12.1,
> libjxl v0.8.5, oxipng 10.1.1, mozjpeg v4.1.5, resize 0.8.9) were rebuilt
> **natively with emsdk 3.1.0 + rustup nightly (no Docker, no sudo)** and committed
> on **`codec-rebuilds`** — verified by the 17-test Playwright e2e suite + the
> benchmark with no regressions. The as-built record (toolchains, gotchas, bugs)
> is in [codec-build-notes.md](codec-build-notes.md). **This doc is kept as a
> reference for future codec updates.** The multi-threaded (`_mt`) runtime is now
> wired and verified too (done 2026-06-03, merged to `main`) — see
> [threading-enablement.md](threading-enablement.md).

This is a self-contained handoff for actually **building** the codec upgrades.
The audit ([codec-upgrade-audit.md](codec-upgrade-audit.md)) decided *what* to
upgrade and *why*; the runbooks ([codec-upgrade-runbooks.md](codec-upgrade-runbooks.md))
give the per-codec details. This doc is the **build recipe + verification loop**.

## Native build — NO DOCKER (proven 2026-06-02)

Docker is **not** required. The codecs' `build-cpp.sh`/`build-rust.sh` use Docker
only to *provide* Emscripten — you can install Emscripten directly into a user
folder (no sudo) and build natively. This was used to upgrade libimagequant and
libwebp on Apple Silicon. The build outputs are functionally identical (verified
by `npm run check`, the e2e suite, and the benchmark).

**One-time toolchain setup (no Docker, no sudo):**

```sh
# Emscripten (C/C++ codecs):
git clone --depth 1 https://github.com/emscripten-core/emsdk.git ~/emsdk
cd ~/emsdk && ./emsdk install latest && ./emsdk activate latest
# cmake (avif/webp/jxl need it):
brew install cmake
# Rust codecs (oxipng/resize/hqx) additionally need:
#   rustup + `rustup target add wasm32-unknown-unknown` + wasm-pack
#   (the squoosh rust build also wires emscripten's clang as the wasm sysroot —
#    see codecs/rust.Dockerfile; this one is fiddlier, do it last).
```

**Per C/C++ codec, build directly (bypassing the Docker wrapper):**

```sh
source ~/emsdk/emsdk_env.sh
cd codecs/<codec>
rm -rf node_modules/<lib>           # force a fresh source download of the new version
# The codecs' Dockerfile sets these; replicate them natively:
export CFLAGS="-O3 -flto"
export CXXFLAGS="-O3 -flto -std=c++17"
export LDFLAGS="-O3 -flto -s FILESYSTEM=0 -s ALLOW_MEMORY_GROWTH=1 -s TEXTDECODER=2 -s NODEJS_CATCH_EXIT=0 -s NODEJS_CATCH_REJECTION=0"
emmake make                          # writes the new .js/.wasm into the codec dir
cd ../..
```

### Modern-toolchain gotchas already discovered (emcc 5.x / clang 16)

- **sync-script patch is now toolchain-agnostic** (`scripts/sync-sveltekit-app.mjs`)
  — it matches both `new URL(...).toString()` (emsdk 2.0.x) and `.href` (current).
  Done; no action needed. This is what makes modern-emcc rebuilds integrate.
- **libwebp**: since v1.3.0 `libsharpyuv` is a separate archive — the Makefile now
  links `libsharpyuv.a` after `libwebp.a`. The SIMD variant needs **`-msimd128`**
  (else it silently collapses to the non-SIMD baseline) and
  `-Wno-error=implicit-function-declaration` for clang-16 strictness. Done.
- **libavif/libaom — BLOCKED on emcc 5.x; use emsdk 2.0.34 instead.** Investigated
  thoroughly (2026-06-02): libaom v3.12.1 + libavif v1.4.2 compile fine (fix:
  `-DAVIF_LIBYUV=OFF`, libavif v1.4 newly requires libyuv), but emcc 5.0.7's
  linker **strips libaom out of the encoder** (21 KB wasm instead of ~2.8 MB) and
  the encoder doesn't run. Root cause: a DCE/archive-extraction behavior change
  vs the codecs' original emsdk **2.0.34**. Diagnosis was exact — `avif_enc.o`
  has correct undefined refs to `avifEncoderCreate` etc., `libavif.a` defines all
  211 of them, but the modern linker won't pull them; only `--whole-archive
  --no-gc-sections` force-includes libaom, and that binary traps at runtime.
  Removing `-s ERROR_ON_UNDEFINED_SYMBOLS=0`, `--start-group`, and separate
  compilation all failed. **libjxl will likely hit the same wall** (also a
  complex multi-library C++ codec). The simple codecs (imagequant, webp) built
  fine on emcc 5.x because they're single-library with direct calls.
  → **Recommendation: build libavif + libjxl with emsdk 2.0.34** (the toolchain
  they were designed for — `./emsdk install 2.0.34 && ./emsdk activate 2.0.34`;
  on Apple Silicon this is x86_64 via Rosetta) **or via the original Docker
  path** (`codecs/build-cpp.sh`, which pins `emscripten/emsdk:2.0.34`). AVIF was
  reverted to its working v1.0.1 state to keep the branch green.
- **Disk**: libaom and libjxl are multi-GB builds. Check `df -h` first.

**Docker alternative:** if you prefer, `cd codecs/<codec> && npm install && npm
run build` still works on a machine with Docker (the original path).

## The loop (per codec)

```sh
# 1. Edit the version pin + any wrapper changes — see the runbook for this codec.
#    (codec-upgrade-runbooks.md has the exact Makefile/Cargo + wrapper diffs.)

## The loop (per codec)

```sh
# 1. Edit the version pin + any wrapper changes — see the runbook for this codec.
#    (codec-upgrade-runbooks.md has the exact Makefile/Cargo + wrapper diffs.)

# 2. Build the new .wasm (Docker does the heavy lifting):
cd codecs/<codec>
npm install
npm run build            # produces <codec>_enc.js/.wasm etc. in this folder
cd ../..

# 3. Regenerate + verify the app still builds and every codec still encodes:
npm run check            # format, sync, svelte-check, vite build, asset audit
npm run test:e2e         # browser regression: every format encodes valid bytes

# 4. Prove it's an improvement, not a regression (size + speed):
npm run bench            # writes benchmarks/results/current.json
npm run bench:compare    # baseline (pre-upgrade) vs current — fails if it regressed
#   Read the table: smaller bytes = better compression, lower ms = faster.
#   A big size drop with no quality complaint = a real win and your article number.

# 5. If green + no regression, commit just this codec, then re-baseline:
git add codecs/<codec> codecs/<codec>/Cargo.lock 2>/dev/null
git commit -m "feat(<codec>): upgrade to <version> (<one-line: CVE/compression/speed>)"
cp benchmarks/results/current.json benchmarks/baseline.json   # track the new shipped state
git add benchmarks/baseline.json && git commit -m "bench: re-baseline after <codec> upgrade"
```

Capture the baseline **once before you start** (it's already committed, but
re-run `BENCH_LABEL=baseline npm run bench && cp benchmarks/results/baseline.json
benchmarks/baseline.json` on this machine first, since timing is machine-specific).
See `benchmarks/README.md`.

`npm run test:e2e` is the safety net added on 2026-06-02 — it loads the app and
encodes through every format asserting valid output, so a bad codec rebuild
fails loudly instead of silently shipping garbage. **Run it after every codec.**

## Order (priority — from the audit §7)

**Do first — urgent (each ships a known CVE to any file a user drops in):**

1. ✅ **libimagequant** 2.12.1 → 2.18.0 — **DONE** (commit `f5f2b922`), verified
   (new quantize e2e test reduces to 4 colours correctly).
2. ✅ **libwebp** → v1.6.0 — **DONE** (commit `c32fc2db`), CVE-2023-4863.
   Byte-identical output, zero size/speed regression. (libsharpyuv split +
   `-msimd128` SIMD fix handled — see the gotchas above.)
3. ✅ **libavif v1.4.2 + libaom v3.12.1** — **DONE.** CVE-2024-5171 (CVSS 9.8);
   zero size regression, 6–13% faster encode.
4. ✅ **libjxl → v0.8.5 (Path A)** — **DONE.** CVE-2023-0645, CVE-2023-35790,
   CVE-2025-12474 (CVE-2026-1837 is LCMS2-only; the build uses skcms, so N/A);
   3–6% smaller + 2–9% faster.

**Do later — gradual (real value, more effort, no urgency):**

5. ✅ **OxiPNG 9.0.0 → 10.1.1** — **DONE.** Rust API break handled; byte-identical
   at default preset; robustness + fast-mode/ICC fixes.
6. ✅ **mozjpeg 3.3.1 → 4.1.5** — **DONE.** 9 CVEs from the libjpeg-turbo 2.x base;
   compression intentionally unchanged = byte-identical; build moved
   autotools → CMake.
7. ✅ **resize 0.5.5 → 0.8.9** — **DONE.** Rust rewrite; rayon disabled for WASM;
   ahead of both Squoosh and jSquash (which pin 0.5.5).

All seven landed on `codec-rebuilds`. Each step was independent and separately
committed. If a codec's build or the e2e suite fails on a future update, revert
that codec (`git checkout -- codecs/<codec>`) and move on — the others are
unaffected.

## New codec to consider first (separate, no Docker needed)

Per [new-codec-investigation.md](new-codec-investigation.md): **SVGO** (SVG
optimization) is the highest-ROI *addition* and needs no codec toolchain (pure
JS, official browser bundle). It's the only candidate that adds a format the app
can't handle today. Independent of the rebuilds above.

---

## Copy-paste prompt for a fresh AI session

> **Note (2026-06-02): the original sweep is COMPLETE — all 7 codecs are upgraded
> and verified on `codec-rebuilds`. This prompt is kept as a template for a
> *future* codec-update session; adapt the "already done / continue" lines to
> whatever is then outstanding.**
>
> I'm working in the Sqush repo (a browser/WASM image compressor) on the
> `codec-rebuilds` branch. libimagequant and libwebp are already upgraded +
> verified; continue the remaining codec upgrades.
>
> Read `docs/codec-upgrade-handoff.md` (esp. "Native build — NO DOCKER" + the
> gotchas), `docs/codec-upgrade-runbooks.md`, and `docs/codec-upgrade-audit.md`
> first. Set up the toolchain per the handoff (install Emscripten directly — no
> Docker, no sudo). Then work the remaining codecs in priority order: **libavif +
> libaom**, **libjxl** (urgent CVEs), then gradual oxipng, mozjpeg, resize.
>
> For each codec: bump the version + any wrapper changes from the runbook, build
> it natively (`source ~/emsdk/emsdk_env.sh` + the env flags + `emmake make` in
> `codecs/<codec>/`), then run `npm run check`, `npm run test:e2e`, `npm run
> bench` + `npm run bench:compare`. **Only commit a codec if check + e2e are green
> AND bench:compare shows no regression**; if a build or test fails, fix the build
> flag (clang-16 wants `-Wno-error=...`; SIMD wants `-msimd128`) or revert that
> codec (`git checkout -- codecs/<codec>`) and tell me. Commit each codec
> separately; re-baseline the benchmark after each. Check `df -h` before libaom
> and libjxl — they're multi-GB builds. Run autonomously; only stop for a real
> decision (an upstream API change the runbook didn't anticipate, or a failure
> you can't resolve).
