<!--
Generated 2026-06-02 by the `codec-upgrade-audit` workflow (16 agents: one web-research pass
per codec + 4 landscape scouts on Sonnet, synthesized by Opus). Inventory was scouted from the
repo's codec Makefiles / Cargo.toml / Cargo.lock. Every claim links its source — verify exact
version numbers and CVE IDs against the linked pages before acting, since web research can drift.
Re-run: Workflow({ scriptPath: ".../workflows/scripts/codec-upgrade-audit-wf_851e63fd-b32.js" }).
-->

# Sqush Codec-Upgrade Audit

> ## ✅ COMPLETED 2026-06-02 — all do-now AND gradual upgrades landed
>
> Every codec this audit recommended upgrading was rebuilt and committed on the
> **`codec-rebuilds`** branch, built **natively with emsdk 3.1.0 + rustup nightly
> (no Docker, no sudo)**. The version numbers that actually shipped:
>
> - **imagequant** 2.12.1 → **2.18.0** (byte-identical; security/quality)
> - **libwebp** pre-1.2.0 commit → **v1.6.0** (CVE-2023-4863; byte-identical)
> - **libavif** 1.0.1 → **1.4.2** + **libaom** 3.7.0 → **3.12.1** (CVE-2024-5171
>   CVSS 9.8; zero size regression, 6–13% faster encode)
> - **libjxl** pre-0.7 commit → **v0.8.5** (Path A; CVE-2023-0645, CVE-2023-35790,
>   CVE-2025-12474; CVE-2026-1837 is LCMS2-only and the build uses skcms, so N/A;
>   3–6% smaller + 2–9% faster)
> - **oxipng** 9.0.0 → **10.1.1** (byte-identical at default preset; robustness +
>   fast-mode/ICC fixes)
> - **mozjpeg** 3.3.1 → **4.1.5** (9 CVEs from the libjpeg-turbo 2.x base;
>   compression intentionally unchanged = byte-identical; autotools → CMake)
> - **resize** 0.5.5 → **0.8.9** (Rust; ahead of both Squoosh and jSquash, which
>   pin 0.5.5)
>
> Where the actual landed version differs from the target this audit names (it
> cites libaom v3.14.1 and libjxl v0.11.2), the **banner numbers above are
> authoritative** — the analysis below is kept verbatim as historical context.
> Verified by the 17-test Playwright e2e suite + the benchmark with no
> regressions. Build details (toolchains, gotchas, bugs):
> [codec-build-notes.md](codec-build-notes.md). Still deferred: wiring the
> multi-threaded (`_mt`) runtime — see [threading-enablement.md](threading-enablement.md).

A decision-oriented review of every codec Sqush ships, plus new-codec, WebP2, and SVG questions. Written for a solo dev: every row tells you whether to act now, later, investigate, or skip — and why. Where a gain is marginal, it says so.

> **Spun-off plans from this audit:** [threading-enablement.md](threading-enablement.md) (enable the already-built multithreading) and [codec-surface-cleanup.md](codec-surface-cleanup.md) (remove WebP 2; the dead `codecs/png/` deletion is already done). Docs map: [README.md](README.md).

The single most important framing fact: **Sqush runs as WASM in the browser.** Two consequences shape every recommendation below:

