# Roadmap

Last updated: 2026-11-04.

The plan and its status, highest priority first. Product direction and
engineering tracks in one list, because they compete for the same time.
[brief.md](brief.md) has the current state and the open questions;
[issue-list.md](issue-list.md) holds small fixes that need no plan.

## Principles

1. Preserve the single-image workflow before adding modes.
2. Prefer framework-neutral helpers and measured browser behavior over UI-only
   prototypes.
3. Keep heavy browser objects (`File`, `Blob`, `ImageData`, workers, WASM, object
   URLs) out of broad app state unless there is a measured reason.
4. Hide or de-emphasize product surface before deleting codec or runtime code.
   Deletion is a separate engineering decision that needs build output, generated
   metadata, workers, WASM assets, service-worker caching, and browser QA to
   prove it is safe.
5. Treat large features as design plus prototype plus verification, never as
   cleanup.

## Now

The 2026-11-02 first-principles review set this order, and the maintainer
confirmed it on 2026-11-04 (keep the lab skins and the desktop direction;
everything else proceeds). Its trust fixes landed the same day; the
structural changes below come next. Full reasoning and the execution table:
[reports/2026-11-02-first-principles-review.md](reports/2026-11-02-first-principles-review.md).

- [ ] **One recipe and one result owner per image (review change A).** One
      typed recipe covering rotation, processors, and output kind (raster
      codec, SVG optimize, or JPEG to JXL transcode), and one source-aware
      operation that runs it. Bulk schedules recipes; the focused editor
      previews the same result; the seeding bridge in `BulkMode.svelte` stops
      translating between two models. Lifts the two `fixme` tests in
      `tests/e2e/export-contract.spec.ts` (rotation in bulk, SVG batches).
- [ ] **Worker-side pipeline (review change B).** One worker op keeps the
      decoded source hot and runs every step, returning bytes plus a
      transferable preview. Closes the 2026-07-07 review's P2(b) and P2(c), and
      proves one Node operation for the headless core.
- [ ] **Bulk resource budget (review change C).** Bound thumbnail decodes,
      cap historical outputs by bytes, budget codec threads against concurrent
      jobs, and publish a supported batch size.

## Next

- [ ] **Auto-quality on one codec, then outcome-first defaults (review change
      D).** The spec below, proven on one codec first, with its two gaps fixed
      (alpha is ignored; up to eight encodes per search needs a latency budget
      and an honest "target not met"). Then named targets become the primary
      control and codec knobs move under Advanced.
- [ ] **Retire the MozJPEG codec and the QOI encoder.** Neither is selectable
      (MozJPEG since 2026-11-04, QOI encode since 2026-06-27) and neither is
      precached; their worker, bridge, meta, controls, and panel code remain.
      Codec deletion needs the e2e suite, per AGENTS.md.
- [ ] **Close the SVG benchmark (stage S8).** The ImageOptim and nano legs are
      measured; finish the Frisp run and publish with its limitations, per
      [specs/2026-07-12-svg-optimization.md](specs/2026-07-12-svg-optimization.md).
      Note that Auto now keeps the original when no candidate passes its gate,
      which changes Frisp's numbers on gate-failing files.
- [ ] **Pick an editor re-style direction.** Three finished skins wait on a
      look-and-choose decision; the maintainer revisits the UI soon. Registry:
      [../lab.md](../lab.md).
- [ ] **Codec options model, minimal slice.** Shrinks once auto-quality makes
      targets primary: only the Advanced controls need the registry. Analysis
      in [../codec-options-model.md](../codec-options-model.md).
- [ ] **Bulk Phase 3, overrides polish.** Lands inside change A's recipe
      rather than on today's sparse per-leaf overrides. Control tables:
      [specs/2026-07-07-ws-g-control-inventory.md](specs/2026-07-07-ws-g-control-inventory.md).
- [ ] **Keyboard control.** Figma-style single-key actions plus Photoshop-style
      digit entry for Quality. The proposal at
      [../keyboard-control.md](../keyboard-control.md) has five open decisions.

## The 2026-07 codec batch

