# Sqush Docs — Index & Map

Last updated: 2026-06-02.

This is the map of all project docs. **New here? Read [STATUS.md](STATUS.md)
first** (live state), then this file. End-user docs live separately in
[user-guide/](user-guide/index.md).

Each doc carries a `Last updated:` line and (for plans) a `Status:`. Keep this
index in sync when you add, finish, or archive a doc — see
[Conventions](#conventions) at the bottom.

---

## What to do next (priority order)

The order to work things, highest priority first. "Urgency" flags genuine
time-pressure (security); everything else is value/effort.

> **Recently landed on branch `codec-cleanup-and-threading`** (pending merge to
> `main`): cross-origin isolation **done & verified** (e2e-test-protected),
> **WebP 2 removed** end to end, **dead code deleted** (`codecs/png/`,
> `codecs/visdif/`, `storage.ts`), and a **Playwright e2e suite** (`npm run
> test:e2e`) that encodes through every codec. See [STATUS.md](STATUS.md).

| # | Track | Plan | Urgency | Why |
|---|-------|------|---------|-----|
| 1 | **Codec security rebuilds** | [codec-upgrade-handoff.md](codec-upgrade-handoff.md) · [codec-upgrade-runbooks.md](codec-upgrade-runbooks.md) · [codec-upgrade-audit.md](codec-upgrade-audit.md) §7 | 🔴 **Urgent** | libwebp / libavif+libaom / libjxl each ship a known **CVE** to any file a user drops in. Plus the trivial libimagequant bump. **Turnkey handoff + runbooks now exist**; needs Docker (not installed here) — run on a Docker machine or CI. |
| 2 | **Wire threaded MT runtime** | [threading-enablement.md](threading-enablement.md) | 🟢 Deferred | Cross-origin isolation is **done + verified + test-protected**. The threaded runtime itself is a *deliberately-disabled subsystem* (generator stubs it); re-enabling needs Emscripten/Safari nested-worker work + cross-browser human verification. Own session. |
| 3 | **Gradual codec upgrades** | [codec-upgrade-runbooks.md](codec-upgrade-runbooks.md) · [codec-upgrade-audit.md](codec-upgrade-audit.md) §7 "do later" | ⚪ When convenient | OxiPNG, mozjpeg, resize — real value, more effort (API/build changes), no urgency. Same runbooks doc. |
| 4 | **Investigate new codecs** | [new-codec-investigation.md](new-codec-investigation.md) | ⚪ Investigate | Researched, **not added**: SVGO for vector (do first), HEIC decode-in (later), jpegli / JPEG→JXL transcode (skip). Decide later. |
| 5 | **Product features** | [road-map.md](road-map.md) | ⚪ Later | Multi-Format Compare (needs #1), then bulk optimization. |
| ✓ | **Codec surface cleanup** | [codec-surface-cleanup.md](codec-surface-cleanup.md) | **Done** | WebP 2 removed; dead `codecs/png/` + `codecs/visdif/` + `storage.ts` deleted. Kept as the removal record. |
| — | **Svelte cleanup remnants** | [svelte-hardening-plan.md](svelte-hardening-plan.md) | ⚪ Ongoing | Waves mostly done; Wave 2b + deferred items + the [codec-options-model.md](codec-options-model.md) project remain. Pick up between the above. |

---

## Start here

- [STATUS.md](STATUS.md) — **live project state**, verification status, gotchas.
  The single source of truth for "where things are right now."
- [road-map.md](road-map.md) — product direction (codec strategy, performance,
  Multi-Format Compare, bulk, PWA).
- [overview.md](overview.md) — architecture in one page (what runs where).

## Active plans

- [codec-upgrade-audit.md](codec-upgrade-audit.md) — **audit + action plan** for
  every codec: current vs latest upstream, CVEs, compression/speed wins, new
  codecs, WebP2 verdict, SVG. The authoritative codec-currency doc (the "why").
- [codec-upgrade-handoff.md](codec-upgrade-handoff.md) — **how to actually build
  the upgrades**: prerequisite (Docker), the per-codec build+verify+commit loop,
  the priority order, and a copy-paste prompt for a fresh AI session on a Docker
  machine. Start here when you're ready to run the rebuilds.
- [codec-upgrade-runbooks.md](codec-upgrade-runbooks.md) — **turnkey per-codec
  upgrade steps** (the "how" details): exact Makefile/Cargo edits, wrapper API
  notes, build commands, and verification per codec.
- [new-codec-investigation.md](new-codec-investigation.md) — researched-but-**not
  added** candidates (SVGO, HEIC-decode, jpegli, JPEG→JXL transcode); decision
  material, not a plan to execute.
- [threading-enablement.md](threading-enablement.md) — COOP/COEP so the
  already-built `_mt` codecs run multi-core. **Headers landed on the branch;
  in-browser verification is still open.**
- [codec-surface-cleanup.md](codec-surface-cleanup.md) — **done.** Record of the
  WebP 2 removal and the dead-code (`codecs/png/`, `codecs/visdif/`, `storage.ts`)
  deletion.
- [svelte-hardening-plan.md](svelte-hardening-plan.md) — post-migration Svelte 5
  cleanup (mostly complete).
- [codec-options-model.md](codec-options-model.md) — design for a shared codec
  options model (the promoted Wave 3 project; pre-pays presets/target-size/bulk).
- [bulk-image-architecture.md](bulk-image-architecture.md) — technical reference
  for the future bulk-optimization feature.
- [issue-list.md](issue-list.md) — small backlog seed / loose open items.

## Testing

- **Static gate:** `npm run check` (format, svelte-check, build, asset audit).
- **Browser regression:** `npm run test:e2e` (Playwright, `tests/e2e/`) — boots
  the production preview cross-origin-isolated and encodes through every codec,
  asserting valid output bytes; plus offline reload. **Run after any codec/build
  change.** `npm test` runs both.
- **Manual / release QA:** [manual-qa.md](manual-qa.md) for what still needs eyes
  (visual quality, Safari/Firefox, mobile layout).

## Reference (stable)

- [build-and-runtime.md](build-and-runtime.md) — build pipeline and runtime map.
- [browser-support.md](browser-support.md) — browser support policy.
- [manual-qa.md](manual-qa.md) — release / browser QA checklist.
- [codec-provenance.md](codec-provenance.md) — codec origins + safety rules
  (**read before touching `codecs/`**).
- [codec-source-references.md](codec-source-references.md) — codec upstream pins.
- [dependency-modernization.md](dependency-modernization.md) — JS/npm dependency
  baseline and policy.
- [parity-audit.md](parity-audit.md) — editor parity expectations (re-run after
  editor changes).
- [project-identity.md](project-identity.md) — naming/identity (Sqush vs the old
  SquooshPlus fork).

## User guide (end-user docs)

Polished, separate from dev docs. Entry point: [user-guide/index.md](user-guide/index.md).
Includes per-format guides and an exhaustive code-derived
[reference/](user-guide/reference/features.md) inventory.

## History (archived — read-only)

[history/](history/) holds the concluded SvelteKit-migration record and old
status logs (MIGRATION-PLAN, the sveltekit-* seam docs, maintenance-status,
prototype handoff, dated handoffs, the old HTML dashboard, the old todo). Kept
for archaeology. Live links inside these point back up with `../`. **Do not treat
anything here as current** — current state is [STATUS.md](STATUS.md).

---

## Conventions

Lightweight rules so docs stay trustworthy:

1. **Every doc starts with `Last updated: YYYY-MM-DD`.** Plans also get
   `Status:` (not started / in progress / done).
2. **[STATUS.md](STATUS.md) is the live state**; this README is the map;
   [road-map.md](road-map.md) is product direction. Update STATUS when reality
   changes.
3. **When a plan is finished**, mark it done in this index and move the doc to
   [history/](history/) (with `git mv`) once nothing active links to it.
4. **When this session's findings contradict a doc, fix the doc** — don't leave
   two truths. (Done 2026-06-02 for the threading "single-threaded" error and
   the WebP 2 "keep for parity" stance.)
5. **Add new docs to this index** in the right section. If the root gets crowded
   again, that's the signal to archive completed work, not to add folders.
