# Frisp docs

Last updated: 2026-11-10.

The index of every doc, and the discipline that keeps them worth reading. Start
with [project/brief.md](project/brief.md): what Frisp is, where it stands, and
what is still undecided. End-user documentation is separate, in
[user-guide/](user-guide/index.md).

## How to use these docs

**Read before, update after.** Scan this index at the start of a task and read
the docs that cover what you are about to touch; they hold decisions you would
otherwise redo or undo. When you are done, update every doc your work
invalidated. A task is not complete while a doc it touched is stale.

**Writing rules.**

- **One doc, one topic.** Split rather than grow a grab-bag. A doc pushing past
  100 lines is usually two topics.
- **One source of truth per topic.** A superseded doc becomes a one-line pointer
  or is deleted; git history keeps the rest.
- **Only the non-obvious, with the reason.** "X because Y". Anything a capable
  reader already knows is left out, because docs exist for what cannot be
  guessed.
- **Absolute dates**, never "last week". Every doc opens with
  `Last updated: YYYY-MM-DD`; plans and specs also carry a `Status:` line.
- **Fresh eyes.** State the current way as if it had always been the way. Name a
  wrong alternative only when it is a live temptation or a mistake that gets
  repeated, and say why. When a practice changes, rewrite the doc so no trace of
  the old way remains.
- **Nothing conversational.** Every doc has to work for someone arriving cold.
- **Add a new doc to this index in the same change.**

## Orientation

| Doc | What it holds |
|---|---|
| [project/brief.md](project/brief.md) | Intent, current state, hard open questions, pointers. Read first. |
| [overview.md](overview.md) | The architecture in one page: what runs where. |
| [gotchas.md](gotchas.md) | Traps that fail silently. Read before debugging anything strange. |
| [design.md](design.md) | Design tokens and visual conventions. A placeholder; the system is not designed yet. |

## Architecture and runtime

| Doc | What it holds |
|---|---|
| [build-and-runtime.md](build-and-runtime.md) | The build and runtime map: SvelteKit and Vite, codec-asset sync, threaded-worker wiring in dev and prod. |
| [bulk-image-architecture.md](bulk-image-architecture.md) | The bulk engine's design: model, helpers, snapshots, queue and export behavior. |
| [threading-enablement.md](threading-enablement.md) | The multi-threading subsystem: COOP/COEP and the three threaded codecs. Read before any worker-pool or SharedArrayBuffer work. |
| [browser-support.md](browser-support.md) | The support policy and the version floors. |
| [project-identity.md](project-identity.md) | The name and identity, and the procedure for a future rename. |
| [rename-record.md](rename-record.md) | The 2026-07-05 Sqush to Frisp cutover record and what it left open. |
| [seo.md](seo.md) | Search and link-preview metadata: why it lives in `app.html` rather than a `<svelte:head>`, the copy decisions, the social card, robots and sitemap. |

## Codecs

| Doc | What it holds |
|---|---|
| [codec-build-notes.md](codec-build-notes.md) | The engineering record of building each WASM codec from source: toolchains, bugs, fixes, and the dead ends not to retry. Read before rebuilding any codec. |
| [codec-provenance.md](codec-provenance.md) | The exact vendored version and source pin of every codec. Must never show a stale version. (`codec-source-references.md` is a pointer here, kept for older handoffs.) |
| [codec-upgrade-runbooks.md](codec-upgrade-runbooks.md) | The per-codec upgrade how-to: the build, verify, and commit loop with exact edits. |
| [codec-options-model.md](codec-options-model.md) | The proposed unified codec-options model, plus the sequencing analysis that puts a minimal slice before bulk Phase 3. |
| [new-codec-investigation.md](new-codec-investigation.md) | The four researched codec candidates and what became of each. SVGO, jpegli and the JPEG to JXL transcode shipped; HEIC is the one still undecided. |
| [svg-optimization-analysis.md](svg-optimization-analysis.md) | The SVG vector-lane analysis and the competitive findings against nano and ImageOptim. |
| [frisp-cli-analysis.md](frisp-cli-analysis.md) | Strategic analysis and design for the headless core and CLI. Direction ratified 2026-08-08; two design questions open. |

