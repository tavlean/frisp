# Gotchas

Last updated: 2026-11-04.

Traps that fail **silently**: the build stays green, the tests stay green, and
the damage shows up later. Loud failures are deliberately absent because the
tools already teach those. A gotcha's best home is a comment next to the code;
this doc holds the cross-cutting ones that no single file owns.

## Build and bundle

- **A `{#if dev}` template guard does NOT keep a statically imported component
  out of the production bundle.** Dev-only routes still emit and precache their
  chunks. Only the build-time `app-strip-dev-only-routes` plugin (or a
  `dev`-gated dynamic import that dead-code elimination can drop) removes them.
  `npm run audit:static-output` is the tripwire; keep it passing.
- **`vitest.config.ts` does not inherit `vite.config.ts` aliases.** It imports
  the exported `appAliases`. If the two drift, tests silently resolve nothing and
  whole files stop running. This already happened once and hid a real bug for
  weeks (10 tests dropped, an accidental `frisp-` prefix on bulk ZIP names).
- **`PLAYWRIGHT_SKIP_BUILD=1` serves whatever is already in `build/`.** Set it
  only immediately after a `check` or `build`; a stale `build/` tests old code
  and passes.
- **`wasm-bindgen` bakes Rust crate names into the `.wasm` import strings.** The
  `squoosh_*` codec artifacts cannot be renamed without a rebuild, and a green
  build proves nothing here. Only the e2e suite catches it.
- **Adding or removing an output format breaks a hard-coded count in the e2e
  suite.** The left panel's "Compare as…" popover renders `OUTPUT_FORMATS` one
  for one, and `tests/e2e/left-panel.spec.ts` asserts the number of
  `.compare-option` buttons (5 since jpegli became the one JPEG on 2026-11-04).
  It is a loud failure once you run e2e, but it is nowhere near the codec you
  changed, and `check` plus unit tests both stay green. Update the count in the
  same commit.
- **Importing a `?worker&url` module from a module the production bundle
  imports emits that worker into every build.** Putting a dev-only probe URL in
  a shared module such as `src/lib/codec-assets.ts` ships the probe worker to
  production even though nothing there runs it. Keep dev-only probe URLs inside
  the probe module itself; `audit:static-output` fails if a probe worker is
  emitted.
- **Markdown is never auto-formatted.** The Prettier globs and the pre-commit
  hook glob both exclude `*.md` on purpose, and `proseWrap: always` is banned.
  Adding Markdown back reflows every hand-wrapped doc in one commit.

- **In a minified build, identifier names do not prove bundle membership.**
  The main page chunk keeps the string `optimizeSvgSide` at the dynamic-import
  call site, and option names such as `cleanupNumericValues` appear in a small
  main-bundle helper chunk, while SVGO itself stays in its lazy chunk. To check
  what a change pulled into the main bundle, build the previous commit too and
  compare chunk hashes and sizes, or fingerprint library-only strings.

## Runtime

- **A codec can silently change the output's resolution.** libjxl downsamples 2x
  on its own once the requested butteraugli distance crosses a threshold, and
  v0.9 moved that threshold from 20 to 10, which quietly put the bottom of
  Frisp's quality slider into the downsampling zone. The file still decodes back
  to the original dimensions, so nothing throws and the e2e magic-byte and
  size checks all pass; the image is just soft. `codecs/jxl` now pins
  `JXL_ENC_FRAME_SETTING_RESAMPLING = 1`. **Resolution is the resize control's
  job, never a side effect of a quality setting.** Worth checking whenever a
  codec is upgraded, since the only reliable detector is decoding the output and
  comparing dimensions.
- **`requestAnimationFrame` never fires in a non-compositing context** such as a
  headless e2e run or a background tab. Never use it to schedule state work; use
  a latest-wins drain loop with `setTimeout` yields. This was hit live while
  verifying the grain scrub preview.
- **`pinch-zoom` transforms every child** via a `pinch-zoom > *` rule, not just
  the first. Overlays that must not be pinched opt out with
  `data-pinch-overlay`.
- **`$lib/svg/optimize` must only ever be dynamic-imported.** A static import
  pulls SVGO into the main bundle. An audit tripwire asserts it stays
  worker-side.
