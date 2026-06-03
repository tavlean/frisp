# Doc registry — consult before and after every task

**Last updated: 2026-06-03.**

The canonical registry of every project doc: what it holds, when to **read** it,
when to **update** it. ([README.md](README.md) is the narrative map;
[STATUS.md](STATUS.md) is current state; this is the maintenance index.)

## How to use

- **Before a task** — scan "Read when"; read the docs relevant to what you're
  about to do. The docs tell the whole story; don't redo what's already decided.
- **After a task** — update every doc whose "Update when" trigger your work
  matched (versions, `Status:` / `Last updated:`, gotchas, completion marks),
  before calling it done.
- **New doc** → add a row here + link from README.md. Don't create a doc when an
  existing row's "Update when" already covers the topic.

Read only the docs you need — context is finite; this index is the cheap lookup.

---

## Start here / live state

| Doc | Contains | Read when | Update when |
|---|---|---|---|
| [STATUS.md](STATUS.md) | Live project state, current branch, what's done/in-flight, gotchas. The single source of truth for "where things are now." | **First, every session.** | **Almost any task** that changes project state: a feature/track lands or starts, a branch's state changes, a build/verify status flips, a blocker is hit or cleared. |
| [README.md](README.md) | Human map of all docs + the work-priority table + conventions. | To find which doc covers a topic, or the priority order of work. | A doc is added/finished/archived; the priority/status of a track changes. |
| [INDEX.md](INDEX.md) (this file) | The registry below — per-doc read/update triggers. | **After every task** (to find which docs to update). | A doc is created, deleted, or repurposed; an "update when" trigger is wrong. |

## Codecs (build, versions, upgrades)

| Doc | Contains | Read when | Update when |
|---|---|---|---|
| [codec-build-notes.md](codec-build-notes.md) | The engineering record of building each WASM codec from source: toolchains, the gotchas, the bugs, the fixes (incl. the dead-ends not to retry). | Before building/rebuilding ANY codec. | After any codec build/rebuild work — a new gotcha, a new fix, a new codec, a toolchain finding. |
| [codec-provenance.md](codec-provenance.md) | The exact vendored version of every codec + its source pin (a factual record). | To know what version ships. | **Whenever a codec's version/source changes** (must never show a stale version). |
| [codec-source-references.md](codec-source-references.md) | Where each codec's source comes from. | Sourcing/checking a codec's upstream. | A codec's upstream source/repo/pin changes. |
| [codec-upgrade-audit.md](codec-upgrade-audit.md) | The version + CVE + landscape audit (the "why upgrade"). Now ✅ done. | Planning codec currency/CVE work. | A new audit runs, a new CVE appears, or upgrade outcomes change. |
| [codec-upgrade-handoff.md](codec-upgrade-handoff.md) · [codec-upgrade-runbooks.md](codec-upgrade-runbooks.md) | The per-codec upgrade how-to (build+verify+commit loop, exact edits). ✅ 2026-06-02 sweep done; now reference. | Doing a future codec upgrade. | The upgrade *process* changes, or a codec is upgraded (mark it). |
| [codec-surface-cleanup.md](codec-surface-cleanup.md) | Record of removed codecs (WebP2, dead dirs). Done. | Adding/removing a codec from the surface. | The codec surface changes (a codec added or removed). |
| [codec-options-model.md](codec-options-model.md) | Design proposal for a unified codec-options model. Not started. | Working the options-model project. | Progress on that project, or the codec option surface changes. |
| [new-codec-investigation.md](new-codec-investigation.md) | Researched-but-not-added candidates (SVGO, HEIC, jpegli…). | Investigating or adding a new codec. | A candidate is investigated, decided on, or added. |
| `benchmarks/README.md` · `tests/fixtures/README.md` | The benchmark harness + the test/bench fixture corpus (incl. the 9 fixtures + provenance). | Adding fixtures, changing the bench, reading benchmark methodology. | A fixture is added/changed, the bench harness/baseline changes. |

## Threading (the active subsystem)

