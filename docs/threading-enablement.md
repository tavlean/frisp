# Threading Enablement (COOP/COEP) — Plan

Last updated: 2026-06-03. Status: **ALL THREE THREADED CODECS LANDED & VERIFIED —
oxipng, AVIF, JXL.** Each engages multi-core in both Chromium (full worker pool)
and WebKit/Safari, with single-thread fallback intact. oxipng (wasm-bindgen-rayon)
needed a shared-memory build fix; AVIF + JXL (Emscripten pthreads) needed a
`PTHREAD_POOL_SIZE` build fix + the `?url`/`mainScriptUrlOrBlob` JS wiring. Both
blockers are solved (see below). Cross-origin isolation was already DONE and
e2e-test-protected. Owner: solo. Priority: **high (performance) — essentially done.**

Read [STATUS.md](STATUS.md) for live state. This finishes a **parked migration
item**, it is not new greenfield work.

> **What landed & is VERIFIED (branch `codec-cleanup-and-threading`):**
> cross-origin isolation now actually activates. `static/_headers` carries
> COOP `same-origin` + COEP `require-corp` into the static output, and
> `svelte.config.js` excludes `static/_headers` from the SW precache manifest so
> `cache.addAll` won't 404 (commit `27ae8b88`). **The first attempt's
> `server.headers`/`preview.headers` did NOT work** — SvelteKit renders the page
> document itself and bypasses Vite's header config, so the document never became
> isolated. **Fixed in commit `09f08f22`** with a Vite plugin
> (`sqush-cross-origin-isolation`) that injects the pair via
> `configureServer`/`configurePreviewServer` middleware on every response.
> **Verified in the dev preview:** `self.crossOriginIsolated === true`,
> `SharedArrayBuffer` available, a shared `WebAssembly.Memory` constructs, no
> COEP-blocked resources, clean console, `npm run check` green. So
> `checkThreadsSupport()` will now return true.
>
> **Two seams still remain before threading is real in PRODUCTION:**
> 1. **Threaded helper-asset emission.** `audit:static-output` reports *"JPEG XL
>    threaded worker helper assets: 0"* and *"OxiPNG parallel worker helper
>    assets: 0"* — the production build does not yet emit the `_mt` /
>    `pkg-parallel` `.worker.js` + threaded `.wasm` helper assets, so when threads
>    engage the dynamic import of those builds may 404 in the static build (dev
>    resolves them on the fly; prod won't). This is the real remaining work.
> 2. **Cross-browser + encode confirmation.** Confirm each codec actually loads
>    its `_mt` module and a real encode uses multiple cores, across Chromium,
>    Safari (nested-worker gotcha), and Firefox.

## The finding (why this exists)

The app **already ships multithreaded codec variants** and already detects
thread support — AVIF, JPEG XL, and OxiPNG each call
`worker-shared/supports-wasm-threads` and load a `_mt` / `_mt_simd` /
`pkg-parallel` build when threads are available
(e.g. `src/features/encoders/oxiPNG/worker/oxipngEncode.ts` calls
`initThreadPool(navigator.hardwareConcurrency)`). (WebP 2 also shipped a `_mt`
build but was removed from the codec surface — see
[codec-surface-cleanup.md](codec-surface-cleanup.md).)

WASM threads require `SharedArrayBuffer`, which requires the page to be
**cross-origin isolated** via two response headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Upstream Squoosh sets these in `serve.json` (Jake Archibald, commit `58c09ff7`,
May 2021). The fork inherited it, then commit **`b6abdea0` "Promote SvelteKit
app to root" deleted `serve.json`** (−22 lines). The current build sets the
headers nowhere (`adapter-static`, no `_headers`, no Vite dev headers), so
`checkThreadsSupport()` returns false everywhere and every codec silently runs
its **single-threaded** build.

The migration team knew and deferred this on purpose — it is tracked as
*unproven* in `history/dashboard.html`, `history/road-map` notes, and the
seams audits. This plan closes it out.

## Why it matters

- **Biggest available performance win**, and free of any codec upgrade — AVIF /
  JXL / WebP 2 / OxiPNG go multi-core.
- This is how the app "uses Apple Silicon" properly: a browser app can't ship
  native ARM/NEON, but portable WASM SIMD + worker threads put an M-series
  machine's many cores to work. (Native-tier performance would require a
  Tauri/native wrapper — a separate product, not this plan.)
- **Prerequisite for the "encode to every format at once, compare sizes"
  feature** (see [road-map.md](road-map.md) → Multi-Format Compare).

