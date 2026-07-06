# Frisp Docs — map, registry & work order

Last updated: 2026-07-07.

The single hub for all project docs: the **work priority order** plus the
**registry** of every doc with explicit "read when" / "update when" triggers.
**New here? Read [STATUS.md](STATUS.md) first** (live state), then this file.
End-user docs live separately in [user-guide/](user-guide/index.md).

> **Maintaining docs?** The [registry](#doc-registry) below is canonical. Per
> [AGENTS.md](../AGENTS.md), consult it at **both ends of a task**: *before* — scan
> "Read when" and read what's relevant (the docs tell the whole story; don't redo
> decided work); *after* — update every doc whose "Update when" trigger your work
> matched (versions, `Status:` / `Last updated:`, gotchas, completion marks) before
> calling it done. **New doc** → add a registry row here. Read only what you need —
> context is finite; this is the cheap lookup.

---

## What to do next (priority order)

The order to work things, highest priority first. "Urgency" flags genuine
time-pressure (security); everything else is value/effort.

> **Merged into `main`:** **all 7 WASM codecs rebuilt natively (no Docker)** —
> imagequant 2.18.0, libwebp v1.6.0, libavif v1.4.2 + libaom v3.12.1, libjxl
> v0.8.5, oxipng 10.1.1, mozjpeg v4.1.5, resize 0.8.9 — every CVE in scope fixed;
> cross-origin isolation, WebP 2 removal, dead-code deletion; **and the full MT
> threading runtime (oxipng/AVIF/JXL multi-core, verified Chromium + WebKit).**
> Verified by the Playwright e2e suite (incl. a WebKit/Safari project) + the
> benchmark, no regressions. The former `codec-rebuilds` /
> `codec-cleanup-and-threading` branches are merged and deleted. See
> [STATUS.md](STATUS.md) and the journey log below.

| # | Track | Plan | Status | Why |
|---|-------|------|--------|-----|
| ✓ | **Wire threaded MT runtime** | [threading-enablement.md](threading-enablement.md) | **✅ DONE** | **oxipng, AVIF, JXL all thread multi-core** — full worker pool in Chromium, no fallback in WebKit, verified, ST fallback intact. oxipng needed a shared-memory build fix; AVIF/JXL needed the `?url`/`mainScriptUrlOrBlob` wiring **+ a `PTHREAD_POOL_SIZE` rebuild** (the `_mt` builds deadlocked spawning pthreads on-demand). |
| 2 | **Investigate new codecs** | [new-codec-investigation.md](new-codec-investigation.md) | ⚪ Investigate | Researched, **not added**: SVGO for vector (do first), HEIC decode-in (later), jpegli / JPEG→JXL transcode (skip). Decide later. |
| 3 | **Bulk optimization** | [specs/2026-07-02-bulk-phase-2-promotion.md](specs/2026-07-02-bulk-phase-2-promotion.md) | ✅ Phase 2 + 2b done (2026-07-03) | **Top product priority (maintainer, 2026-07-02).** Design phase COMPLETE (all questions decided — [bulk-ui-design-options.md](bulk-ui-design-options.md)); Phase 2 production bulk shipped on the main route with ZIP export, folder import, remove+Undo, and bulk e2e coverage. Phase 2b left panel also shipped: shared image info by default, **Compare as…** for opt-in A/B. Next: Phase 3 overrides polish, starting with the options-model minimal slice first (see [codec-options-model.md](codec-options-model.md) sequencing analysis). Multi-Format Compare follows bulk ([road-map.md](road-map.md)). |
| ✓ | **Codec security rebuilds** | [codec-build-notes.md](codec-build-notes.md) · [codec-upgrade-audit.md](codec-upgrade-audit.md) | **✅ DONE** | All 7 codecs upgraded natively, merged into `main` (CVEs fixed; some faster). The engineering record is `codec-build-notes.md`; the planning docs (handoff/runbooks/audit) are now historical. |
| ✓ | **Codec surface cleanup** | [codec-surface-cleanup.md](codec-surface-cleanup.md) | **Done** | WebP 2 removed; dead `codecs/png/` + `codecs/visdif/` + `storage.ts` deleted; browser canvas encoders removed + QOI dropped from the output picker (2026-06-27). Kept as the removal record. User-guide reconciled 2026-06-27 (`d29c5dce`, `38de8df0`, `c01bde77`). |
| — | **Svelte cleanup remnants** | [svelte-hardening-plan.md](svelte-hardening-plan.md) | ⚪ Ongoing | Waves mostly done; Wave 2b + deferred items + the [codec-options-model.md](codec-options-model.md) project remain. Pick up between the above. |