Maintainer-approved on 2026-07-11. The libjxl 0.12 upgrade that gated this
batch landed on 2026-08-08, so every item below is unblocked; run them in this
order. Each spec is executable by an agent with no access to the deciding
conversation.

- [ ] **Auto-quality mode.** A one-shot Auto action on every lossy panel that
      bisects quality until the output meets an SSIMULACRA2 target, powered by a
      new `codecs/ssimulacra2` module. This is the app-level intelligence layer on
      top of the codecs, and per the 2026-08-08 product thesis in
      [brief.md](brief.md) the shared brain of both product surfaces.
      [specs/2026-07-11-auto-quality-mode.md](specs/2026-07-11-auto-quality-mode.md)
- [ ] **Fold in rename Phase B** while codecs are being rebuilt anyway: the
      `squoosh_*` crate names are baked into the WASM import strings and can only
      change with a rebuild. [../rename-record.md](../rename-record.md)

## After the batch

- [ ] **Find smaller (format race).** An explicit action, not an automatic
      pass on every import: encode across WebP, AVIF, JXL, JPEG, and PNG in
      parallel workers within a compatibility profile and time and memory
      limits, and present size against quality so the user picks by result.
      Needs change C's resource budget first (2026-11-02 review).
- [ ] **Frisp headless core and CLI.** Target-driven, metric-verified,
      agent-first, reusing the existing `*_node_*` codec artifacts, the pure
      bulk engine, and the auto-quality engine. The go decision was settled by
      the 2026-08-08 product thesis in [brief.md](brief.md): agents are a
      primary interface, so the headless surface is core product, not a side
      bet. Ship it as a library plus a thin CLI (on servers, workers, and CI
      the library is the interface), with agent-grade help, NDJSON, and an MCP
      adapter per the analysis. Surface policy (maintainer, 2026-08-08):
      prefer the most universal surface that reaches the most agents, and add
      adapters only where they clearly pay for themselves, keeping the
      maintained surface count low. Two design questions (the Node decode
      path, the format-race policy) come before a spec.
      [../frisp-cli-analysis.md](../frisp-cli-analysis.md)
      Timing (2026-11-02 review, maintainer 2026-11-04): change B proves one
      Node operation inside the worker-side pipeline, so the boundary stays
      honest; CLI, MCP, and Raycast distribution wait until a real recurring
      workflow asks for them. The agent door is never designed out, but it
      does not add surfaces ahead of demand.
- [ ] **Raycast extension.** One command per door: "Optimize with Frisp" runs
      the headless core over the Finder selection with auto targets and no
      window; "Open in Frisp" hands files to the app through the
      `web+frisp://` protocol handler. The extension stays thin and depends on
      the headless core above.
- [ ] **Remaining first-principles workstreams**, all fully designed in
      [specs/2026-07-07-first-principles-execution.md](specs/2026-07-07-first-principles-execution.md):
      a composite worker op, worker-side decode, and the `src/engine` rename. The
      rename must go **last**, because it conflicts with everything.
- [ ] **Svelte hardening remnants.** Wave 2b and the deferred items in
      [../svelte-hardening-plan.md](../svelte-hardening-plan.md). Good filler work
      between larger tracks.
- [ ] **Bulk export evolution.** Duplicate-safe naming templates, suffix and
      extension rules, presets for common WebP and AVIF workflows, warnings for
      larger output and memory-heavy batches, and summary totals.
- [ ] **PWA and OS-integration polish.** The native-gap closers, each of which
      also carries unchanged into a future Electron shell: manifest
      `file_handlers` (installed Chromium PWAs register with Finder as real
      "Open With" targets), `launch_handler: focus-existing`, a `web+frisp://`
      protocol handler (designed once; it is also the Raycast open-in-app
      handoff), persisted directory handles for recent folders and bulk
      write-back, and Window Controls Overlay. Plus the earlier scope: an OS
      share target for incoming images, a target-file-size mode, metadata
      stripping controls, and session files for saving a batch plan.
      IndexedDB-backed restore only if the product genuinely needs persisted
      source blobs, and never live blobs or object URLs in localStorage.
