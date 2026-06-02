# Codec-Upgrade Handoff (run on a machine with Docker)

Last updated: 2026-06-02. Status: **ready to execute — needs Docker (not present
in the environment where this was prepared).**

This is a self-contained handoff for actually **building** the codec upgrades.
The audit ([codec-upgrade-audit.md](codec-upgrade-audit.md)) decided *what* to
upgrade and *why*; the runbooks ([codec-upgrade-runbooks.md](codec-upgrade-runbooks.md))
give the exact per-codec steps. This doc is the **orchestration + verification
loop** to run them safely, plus a copy-paste prompt for a fresh AI session.

## Plain-English: what "building a codec" means here

Each codec (WebP, AVIF, …) is C/C++ or Rust source from its original authors. The
app ships a pre-compiled **`.wasm`** (the browser-runnable form). To upgrade one:

1. **Bump the version** the codec points at (one line in its `Makefile` or
   `Cargo.toml`).
2. **Adjust the wrapper** if the new version renamed an API the small wrapper
   file calls (the runbook says when).
3. **Compile to `.wasm`** by running `npm run build` inside that codec's folder.
   Each codec's build is a **Docker** command (`codecs/build-cpp.sh` /
   `build-rust.sh`) — the Dockerfile already contains Emscripten/Rust, so you do
   **not** install emsdk/wasm-pack by hand. You only need **Docker** installed.
4. **Verify** the new `.wasm` in the app: `npm run check` + `npm run test:e2e`.
5. **Commit** that one codec, then move to the next.

That's it. The only prerequisite missing in the prep environment was Docker.

## Prerequisite

- **Docker Desktop** (or Docker Engine) installed and running. Nothing else —
  Node/npm are already set up by the repo.
- Work on the `codec-cleanup-and-threading` branch (or a fresh branch off it).

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

# 4. If green, commit just this codec:
git add codecs/<codec> codecs/<codec>/Cargo.lock 2>/dev/null
git commit -m "feat(<codec>): upgrade to <version> (<one-line: CVE/compression/speed>)"
```

`npm run test:e2e` is the safety net added on 2026-06-02 — it loads the app and
encodes through every format asserting valid output, so a bad codec rebuild
fails loudly instead of silently shipping garbage. **Run it after every codec.**

## Order (priority — from the audit §7)

**Do first — urgent (each ships a known CVE to any file a user drops in):**

1. **libimagequant** 2.12.1 → 2.18.0 — trivial one-line `CODEC_URL` bump, same C
   build. Do it first to warm up the Docker pipeline.
2. **libwebp** → v1.6.0 — CVE-2023-4863. Watch the libsharpyuv coupling with AVIF
   (build webp before/with avif).
3. **libavif + libaom** → latest 1.x / 3.x — CVE-2024-5171 (CVSS 9.8) + real
   compression gain. Refresh the libsharpyuv pin alongside libwebp.
4. **libjxl** → v0.11.x — 6 CVEs + faster lossless. **Isolate this one** (both
   Squoosh and jSquash are stuck on the same old commit → expect build friction;
   the `JxlEncoderOptions*` removal in v0.9 may need wrapper edits).

**Do later — gradual (real value, more effort, no urgency):**

5. **OxiPNG** 9 → 10.x — Rust API break in `codecs/oxipng/src/lib.rs`.
6. **mozjpeg** 3.3.1 → 4.x — security/robustness only; gated on the
   autotools→CMake build change.
7. **resize** 0.5.5 → 0.8.x — Rust API changes; disable rayon for WASM.

Each step is independent and separately committed, so you can stop after the
urgent four and pick up the rest anytime. If a codec's build or the e2e suite
fails, revert that codec (`git checkout -- codecs/<codec>`) and move on — the
others are unaffected.

## New codec to consider first (separate, no Docker needed)

Per [new-codec-investigation.md](new-codec-investigation.md): **SVGO** (SVG
optimization) is the highest-ROI *addition* and needs no codec toolchain (pure
JS, official browser bundle). It's the only candidate that adds a format the app
can't handle today. Independent of the rebuilds above.

---

## Copy-paste prompt for a fresh AI session (on the Docker machine)

> I'm working in the Sqush repo (a browser/WASM image compressor) on the
> `codec-cleanup-and-threading` branch. Docker is installed. I want to execute
> the **codec upgrades** that were prepared but couldn't be built in the previous
> environment (no Docker there).
>
> Read `docs/codec-upgrade-handoff.md`, `docs/codec-upgrade-runbooks.md`, and
> `docs/codec-upgrade-audit.md` first. Then work the codecs **in the priority
> order in the handoff** (urgent CVE codecs 1–4 first: libimagequant, libwebp,
> libavif+libaom, libjxl; then gradual 5–7: oxipng, mozjpeg, resize).
>
> For each codec: make the version + wrapper changes from the runbook, build it
> with `npm run build` inside `codecs/<codec>/`, then run `npm run check` and
> `npm run test:e2e`. **Only commit a codec if both are green**; if a build or
> test fails, revert that codec with `git checkout -- codecs/<codec>` and tell me
> before moving on. Commit each codec separately with a clear message. Keep
> `docs/codec-upgrade-audit.md` and `docs/STATUS.md` updated as you complete each
> one. Run autonomously; only stop for me if a codec needs a real decision (e.g.
> an upstream API change the runbook didn't anticipate, or an e2e failure you
> can't resolve).
