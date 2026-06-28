# Engine & codecs reference

Code-derived inventory of the Sqush processing engine, processors/preprocessors,
and image codecs. Source of truth: `src/features/**` and `codecs/**`. Versions
and provenance come from `docs/codec-provenance.md` and the codec build recipes.

## Engine model

- **The image pipeline runs locally in the browser.** No server, no upload.
  The WASM decode/preprocess/process/encode paths run through the generated
  SvelteKit worker surface.
- **Threading is enabled (multi-core), with single-thread fallback.** AVIF,
  JPEG XL, and OxiPNG encode multi-core when the page is cross-origin-isolated
  (COOP/COEP via the `sqush-cross-origin-isolation` Vite plugin for dev/preview +
  `static/_headers` on the host), falling back to single-thread when threads /
  `SharedArrayBuffer` are unavailable. WebP runs a SIMD build. The production
  build emits the threaded helper assets, `audit:static-output` asserts them, and
  e2e (`oxipng-threads.spec.ts`, `emscripten-threads.spec.ts`) confirms real
  multi-core encode in Chromium + WebKit. See `docs/threading-enablement.md`.

## Processors & preprocessors

### Resize (`src/features/processors/resize`)

Options panel: `src/lib/editor/options/ResizeOptions.svelte`.
Shapes: `src/features/processors/resize/shared/meta.ts`,
`src/lib/editor/options/processor-types.ts`.

| Field            | Values / range                                                                               | Notes                                                                                                                                                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `method`         | `lanczos3` (default), `mitchell`, `catrom`, `triangle`, `hqx`, `browser-pixelated`, `vector` | Three families: worker (Rust `resize`/`hqx`), browser-canvas, vector. `catrom`/`triangle` are valid worker values kept for the code path (catrom finishes hqx) but not offered in the UI dropdown; the browser low/medium/high quality levels were removed. |
| `width`/`height` | int >= 1                                                                                     | Defaults to source size; aspect lock in UI (`maintainAspect`).                                                                                                                                                                                              |
| `fitMethod`      | `stretch` (default), `contain`                                                               | Only surfaced when aspect lock is off.                                                                                                                                                                                                                      |
| `premultiply`    | bool (default true)                                                                          | Worker methods only (premultiply alpha).                                                                                                                                                                                                                    |
| `linearRGB`      | bool (default true)                                                                          | Worker methods only (resize in linear light).                                                                                                                                                                                                               |

- **Worker methods** (`triangle`, `catrom`, `mitchell`, `lanczos3`, `hqx`) run
  in WASM and expose `premultiply` + `linearRGB`. Only `lanczos3`/`mitchell`/`hqx`
  are user-selectable; `catrom`/`triangle` stay in the set for the code path
  (catrom finishes an hqx pass) but aren't offered in the dropdown.
- **`hqx`** is the pixel-art scaler (Rust `hqx` crate / `squooshhqx`).
- **`browser-pixelated`** is the only browser scaler: canvas with smoothing off
  (nearest-neighbour). The smooth `imageSmoothingQuality` low/medium/high methods
  were removed (lower quality than the worker filters, inconsistent across browsers).
- **`vector`** rasterises an SVG source at the target size; only offered when the
  input is SVG (`isVector`).
- **Presets** (`resize/client/preset-state.ts`): `0.25, 0.5, 1`
  (shown as 25% / 50% / 100%), plus `custom`. Shrink-only by design — no enlarge
  presets (Sqush is an optimizer, not an upscaler); enlarging is reachable only
  by typing larger Width/Height values via `custom`.
- **Identity resize is skipped.** `processImage` only calls the resampler when the
  target dims differ from the (preprocessed) source — at 100% the default
  interpolating filters are a mathematical no-op. `editor-session.svelte.ts`
  mirrors this: a resize counts toward the encode signature / "Resizing" badge only
  when it changes the size, so enabling Resize at 100% (or toggling
  `premultiply`/`linearRGB` there) re-encodes nothing.

### Quantize / "Reduce palette" (`src/features/processors/quantize`)

Options panel: `src/lib/editor/options/QuantizeOptions.svelte`.
Shapes: `quantize/shared/meta.ts`, `processor-types.ts`.
Codec: imagequant (`codecs/imagequant/imagequant.*`).

| Field          | Range                | UI? | Notes                                |
| -------------- | -------------------- | --- | ------------------------------------ |
| `maxNumColors` | 2-256 (default 256)  | yes | "Colors" slider.                     |
| `dither`       | 0-1, step 0.01 (1.0) | yes | "Dithering" slider.                  |
| `zx`           | number (default 0)   | NO  | Hidden Konami/easter-egg; see below. |

- **Hidden `zx` (ZX Spectrum) easter-egg.** `quantize/worker/runtime.ts`: when
  `opts.zx` is truthy it calls `module.zx_quantize(...)` (a ZX-Spectrum-palette
  quantizer) instead of `module.quantize(...)`, ignoring `maxNumColors`. The
  Svelte panel deliberately **omits** the `zx` control (only the original
  React/Konami path toggled it). It survives in the data shape and worker only.

### Rotate (preprocessor, `src/features/preprocessors/rotate`)