- [ ] **UI polish.** A mobile multi-panel accordion if the responsive editor
      proves insufficient, visual difference metrics, stronger preset and warning
      language, and advanced codec grouping once the format focus is settled.
- [ ] **Upstream mining.** The abandoned upstream Squoosh pull requests hold codec
      fixes, browser compatibility fixes, service-worker fixes, and small UI
      improvements. Extract small patches with tests or focused browser
      verification; never merge stale PRs wholesale. The triage ledger is
      [../upstream-signals.md](../upstream-signals.md), which is idea intake and
      not a second roadmap.
- [ ] **Test coverage gaps.** The remaining bulk-engine unit targets and the e2e
      additions in [../test-plan.md](../test-plan.md), which is the single
      reference for all test work.

## Later, deliberately

- **HEIC** stays undecided. Licensing and browser support make it a product
  question rather than a build question.
  [../new-codec-investigation.md](../new-codec-investigation.md)
- **WebP 2 is never coming back.** It was removed in 2026-06 because it is
  permanently experimental with a non-final bitstream and no browser decodes it.
  Do not reintroduce it for parity.
- **Desktop shells are direction, not scheduled work.** An Electron shell
  (macOS first, maintainer preference 2026-08-08) around the same static build
  is the intended path to Services-grade OS integration once the PWA polish
  above hits its ceiling: a custom protocol with COOP/COEP injected so the
  threaded codecs keep multi-core, sandboxed renderer, no Node in the
  renderer, and the PWA build as the single source of truth. A separate
  product shipping native codec binaries for CPU speed is still not planned;
  noted so nobody re-derives it.
- **Branch `claude/clever-swartz-2b34ed` is kept, not merged.** Its experiments
  (compare-size chips with a best badge, fit-under-target binary search, shared
  Adjust state) are idea material for a later phase. Do not delete it.

## For future executors

- Read [../gotchas.md](../gotchas.md) before debugging anything that looks
  impossible. Most of the expensive surprises in this repo are already written
  down.
- The specs under [specs/](specs/) are written to be run cold, weeks later, with
  no access to the conversation that produced them. Trust the spec over your
  reconstruction, and flip its `Status:` line when you land it.
- The bulk engine is pure and framework-neutral by design. Extend it with
  reducers and cover them with unit tests; never reach into it from the UI.
- Codec work needs provenance, build, service-worker, and browser verification.
  A green build proves nothing about a WASM import name; only the e2e suite does.
- Anything user-facing that changes an option, a default, or a codec also changes
  [../user-guide/](../user-guide/index.md).

## Done

Newest first. The narrative, with the gotchas, is in [worklog.md](worklog.md).

- [x] **Export-contract trust fixes and low-risk cuts** (2026-11-04), from the
      2026-11-02 review: Save and Share only hand out a result matching the
      current recipe; bulk jobs never settle under replaced settings and a
      mid-encode removal never stalls the queue; Keep originals never undoes
      a pixel edit; a first offline encode works (worker chunks precached);
      an update asks before reloading another tab with open images; SVG Auto
      keeps the original when nothing passes its gate; jpegli is the one
      JPEG; WebP defaults to method 4; dead code, the per-side copy/save/import
      buttons, and production `/diagnostics` are gone. Regression suite:
      `tests/e2e/export-contract.spec.ts`.
- [x] **Lossless JPEG to JXL transcode** (2026-08-11): a "Lossless transcode"
      toggle on the JXL panel for JPEG sources repacks the source's DCT
      coefficients into a JXL container, bit-for-bit reversible (proven by a
      byte-identical djxl reconstruction), 12 to 20 percent smaller depending
      on source size, with a snackbar fallback to pixel encoding for
      untranscodable JPEGs.
      [specs/2026-07-11-jpeg-to-jxl-transcode.md](specs/2026-07-11-jpeg-to-jxl-transcode.md)
