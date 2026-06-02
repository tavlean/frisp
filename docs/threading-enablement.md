# Threading Enablement (COOP/COEP) — Plan

Last updated: 2026-06-02. Status: **isolation VERIFIED working in dev — two seams
remain before it's done in production.** Owner: solo. Priority: **high (performance).**

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
2. **Verify isolation. — PENDING (needs a browser).** In the preview, confirm
   `self.crossOriginIsolated ===
   true` and `typeof SharedArrayBuffer !== 'undefined'`.
3. **Re-prove the three seams the migration flagged** (these are why it was
   deferred, not just the headers):
   - **Nested-worker loading** — the codecs run from inside a worker, and Safari
     historically lacked nested-worker support (see the comment in
     `supports-wasm-threads.ts`). Verify Safari path.
   - **Codec helper-asset URLs** — the `_mt` builds pull `.worker.js` + threaded
     `.wasm` helper assets; confirm they resolve under SvelteKit static output
     and the `?url` import strategy.
   - **Service-worker cache** — ensure the threaded worker/wasm assets are in the
     precache set so offline reload still works.
4. **Confirm each codec actually goes threaded** — use the diagnostics route and
   console to confirm AVIF/JXL/OxiPNG load their `_mt` module (not the baseline)
   and that encodes use multiple cores. (WebP 2 was removed from the codec
   surface — see [codec-surface-cleanup.md](codec-surface-cleanup.md) — so it is
   no longer in this list.)
5. **Cross-browser pass** — Chromium, Safari (nested-worker gotcha), Firefox.

## Risks / watch-list

- `COEP: require-corp` makes the page reject cross-origin subresources lacking
  CORP/`crossorigin`. Sqush is self-contained (local logo/icons), so low risk —
  but audit any external asset before shipping.
- Service-worker interaction: the SW must not strip the isolation headers and
  must cache the threaded helper assets.
- Keep the single-threaded builds as the automatic fallback (they already are) —
  isolation can fail on some hosts/browsers.

## Effort

Medium. Headers are trivial; the seam re-proofing (Safari nested workers, helper
asset URLs, SW cache) is the real work, and the migration team already scoped it.

## Related

- [codec-upgrade-audit.md](codec-upgrade-audit.md) — WASM framing; threading note.
- [road-map.md](road-map.md) — Multi-Format Compare feature (depends on this).
- Archived context: `history/sveltekit-migration-seams-exit-audit.md`,
  `history/dashboard.html`.
