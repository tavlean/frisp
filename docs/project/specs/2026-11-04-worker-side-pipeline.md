# Spec: the worker-side pipeline (review change B)

Last updated: 2026-11-04.
Status: in progress 2026-11-04.

Change B of [../reports/2026-11-02-first-principles-review.md](../reports/2026-11-02-first-principles-review.md)
(July's open items P2(b), one composite worker op, and P2(c), decode in the
worker), approved by the maintainer on 2026-11-04 with the rest of the
review. Folds in two leftovers: the OxiPNG thread budget from change C, and
the bench re-capture owed since WebP's default moved to method 4
(`555def1c`).

## Objective

Every raster encode becomes one call into the codec worker. The worker
decodes the source itself (`createImageBitmap` plus `OffscreenCanvas`, or a
WASM decoder), keeps that decoded frame hot for the next call on the same
file, runs rotate, resize, grain, quantize, and encode inside the worker, and
replies with the encoded bytes plus, when asked, the decoded output as a
transferred `ImageData`. No full-frame structured clone crosses the worker
boundary on the encode path, and the main thread no longer decodes raster
sources or outputs. The step logic lives in one framework-neutral function
that a Node `worker_thread` runs over the committed `*_node_*` codec
artifacts, which proves the headless boundary without shipping a CLI.

## Non-goals

- No CLI, MCP, npm package, or anything under `packages/` changes.
- No change to codec builds, WASM files, `codecs/`, the asset manifest, or
  the service worker's precache list. The codec worker stays one module.
- No change to output bytes. Every bench size must match the before run.
- No `ImageBitmap` preview: the preview stays `ImageData` (transferred), so
  `Output.svelte`, the grain preview, and the three lab skins keep their
  types. Switching to `ImageBitmap` is a later, separate change.
- No AVIF or JXL thread budget: their pthread counts are fixed at build time
  (`emscripten_num_logical_cores()`); only OxiPNG's pool is runtime-sized.
- The SVG lane (SVGO worker) and SVG rasterization stay on the main thread:
  rasterizing an SVG needs the DOM.

## References

- Entry point: `src/lib/optimize-image.ts` (`optimizeImage`, `chooseLane`).
  Callers: `EditorSession.encodeSide` and `adoptResult` in
  `src/lib/editor/editor-session.svelte.ts`, `BulkRuntime.#processOne` in
  `src/lib/bulk/runtime.ts`.
- Today's step chain: `compressPreprocessed` and `transcodeJpegToJxl` in
  `src/lib/compress.ts`; `decodeImage`, `decodeSourceImage`,
  `preprocessImage`, `processImage` in
  `src/client/lazy-app/image-pipeline-shared.ts`; the per-encoder switch in
  `src/client/lazy-app/image-pipeline.ts`; `resize` in
  `src/features/processors/resize/client/runtime.ts` (browser and vector
  methods) and `worker/runtime.ts` (WASM methods).
- Worker: `src/worker/codec-worker.ts`; bridge:
  `src/lib/sveltekit-worker-bridge.ts` over
  `src/client/lazy-app/worker-bridge/runtime.ts` (serial queue per bridge;
  aborting the running call terminates the worker; 60 s idle reclaim).
- Style models: `src/lib/bulk/runtime.ts` (delegating to a neutral engine)
  and `src/lib/result-cache.ts` (small class with a memory-model header).
- Traps: `docs/gotchas.md` (bench cache, AVIF size vs core count, offline
  worker precache, bulk mock abort rule).