Shape: `rotate/shared/meta.ts`. Runs **before** processing.

| Field    | Values                            | Notes                                             |
| -------- | --------------------------------- | ------------------------------------------------- |
| `rotate` | `0` (default), `90`, `180`, `270` | ~500B WASM module; grows memory to hold 2x image. |

## Codecs / libraries

WASM/JS artifacts live under `codecs/` (inherited from Squoosh; ~80 committed
JS/WASM artifacts). Each codec is wired through `src/features/{encoders,decoders}`.

| Codec / role           | Library (upstream)               | Version / commit (recorded locally)                             | Threads               | SIMD                    | App wiring                                                                                    |
| ---------------------- | -------------------------------- | --------------------------------------------------------------- | --------------------- | ----------------------- | --------------------------------------------------------------------------------------------- |
| WebP enc/dec           | libwebp (webmproject/libwebp)    | `v1.6.0`                                                        | no                    | yes (`webp_enc_simd`)   | enc+dec, `image/webp`                                                                         |
| AVIF enc/dec           | libavif + libaom (+ libsharpyuv) | libavif `v1.4.2`, libaom `v3.12.1`, libwebp `v1.6.0` (sharpyuv) | yes (`avif_enc_mt`)   | no                      | enc+dec, `image/avif`; engages multi-core, single-thread fallback                             |
| JPEG XL enc/dec        | libjxl                           | `v0.8.5`                                                        | yes (`jxl_enc_mt`)    | yes (`jxl_enc_mt_simd`) | enc+dec, menu "JPEG XL", `image/jxl`; engages multi-core, single-thread fallback              |
| MozJPEG enc            | mozilla/mozjpeg                  | `v4.1.5` (built `--with-build-date=squoosh`)                    | no                    | no                      | enc, menu "JPEG" (encoder in tooltip), `image/jpeg`                                           |
| OxiPNG enc             | oxipng (crates.io)               | `10.1.1` (normal + parallel wasm-pack)                          | parallel build exists | no                      | enc, menu "PNG" (encoder in tooltip), `image/png`; engages multi-core, single-thread fallback |
| imagequant (quantize)  | libimagequant (ImageOptim)       | `2.18.0` (`--disable-sse`)                                      | no                    | no                      | quantize processor                                                                            |
| resize (worker resize) | `resize` crate (crates.io)       | `0.8.9` (wrapper `squoosh-resize` 0.1.0)                        | no                    | no                      | resize processor                                                                              |
| hqx (pixel-art resize) | CryZe/wasmboy-rs `hqx` crate     | git tag `v0.1.3` (wrapper `squooshhqx` 0.1.0)                   | no                    | no                      | resize processor (`hqx` method)                                                               |
| QOI dec (enc unused)   | phoboslab/qoi                    | commit `8d35d93cdca85d2868246c2a8a80a1e2c16ba2a8`               | no                    | no                      | dec wired for import; encoder built but removed from `OUTPUT_FORMATS` (2026-06-27)            |
| rotate (preprocessor)  | local Rust (`squoosh-rotate`)    | local `0.1.0` (WABT `1.0.11` + `wasm-opt`)                      | no                    | no                      | rotate preprocessor                                                                           |

### Codec assets present but not wired as app features

- `codecs/*/*_node_*` — Node-targeted builds for codec tests/examples, not
  imported by browser features. (The dead `codecs/png/` Rust PNG helper and
  `codecs/visdif/` butteraugli visual-diff utility were deleted in the
  codec-cleanup pass; active PNG optimization uses OxiPNG.)
- The canvas/browser encoders (Browser JPEG/PNG/GIF) were removed entirely on
  2026-06-27 — see `docs/codec-surface-cleanup.md` §3.

### Product direction (per provenance doc)

Focused codec list under consideration: **WebP 1, AVIF, JPEG XL**. WebP 2 has been
removed (encoder + decoder); its `codecs/wp2/` tree and all wiring are gone.

## Offline / Service Worker

- **Service worker** (`src/service-worker.ts`): SvelteKit-native. Cache name
  `sqush-${version}`. On `install` it precaches `build + files + prerendered +
serviceWorkerCodecAssetUrls` (codec WASM/JS via
  `src/lib/service-worker-codec-assets.ts`, merged from generated
  `sqush-generated/service-worker/cache-plan` + local probe workers). Strategy:
  **cache-first for known asset pathnames, network-first (with cache fallback)**
  for everything else. On `activate` it deletes stale caches and claims clients.
  Result: offline reload on the deployed origin once cached.
- **Registration** (`src/lib/service-worker-registration.ts`): registers the SW
  **only on the real deployed origin**. In dev, and on any
  loopback/localhost-style origin running a production build, it instead
  **unregisters** any leftover worker and clears Cache Storage, then skips
  registration. This stops a stale cache-first worker from hijacking another app
  that reuses the same localhost port. Opt back in for local offline QA with
  `?sw` (persisted via `localStorage` key `sqush:force-localhost-sw`; `?sw=0`
  disables). Loopback detection covers `localhost`, `*.localhost`, `127.0.0.0/8`,
  `::1`, `0.0.0.0`.