- [x] **jpegli** (2026-08-09): new encode-only codec from google/jpegli,
      shipped as "JPEG (jpegli)" beside MozJPEG with no default change. Faster
      than MozJPEG on every bench fixture and about 7 percent smaller on photos
      at the shipped defaults; the equal-quality ladder study that decides the
      default JPEG encoder is future work.
      [specs/2026-07-11-jpegli-codec.md](specs/2026-07-11-jpegli-codec.md)
- [x] **libjxl v0.8.5 to v0.12.0** (2026-08-08, fast-tracked and landed the
      same day): encoder rewritten onto the public C API (the internal-API wall
      both upstream anchors failed to cross; zero internal headers remain), a
      new fidelity-calibrated quality curve for the accurate distance targeting,
      RESAMPLING pinned so the slider can never silently halve resolution, and
      the JXL baseline re-captured. Default photo behavior preserved within 0.4
      percent; the old slider bottom (negative SSIMULACRA2) is fixed. The
      spec's Outcome section has the measurement story.
      [specs/2026-07-11-libjxl-0-12-upgrade.md](specs/2026-07-11-libjxl-0-12-upgrade.md)
- [x] **Benchmark methodology fixed and re-baselined** (2026-08-08): measured
      runs are cache-cold and module-warm instead of timing a `ResultCache` hit,
      timing no longer gates the exit code (size and reliability do), the suite
      runs 5x faster, and `baseline.json` is a fresh capture at `aeb169fa`. The
      old baseline predated the WebP default change and AVIF threading, which is
      why it read as a WebP regression. [../gotchas.md](../gotchas.md)

- [x] **Search and link-preview metadata** (2026-07-25): title, description,
      Open Graph, social card, robots.txt, sitemap. The served HTML previously had
      no title at all. [../seo.md](../seo.md).
- [x] **Lab restructure, design unification, shared icon set** (2026-07-18).
- [x] **Web Share for saved images** (2026-07-17).
- [x] **Rebrand, new landing, dev-only route stripping** (2026-07-15).
- [x] **SVG optimization stages S1 to S6** (2026-07-12): SVGO 4 vector lane, Auto
      candidate search, vector-true preview, gzip reporting.
- [x] **Film grain, then v1.1** (2026-07-12): calibrated Amount slider, grain size
      control, live scrub preview.
- [x] **First-principles review executed** (2026-07-07): decoded-source cache,
      per-slot bulk drain, codegen retirement, worker transfers, dead code, tooling
      and CI. Report:
      [reports/2026-07-07-first-principles-review.md](reports/2026-07-07-first-principles-review.md).
- [x] **Bulk Phase 2 and Phase 2b** (2026-07-03): production bulk on the main
      route, ZIP save-all, folder import, remove with Undo, shared image-info
      panel, opt-in second encoder side.
- [x] **Rename-proofing** (2026-07-05): brand confined to `src/shared/brand.ts`.
- [x] **Satoshi as the app typeface** (2026-07-02).
- [x] **Review-hardening batch and follow-ups** (2026-07-02): persistent worker
      bridges, in-flight encode dedup, one canonical recipe signature, input
      clamps, extracted settings storage, and the full e2e suite in CI.
- [x] **Codec surface cleanup** (2026-06-27): WebP 2, dead codec directories, the
      browser canvas encoders, and QOI as an output all removed.
      [../history/codec-surface-cleanup.md](../history/codec-surface-cleanup.md)
- [x] **Variant-aware service-worker precache** (2026-06-10): first-visit payload
      down from 14.3 MB to 6.8 MB.
- [x] **Multi-threading** (2026-06-03): oxipng, AVIF, and JXL multi-core in
      Chromium and WebKit, single-thread fallback intact.
      [../threading-enablement.md](../threading-enablement.md)
- [x] **All 7 codecs rebuilt from source natively** (2026-06-02): 14 CVEs closed,
      one critical. Audit:
      [reports/2026-06-02-codec-upgrade-audit.md](reports/2026-06-02-codec-upgrade-audit.md).
- [x] **The SvelteKit 2 and Svelte 5 migration** (concluded 2026-06-01). Archive:
      [../history/MIGRATION-PLAN.md](../history/MIGRATION-PLAN.md).