- **SvelteKit's service-worker `build` list omits the worker chunks Vite emits
  for `new Worker(new URL(...))`** (codec worker, SVG optimizer worker, OxiPNG
  thread helper). The codec WASM was precached but no worker could load it, so a
  first offline encode of any image failed until an online encode had fetched the
  worker, and an old SVG-worker exclusion keyed on `build` never matched
  anything. Fixed 2026-11-04: the `app-worker-precache-manifest` plugin in
  `vite.config.ts` writes `_app/worker-precache.json`, the service worker
  precaches it at install, and `audit:static-output` fails if the list and the
  emitted workers disagree. Chunk names are hash-only, so anything that matches
  a worker must key on the stable `workers/<name>-` path segment.
- **Changing a codec default does not reach existing users.** `app:settings:v3`
  stores each side's full options object, so a side autosaved under the old
  default keeps the old value until the user changes it. Seen with WebP Effort:
  the default went from 6 back to 4 on 2026-11-04, and autosaved sides stay at 6.
  The storage format is frozen, so this cannot be fixed by rewriting stored
  values; account for it when reasoning about what users actually run.
- **WebKit hands out drop items whose `webkitGetAsEntry().file()` rejects** with
  `NotFoundError` even when `getAsFile()` works. Read plain files synchronously
  via `getAsFile`; use the async entry walk for directories only. An entry-first
  read turns such drops into a silent no-op.
- **Web Share needs `files` alone.** WebKit drops the file if `text` or `url`
  ride along, `share()` must be called straight from the tap before the user
  activation expires, and the download name has to be carried onto the shared
  `File`.
- **Svelte 5 flushes class bindings asynchronously.** A `getComputedStyle` sweep
  taken immediately after a state change reads the previous frame.

- **A codec-worker step must never write to its input frame.** The worker
  keeps the decoded source between calls (`src/worker/pipeline-op.ts`), so a
  step that edits its input in place corrupts every later encode of that file,
  and the first encode still looks right. The WASM resize's contain-fit `crop`
  did exactly that with `copyWithin` until 2026-11-04; it was harmless only
  while each step got its own structured clone. `pipeline-core.test.ts` pins
  the rule for crop and grain.
- **Spreading a request object drops its Comlink transfer marker.**
  `transfer(obj, list)` remembers `obj` itself, so a bridge override that
  builds `{ ...request, urls }` sends the pixels as a structured clone and
  nothing fails. That is why the codec URLs and thread count travel as a
  separate `WorkerContext` argument. `tests/e2e/worker-pipeline.spec.ts`
  catches a regression.
- **Aborting an encode terminates its worker, cache included.** WASM cannot be
  interrupted, so the bridge kills the worker; the next call decodes the file
  again. Cheap for a JPEG, but each rapid slider change during a long encode
  costs a decode, and an SVG source has to resend its pixels (`needs-source`).

- **Anything placed in an `EditorSession` `ResultCache` must use a URL the cache
  owns.** The cache revokes an entry's object URL on eviction and on `clear()`
  (every new file). Handing it another owner's URL, such as a bulk output's
  `downloadUrl`, silently breaks that owner's download later. Mint a fresh
  URL for the cache, as `adoptResult` does.

## Measurement

- **Any repeat encode of the same recipe in one page session is a `ResultCache`
  hit**, not an encode: it returns in ~9ms. The codec benchmark used to time
  exactly that. It now takes a fresh page session per measured run and warms the
  WASM module on the left side first (`benchmarks/README.md` has the shape);
  anything else that times an encode has to do the same or it is timing the
  cache.
- **AVIF output size depends on the core count.** `avif_enc.cpp` sets
  `maxThreads` from `emscripten_num_logical_cores()`, and libaom partitions the
  frame differently per thread count, so the bytes differ across machines and
  moved the day threading actually engaged (`e9b1be6c`). Every other codec
  reproduced to the byte across that change. Compare AVIF sizes only against a
  same-machine baseline.