## Plan

1. **Set the headers. — DONE (commit `27ae8b88`).**
   - Dev/preview: `vite.config.ts` sets `Cross-Origin-Opener-Policy: same-origin`
     + `Cross-Origin-Embedder-Policy: require-corp` on both the dev `server` and
     `preview`.
   - Production: `adapter-static` emits files, so headers are set at the **host**.
     `static/_headers` carries the same pair into the static output for
     Netlify/Cloudflare-style hosts (`svelte.config.js` excludes it from the SW
     precache manifest so it does not 404 in `cache.addAll`). If a host cannot set
     headers, fall back to the `coi-serviceworker` shim, but prefer real headers
     since the app already runs its own service worker.
2. **Verify isolation. — ✅ DONE & TEST-PROTECTED.** Verified in the production
   preview: `self.crossOriginIsolated === true`, `SharedArrayBuffer` available,
   shared `WebAssembly.Memory` constructs. The e2e suite
   (`tests/e2e/app-shell.spec.ts`) now **asserts `crossOriginIsolated === true`**,
   so a future regression (e.g. someone dropping the headers again) fails CI.
3. **Wire the multithread runtime. — DEFERRED (the real work; see below).**

## How multithreading is currently disabled (exact, code-grounded)

Re-reading the actual pipeline: this is **not** a missing-asset bug — the
SvelteKit code generator **deliberately disables** the threaded runtime. In
`scripts/sync-sveltekit-app.mjs` the generated worker hardcodes:

- AVIF: `createAvifEncoderRuntime({ supportsThreads: async () => false, … })`
- JPEG XL: `createJxlEncoderRuntime({ supportsThreads: async () => false,
  supportsSimd: async () => false, loadSingleThread: …, async loadMultiThread()
  { throw new Error('JPEG XL multithread runtime is unavailable in the SvelteKit
  app.') }, async loadMultiThreadSimd() { throw … } })`
- OxiPNG: `createOxiPngEncoderRuntime({ supportsThreads: async () => false, … })`

So even though `crossOriginIsolated` is now true, every encoder reports
`supportsThreads → false` and runs single-thread; the `_mt` / `pkg-parallel`
modules are never imported, so the build emits **only** single-thread assets
(confirmed: `build/` has `jxl_enc.wasm`, `avif_enc.wasm`,
`squoosh_oxipng_bg.wasm` — no `*_mt*`, no `workerHelpers`). `audit:static-output`
**asserts** these threaded assets are absent (e.g. "Expected no JPEG XL threaded
worker helper assets when the SvelteKit app injects the single-thread runtime").

This was a deliberate migration decision, almost certainly because Emscripten
pthreads + wasm-bindgen-rayon spawn **nested** workers (the codec already runs
inside a worker), and Safari historically can't do nested workers (see
`worker-shared/supports-wasm-threads.ts`), and the threaded `.worker.js` + wasm
URL resolution under SvelteKit static output was unproven.

## Re-enablement plan (per codec: avif, jxl, oxipng)

The data contract already supports it — `src/shared/codec-assets.ts` already has
the `multi-thread` variant, `worker-helper` role, and `threaded-only` cache. The
work is:

1. **Emit + map the threaded assets.** In the generator, add `?url` imports +
   `CodecAssetRecord`s (variant `multi-thread`, role `worker-helper`, cache
   `threaded-only`) for: `jxl_enc_mt(.worker).js` + `jxl_enc_mt_simd`, `avif_enc_mt(.worker)`,
   and oxipng `pkg-parallel` + its `snippets/.../workerHelpers.js`. Extend the
   generated `locateCodecWasm` map to resolve the threaded `.wasm`.
2. **Generate a threaded worker.** Replace the `supportsThreads: () => false`
   stubs with real detection (`worker-shared/supports-wasm-threads`) and implement
   `loadMultiThread`/`loadMultiThreadSimd` to instantiate the `_mt` modules with
   the injected threaded wasm URL **and** the `.worker.js`/`workerHelpers` URL
   (Emscripten `mainScriptUrlOrBlob` / wasm-bindgen-rayon `initThreadPool`).
3. **Service worker.** Cache the `threaded-only` assets at runtime (the cache type
   exists for exactly this) so offline still works once threads are used.
4. **Flip the audit.** Change the three `=== 0` asserts in
   `scripts/audit-static-output.mjs` to expect the threaded assets, and add their
   logical records to `expectedLogicalAssetRecords`.