> **Writing the articles?** [journey-and-article-notes.md](journey-and-article-notes.md)
> is the source material — every task, problem, and solution for both planned
> write-ups (the SvelteKit migration + the codec sweep).

---

## Doc registry

Every project doc: what it holds, when to **read** it, when to **update** it.

### Start here / live state

| Doc | Contains | Read when | Update when |
|---|---|---|---|
| [STATUS.md](STATUS.md) | Live project state, current branch, what's done/in-flight, gotchas. The single source of truth for "where things are now." | **First, every session.** | **Almost any task** that changes project state: a feature/track lands or starts, a branch's state changes, a build/verify status flips, a blocker is hit or cleared. |
| [README.md](README.md) (this file) | The docs hub: the work-priority order, the full doc registry (read/update triggers), and the conventions. | To find which doc covers a topic, the priority order of work, or which docs to update after a task. | A doc is created / finished / archived / repurposed; a track's priority or status changes; an "update when" trigger is wrong. |

### Codecs (build, versions, upgrades)

| Doc | Contains | Read when | Update when |
|---|---|---|---|
| [codec-build-notes.md](codec-build-notes.md) | The engineering record of building each WASM codec from source: toolchains, the gotchas, the bugs, the fixes (incl. the dead-ends not to retry). | Before building/rebuilding ANY codec. | After any codec build/rebuild work — a new gotcha, a new fix, a new codec, a toolchain finding. |
| [codec-provenance.md](codec-provenance.md) | The exact vendored version of every codec + its source pin (a factual record). | To know what version ships. | **Whenever a codec's version/source changes** (must never show a stale version). |
| [codec-source-references.md](codec-source-references.md) | Where each codec's source comes from. | Sourcing/checking a codec's upstream. | A codec's upstream source/repo/pin changes. |
| [codec-upgrade-audit.md](codec-upgrade-audit.md) | The version + CVE + landscape audit (the "why upgrade"). Now ✅ done. | Planning codec currency/CVE work. | A new audit runs, a new CVE appears, or upgrade outcomes change. |
| [codec-upgrade-handoff.md](codec-upgrade-handoff.md) · [codec-upgrade-runbooks.md](codec-upgrade-runbooks.md) | The per-codec upgrade how-to (build+verify+commit loop, exact edits). ✅ 2026-06-02 sweep done; now reference. | Doing a future codec upgrade. | The upgrade *process* changes, or a codec is upgraded (mark it). |
| [codec-surface-cleanup.md](codec-surface-cleanup.md) | Record of removed codecs (WebP2, dead dirs, browser canvas encoders, QOI-as-output). Done. | Adding/removing a codec from the surface. | The codec surface changes (a codec added or removed). |
| [codec-options-model.md](codec-options-model.md) | Design proposal for a unified codec-options model. Minimal slice started; includes the 2026-07-02 Phase-3 sequencing analysis (minimal slice first). | Working the options-model project or bulk Phase 3. | Progress on that project, or the codec option surface changes. |
| [keyboard-control.md](keyboard-control.md) | Design proposal for Figma-style app-wide keyboard control (single-key actions, digit value entry, shortcut overlay). Proposed 2026-07-02; build after bulk Phase 2 + 2b. | Designing or building keyboard shortcuts. | Keymap decisions are made, or any keyboard handler is added/changed. |
| [new-codec-investigation.md](new-codec-investigation.md) | Researched-but-not-added candidates (SVGO, HEIC, jpegli…). | Investigating or adding a new codec. | A candidate is investigated, decided on, or added. |
| `benchmarks/README.md` · `tests/fixtures/README.md` | The benchmark harness + the test/bench fixture corpus (incl. the 9 fixtures + provenance). | Adding fixtures, changing the bench, reading benchmark methodology. | A fixture is added/changed, the bench harness/baseline changes. |

### Threading

| Doc | Contains | Read when | Update when |
|---|---|---|---|
| [threading-enablement.md](threading-enablement.md) | The MT-threading subsystem: COOP/COEP + all three threaded codecs (oxipng/AVIF/JXL) multi-core — **done & verified, merged to `main`**; incl. the build fixes and the `vite dev` raw-worker fix. | Before ANY threading/SharedArrayBuffer/worker-pool work. | After any threading change — a build/runtime fix, a regression, or a new dev/prod gotcha. |

### Architecture & runtime