| Doc | Contains | Read when | Update when |
|---|---|---|---|
| [threading-enablement.md](threading-enablement.md) | The MT-threading subsystem: COOP/COEP + all three threaded codecs (oxipng/AVIF/JXL) multi-core — **done & verified, merged to `main`**; incl. the build fixes and the `vite dev` raw-worker fix. | Before ANY threading/SharedArrayBuffer/worker-pool work. | After any threading change — a build/runtime fix, a regression, or a new dev/prod gotcha. |

## Architecture & runtime

| Doc | Contains | Read when | Update when |
|---|---|---|---|
| [overview.md](overview.md) | The architecture in one page (what runs where). | Onboarding / orienting. | The architecture changes (pipeline, workers, what-runs-where). |
| [build-and-runtime.md](build-and-runtime.md) | The build + runtime map (SvelteKit/Vite, the codec-asset sync). | Touching the build pipeline or asset wiring. | The build/sync/asset pipeline changes. |
| [bulk-image-architecture.md](bulk-image-architecture.md) | The bulk-optimization feature design (roadmap). | Working the bulk feature. | Bulk design/implementation changes. |
| [browser-support.md](browser-support.md) | The browser support policy + what must work per browser. | Changing engine-specific behavior, adding a cross-browser test. | Support targets change, or a browser-specific finding lands (e.g. the WebKit/Safari work). |
| [project-identity.md](project-identity.md) | The project name/identity. | Rarely. | A rename or identity change. |

## Plans, status, backlog

| Doc | Contains | Read when | Update when |
|---|---|---|---|
| [road-map.md](road-map.md) | Product direction (codec strategy, performance, Multi-Format Compare, bulk, PWA). | Planning product work / priorities. | A roadmap item lands or its priority/feasibility changes (e.g. codecs done unblocks Multi-Format Compare). |
| [test-plan.md](test-plan.md) | The test strategy: two-layer model (unit always / E2E on codec-or-build change), the gap analysis, the bulk-engine unit-test plan, E2E additions, CI changes, and verified doc-accuracy fixes. | Before adding/changing tests, or building bulk/crop/compare (write the feature's test with it). | A test layer/tool lands, a gap is closed, the CI cadence changes, or a planned phase completes. |
| [svelte-hardening-plan.md](svelte-hardening-plan.md) | The post-migration cleanup / Svelte-5 hardening backlog. | Doing cleanup/hardening work. | A hardening wave/item is done or added. |
| [issue-list.md](issue-list.md) | Small backlog seed (issues that don't warrant their own plan). | Picking up small fixes. | A small issue is found, fixed, or promoted to a plan. |
| [dependency-modernization.md](dependency-modernization.md) | The dependency-graph modernization state. | Modernizing/bumping deps. | Dependencies are modernized/bumped meaningfully. |
| [parity-audit.md](parity-audit.md) | Editor feature-parity vs the original Squoosh + the deviation log. | Changing editor features; verifying parity. | A feature changes, parity is verified, or a deviation is added/closed. |
| [manual-qa.md](manual-qa.md) | The manual QA checklist (pre-release / after risky changes). | Before a release or after build/worker/codec changes. | A new feature/path needs a manual check, or a step changes. |

## Reference / notes

| Doc | Contains | Read when | Update when |
|---|---|---|---|
| [journey-and-article-notes.md](journey-and-article-notes.md) | Task/problem/solution notes for two planned articles (migration + codec sweep). | Writing the articles; recalling how a past problem was solved. | A task produced a notable problem/solution worth recording. |

## Archive & end-user (special handling)

| Doc | Contains | Read when | Update when |
|---|---|---|---|
| [history/](history/) | The SvelteKit-migration archive (plans, audits, handoffs) — frozen historical record. | For migration context / the migration article. | **Generally frozen — do NOT update.** It's a point-in-time record; new state goes in the live docs above. |
| [user-guide/](user-guide/index.md) | End-user documentation (features, formats, options, codecs) — written for users, not devs. | Changing any user-facing feature/option/codec/UI. | **A user-facing feature, option, codec, or default changes.** (e.g. a new codec version that changes behavior, a new/removed option.) |