- **A stale benchmark baseline reads as a codec regression.** The 2026-06-02
  baseline survived a WebP default change (`e184882f`, quality 75 to 80 and
  method 4 to 6) and AVIF threading engaging (`e9b1be6c`) without being
  re-captured, so the next run looked like WebP had regressed 6 to 22 percent
  when nothing had regressed at all. Re-capture the baseline in the same commit
  that changes a default, a codec build, or the harness.
- **The `photo-large` bench fixture is a single cold run.** Treat it as a
  regression signal, never as a timing measurement.
- **The SVG auto gate deliberately upscales small sources.** Precision loss that
  is invisible at 24px is obvious at 256px.

## Environment and process

- **Dimensionless SVGs** with no `width`, `height`, or `viewBox` are rejected by
  the inherited import contract. They surface as errors in the benchmark and are
  not losses; count them separately.
- **After merging lab branches while `vite dev` is running, the open page can
  hold stale HMR modules**: deleted-file import errors and mixed-theme surfaces.
  Hard-reload before diagnosing anything.
- **Worktree agents need `ln -s <main>/node_modules` and a widened
  `server.fs.allow`** to run the dev server, because the symlink resolves outside
  the default allow-list.
- **`git add <dir>` while a parallel agent is editing that directory stages its
  half-finished work under your commit message.** `git add src` takes whatever is
  on disk at that instant, not what you reviewed a moment earlier, so a diff you
  checked and then staged are two different things. The commit succeeds and its
  message is now false. Either commit before delegating, wait for the agent to
  report, or stage explicit file paths and re-read the staged diff with
  `git diff --cached` before committing.
- **Do not diagnose a lost edit from file mtimes.** A file whose changes were
  absorbed into someone else's commit looks byte-identical to one whose changes
  were reverted: `git status` reads clean in both cases. Check
  `git show <commit> -- <file>` before re-applying anything, or you will redo work
  that already landed.
- **`codex exec` inside a compound background command must end with
  `</dev/null`.** Otherwise stdin never closes and it hangs at "Reading
  additional input from stdin".
- **A sandboxed shell cannot bind the Playwright preview-server port.** Run e2e
  outside the sandbox.
- **The older `*_node_*` codec artifacts do not load from plain ESM Node.**
  Their Emscripten glue reads `require` and `__dirname` as free variables and
  tries `fetch` on a file path, which Node's fetch rejects. Pass the WASM bytes
  as `wasmBinary` and define global `require` and `__dirname` around the
  factory call, as `tests/node/pipeline-worker.ts` does. Only the WebP node
  artifacts are new enough to need neither.
- **Playwright's Chromium headless shell must be installed for e2e.** Without
  it (`npx playwright install chromium`), every Chromium test fails at browser
  launch, which reads like a broken app rather than a missing browser.
- **Playwright `context.setOffline(true)` does not cut the network for
  dedicated workers in Chromium.** A worker's fetch still succeeds, so an
  "offline" test passes even when offline is broken. Also abort every request
  with `context.route('**/*', (r) => r.abort('internetdisconnected'))`, as
  `tests/e2e/export-contract.spec.ts` does.
- **In zsh, an unquoted `grep --include=*.svelte` matches nothing.** zsh expands
  the glob itself or errors with "no matches found", so the search returns
  nothing and looks like proof a symbol is unused. Quote the glob:
  `--include='*.svelte'`.
- **Cloudflare's Browser Cache TTL must stay on "Respect Existing Headers".**
  Anything else overrides the app's own cache headers and serves stale assets.
- **Workers static assets serve the SPA fallback via `not_found_handling`**
  returning `/index.html`, so the adapter's `200.html` ships unused. `_headers`
  and `_redirects` work as they did on Pages.
- **`page.setInputFiles` cannot mix file paths and buffers in one call.** It
  throws "File paths cannot be mixed with buffers". For a batch that needs an
  inline buffer (an SVG string, say), read the path fixtures with
  `readFileSync` and pass everything as buffers.
- **A long-running `vite preview` keeps the SvelteKit manifest it loaded at
  startup.** After a rebuild it serves HTML that points at deleted chunks: a
  blank page with 404s on `entry/start` and `entry/app`. Restart the preview
  after every build.