- Node artifacts: `codecs/*/{enc,dec}/*_node_*.{js,wasm}`. Verified
  2026-11-04: they are ESM factories; the older ones reference `require` and
  `__dirname` and try `fetch` for their WASM, so a Node loader must pass
  `wasmBinary` (the file bytes) and, for the factory call, define global
  `require` (from `createRequire`) and `__dirname` (the artifact's folder).
  `mozjpeg_node_dec` plus `webp_node_enc` decoded `photo.jpg` and encoded
  61,158 bytes of WebP that way.

## Design

### Data shapes

New framework-neutral module `src/client/lazy-app/pipeline-core.ts` (no DOM,
no `$lib`, no Svelte):

```ts
export interface PipelineSteps {
  rotate(image: ImageData, rotate: 90 | 180 | 270): Promise<ImageData>;
  /** WASM methods (triangle, catrom, mitchell, lanczos3, hqx) and
   *  'browser-pixelated'. Never 'vector' (main-thread only). */
  resize(image: ImageData, options: ResizeOptions): Promise<ImageData>;
  quantize(image: ImageData, options: QuantizeOptions): Promise<ImageData>;
  encode(image: ImageData, encoder: EncoderState): Promise<ArrayBuffer>;
}

/** Rotate an unrotated decoded frame. Rotation 0 returns `decoded` itself. */
export function prepareFrame(decoded, rotate, steps): Promise<ImageData>;

/** Resize (only when enabled and the target differs from the frame), grain
 *  (grainIsReal), quantize (enabled), then encode. Never mutates `prepared`. */
export function encodeFrame(prepared, processors, encoder, steps): Promise<ArrayBuffer>;
```

The step order and skip rules are exactly `processImage`'s today.

Lane choice moves to neutral `src/client/lazy-app/lane.ts`:
`chooseLane(file: { type: string; name: string }, recipe, source)`, same
rules as today; `src/lib/optimize-image.ts` re-exports it.

Worker op (in `codec-worker.ts`, typed in a new neutral
`src/client/lazy-app/worker-op.ts`):

```ts
export type WorkerSource =
  | { kind: 'file'; file: File }          // decoded in the worker
  | { kind: 'pixels'; image: ImageData }; // transferred in (SVG raster)

export interface OptimizeRequest {
  key: string;             // identity of the decoded source (see Cache)
  source?: WorkerSource;   // 'file' always sent; 'pixels' only on needs-source
  recipe: ImageRecipe;     // output.kind === 'raster'
  preview: boolean;        // decode the output back for the compare view
  threads: number;         // OxiPNG pool size for this worker
  urls: CodecUrls;         // every WASM URL group, as locateCodecWasm takes
}

export type OptimizeReply =
  | { kind: 'needs-source' }
  | {
      kind: 'encoded';
      bytes: ArrayBuffer;          // transferred
      preview?: ImageData;         // transferred, present iff preview
      decodedWidth: number;        // unrotated source size
      decodedHeight: number;
      preparedWidth: number;       // after rotation
      preparedHeight: number;
      transcodeFellBack: boolean;
    };

export interface PrepareRequest { source: WorkerSource; rotate: Rotation; urls: CodecUrls }
export interface PrepareReply { image: ImageData; decodedWidth: number; decodedHeight: number } // transferred
```

The worker also exposes `decodeOutput(file: Blob, urls): Promise<ImageData>`
(transferred) for `adoptResult`. `optimize`, `prepare`, and `decodeOutput`
are the only image ops the main thread calls once the cleanup phase lands.

Main-thread side, `optimizeImage(source, recipe, options)` keeps its name and
lane contract but takes:

```ts
export interface OptimizeSource {
  file: File;
  /** The rotated frame on the main thread, for the Original ('identity')
   *  output only. Editor supplies it; bulk never encodes identity. */
  prepared?: (rotate: Rotation) => Promise<ImageData>;
  /** SVG sources: the main-thread raster plus the element vector resize
   *  draws from. Defaults to rasterizing the file. */
  svg?: () => Promise<{ image: HTMLImageElement; raster: ImageData }>;
}
```

`CompressOutcome` loses `sourceImageData`: nothing renders it (verified by
grep on 2026-11-04: only `ResultCache` sizing and its constructors read it),
and keeping it would mean sending the processed frame back. `ResultCache`
counts `outputImageData` plus SVG text.

### Cache semantics (worker side)

- One entry per worker: `{ key, decoded, rotated?: { rotate, image } }`. A
  request with a different key replaces it, so a worker holds at most two
  frames (decoded plus one rotation).
- `key` is per `File` object: `sourceKey(file)` in a new
  `src/lib/source-key.ts`, a `WeakMap<File, string>` minting `src-1`,
  `src-2`, and so on. Reopening the same `File` object hits; a new file
  misses. SVG raster sources with a vector resize use
  `${sourceKey(file)}@vector:${w}x${h}:${fit}` since the pixels differ.
- `prepare` never touches the cache: it decodes, rotates, and transfers the
  frame itself (zero copy), because its caller keeps the frame.
- The cached frame is never transferred and never mutated. `crop` in
  `resize/worker/runtime.ts` currently rewrites its input buffer in place
  (`copyWithin`); it must copy first, or a contain-fit resize corrupts the
  hot source for the next call.

### Abort semantics

Unchanged at the bridge: aborting the running call terminates the worker,
which takes the cache with it. Every op is atomic from the caller's side. The
next call on a fresh worker decodes again ('file') or answers `needs-source`
('pixels'); the client wrapper then resends with the pixels (a copy it makes
and transfers). A call that was queued but not started is rejected without
terminating anything (existing queue behavior).

### Transfer ownership

- Reply `bytes` and `preview.data.buffer` are transferred; the worker keeps
  no reference.
- A 'pixels' source is a fresh copy the client makes and transfers; the
  worker owns it as its cache.
- A `File` is structured-cloned by reference (no byte copy).
- Verification: an e2e test patches `Worker.prototype.postMessage` before the
  app loads and fails if any main-to-worker message carries an
  `ArrayBuffer`, typed array, or `ImageData` of 64 KiB or more that is not in
  the transfer list. Worker replies build their transfer list in one helper
  (`replyTransfers`) with a unit test.

### Decode in the worker

`decodeInWorker(blob, urls)`: sniff the magic bytes (`sniffMimeType`, which
is worker-safe). QOI goes straight to WASM. AVIF, WebP, and JXL try
`createImageBitmap(blob)` and fall back to their WASM decoder when it
rejects. Everything else uses `createImageBitmap`. A bitmap is drawn to an
`OffscreenCanvas` 2D context, read with `getImageData`, then closed. Any
failure other than an abort surfaces as `Error("Couldn't decode image")` with
the cause attached, the message the editor shows today. Browser floors
(Chrome 121, Firefox 115, Safari 17) all have worker `createImageBitmap` and
2D `OffscreenCanvas`.

This tries native decode first where the main thread asked
`canDecodeImageType` (a `<picture>` probe that needs the DOM). Both answer
the same question; when native decode is missing the WASM decoder runs as
before.

### What stays on the main thread

- SVG rasterization (`processSvg`), the SVG lane, and vector resize. For an
  SVG source on a raster lane, the client sends 'pixels': the natural-size
  raster, or, when the resize method is `vector`, the vector rendered at the
  unrotated target size with the recipe's resize then disabled for that call.
- The grain scrub preview (it already runs on a main-thread frame).
- The Original side: `optimizeImage` returns the identity outcome from
  `source.prepared`, without a worker call.

### Editor wiring

`EditorSession` gets a third, lazily created bridge used only for `prepare`
and `decodeOutput`, under `#sourceAbort`. It is never queued behind an encode
and never terminated by an encode abort. `#preparedSource` becomes a cached
`prepare` call (one per load and rotation) that resolves the rotated frame
plus the decoded size; the encode path no longer awaits it except for the
identity output and SVG sources. `naturalWidth` and `naturalHeight` keep
coming from results (`preparedWidth`/`preparedHeight` map to the existing
`preprocessedWidth`/`preprocessedHeight` fields).

### Bulk wiring

`BulkRuntime.#processOne` stops decoding: it calls
`optimizeImage({ file: job.sourceFile }, recipe, { signal, bridge, preview: false })`.
Each slot's worker caches its current job's source and drops it when the slot
moves on.

### Thread budget

`new SvelteKitWorkerBridge({ threads })`; the bridge sends `threads` with
every op. The worker sizes OxiPNG's pool from the first threaded OxiPNG init
in its lifetime (a pool cannot resize). Editor bridges use
`navigator.hardwareConcurrency`. Bulk uses
`bulkThreadBudget(cores, slots) = Math.max(1, Math.floor(cores / slots))`
with two slots, exported from `src/lib/bulk/runtime.ts` and unit-tested.

### Node proof

- `tests/node/pipeline-worker.ts`: a `worker_thread` entry that polyfills
  `ImageData`, loads `mozjpeg_node_dec`, `webp_node_enc`, and
  `webp_node_dec` with the loader shim above, builds `PipelineSteps` from the
  same runtimes the browser worker uses (`createRotate`, `createResize`,
  given WASM bytes instead of URLs, and the WebP encoder runtime), then runs
  `prepareFrame` and `encodeFrame` and posts back the bytes and the
  re-decoded size.
- `tests/unit/node-pipeline.test.ts`: bundles that entry with Vite's `build`
  (SSR target, `appAliases` from `vite.config.ts`) into a temp folder, runs
  it in `new Worker(...)`, and asserts on the reply.
- Scope: `photo.jpg` (1024x683), rotate 90, resize lanczos3 to 342x512,
  grain amount 12, WebP at default options. Quantize and OxiPNG are out of
  scope (no Node build of imagequant or OxiPNG is committed).
- `createRotate` gains a bytes-or-URL loader so Node can pass file bytes.

## Phases (one concern per commit, straight to `main`)

1. `refactor`: neutral `pipeline-core.ts`, `lane.ts`, `worker-op.ts`; `crop`
   copies its input; `createRotate` takes a loader. Unit tests for
   `encodeFrame` order and skips with fake steps, and for non-mutation.
2. `feat(worker)`: worker `optimize`, `prepare`, `decodeOutput`, decode in
   the worker, the source cache, the thread budget plumbing; bridge methods
   and `src/lib/worker-pipeline.ts` (the needs-source retry).
3. `refactor`: `optimizeImage` runs through the worker op; editor and bulk
   switch; `sourceImageData` leaves `CompressOutcome`.
4. `feat(bulk)`: bulk thread budget.
5. `test`: the Node proof.
6. `test(e2e)`: the no-clone instrumentation test.
7. `refactor`: delete the dead main-thread chain (per-codec bridge and
   worker methods, `compressPreprocessed`, `transcodeJpegToJxl`, the
   `compressImage` switch, encoder `client/runtime.ts` files, `processImage`,
   `preprocessImage`, main-thread `decodeImage` fallbacks, the engine-level
   `bulk/processor.ts` and `bulk/runner.ts`, and the `/diagnostics` WebP
   pipeline probe that is their only caller). Skip any piece whose removal
   breaks the gate and record it.
8. `chore(bench)`: after run, compare, re-capture `benchmarks/baseline.json`.
9. `docs`: overview, build-and-runtime, brief, roadmap, worklog, gotchas,
   review execution table, this spec's status.

## Edge cases

| Input | Required behavior |
|---|---|
| Slider change mid-encode | Running op aborted, worker terminated; next op decodes again. Result identical. |
| New file | New key; the worker replaces its entry on the next op. |
| Same `File` reopened | Same key; cache hit on a live worker. |
| Undecodable file | Rejects `Couldn't decode image`; editor shows it as today. |
| JPEG that libjxl will not transcode | Worker encodes pixels instead; reply `transcodeFellBack: true`; snackbar as today. |
| SVG source, raster output | Main thread rasterizes; 'pixels' source on `needs-source`. |
| SVG source, vector resize | Pre-rendered at the unrotated target, resize disabled for the call, key carries the size. |
| SVG source, SVG output | Main-thread SVG lane, unchanged. |
| `preview: false` (bulk) | No output decode; no `preview` in the reply. |
| Identity side | No worker op; frame from `prepare`. |
| Contain-fit resize | Cached frame unchanged afterwards (unit test). |
| Resize to the frame's own size | Skipped, as today. |
| OffscreenCanvas missing | Rejects with a clear error (below the support floor). |
| Two bulk slots on OxiPNG | Each pool sized `max(1, floor(cores / 2))`. |

## Acceptance criteria

1. `npm run check` passes (0 errors).
2. `npm run test:unit` passes, including new tests for `encodeFrame`,
   `crop` non-mutation, `replyTransfers`, `bulkThreadBudget`, and the Node
   proof.
3. `npm run test:e2e` passes in both Playwright projects (Chromium, WebKit),
   including the new no-clone test.
4. `node benchmarks/compare.mjs benchmarks/results/before-change-b.json benchmarks/results/after-change-b.json`
   reports no size change for any codec and fixture, and its time column is
   quoted in the worklog.
5. `grep -rn "compressPreprocessed\|decodeSourceImage(" src` returns only
   the SVG rasterizer's use (or nothing), after phase 7.
6. The listed docs carry the new architecture with `Last updated: 2026-11-04`.

## Verification

```sh
npm run check
npm run test:unit
npm run test:e2e
BENCH_LABEL=after-change-b npm run bench
node benchmarks/compare.mjs benchmarks/results/before-change-b.json benchmarks/results/after-change-b.json
```

Pass means each exits 0 and the compare shows no size row marked worse.
`before-change-b.json` was captured on 2026-11-04 at `b437df36` on this Mac.

## Guardrails

- Never delete or move anything under `codecs/`, the codec asset manifest,
  or the WASM assets. Worker-chunk names must keep the `workers/<name>-`
  segment the precache manifest keys on.
- Keep the lab skins compiling and working: they read
  `runtime[n].result.outputImageData` and call `EditorSession`'s public API.
- `app:settings:v3` untouched.
- If any bench size changes, stop: the pipeline is supposed to be
  byte-identical. Find the step that diverged before going on.
- If worker `createImageBitmap` decode differs from today's main-thread
  decode on a fixture (a size change in the bench is the signal), keep the
  main-thread decode for that format and record it.
- Re-verify before starting: the bridge still terminates on abort; no lab
  skin reads `sourceImageData`; `crop` still mutates in place.
