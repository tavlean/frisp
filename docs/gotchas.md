# Gotchas

Last updated: 2026-11-10.

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
- **`vitest.config.ts` does not inherit `vite.config.ts`.** A standalone
  Vitest config takes full precedence, so anything a test's imports need must
  be set there too. Import aliases were the trap once: the two configs
  drifted, tests silently resolved nothing, and whole files stopped running
  (10 tests dropped, and an accidental `frisp-` prefix on bulk ZIP names went
  unseen for weeks). Since 2026-11-10 imports resolve through `package.json`
  subpath imports, which Vitest reads on its own, so that drift cannot recur.
  It still needs its own Svelte plugin (`svelte({ configFile: false })`) for
  tests to import `.svelte.ts` rune modules. Under Vitest's node environment
  those compile as the server build, so their effects never run: a unit test
  can exercise a rune class's methods and state, not its `$effect`s.
- **Subpath imports do no lookup.** Imports go through the `imports` field of
  `package.json` (`#lib/*`, `#client/*`, `#features/*`, `#shared/*`, `#sw/*`,
  `#worker-shared/*`, `#codecs/*`, `#app-generated/*`). Write the real
  extension (`#lib/compress.ts`, `#lib/bulk/store.svelte.ts`), name `index.ts`
  for a directory, and name the entry file of a `codecs/*/pkg` directory: a
  directory's own `package.json` is not read. One more reader of those
  specifiers is easy to miss: `scripts/audit-static-output.mjs` parses the
  import text of `src/shared/codec-assets/manifest.ts` and compares it with
  the manifest's record paths, so changing how that file imports breaks
  `audit:static-output` while the build and tests stay green.
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
- **`{@const}` stays until prettier-plugin-svelte can print its
  replacement.** The Svelte docs call `{@const}` legacy syntax, but the
  replacement, declaration tags (`{const x = $derived(...)}`, Svelte 5.56),
  cannot be used yet: prettier-plugin-svelte 4.0.1 cannot print it. The four
  `{@const}` tags in `src/lib/bulk/StackStage.svelte` stay until the plugin
  supports the new tag.

- **In a minified build, identifier names do not prove bundle membership.**
  The main page chunk keeps the string `optimizeSvgSide` at the dynamic-import
  call site, and option names such as `cleanupNumericValues` appear in a small
  main-bundle helper chunk, while SVGO itself stays in its lazy chunk. To check
  what a change pulled into the main bundle, build the previous commit too and
  compare chunk hashes and sizes, or fingerprint library-only strings.

## Runtime

- **`static/_headers` must stay out of the service-worker precache, and no
  local test can tell you it slipped in.** The host consumes the file and
  answers 404 for it, so a precache that lists it makes `cache.addAll` reject
  and the worker never installs: the deployed app silently loses offline.
  `vite preview` serves `_headers` like any file, so check, unit and the whole
  e2e suite stay green. SvelteKit 2 filtered it through the
  `serviceWorker.files` config option; SvelteKit 3 removed that option and
  lists every static file in `$app/manifest`, so `src/service-worker.ts` now
  drops it itself (`isHostOnlyFile`). Keep that filter through any SvelteKit
  upgrade.
- **Never read `page.state.editor` directly to decide whether the editor is
  open; ask `isEditorOpen()` in `src/lib/editor/editor-route.svelte.ts`.**
  `pushEditorRoute()` pushes the entry with
  `goto('', { state: { editor: true }, shallow: true })` (since 2026-11-10;
  SvelteKit 3 deprecated `pushState`). Like SvelteKit 3's `pushState`, that
  `goto` is async: it resolves the route first and writes `page.state` a few
  microtasks later. In that gap the route-sync effects in
  `src/routes/+page.svelte` saw an image with no editor state, took it for
  Back, and closed the image the moment it opened (and tore down a restored
  batch). Check, unit tests and the build all stayed green; only e2e caught
  it. `pushEditorRoute()` counts a push in flight as open.