| Doc | Contains | Read when | Update when |
|---|---|---|---|
| [overview.md](overview.md) | The architecture in one page (what runs where). | Onboarding / orienting. | The architecture changes (pipeline, workers, what-runs-where). |
| [build-and-runtime.md](build-and-runtime.md) | The build + runtime map (SvelteKit/Vite, the codec-asset sync, the threaded-worker dev/prod wiring). | Touching the build pipeline or asset wiring. | The build/sync/asset pipeline changes. |
| [bulk-image-architecture.md](bulk-image-architecture.md) | The bulk-optimization feature design (roadmap). | Working the bulk feature. | Bulk design/implementation changes. |
| [browser-support.md](browser-support.md) | The browser support policy + what must work per browser. | Changing engine-specific behavior, adding a cross-browser test. | Support targets change, or a browser-specific finding lands (e.g. the WebKit/Safari work). |
| [project-identity.md](project-identity.md) | The project name/identity. | Rarely. | A rename or identity change. |

### Plans, status, backlog

| Doc | Contains | Read when | Update when |
|---|---|---|---|
| [road-map.md](road-map.md) | Product direction (codec strategy, performance, Multi-Format Compare, bulk, PWA). | Planning product work / priorities. | A roadmap item lands or its priority/feasibility changes (e.g. codecs done unblocks Multi-Format Compare). |
| [bulk-ui-design-options.md](bulk-ui-design-options.md) | The bulk-UI design session (2026-07-02): gap inventory, layout options (grid vs filmstrip), left-panel rethink, override/reset signaling, ZIP-in-v1 export revision, phased roadmap, the 5 questions that close the design. | Choosing/refining the bulk UI direction; starting any bulk phase. | A design question is answered, a phase lands or re-scopes, or a lab variant changes the direction. |
| [test-plan.md](test-plan.md) | The test strategy: two-layer model (unit always / E2E on codec-or-build change), the gap analysis, the bulk-engine unit-test plan, E2E additions, CI changes, and verified doc-accuracy fixes. | Before adding/changing tests, or building bulk/crop/compare (write the feature's test with it). | A test layer/tool lands, a gap is closed, the CI cadence changes, or a planned phase completes. |
| [svelte-hardening-plan.md](svelte-hardening-plan.md) | The post-migration cleanup / Svelte-5 hardening backlog. | Doing cleanup/hardening work. | A hardening wave/item is done or added. |
| [first-principles-review.md](first-principles-review.md) | The 2026-07-07 whole-app first-principles review: ranked findings P1–P10 (per-pass source re-decode, worker-boundary pixel copies, codegen retirement, WebP-shaped bulk options seam, dead code, tooling/CI gaps, Svelte idioms, bulk scheduling, layout naming) + suggested sequencing. | Planning performance/cleanup/simplification work; deciding what to tackle next. | A P-item lands, is re-scoped, or is disproven (mark it in place). |
| [specs/2026-07-07-first-principles-execution.md](specs/2026-07-07-first-principles-execution.md) | The execution plan for the review: workstreams WS-A…H with fixed designs (decoded-source cache, worker transfer staging, codegen retirement target shape, bulk drain loops, options-slice decisions) + per-WS status lines. **Execution state lives HERE.** Appendices: [WS-G control inventory](specs/2026-07-07-ws-g-control-inventory.md) (per-encoder control→field tables + binding directives) · [WS-H rename inventory](specs/2026-07-07-ws-h-rename-inventory.md) (git-mv list, sed patterns, doc refs). | Executing or resuming ANY review workstream. | A workstream lands, re-scopes, or its status changes (flip the Status line). |
| [review-hardening-plan.md](review-hardening-plan.md) | The 2026-07-02 code-review execution plan: per-side persistent worker bridges, in-flight encode dedup, one canonical recipe signature, number-input clamp, two-up key scoping, SW cross-origin pass-through, settings-storage extraction, SideRuntime grouping — with per-task specs, commit messages, test gates, and the Svelte-docs research brief. | Doing or resuming any of those tasks. | A task in it lands, is re-scoped, or is dropped (update its Status line). |
| [specs/2026-07-02-bulk-phase-2-promotion.md](specs/2026-07-02-bulk-phase-2-promotion.md) | The executed bulk Phase-2 promotion spec: stage-by-stage lab→production migration (engine additions, entry routing, Stack-only cleanup, ZIP + size guard, folder import, remove-Undo, e2e, docs sweep) with acceptance criteria and guardrails. | Auditing the shipped bulk Phase 2 work. | The orchestrator flips the spec Status line; update only if the plan record changes. |
| [specs/2026-07-02-phase-2b-contextual-left-panel.md](specs/2026-07-02-phase-2b-contextual-left-panel.md) | The executed Phase-2b spec: the single editor's left column became the shared image-info panel (extracted from the bulk panel — one component, both editors) + the "Compare as…" opt-in second side. Done 2026-07-03. | Auditing Phase 2b. | The orchestrator flips the spec Status line; update only if the plan record changes. |
| [presk-rename-runbook.md](presk-rename-runbook.md) | The Sqush→Frisp rename record + what remains: Phase B codec-crate rebuild (deferred to the next codec upgrade), Phase F sqush.app sunset Worker (`infra/sqush-sunset/`), Phase E rename-proofing outcome (brand lives ONLY in `src/shared/brand.ts`). | Renaming anything brand-related; touching the sunset Worker; planning the next codec upgrade (fold Phase B in). | A rename phase lands, the sunset Worker is deployed/decommissioned, or identity plumbing changes. |
| [issue-list.md](issue-list.md) | Small backlog seed (issues that don't warrant their own plan). | Picking up small fixes. | A small issue is found, fixed, or promoted to a plan. |
| [upstream-signals.md](upstream-signals.md) | Triage ledger for high-signal issues/PRs from GoogleChromeLabs/squoosh, classified against Frisp's docs and boundaries. | Mining upstream Squoosh, classifying external requests/bugs/PR ideas, or checking whether a signal is already handled locally. | An upstream issue/PR is reviewed, dismissed, promoted to local backlog, implemented, or changes a local assumption. |
| [dependency-modernization.md](dependency-modernization.md) | The dependency-graph modernization state. | Modernizing/bumping deps. | Dependencies are modernized/bumped meaningfully. |
| [parity-audit.md](parity-audit.md) | Editor feature-parity vs the original Squoosh + the deviation log. | Changing editor features; verifying parity. | A feature changes, parity is verified, or a deviation is added/closed. |
| [manual-qa.md](manual-qa.md) | The manual QA checklist (pre-release / after risky changes). | Before a release or after build/worker/codec changes. | A new feature/path needs a manual check, or a step changes. |

### Reference / notes

| Doc | Contains | Read when | Update when |
|---|---|---|---|
| [journey-and-article-notes.md](journey-and-article-notes.md) | Task/problem/solution notes for two planned articles (migration + codec sweep). | Writing the articles; recalling how a past problem was solved. | A task produced a notable problem/solution worth recording. |
| [WORKLOG.md](WORKLOG.md) | Session-by-session build log (what/why/gotchas), newest first. | Resuming after a gap; tracing why a recent change was made. | After any build session — append an entry. |

### Archive & end-user (special handling)

| Doc | Contains | Read when | Update when |
|---|---|---|---|
| [history/](history/) | The SvelteKit-migration archive (plans, audits, handoffs) — frozen historical record. | For migration context / the migration article. | **Generally frozen — do NOT update.** It's a point-in-time record; new state goes in the live docs above. |
| [user-guide/](user-guide/index.md) | End-user documentation (features, formats, options, codecs, bulk optimization) — written for users, not devs. Includes per-format guides + an exhaustive code-derived [reference inventory](user-guide/reference/features.md). | Changing any user-facing feature/option/codec/UI. | **A user-facing feature, option, codec, or default changes.** |

---

## Testing

- **Unit tests:** `npm run test:unit` (Vitest, `tests/unit/`) — pure
  bulk-engine/helper coverage; does not build or boot the browser app.
- **Static gate:** `npm run check` (sync, svelte-check, build, asset audit).
- **Browser regression:** `npm run test:e2e` (Playwright, `tests/e2e/`) — boots
  the production preview cross-origin-isolated and encodes through every codec,
  asserting valid output bytes; plus offline reload. **Run after any codec/build
  change.** `npm test` runs check, unit, and e2e.
- **Codec benchmark:** `npm run bench` + `npm run bench:compare` (`benchmarks/`) —
  measures each WASM codec's output size + encode time + reliability and diffs
  before/after a codec upgrade (regression gate + article numbers). See
  `benchmarks/README.md`.
- **Manual / release QA:** [manual-qa.md](manual-qa.md) for what still needs eyes
  (visual quality, Safari/Firefox, mobile layout).

---

## Conventions

Lightweight rules so docs stay trustworthy:

1. **Every doc starts with `Last updated: YYYY-MM-DD`.** Plans also get
   `Status:` (not started / in progress / done).
2. **[STATUS.md](STATUS.md) is the live state**; this file is the docs hub
   (registry + work order); [road-map.md](road-map.md) is product direction.
   Update STATUS when reality changes.
3. **When a plan is finished**, mark it done in the priority table / registry
   above and move the doc to [history/](history/) (with `git mv`) once nothing
   active links to it.
4. **When this session's findings contradict a doc, fix the doc** — don't leave
   two truths. (Done 2026-06-02 for the threading "single-threaded" error and
   the WebP 2 "keep for parity" stance; 2026-06-03 for the "branches not yet on
   main" / "threading deferred" staleness.)
5. **Add new docs to the registry above** in the right section. If the root gets
   crowded again, that's the signal to archive completed work, not to add folders.