5. **Verify.** `npm run test:e2e` must stay green (single-thread fallback intact),
   then confirm in an isolated browser that the `_mt` modules actually load (200,
   not 404) and a real encode runs threaded.

## Risks / watch-list

- **Nested workers + Safari — RESOLVED (2026-06-02).** This was THE make-or-break
  unknown and the reason the runtime was deferred. It is now **verified false**:
  `tests/e2e/threads-support.spec.ts` runs against **Playwright WebKit (Safari's
  exact engine, JavaScriptCore) as well as Chromium** and confirms that, inside a
  worker in the app's cross-origin-isolated context, both engines support
  `SharedArrayBuffer` + spawning a **nested** `Worker` + sharing that SAB via
  `Atomics` — exactly what wasm-bindgen-rayon / Emscripten pthreads need. (The
  historical Safari-16 nested-worker gap is gone in current Safari/WebKit.) So the
  engine capability is no longer a blocker; the remaining risk is purely the Vite
  pthread-URL resolution below. Still keep single-thread as the automatic fallback.
- **Emscripten pthread URL resolution under Vite static output** — the empirical
  hard part; expect iteration on the `.worker.js` / wasm URLs.
- `COEP: require-corp` rejects cross-origin subresources without CORP. Sqush is
  self-contained, so low risk — but audit any external asset before shipping.

## Effort

**Medium now — the scary part is gone.** The isolation foundation is done,
verified, and test-protected; and the **nested-worker-in-Safari make-or-break is
now verified working** (via Playwright WebKit — see Risks above), which was the
reason this was sized "Large / its own session." What remains is the mechanical
multi-file wiring (generator worker + asset records + `OxipngWasmUrls.multiThread`
in the bridge + audit flip + SW cache) and the one empirical unknown left: whether
wasm-bindgen-rayon's `new Worker(new URL('./workerHelpers.js', import.meta.url))`
resolves correctly under Vite's static output — testable in CI now that WebKit is
in the e2e matrix. Keep single-thread as the automatic fallback throughout.

## POC status (2026-06-03): oxipng MT threading RESOLVED & LANDED on `codec-rebuilds`

The full oxipng threaded runtime is wired, the shared-memory blocker is solved,
and threading is **verified engaging multi-core in both engines**. All the wiring
from the plan above WORKS:

- Generator (`sync-sveltekit-app.mjs`): emits the `oxipng:encoder:multi-thread`
  asset record (cache `threaded-only`, correctly excluded from precache), real
  `supportsThreads: checkThreadsSupport`, and `loadMultiThread` (dynamic import of
  `pkg-parallel` + `initThreadPool`). It copies `pkg-parallel/` + its
  `snippets/workerHelpers.js` + `package.json` into the generated tree (the last
  is required: workerHelpers does `import('../../..')`, resolved via `"main"`).
- Vite/rolldown **bundles the nested wasm-bindgen-rayon worker** —
  `workerHelpers-*.js` is emitted, the threaded `.wasm` is emitted, `npm run check`
  + the audit pass (audit now asserts 2 oxipng wasm assets + worker-helper assets
  present).
- Safety: the runtime falls back to single-thread if MT load throws, so oxipng
  never hard-fails. The single-thread `pkg/` stays non-shared and is the fallback.

### The fix — the threaded wasm now ships a SHARED + IMPORTED memory

The blocker was the threaded `pkg-parallel` wasm shipping a **non-shared**
`WebAssembly.Memory` (`flags=0x0`), so wasm-bindgen-rayon's `startWorkers` →
`postMessage(memory)` threw `DataCloneError: #<Memory> could not be cloned` and
every encode fell back to single-thread.

**Root cause:** on the *old* toolchains the canonical wasm-bindgen-rayon recipe
relied on `+atomics` auto-emitting a shared+imported memory at link (jSquash's
oxipng-parallel, on wasm-bindgen-rayon 1.2.1 / wasm-bindgen 0.2.92, still does
exactly this — bare `-C target-feature=+atomics,+bulk-memory`). On **current
nightlies that implicit behavior is gone**: `+atomics` alone emits a *non-shared*
memory, and you must pass the full linker set explicitly. The previous session's
dead-end (`--shared-memory --max-memory` → wasm-bindgen errors `failed to prepare
module for threading`) was an *incomplete* set — wasm-bindgen's threading pass also
needs the TLS-init + heap-base symbols **exported** so it can rewrite them.

The working `RUSTFLAGS` for the `pkg-parallel` build (in `codecs/oxipng/build.sh`):