1. **Native CPU assembly doesn't apply.** WASM uses portable 128-bit SIMD (which the browser maps to NEON on Apple Silicon / AVX on x86 automatically) — it cannot run a library's hand-written AVX2/AVX-512/NEON assembly. So "X% faster on AVX2/NEON" desktop benchmarks usually mean **nothing** for your build. The real wins here are CVE fixes, compression-ratio improvements, and WASM-specific speedups.
2. **Threading is ON (done 2026-06-03).** *(This item originally said threading was OFF — that highest-leverage perf change has since landed and is merged into `main`.)* The app ships multithreaded codec variants — AVIF, JXL and OxiPNG (WP2 was removed) each detect thread support and load `_mt` / `pkg-parallel` builds. WASM threads require `SharedArrayBuffer` (and so a **cross-origin-isolated** page via COOP + COEP), which is now set in dev/preview (Vite plugin) and prod (`static/_headers`); all three codecs engage multi-core, verified Chromium + WebKit. SVT-AV1's multithreading still wouldn't apply (its asm can't compile to WASM), but libaom/JXL/OxiPNG threading is now live. Full record: [threading-enablement.md](threading-enablement.md).

---

## 1. TL;DR priority ranking

Ordered high → low by upgrade value. "Years behind" is approximate calendar gap from your pin to current.

| Codec | Current → Latest | Years behind | Why upgrade (1 phrase) | Value | Risk | Verdict |
|---|---|---|---|---|---|---|
| **libwebp (WebP v1)** | pre-1.2.0 commit (Nov 2020) → v1.6.0 | ~5.5 | Critical CVE-2023-4863 OOB write + WASM lossless speed | High | Med | **Do now** |
| **libavif + libaom (AVIF)** | v1.0.1 / aom v3.7.0 → v1.4.2 / aom v3.14.1 | ~2.75 | Critical CVE-2024-5171 (CVSS 9.8) + real 12–17% compression gain | High | Med | **Do now** |
| **libjxl (JPEG XL)** | pre-0.7 commit (Jan 2022) → v0.11.2 | ~4 | 6 CVEs + 5–10× faster lossless + 30–40% smaller progressive | High | Med | **Do now** |
| **libimagequant** | 2.12.1 → 2.18.0 (C branch) | ~5 | ~6 rounds of quant quality/correctness, one-line change | Med | Low | **Do now (easy)** |
| **OxiPNG** | 9.0.0 → 10.1.1 | ~1.5 | Faster low-level presets + better ICC, small wrapper edit | Med | Med | **Do later** |
| **mozjpeg** | v3.3.1 (2018) → v4.1.5 | ~5.5 | 9 CVEs in libjpeg-turbo base (compression unchanged) | Med | Med | **Do later** |
| **resize (Rust crate)** | 0.5.5 → 0.8.9 | ~5.5 | OOM-safe API, no_std, single-thread perf, new filters | Med | Med | **Do later** |
| **QOI** | 8d35d93 (2023) → HEAD | ~0 (1 real commit) | ~1.4% encode speed, two-line micro-opt | Low | Low | **Skip (opportunistic)** |
| **libwebp2 / wp2** | 413df7ca (Jan 2021) → HEAD (no releases) | ~5 | No browser will ever decode it; non-final bitstream | Low | High | **Skip / hide / drop** |
| **hqx** | v0.1.3 → v0.1.3 (latest) | 0 | Already on latest; upstream abandoned | None | Low | **Skip** |
| **png (image-png crate)** | 0.16.7 → 0.18.1 | ~5–6 | Dead directory, not imported anywhere | None | Low | **Skip / delete** |

Three "do now" items (libwebp, AVIF, JXL) are driven by genuine security exposure — each has a critical/important CVE that your WASM build hands to any file a user drops in. libimagequant is a free win (one-line Makefile change). Everything else is convenience or cleanup.

---

## 2. Per-codec detail

### libwebp (WebP v1) — Do now
- **Current → latest:** commit `d2e245ea` (Nov 24 2020, just before v1.2.0) → **v1.6.0** (Jun 30 2025). Eleven stable releases behind.
- **Gist:** API is binary-compatible across the whole range, so no wrapper rewrite — this is a rebuild of the two WASM blobs.
- **Why it matters:**
  - **Reliability (the headline):** **CVE-2023-4863**, the critical OOB write in the lossless decoder `BuildHuffmanTable` — the same bug that hit Chrome globally in 2023, fixed in v1.3.2. Your build exposes it to any dropped file. Plus further Huffman OOB fixes in v1.3.1/v1.4.0. ([libwebp v1.3.2](https://chromium.googlesource.com/webm/libwebp/+/refs/tags/v1.3.2))
  - **Speed (WASM-relevant, unusually):** v1.6.0 explicitly enables `VP8L_USE_FAST_LOAD` + 64-bit BITS caching **for the WASM target** — a real lossless-decode speedup for your build, not a desktop-only SIMD claim. ([v1.6.0](https://chromium.googlesource.com/webm/libwebp/+/refs/tags/v1.6.0))
  - **Compression:** incremental lossless gains (palette sorting v1.3.1, histogram/predictor work v1.5.0).
- **Effort/risk:** Medium. One coupling to watch — Sqush uses libwebp as the **libsharpyuv** source for AVIF; v1.3.0 promoted libsharpyuv to its own CMake target, so the AVIF build path may need its libsharpyuv reference adjusted. Otherwise mechanical. ([NEWS](https://chromium.googlesource.com/webm/libwebp/+/refs/heads/main/NEWS))

### libavif + libaom (AVIF) — Do now
- **Current → latest:** libavif **v1.0.1** + libaom **v3.7.0** (Aug 2023) → **v1.4.2** + **v3.14.1** (May 2026).
- **Why it matters:**
  - **Reliability:** **CVE-2024-5171 (CVSS 9.8 Critical)** — integer overflow in libaom `img_alloc_helper`, affecting every version up to and including v3.9.0. Your v3.7.0 is directly vulnerable; fixed in v3.9.1. This alone is sufficient grounds. ([NVD](https://nvd.nist.gov/vuln/detail/CVE-2024-5171))
  - **Compression (genuine, not hype):** libaom v3.12.0's `AOM_TUNE_IQ`, enabled by default in libavif v1.4.0 for still images, shows up to **12% BD-rate at equal SSIMULACRA2, 14% DSSIM, 17% Butteraugli** on the CLIC dataset. For an image compressor that's a real user-facing win. ([libavif v1.4.0 blog](http://aomedia.org/blog%20posts/Libavif_v1_4_0-Boasts-Major-Updates-to-Encoder-Technology/))
  - **Speed:** the big libaom Arm/x86 SIMD gains **do not apply** — your build uses `AOM_TARGET_CPU=generic`, which disables SIMD. Encoder speed in WASM is essentially unchanged. (AVIF in WASM is slow regardless; see §4.)
- **Effort/risk:** Medium, mechanical version bumps in `codecs/avif/Makefile`. Verify three things: (1) the quantizer→quality API was deprecated in v1.2.0 — your wrapper uses the quality API, so should be fine; (2) v1.4.0 wants C11 internally — add `-DCMAKE_C_STANDARD=11` if it complains; (3) the libsharpyuv pin may need refreshing alongside the libwebp bump. **Note: SVT-AV1 is not a viable swap** — see §4. ([CHANGELOG](https://github.com/AOMediaCodec/libavif/blob/main/CHANGELOG.md))

### libjxl (JPEG XL) — Do now
- **Current → latest:** commit `9f544641` (Jan 2022, pre-0.7) → **v0.11.2** (Feb 2026). 4+ major versions, ~14 releases.
- **Why it matters:**
  - **Reliability:** six CVEs your pin predates — CVE-2023-0645, CVE-2023-35790, CVE-2024-11403, CVE-2024-11498, CVE-2025-12474, CVE-2026-1837 — plus a Google Project Zero `djxl` crash, all fixed across v0.8–v0.11.2. ([CVE-2025-12474](https://www.cve.org/cverecord?id=CVE-2025-12474))
  - **Speed (large, real):** the v0.9→v0.10 transition is the biggest documented leap — non-photographic lossless went **~2.6 Mpx/s → ~12.2 Mpx/s at effort 5 (~5×)**. v0.11.2 adds resampling-2 up to 10× faster below effort 10. ([CHANGELOG](https://github.com/libjxl/libjxl/blob/main/CHANGELOG.md))
  - **Compression:** v0.11.2 progressive lossless is **30–40% smaller** on average.
  - **Strategic tailwind:** Chrome 145 (Feb 2026) reintroduced JXL decode via a Rust decoder behind a flag, default-on expected H2 2026; Safari already supports it. The format you already have wired up is becoming web-deliverable. ([photoformatlab](https://www.photoformatlab.com/blog/jpeg-xl-chrome-browser-support-2026))
- **Effort/risk:** Medium. The one real API break is v0.9.0 removing deprecated `JxlEncoderOptions*` symbols — audit `codecs/jxl/enc/jxl_enc.cpp` and `dec/jxl_dec.cpp`. Note: **neither Squoosh nor jSquash has moved off this commit**, which signals real WASM build friction — attempt this one in isolation first. ([building_wasm.md](https://github.com/libjxl/libjxl/blob/main/doc/building_wasm.md))

### libimagequant — Do now (easiest high-confidence win)
- **Current → latest:** **2.12.1** (2018) → **2.18.0** (Jan 2023, C branch). (4.4.1 exists but is a Rust rewrite — see below.)
- **Why it matters:** ~6 rounds of "speed and quality improvements" to palette selection (2.13–2.18), including **2.14's better remap-over-background** (directly relevant to your dithering/remap pipeline) and 2.18's improved handling of few-pixel/diverse-color images, plus a memory-leak fix. ([CHANGELOG 2.x](https://github.com/ImageOptim/libimagequant/blob/2.x/CHANGELOG))
- **Effort/risk:** **Near zero.** Same `./configure && make` Emscripten path; update one `CODEC_URL` line in `codecs/imagequant/Makefile`. C API stable across all 2.x — no `imagequant.cpp` edits expected.
- **The 4.x question:** v4.x is a pure-Rust rewrite (same C ABI) and is the actively-developed line with further quality gains, but it requires moving to a Rust/wasm-bindgen toolchain. That's a separate investigation, not this upgrade.

### OxiPNG — Do later
- **Current → latest:** **9.0.0** (Oct 2023) → **10.1.1** (Apr 2025). 9 releases.
- **Why it matters:** 10.1.1's Bigrams improvement gives **notably faster results at the lower optimization levels Sqush exposes** (the levels users actually hit), better ICC profile recompression, and a fast-mode correctness fix for small indexed images. Compression gains are modest but real. ([v10.1.1](https://github.com/shssoichiro/oxipng/releases/tag/v10.1.1))
- **Effort/risk:** Medium — the v10.0.0 **breaking Rust API** touches your 27-line `codecs/oxipng/src/lib.rs`: `Options.interlace` becomes `Option<bool>`, `filter`→`filters` (typed differently), `deflate`→`deflater`, and `optimize()` returns `(usize, usize)`. MSRV → 1.85.1; check `wasm-bindgen` pins after. ~30 min of mechanical edits plus a test cycle. jSquash already ships this (`@jsquash/oxipng 2.3.0`) as a reference.

### mozjpeg — Do later
- **Current → latest:** **v3.3.1** (2018) → **v4.1.5** (Oct 2023). 6 stable releases.
- **Why it matters — be honest:** **MozJPEG's own compression is unchanged** between v3.3.1 and v4.1.5 (trellis quant, scan optimisation untouched). All value is the rebased libjpeg-turbo 2.x base: **9 CVEs** (CVE-2018-11813, -14498, -1152, -19664, -20330, CVE-2020-13790, -17541, CVE-2021-20205, -37972) plus OSS-Fuzz/UBSan fixes. The advertised AVX2/SSE2 speedups are **irrelevant in WASM** (Emscripten is scalar). So this is a security/robustness upgrade, not a compression one. ([libjpeg-turbo 2.1.2 ChangeLog](https://skia.googlesource.com/external/github.com/libjpeg-turbo/libjpeg-turbo.git/+/refs/tags/2.1.2/ChangeLog.md))
- **Effort/risk:** Medium, and the effort is the blocker not the code: **v4.0.0 dropped autotools and is CMake-only.** Your Emscripten Makefile build must be rewritten to `emcmake cmake`. `mozjpeg_enc.cpp`'s interface is stable, so no wrapper changes. jSquash and `mozjpeg-wasm` have done this migration as references. Budget 0.5–1 day. (Most input JPEGs decode in your *decoder*, not mozjpeg the encoder — but the hardened base still matters.)

### resize (Rust crate) — Do later
- **Current → latest:** **0.5.5** (2020) → **0.8.9** (Feb 2026). 13 releases, two API breaks; won't compile past 0.5.x without edits.
- **Why it matters:** OOM-safe `Result` returns instead of panics (v0.6.0); **no_std compatibility** (v0.8.1, a genuine WASM build improvement); compounding single-threaded perf gains (v0.8.1 drops a transpose pass and oversized buffer); new filter types — Box, Hermite, Lagrange, B-Spline, Gaussian (v0.8.3) you could surface in the UI. The rayon multithreading (3–7×) **cannot compile to WASM** and must be disabled. ([compare](https://github.com/PistonDevelopers/resize/compare/v0.5.5...v0.8.9))
- **Effort/risk:** Medium, ~half a day. In `codecs/resize/src/lib.rs`: rename `Pixel::RGBA`→`RGBA8`, wrap slices with the `rgb` crate's `.as_rgba()`/`.as_rgba_mut()`, add error handling on `resize::new()`/`resizer.resize()`. In `Cargo.toml`: set `default-features = false` (drops rayon — the biggest gotcha), drop abandoned `wee_alloc`, bump ancient `wasm-bindgen` 0.2.38. **Note:** neither Squoosh nor jSquash upgraded this crate (both still pin 0.5.5), so you'd be ahead of your upstreams here — verify carefully.

### QOI — Skip (opportunistic)
- **Current → latest:** `8d35d93` (2023) → HEAD. 62 commits behind, but **only one** (`4ab68bbd`, Apr 2025) touched `qoi.h`: a `% 64` → `& 63` micro-opt claiming ~1.4% faster encode, zero API/behavior change. The other 61 commits are README links. ([commit](https://github.com/phoboslab/qoi/commit/4ab68bbd20618a663255625160c40875713f5485))
- **Verdict:** Skip. The QOI spec is **intentionally frozen** (phoboslab considers it done). Bump the `CODEC_URL` SHA only if you're rebuilding QOI for another reason. Note QOI also has no compression rationale for a size-focused tool — its files are 10–30% *larger* than optimised PNG.

### libwebp2 / wp2 — Skip / hide / drop (full verdict in §3)
- No releases ever; pin `413df7ca` (Jan 2021) is ~463 commits / 5+ years behind HEAD. Real fixes exist (fuzzer crashes, GetMaxTileSize overflow) but the format is an abandoned research playground with a deliberately non-final bitstream and a C++20 build wall. No upgrade changes the product reality.

### hqx — Skip
- Pin **v0.1.3** is the latest tag *and* repo HEAD; upstream `wasmboy-rs` has been dead since Jan 2021. hqx is a fixed mathematical scaling filter with no development path. Nothing to do unless a project-wide `wasm-bindgen` bump forces a touch-up. ([repo](https://github.com/CryZe/wasmboy-rs))

### png (image-png crate) — Deleted
- `codecs/png` was pinned at **0.16.7** (16 releases behind 0.18.1) but was a **dead directory** — the prebuilt `squoosh_png.js/.wasm` in `codecs/png/pkg/` was never imported by `src/`; browserPNG + OxiPNG handle every PNG path. The correct action was **deletion, not upgrade**, and it was deleted in the codec-cleanup pass (see §7). ([tags](https://github.com/image-rs/image-png/tags))

---

## 3. WebP2 verdict — answering "is my WebP2 unstable?"

**Yes, it is unstable, and no, there is no more-stable version to move to. The instability is the format's permanent design status, not a bug your old pin introduced.** Here is the direct answer to each part of your worry:

- **Is there a stabler version?** No. libwebp2 has **zero release tags, zero stable branches, and no bitstream freeze, ever.** The current README still says: *"the format is not finalized so changes to the library can break compatibility with images encoded with previous versions. USE AT YOUR OWN RISK!"* ([README](https://chromium.googlesource.com/codecs/libwebp2/+/refs/heads/main/README.md))
- **Is it abandoned?** As a *format*, effectively yes. In **October 2022 Google rewrote the README** to call it *"a playground for image compression experiments"* — an on-the-record statement it will never ship as a product. **Mozilla closed its WebP2 support bug WONTFIX.** No browser has, or intends to have, a WebP2 decoder. ([reclassification commit](https://chromium.googlesource.com/codecs/libwebp2/+/1251ca748c17278961c0d0059b744595b35a4943%5E!), [Mozilla bug 1723555](https://bugzilla.mozilla.org/show_bug.cgi?id=1723555))
- **Why your build crashes specifically:** your pin predates years of fuzzer/overflow fixes, and there's a known Squoosh bug ([#854](https://github.com/GoogleChromeLabs/squoosh/issues/854)) where **lossless + palette reduction → `WP2_STATUS_BITSTREAM_ERROR`**, which you inherit at an even older commit. A rebuild to HEAD *would* patch some crashes (e.g. the Dec 2025 `GetMaxTileSize` uint32 overflow) — but the bitstream stays non-final, so it doesn't make WebP2 *safe to ship to users*.
- **The build wall:** HEAD bumped to **C++20** (Apr 2025), so upgrading isn't even a free rebuild — it needs a C++20-capable emsdk.

**Recommendation: ✅ RESOLVED — WebP 2 was removed entirely (encoder and decoder) on 2026-06-02.** The original staged plan (harden label → hide → delete) was superseded by a clean full removal, since the only real-world producer of `.wp2` files was this app's own encoder and no browser can decode them. See [codec-surface-cleanup.md](codec-surface-cleanup.md) for the removal record. There is nothing left to upgrade or maintain here.

---

## 4. New codecs worth adding

### jpegli — the single highest-ROI *new* codec (but you build it yourself)
- **What it adds:** a JPEG encoder from Google's JXL team that is **API/ABI-compatible with libjpeg-turbo/MozJPEG** and outputs **standard JPEG** every decoder reads — but with **~28–35% better compression at high quality** (CID22 perceptual study: jpegli at 2.8 bpp beat libjpeg-turbo at 3.7 bpp). Encode speed is on par with MozJPEG. ([Google blog](https://opensource.googleblog.com/2024/04/introducing-jpegli-new-jpeg-coding-library.html), [arXiv](https://arxiv.org/html/2403.18589v1))
- **Honest hype check:** this is the real thing, not hype — same format, dramatically better bytes. **But** there is **no off-the-shelf WASM package.** jSquash doesn't have it, Squoosh's request ([#1408](https://github.com/GoogleChromeLabs/squoosh/issues/1408)) and jpegli's WASM-encoder issue ([#13](https://github.com/google/jpegli/issues/13)) are both open and idle. You'd build the Emscripten module yourself from `google/jpegli` (CMake has a WASM target; source compiles cleanly). It's **additive** — a new codec slot beside MozJPEG, not a replacement of the build.
- **Effort:** moderate-to-high (custom WASM build + wrapper). Highest payoff of anything in this section. Watch issue #13 for an official package before committing to maintaining your own build.

### JPEG XL as a *new capability* — you already have the codec
- You already ship libjxl; the additive opportunity is **lossless JPEG → JXL transcoding** (20–35% smaller, **zero quality loss**, reversible back to JPEG). `@jsquash/jxl` exists on npm if you ever want a reference. Frame it as "compress for storage/download" until Chrome ships JXL default-on (H2 2026). Low extra effort given you're already upgrading libjxl in §2. ([@jsquash/jxl](https://www.npmjs.com/package/@jsquash/jxl))

### SVT-AV1-backed AVIF — skip (hype in a WASM context)
- SVT-AV1 4.0.0 (Jan 2026) even added an "AVIF mode." But its entire advantage is **multi-core parallelism**, which **single-threaded WASM erases** — and its AVX2/AVX-512 NASM assembly **can't compile to WASM** (only 128-bit WASM SIMD exists). libaom with `AOM_TARGET_CPU=generic` remains the only practical browser AV1 encoder. **Don't pursue this.** ([sascha.work benchmark](https://sascha.work/posts/avif-and-webassembly/), [catskull](https://catskull.net/libaom-vs-svtav1-vs-rav1e-2025.html))
- Real AVIF caveat orthogonal to encoder choice: encoding a 12 MP image takes ~60–140s in WASM regardless. Consider a time estimate or "fast preview vs full quality" toggle rather than chasing a faster backend that doesn't exist for WASM.

### HEIC — decode-only at most, never encode
- HEIC = HEVC = **patent royalties** (MPEG LA + Access Advance); only Safari licenses it. **A HEIC encoder in a public tool is a non-starter** regardless of WASM. A useful, feasible addition is **libheif WASM as a decode-only input path** so iPhone users can drop HEIC files and convert them to JPEG/WebP/AVIF/JXL. Output should never be HEIC. ([heiccon](https://heiccon.com/blog/heic-for-web))

### Not worth it
- **ECT / zopflipng** for PNG: no WASM build exists, ~1–2% over OxiPNG. Skip — keep OxiPNG, optionally expose a gated "max compression (slow)" mode.
- **JPEG XS / FLIF / new formats:** XS is a low-latency video codec (worse than JPEG at web quality, no WASM impl); FLIF is dead (superseded by JXL). Nothing post-2021 is mature + WASM-available enough to add.

**Net:** the only new codec genuinely worth the effort is **jpegli**, and only because you can build it. JXL-transcode is a cheap bonus on top of the libjxl upgrade. Everything else is skip.

---

## 5. Vector / SVG optimization

**Recommendation: feasible and low-risk, but it's a product decision, not a technical one. Add it only if your users routinely drop SVGs alongside JPEGs/PNGs. If they don't, point them at SVGOMG and move on.**

- **Why it's architecturally different:** SVG is XML text. Optimization is AST manipulation (strip editor metadata, reduce coordinate precision, minify paths) — **no WASM, no quality slider, no before/after pixel diff.** It bypasses your entire codec layer. This is exactly why Squoosh never added it. ([SVGO](https://github.com/svg/svgo))
- **The tool:** **SVGO v4** (v4.0.1, Mar 2026) — industry standard, ~30M weekly npm downloads, ships a first-party **browser bundle** (`import { optimize } from 'svgo/browser'`, ~781 kB pure JS, loads on demand). Run `optimize()` in a Web Worker to match your off-main-thread pattern. SVGOMG proves the full pipeline runs fine in-browser. ([browser docs](https://svgo.dev/docs/usage/browser/))
- **Gains:** **40–70% on design-tool exports** (Illustrator/Figma/Inkscape), 15–30% on hand-coded SVGs — lossless, visually identical. A 150 KB export → ~45 KB is the same order as a good WebP encode.
- **Effort:** Backend integration ~1–2 days (input detection + worker + `optimize()`). Pragmatic middle path — `preset-default`, no per-plugin UI, just a before/after size readout and download — is **~2–3 days total.** A full SVGOMG-style per-plugin UI is a week+; don't.
- **Don't:** use `svgcleaner` (archived since 2021). **Watch** OXVG (Rust/WASM, but pre-1.0 at v0.0.5) as a future-native fit — not ready today.
- **The cheapest option:** if SVG isn't in scope, a 30-minute info callout pointing users to [SVGOMG](https://jakearchibald.github.io/svgomg/) when they drop an SVG is zero-maintenance and honest.

---

## 6. The Squoosh / jSquash anchor

When in doubt, match **jSquash** first — it's actively maintained (last commit Jan 2026, vs Squoosh's dev branch hibernating since Aug 2024) and ships browser/worker-verified npm packages, so its pins are *proven-WASM-buildable* targets. Both projects share identical codec Makefiles for the overlap. Where Sqush sits vs these anchors:

| Codec | Squoosh / jSquash pin | Sqush vs anchor | Safest known-good target |
|---|---|---|---|
| mozjpeg | **v3.3.1** (both) | Same — both also badly stale | Beyond anchor: v4.1.5 (jSquash/`mozjpeg-wasm` have the CMake build) |
| libwebp | `d2e245ea` (both) | Same | Beyond anchor: v1.6.0 |
| libavif/libaom | **v1.0.1 / v3.7.0** (both) | Same | Beyond anchor: v1.4.2 / v3.14.1 |
| libjxl | `9f544641` (both) | Same | **Anchor is stuck here too** — neither moved to v0.11.x (build friction signal) |
| oxipng | **9.0** (both) | Same | **jSquash already at the target** — `@jsquash/oxipng 2.3.0` ships 10.x; use its `Cargo.toml` as reference |
| libimagequant | **2.12.1** (Squoosh; jSquash has none) | Same | Beyond anchor: 2.18.0 (same C path) |
| resize | **0.5.5** (both) | Same | **No anchor help** — neither upgraded; you'd be ahead |
| qoi | `8d35d93` (both) | Same | Anchor is current-enough (spec frozen) |
| wp2 | `413df7ca` (Squoosh; **jSquash has none**) | Same | No anchor, no releases — confirms "don't bother" |

**Reading this table:** for libwebp / AVIF / mozjpeg you'd be going *beyond* both anchors, but the WASM build paths are well-trodden by jSquash's tooling. For **oxipng**, jSquash has *already done the work* — copy it. For **libjxl**, the fact that *both* anchors are stuck on your exact commit is the strongest evidence that the JXL upgrade carries real WASM build risk — isolate it. For **resize** and **wp2**, the anchors give you nothing.

---

## 7. Recommended action plan

### Do now (highest value, lowest risk first)
1. **libimagequant 2.12.1 → 2.18.0** — one-line `CODEC_URL` change, same build path, ~6 rounds of quant quality. The free win; do it first to warm up the build pipeline.
2. **libwebp → v1.6.0** — critical CVE-2023-4863 + WASM-specific lossless speedup. Watch the libsharpyuv/AVIF coupling.
3. **libavif v1.4.2 + libaom v3.14.1** — critical CVSS-9.8 CVE + real 12–17% compression gain. Do alongside libwebp (shared libsharpyuv pin).
4. **libjxl → v0.11.2** — 6 CVEs + 5–10× lossless speed + 30–40% smaller progressive. **Isolate this one** (both upstreams are stuck on your commit — expect build friction).

### Do later (real value, more effort or lower urgency)
5. **OxiPNG 9.0.0 → 10.1.1** — small breaking-API wrapper edit; copy `@jsquash/oxipng 2.3.0`. Faster at the low presets users actually hit.
6. **mozjpeg v3.3.1 → v4.1.5** — security/robustness only (compression unchanged). Gated on the **autotools→CMake build rewrite**; reference jSquash / `mozjpeg-wasm`.
7. **resize 0.5.5 → 0.8.9** — OOM-safe API, no_std, perf, new filters. ~half a day; disable rayon, drop `wee_alloc`. You'll be ahead of both upstreams.

### Investigate (net-new, build it yourself)
8. **jpegli** — highest-ROI new codec (~30% better JPEG, same format). No package exists; custom Emscripten build. Watch [jpegli#13](https://github.com/google/jpegli/issues/13) for an official package first.
9. **JXL lossless-JPEG transcode** — cheap capability on top of the libjxl upgrade; reference `@jsquash/jxl`.
10. **libheif decode-only input** — let iPhone users drop HEIC and convert out (never encode HEIC).
11. **SVG via SVGO v4** — only if users actually bring SVGs; ~2–3 days for the pragmatic version. Otherwise a 30-min SVGOMG link.
12. **libimagequant 4.x (Rust)** — better quant + drops OpenMP, but a full toolchain switch. Standalone project.

### Skip
13. **wp2** — ✅ **DONE: removed entirely** (encoder + decoder) on 2026-06-02. No browser decodes it; bitstream non-final. See [codec-surface-cleanup.md](codec-surface-cleanup.md).
14. **QOI** — spec is **frozen**; only one real two-line commit (~1.4% encode). Bump the SHA opportunistically if you rebuild for another reason. (Also: QOI files are *larger* than optimised PNG — no compression rationale.)
15. **hqx** — already on the latest tag; upstream abandoned; fixed-math filter.
16. **png (image-png crate)** — **dead directory** (DELETED), never imported (browserPNG + OxiPNG own all PNG paths). `codecs/png/` was deleted in the codec-cleanup pass.
17. **SVT-AV1 / HEIC encoder / ECT / zopflipng / JPEG XS** — not viable or not worth it in single-threaded WASM (see §4).

**Suggested sequencing:** the codec-surface cleanup (WebP 2 removed, `codecs/png/` + `codecs/visdif/` deleted) and the multithreading headers are **already DONE** on the `codec-cleanup-and-threading` branch. The remaining codec work is the upgrades: do the four security-driven rebuilds (items 1–4) as one batch since they share the Emscripten/Docker pipeline and the libwebp↔AVIF libsharpyuv coupling means testing them together is cleaner — see [codec-upgrade-runbooks.md](codec-upgrade-runbooks.md) for turnkey steps. Defer mozjpeg's CMake rewrite, the resize crate edits, and the jpegli build to their own focused sessions.