## Product and design

| Doc | What it holds |
|---|---|
| [lab.md](lab.md) | The lab registry: every experiment, its route, its verdict, and what must not be deleted. Hygiene audits read this first. |
| [lab-editor-restyle.md](lab-editor-restyle.md) | The editor re-style design record for the three skins. |
| [lab-intro-page.md](lab-intro-page.md) | The intro-page design record and the promotion of `frame`. |
| [bulk-ui-design-options.md](bulk-ui-design-options.md) | The bulk UI design session: layout options, override signaling, and the phased plan. |
| [keyboard-control.md](keyboard-control.md) | The proposal for app-wide single-key control. Five decisions open. |
| [mobile-save-ux.md](mobile-save-ux.md) | Where saved images land on iOS and Android, and the Web Share button's platform constraints. |
| [parity-audit.md](parity-audit.md) | Feature parity against the original Squoosh, and the deviation log. |

## Quality

| Doc | What it holds |
|---|---|
| [test-plan.md](test-plan.md) | The test strategy: static gate, unit layer, e2e, and the remaining coverage gaps. |
| [manual-qa.md](manual-qa.md) | The manual checklist for what still needs human eyes before a release. |
| [svelte-hardening-plan.md](svelte-hardening-plan.md) | The post-migration cleanup and Svelte 5 hardening backlog. |
| [dependency-modernization.md](dependency-modernization.md) | The state of the dependency graph. |
| [upstream-signals.md](upstream-signals.md) | Triage of high-signal upstream Squoosh issues and PRs against local decisions. |

## Notes

| Doc | What it holds |
|---|---|
| [journey-and-article-notes.md](journey-and-article-notes.md) | Task, problem, and solution material for two planned articles. |

Two more live next to the code they describe rather than here:
[`benchmarks/README.md`](../benchmarks/README.md) for the benchmark harness and
methodology, and [`tests/fixtures/README.md`](../tests/fixtures/README.md) for the
fixture corpus and its provenance.

## Management

**[project/](project/)** is the management set: [brief.md](project/brief.md)
(intent and state), [roadmap.md](project/roadmap.md) (the phased plan and its
status), [worklog.md](project/worklog.md) (the session narrative, newest first),
[issue-list.md](project/issue-list.md) (small fixes with no plan of their own),
[ledger.md](project/ledger.md) (when each heavy audit last ran),
[specs/](project/specs/) (executable implementation specs, dated),
`decisions/` (dated decision records; none written yet),
[reports/](project/reports/) (audits and studies, dated), and `references/`
(local design reference images, gitignored).

## Archive and end-user docs

| Path | What it holds |
|---|---|
| [history/](history/) | The SvelteKit-migration archive and frozen completed plans. **Do not update**; it is a point-in-time record and new state belongs in the live docs above. |
| [user-guide/](user-guide/index.md) | End-user documentation, written for users rather than developers. Includes per-format guides and an exhaustive code-derived reference inventory. Update whenever a user-facing feature, option, codec, or default changes. |

## Testing commands

- `npm run check`: typecheck, production build, static-output audit. The gate for
  any app, build, runtime, service-worker, or tooling change.
- `npm run typecheck:fast`: the incremental svelte-check alone, for quick loops.
  `npm run typecheck` (part of `check`) also checks the service worker and the
  tests, and fails on any warning.
- `npm run typecheck:tests`: type-checks `tests/` and the three root config
  files alone.
- `npm run test:unit`: Vitest over `tests/unit/`. Fast; does not boot a browser.
- `npm run test:e2e`: Playwright over `tests/e2e/`. Boots the production preview
  cross-origin-isolated and encodes through every codec. Required after any
  codec, build, worker, or service-worker change. Set `PLAYWRIGHT_PORT` to run
  a second checkout's suite at the same time.
- `npm test`: check, unit, then e2e.
- `npm run bench` and `npm run bench:compare`: codec size and time regression
  gate. Read the benchmark caveat in [gotchas.md](gotchas.md) before trusting a
  warm number.