- **A local `transition:` inside a component's own `{#if}` or `{#key}` never
  plays when a parent block creates the component.** Svelte plays a local
  transition only when the block that owns the element already existed, so
  ToggleRow's and OptionRow's `slide` prop never animated, and nothing failed.
  Put the transition on one element owned by the caller's block (as those two
  rows now do), or make it `|global` (as the snackbar does). New transitions
  go through `src/lib/editor/motion.ts` so they honor reduced motion: Svelte
  runs transitions in JS, which the CSS `prefers-reduced-motion` rules do not
  reach. `tests/e2e/motion.spec.ts` pins the reveal and the snackbar.
- **A `<svelte:boundary>` never sees the thrown Error.** SvelteKit 3 passes
  every error the boundary catches through `handleError` first, so `failed`
  and `onerror` receive an `App.Error`, with the message "Internal Error"
  unless `src/hooks.client.ts` returns the real one. That hook keeps the
  message and logs the error; defining it turns off SvelteKit's own logging,
  so keep the `console.error` there.
- **A scoped `.bar > *` rule does not match the root element of a child
  component.** Output's `.controls > *` and FocusView's `.stack-controls > *`
  turn pointer events back on for their own children only. A component
  extracted from such a bar must set what it needs itself, as
  `src/lib/editor/output/ViewOptions.svelte` sets its own `pointer-events`;
  otherwise its buttons silently ignore clicks.

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
- **`src/lib/svg/optimize.ts` must only ever be dynamic-imported.** A static import
  pulls SVGO into the main bundle. An audit tripwire asserts it stays
  worker-side.
- **SvelteKit's service-worker file list does not reliably cover the worker
  chunks Vite emits for `new Worker(new URL(...))`** (codec worker, SVG
  optimizer worker, OxiPNG thread helper). When this was found, none were
  listed: the codec WASM was precached but no worker could load it, so a first
  offline encode of any image failed until an online encode had fetched the
  worker, and an old SVG-worker exclusion keyed on the list never matched
  anything. Fixed 2026-11-04: the `app-worker-precache-manifest` plugin in
  `vite.config.ts` writes `_app/worker-precache.json`, the service worker
  precaches it at install, and `audit:static-output` fails if the list and the
  emitted workers disagree. With SvelteKit 3.1.1 and Vite 8.3.7 the two worker
  entry chunks do appear in `immutable`, but the thread helper, a chunk loaded
  from inside a worker, still does not. Keep the plugin: what the list holds
  depends on the Vite manifest shape, and a gap fails silently. Chunk names
  are hash-only, so anything that matches
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

