# Engine & codecs

> Presk compresses your images entirely inside your own browser — nothing is ever uploaded — using the same battle-tested open-source codecs that power Google's Squoosh.

## Overview / When to use it

A **codec** (short for _coder–decoder_) is the piece of software that knows how to read one image format and write another — for example, turning a big PNG into a small WebP. In most online compressors, that work happens on a faraway server, which means your image leaves your device. Presk is different: its codecs and processors run locally in your browser through **WebAssembly** (WASM) workers. You don't need to understand any of this to use Presk; it just means your photos stay private, the app keeps working offline after it has cached itself, and there is no upload step.

## How the engine works

### Everything runs on your device

When you drop an image into Presk, it travels through a four-step pipeline — **decode → preprocess → process → encode** — and the heavy WASM work runs client-side inside a background **Web Worker** so the interface can stay responsive. No server is involved and no image data is sent over the network. This is what "local-first" means in practice: the picture you compress never leaves the computer or phone you're using.

(Source of truth: `src/lib/compress.ts`, which drives `decode → preprocess → process → compressImage`; engine notes in `docs/user-guide/reference/engine-and-codecs.md`.)

### It picks the fastest build your browser allows

Modern browsers can run WebAssembly faster when they support two optional features:

- **Threads** — letting a codec use several CPU cores at once.
- **SIMD** — a CPU trick that processes several pixels in a single instruction.

The committed codec set includes baseline, SIMD, and threaded artifacts, and Presk picks the fastest your browser allows. AVIF, JPEG XL, and OxiPNG **encode multi-core** when the page is cross-origin-isolated — which Presk sets up automatically (COOP/COEP) — falling back to a single thread when threads or `SharedArrayBuffer` aren't available. WebP runs through a SIMD build. Correctness never depends on threads; they only affect speed.

> **Threading is on, with a single-thread fallback.** All three threaded codecs — AVIF, JPEG XL, OxiPNG — engage multiple cores in current Chromium and Safari/WebKit. If cross-origin isolation or `SharedArrayBuffer` isn't available, they fall back to a correct single-thread path, so the output is identical either way.

## The codecs

Presk bundles a focused set of image codecs, each built from a well-known open-source library. The committed WASM/JavaScript files live under `codecs/` (inherited from Squoosh) and are wired into the app through `src/features/encoders` and `src/features/decoders`. The output formats you can pick are defined in `src/lib/compress.ts` (`OUTPUT_FORMATS`).

The versions below come straight from the project's build recipes, recorded in `docs/codec-provenance.md`.

### Output formats (what you can compress _to_)

| Format in the menu           | Underlying library               | Recorded version                   | Speed boosts  | Notes                                                                    |
| ---------------------------- | -------------------------------- | ---------------------------------- | ------------- | ------------------------------------------------------------------------ |
| **WebP**                     | libwebp (`webmproject/libwebp`)  | `v1.6.0`                           | SIMD          | Broadly supported modern format; great all-rounder.                      |
| **AVIF**                     | libavif + libaom (+ libsharpyuv) | libavif `v1.4.2`, libaom `v3.12.1` | Threads       | Excellent compression for photos; slower to encode.                      |
| **JPEG XL**                  | libjxl                           | `v0.8.5`                           | Threads, SIMD | Newer high-efficiency format.                                            |
| **JPEG**                     | `mozilla/mozjpeg`                | `v4.1.5`                           | —             | Highly optimized classic JPEG encoder (MozJPEG; encoder in the tooltip). |
| **PNG**                      | `oxipng` (crates.io)             | `10.1.1`                           | Threads       | Lossless PNG optimizer (OxiPNG; encoder in the tooltip).                 |

All five output codecs are bundled WebAssembly and **always available** — there is nothing to feature-detect.

### Input formats (what you can open)

**Presk can read more formats than it can write** — the import list is separate from the output list above. There are two layers:

- **Bundled WASM decoders** — WebP, AVIF, JPEG XL, and **QOI**. These work even on browsers that can't decode them natively (`src/features/decoders`).
- **Whatever your browser decodes natively** — JPEG, PNG, GIF, **BMP**, SVG, and TIFF where the browser supports it. Presk hands these to the browser's own decoder (`createImageBitmap`).

So you can open GIF, BMP, SVG, and QOI files even though none of them are output options. **HEIC / HEIF is not supported** — there is no HEIC decoder, so a `.heic` file only opens if your browser/OS decodes it itself (in practice, Safari on Apple devices); elsewhere it fails to load.

### Helpers behind the editing controls

Two more libraries power the editing options rather than an output format:

- **Resize** uses the Rust `resize` crate (`0.8.9`) for its high-quality methods, plus the **hqx** pixel-art scaler (`v0.1.3`).
- **Reduce palette / quantize** uses **imagequant** (libimagequant `2.18.0`).
- **Rotate** uses a small local Rust module (`squoosh-rotate`) that runs before everything else.

These are documented in their own guides; they're listed here so you can see the full set of engines Presk ships.

## What "offline" means in practice

Presk uses a background **service worker** (`src/service-worker.ts`) so the deployed site can reload and keep working offline after the first successful load:

- The first time you visit the deployed site, it quietly **caches** the app shell and codec files your browser needs.
- After that, the app loads from that cache, so it opens fast and **keeps working with no connection**. Because the codecs are stored locally too, you can compress images on a plane or in a tunnel with no loss of capability.
- The cache is versioned (named `presk-${version}`), so when a new release ships, stale files are cleaned up automatically.

The service worker only activates on the **real deployed site**. During development, or on local "localhost"-style addresses, Presk deliberately _unregisters_ the worker and clears its cache so a leftover copy can't hijack another app sharing the same port. This is purely a developer safeguard and doesn't affect normal users (details in `src/lib/service-worker-registration.ts`).

## Tips & pitfalls

- **Privacy is structural, not a promise.** Because there is no server in the compression path, there is no upload to opt out of — your image physically cannot leave your device during compression.
- **Encoding speed depends on your browser and CPU, not on Presk settings alone.** A browser without thread/SIMD support will still produce identical output; it just takes longer. AVIF and JPEG XL are the most compute-heavy, so they feel slowest on older machines.
- **Newer formats aren't always safe to ship.** JPEG XL works, but it's newer and less universally supported by other apps and browsers, so prefer WebP or AVIF for files you need to share widely.
- **First offline use requires one online visit.** Offline reload can only work _after_ the service worker has cached the app, so open Presk online once before relying on it without a connection.

## Under the hood

Presk is a maintained Svelte fork of Google's Squoosh, and it reuses Squoosh's committed codec artifacts under `codecs/` rather than rebuilding them on every install — the project even records that there are roughly 80 committed JS/WASM artifacts, including baseline, threaded, SIMD, and Node-targeted builds (`docs/codec-provenance.md`). The single-image editor and future bulk helpers share one framework-neutral pipeline so both paths can produce the same results, with heavy work dispatched to a codec worker (`src/lib/compress.ts`). The recorded versions above are the _rebuild recipe inputs_; the provenance doc is candid that they document how each codec would be rebuilt rather than proving every shipped `.wasm` was generated from exactly those inputs.
