# Roadmap

Last updated: 2026-11-02.

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

- [ ] **Decide on the 2026-11-02 first-principles review.** It found six
      code-confirmed paths (and one likely) where the saved file disagrees with
      what the user asked for, and proposes trust fixes ahead of every track
      below, then a reordering of this roadmap. Seven decisions wait on the
      maintainer.
      [reports/2026-11-02-first-principles-review.md](reports/2026-11-02-first-principles-review.md)
- [ ] **SVG benchmark (stage S8).** The competitive comparison against nano and
      ImageOptim over the stratified corpus in `benchmarks/svg/`. Everything else
      in the SVG track shipped on 2026-07-12. The protocol is self-contained in
      [specs/2026-07-12-svg-optimization.md](specs/2026-07-12-svg-optimization.md),
      so this needs no design work, only execution. The maintainer optimizes
      SVGs daily, which keeps this in Now.

## Next

- [ ] **Codec options model, minimal slice.** Pre-pays the override UI below. The
      sequencing analysis in [../codec-options-model.md](../codec-options-model.md)
      concluded the slice comes first; its open decisions were resolved on
      2026-07-07, so it is executable.
- [ ] **Bulk Phase 3, overrides polish.** Per-control override dots and resets
      wired through to the UI. The engine half landed on 2026-07-07 (per-codec
      control registries plus sparse per-control overrides); the control tables and
      binding directives are in
      [specs/2026-07-07-ws-g-control-inventory.md](specs/2026-07-07-ws-g-control-inventory.md).
- [ ] **Pick an editor re-style direction.** Three finished skins are waiting on a
      look-and-choose decision; hybrid is the standing recommendation. Registry:
      [../lab.md](../lab.md).
- [ ] **Keyboard control.** Figma-style single-key actions plus Photoshop-style
      digit entry for Quality. The proposal at
      [../keyboard-control.md](../keyboard-control.md) is ready and has five open
      decisions: which letters, whether to free 1/2/3 from the divider, digit
      semantics, S versus Cmd+S, and what S means in bulk.

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

- [ ] **Multi-Format Compare.** On import, encode across MozJPEG, WebP, AVIF, JXL,
      and OxiPNG in parallel workers and present a size and quality comparison, so
      the user picks by result instead of guessing a format. Multi-threading, which
      landed on 2026-06-03, was the prerequisite; the bulk worker-bridge pool is
      the same substrate, which is why bulk comes first. Use fast presets for the
      compare pass and a full-quality encode once the user commits, with
      concurrency bounded by `navigator.hardwareConcurrency`.
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