```
-C target-feature=+atomics,+bulk-memory
-C link-arg=--shared-memory
-C link-arg=--max-memory=1073741824      # shared memory MUST declare a max (1 GiB = 16384 pages)
-C link-arg=--import-memory              # JS glue creates+supplies the shared memory
-C link-arg=--export=__wasm_init_tls
-C link-arg=--export=__tls_size
-C link-arg=--export=__tls_align
-C link-arg=--export=__tls_base
-C link-arg=--export=__heap_base         # wasm-bindgen injects per-thread stacks/ids here
```

plus `-Z build-std=panic_abort,std` (rebuild std with the same target-features) on
nightly. `+mutable-globals` was dropped (no longer required). Cargo.toml keeps
`wasm-opt = ["-O", "--no-validation"]` (jSquash's setting — preserves the shared
memory). The generated glue now creates
`new WebAssembly.Memory({initial:18, maximum:16384, shared:true})` and the wasm
imports it; parsing the memory confirms `flags=0x03` (shared + max). Symptom →
error map: missing TLS exports → `failed to prepare module for threading`; missing
`__heap_base` → `failed to find __heap_base for injecting thread id`.

### Verification (2026-06-03)

`npm run check` green; full e2e (`tests/e2e/`, **chromium + webkit**) green
(37 passed, the 1 skip is the pre-existing WebKit offline-SW skip). The new
`tests/e2e/oxipng-threads.spec.ts` asserts threading ENGAGES, not just that the
asset exists:

- **Chromium:** `hw=11, workers=11, requests=11, fallback=false` — 11 rayon
  worker-helper workers spawn (= all cores), no single-thread fallback.
- **WebKit:** `hw=8, workers=0, requests=1, fallback=false` — Playwright's WebKit
  doesn't surface *nested* workers to `page.on('worker')` (so the count reads 0),
  but the `workerHelpers` script IS fetched (engine-agnostic network signal) and
  there is **no fallback** — and because `initThreadPool` awaits every worker
  reaching `ready` before resolving (and the encode completes in ~2s, no timeout),
  the 8-thread pool genuinely built. Consistent with `threads-support.spec.ts`,
  which already proved WebKit does nested-worker + SAB + Atomics.

