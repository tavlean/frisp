# Audit ledger

Last updated: 2026-11-10.

Freshness receipts for the expensive passes. Before re-running any of these, check
what has actually changed since the date below. Re-run on substantial drift only;
a fresh receipt is not worth the tokens if nothing in scope moved. Cheap
per-session checks (a baseline gate run, a second opinion on a plan) are exempt
and never need a receipt here.

| Audit | Last run | Scope covered then | Re-run when |
|---|---|---|---|
| Quality gates baseline | 2026-07-25 | `format:check`, `check` (0 errors, 57 `corner-shape` warnings), `test:unit` all green at `daa064cb`. e2e and bench not run. | Every session start; cheap, no receipt needed. |
| Codec version and CVE audit | 2026-06-02 | All 7 codecs against upstream, 14 CVEs. Report: [reports/2026-06-02-codec-upgrade-audit.md](reports/2026-06-02-codec-upgrade-audit.md). | A new CVE lands, or before the 2026-07 codec batch starts. Upstream has moved since; expect real findings. |
| Whole-app first-principles review | 2026-07-07 | Performance, dead code, tooling, Svelte idioms, bulk scheduling. P1 to P10. Report: [reports/2026-07-07-first-principles-review.md](reports/2026-07-07-first-principles-review.md); execution state in [specs/2026-07-07-first-principles-execution.md](specs/2026-07-07-first-principles-execution.md). | The remaining workstreams land, or after another month of feature work. Bulk Phase 3 and the SVG lane are both unreviewed by it. |
| Deep code-review pass | 2026-07-21 | Whole app at xhigh effort. Two surviving findings logged as [issue-list.md](issue-list.md) items 8 and 9. | After Bulk Phase 3 or the codec batch lands. |
| Style and economy pass | 2026-07-16 | `.svelte` component discipline; nominated `Intro.svelte` as a tie-breaker. Earlier round 2026-07-10 covered the TypeScript tie-breakers. | The tie-breaker list in `AGENTS.md` needs re-blessing, or a new kind of module appears with no exemplar. |
| Svelte and SvelteKit docs review | 2026-11-10 | 150 doc sections read against the code at `b249289b` (Svelte 5.57.3, SvelteKit 3.1.1), experimental features included. 74 findings, ranked. Report: [reports/2026-11-10-svelte-sveltekit-docs-review.md](reports/2026-11-10-svelte-sveltekit-docs-review.md). | Svelte 6 or the next SvelteKit major lands, or async Svelte leaves experimental. Minor releases do not justify a re-run. |
| Editor parity vs Squoosh | 2026-07-12 | Feature parity and the deviation log: [../parity-audit.md](../parity-audit.md). | Any editor feature changes, or a parity claim is questioned. |
| User-guide accuracy pass | 2026-06-01 | About 569 code-derived claims checked by a 16-agent sweep; 2 errors found and fixed. Inventory: [../user-guide/reference/features.md](../user-guide/reference/features.md). | A user-facing option, default, or codec changes. Film grain, SVG, bulk, and Web Share all shipped after this pass. |
| Dependency modernization | 2026-06-10 | The dependency graph: [../dependency-modernization.md](../dependency-modernization.md). | Before a major framework bump, or roughly quarterly. |
| Upstream Squoosh triage | 2026-06-09 | High-signal issues and PRs classified against local docs: [../upstream-signals.md](../upstream-signals.md). | Mining upstream again, or when an external report needs classifying. |
| Codec benchmark baseline | 2026-06-02 | The committed baseline in `benchmarks/`. **Known stale and deliberately not refreshed**: the warm-run methodology hits the in-session `ResultCache`, so re-baselining now would bake cache-hit artifacts into the reference. Fix the methodology first ([../gotchas.md](../gotchas.md)). | The methodology is fixed, or a codec is upgraded. |
| Dead-code and hygiene sweep | 2026-07-07 | Removed dead code and deduped utilities as part of the first-principles execution. | Before any pruning pass. **Read [../lab.md](../lab.md) first**: lab code marked ongoing or kept-for-reference is deliberate. Known deferral: the bulk-engine barrel exports in [issue-list.md](issue-list.md) item 5, which must wait for Phase 3. |