- **A new select inside an encoder panel must not carry `builtin-select`.**
  Many e2e specs (and the lab skins' CSS) find a panel's setting selects as
  `select.builtin-select`, several expecting exactly one per panel
  (`left-panel.spec.ts` counts them; `codec-encode.spec.ts` uses the right
  panel's only one). The Auto select therefore uses `<Select action>`, which
  drops the class. Adding a plain `<Select>` to an always-visible panel row
  breaks specs far from the change with strict-mode violations.

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
- **SSIMULACRA2 at full size costs more than the encode it judges.** At
  12 MP the metric took about 3 s per call in the worker against a 0.9 to
  1.4 s WebP encode, so a time-boxed auto-quality search fit two probes.
  Above 4 MP the metric now scores four full-resolution tiles and keeps the
  worst (`src/worker/score-scale.ts`); anything new that scores large frames
  should go through `scorePairs` too.
- **Never judge codec artifacts on a shrunk frame.** Box-shrinking both
  frames alike looks fair but averages blocking and ringing away before the
  metric sees them: jpegli at quality 24 on the 12 MP fixture scored 70.4
  shrunk 2x against 55.3 at full size, so Auto chose visibly blocky JPEGs.
  Sample at full resolution instead (tiles), and keep the worst tile rather
  than pooling them into a mosaic, which scores near their average.
- **Auto probes substitute `quality` alone, not what the panel would
  write.** A panel's `apply()` can couple other fields to quality (JXL forces
  `lossyModular` below 7). A probe in that zone scores an encode the slider
  never produces, so `AUTO_QUALITY_BOUNDS` must stop short of every such
  coupling, the same way it stops short of a lossless switch at 100. Check
  the panel's `apply()` before adding a codec's bounds.
- **To find what triggers a redundant encode, put `$inspect.trace('label')`
  as the first statement of the method body**, not in the one-line effect
  arrow that calls it. In `src/lib/editor/editor-session.svelte.ts` that means
  inside `encodeSide`, `updateGrainPreview` or `watchHistory`: the arrow
  `$effect(() => this.encodeSide(index))` reads nothing itself, so a trace
  there reports nothing useful.
- **The `photo-large` bench fixture is a single cold run.** Treat it as a
  regression signal, never as a timing measurement.
- **The SVG auto gate deliberately upscales small sources.** Precision loss that
  is invisible at 24px is obvious at 256px.

## Environment and process

- **Playwright's `getByLabel(text, { exact: true })` cannot find a native
  `<select>` wrapped in its `<label>`.** The label's text content includes
  every option's text, so the exact match fails and the test times out
  waiting. Use `getByRole('combobox', { name, exact: true })`, which reads
  the computed accessible name.

- **Dimensionless SVGs** with no `width`, `height`, or `viewBox` are rejected by
  the inherited import contract. They surface as errors in the benchmark and are
  not losses; count them separately.
- **After merging lab branches while `vite dev` is running, the open page can
  hold stale HMR modules**: deleted-file import errors and mixed-theme surfaces.
  Hard-reload before diagnosing anything.
- **Worktree agents need `ln -s <main>/node_modules` and a widened
  `server.fs.allow`** to run the dev server, because the symlink resolves outside
  the default allow-list.
- **A git worktree nested inside the main checkout depends on the main
  checkout's install.** The build looks up a tsconfig for
  `src/service-worker.ts`, which the root `tsconfig.json` excludes, so the
  lookup walks up past the worktree into the parent checkout's `tsconfig.json`.
  If `node_modules/$app` is missing there, the build fails with "Tsconfig not
  found $app/tsconfig". Run `npm ci` and `npx svelte-kit sync` in the main
  checkout.
- **In a fresh checkout or worktree, run `npm run sync` before `vite dev`.**
  Without the generated codec wrappers the page loads, but every encode hangs
  with no console error. `npm run build` and `npm run typecheck` run `sync`
  themselves; `npm run dev` does not.
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
- **A Playwright check made after an action can miss a 200 to 300 ms
  transition.** By the time Playwright's own round trips return, the
  animation may be over and the test reads "no animation". Start watching for
  the element in the page before the action that inserts it, as
  `animationsOnArrival` in `tests/e2e/motion.spec.ts` does.
- **In zsh, an unquoted `grep --include=*.svelte` matches nothing.** zsh expands
  the glob itself or errors with "no matches found", so the search returns
  nothing and looks like proof a symbol is unused. Quote the glob:
  `--include='*.svelte'`.
- **Cloudflare's Browser Cache TTL must stay on "Respect Existing Headers".**
  Anything else overrides the app's own cache headers and serves stale assets.
- **Unknown URLs need the `404.html` fallback, not `index.html`.**
  `index.html` uses relative asset paths, so served for a nested unknown URL
  (`/a/b`) it loads a blank page, and serving it for everything answers 200.
  Since 2026-11-10 the adapter emits `404.html` (absolute paths) and
  `wrangler.jsonc` sets `not_found_handling: "404-page"`; details in
  [build-and-runtime.md](build-and-runtime.md#sveltekit-config). `_headers`
  and `_redirects` work as they did on Pages.
- **Local `wrangler dev` needs a compatibility date override.** The installed
  wrangler 4.98's workerd rejects this project's `compatibility_date`, so pass
  `--compatibility-date 2026-06-10` on the command line. It also writes a
  `.wrangler/` folder into the repo, which is not gitignored; do not commit it.
- **`page.setInputFiles` cannot mix file paths and buffers in one call.** It
  throws "File paths cannot be mixed with buffers". For a batch that needs an
  inline buffer (an SVG string, say), read the path fixtures with
  `readFileSync` and pass everything as buffers.
- **A long-running `vite preview` keeps the SvelteKit manifest it loaded at
  startup.** After a rebuild it serves HTML that points at deleted chunks: a
  blank page with 404s on `entry/start` and `entry/app`. Restart the preview
  after every build.