Build env (oxipng 10's libdeflate-sys C dep needs emsdk clang): `~/.cargo/bin`
first on PATH, `CC_wasm32_unknown_unknown=<emsdk>/upstream/bin/clang`,
`AR_wasm32_unknown_unknown=<emsdk>/upstream/bin/llvm-ar`,
`CPATH=<emsdk>/upstream/emscripten/cache/sysroot/include`. Full build engineering:
[codec-build-notes.md](codec-build-notes.md).

### AVIF + JXL (Emscripten pthreads) — LANDED 2026-06-03

Their `_mt` / `_mt_simd` variants are **Emscripten pthreads** (built with
`-pthread`), NOT wasm-bindgen-rayon — Emscripten infers shared memory from
`-pthread`, so the shared-memory fix above does **not** apply. Two pieces were
needed:

**1. JS-side wiring (the `?url` + `mainScriptUrlOrBlob` pattern).** The generator
now flips the `supportsThreads`/`loadMultiThread`(`Simd`) stubs to real detection
(`checkThreadsSupport` + `wasm-feature-detect`'s `simd`), emits the threaded
assets as `?url` records (wasm + `.worker.js` + the glue `.js`), and the audit
asserts them. Because the codec runs inside a worker and the assets are served from
hashed `?url` paths, the spawned pthread workers can't fall back to a relative
`./<codec>_mt.js` import — so `initEmscriptenModule` hands them the glue's `?url`
as **`Module.mainScriptUrlOrBlob`** (set by the generated `loadMultiThread` via a
global; the generated `locateCodecWasm` maps `<codec>_mt(.worker).js` →
`?url`). Also: `vite.config.ts`'s `assetsInlineLimit` must **not inline** the
`~2 kB` `*_mt(.worker).js` scripts (a `data:` URI worker breaks under COEP /
WebKit, and the audit + SW manifest expect real files).

**2. The codec build fix (`PTHREAD_POOL_SIZE`).** Wiring alone wasn't enough — the
encode **deadlocked**: init succeeds, but `module.encode()` (running synchronously
in the codec worker, blocking on `Atomics.wait`) tries to spawn pthreads
**on-demand** and can't, because the blocked worker can't process the new worker's
`loaded` message. The `_mt` builds had **no pre-spawned pool**. Fixed by rebuilding
the `_mt` wrappers with `-sPTHREAD_POOL_SIZE=navigator.hardwareConcurrency` (a
link-only flag — relink against cached `.a`s, keeping the original `-O3 -flto` +
`ALLOW_MEMORY_GROWTH` env flags). Full build detail:
[codec-build-notes.md](codec-build-notes.md).

**Diagnosis trail (how it was found):** the encode worked in the page context for
*init* but threw `Atomics.wait cannot be called in this context` on the main thread
(proving encode needs a worker); in a nested worker it hung after "factory resolved"
at "encoding" — pinpointing the on-demand pthread spawn during the blocking encode.

**Verified (2026-06-03):** `tests/e2e/emscripten-threads.spec.ts` (AVIF + JXL,
Chromium + WebKit). Chromium spawns the full pthread pool (11 workers each; JXL via
the SIMD variant), WebKit loads the threaded wasm with no fallback and no hang. The
single-thread builds remain the fallback. `oxipng-threading-wip` is superseded by
all of this landed work.

## Dev server (`vite dev`) — threaded workers must be served RAW (2026-06-03)

**Symptom.** Threaded AVIF/JXL were ~50× slower under `vite dev` (AVIF 24s+, often
appearing to hang) than in a production build (<0.5s) — on the *same commit*,
same machine, both cross-origin-isolated. A non-threaded codec (webP) was fast in
dev, which was the tell: only the pthread path was affected.

**This was misread as a commit regression — it is not.** The `8e2cb536..HEAD`
diff (live-version → HEAD) is docs + cosmetic `package.json` only; the codec /
worker / `vite.config` code is byte-identical to the fast live version, and a
local production build of HEAD encodes AVIF in <0.5s. The variable was **dev vs
prod**, not the commits. (Confusingly, the user had compared the *deployed prod*
site against a *local dev* server. A macOS-CI "failure" seen around the same time
was an unrelated `npm audit` DNS flake — `ENOTFOUND registry.npmjs.org` — not
code.)

**Root cause.** The Emscripten pthread workers (`avif_enc_mt.worker.js`,
`jxl_enc_mt(.worker).js`) are **classic** workers. Under `vite dev`, a direct
request for one of these `.js` files is run through Vite's JS transform, which
**prepends** an ESM preamble:

```
import { injectQuery as __vite__injectQuery } from "/@vite/client";"use strict";var Module={}…
```

A static `import` is a syntax error in a classic worker, so it throws on load.
Emscripten's glue then spawns its `PTHREAD_POOL_SIZE` workers, none come online,
and the encode (blocking on `Atomics.wait`) waits → stall. A `vite build` emits
these as raw hashed assets, so the bug is **dev-only** — which is exactly why it
never appeared in the deployed app or CI. (Confirmed against Vite #7019 / #15377
and Emscripten #22394; the ITK-Wasm and jSquash projects hit the same wall and
also serve the workers raw.)

**Fix (`vite.config.ts`, plugin `sqush-raw-threaded-codec-workers`).** A dev-only
`configureServer` middleware that serves `/codecs/**/*_mt(_simd)?.worker.js`
**raw from disk**, bypassing the transform — matching what the production build
already emits. It deliberately leaves the `?url` / `?worker` *module* forms to
Vite (those must return the JS that *exports* the asset URL, not the raw bytes),
and short-circuits before Vite's internal middleware (registered in the
`configureServer` body, not a returned post-hook). It's `configureServer`-only,
so `vite build` ignores it entirely (prod output unchanged), needs no new
dependency, and requires no per-developer setup — `npm run dev` "just works".

**Scope.** Only the Emscripten **classic** pthread workers need this. oxipng's
wasm-bindgen-rayon worker (`workerHelpers.js`) is a **module** worker, which
tolerates Vite's transform, and was already fast in dev — left untouched.

**Verified (2026-06-03):** after the fix, the dev server serves the worker
un-injected (starts with `"use strict";var Module={}…`), and AVIF / JXL encode in
<0.5s in `vite dev` (down from 24s+), with no console errors. This is the dev
counterpart to the prod-side `?url` / `mainScriptUrlOrBlob` wiring above; the
"Emscripten pthread URL resolution under Vite" watch-list item now covers BOTH
dev (raw-serve middleware) and prod (raw hashed emit).

## Related

- [codec-upgrade-audit.md](codec-upgrade-audit.md) — WASM framing; threading note.
- [road-map.md](road-map.md) — Multi-Format Compare feature (depends on this).
- Archived context: `history/sveltekit-migration-seams-exit-audit.md`,
  `history/dashboard.html`.
