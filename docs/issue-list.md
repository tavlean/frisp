# Issue List

Last updated: 2026-07-10.

Small backlog seed. The big tracks live in their own plans — see
[README.md](README.md) for the map. Product work belongs in
[road-map.md](road-map.md); the (concluded) migration record is in
[history/MIGRATION-PLAN.md](history/MIGRATION-PLAN.md).

## Done

- Migration closeout verification — `npm run check`, `npm run audit`, production
  preview browser smoke, and offline-reload-after-SW-install all pass (see
  [STATUS.md](STATUS.md) → Verification State).
- Svelte hardening waves 0–2, 4–6 landed; Wave 3 promoted to
  [codec-options-model.md](codec-options-model.md).

## Open

1. **Release browser coverage.** Chromium is primary; confirm Safari and Firefox
   before public support claims. Safari's nested-worker behavior specifically
   matters once threading is enabled — fold into
   [threading-enablement.md](threading-enablement.md) verification.
2. **Browser smoke command.** If repeated local QA keeps re-running the same
   Playwright flow, capture it as a script. See [manual-qa.md](manual-qa.md).
3. **Codec provenance gaps.** Fill any remaining gaps in
   [codec-provenance.md](codec-provenance.md) before touching committed codec
   artifacts (the codec rebuilds in [codec-upgrade-audit.md](codec-upgrade-audit.md)
   will exercise this).
4. **Turn stable backlog items into GitHub issues** if/when the project moves to
   issue-tracked work.
5. **Bulk-engine barrel pruning (AFTER Phase-3 UI wiring).** The 2026-07-10
   quality pass verified a set of `src/client/lazy-app/bulk/*` exports with no
   consumer anywhere (all re-exported via the barrel): `changes.ts` entirely
   (`applyGlobalSettings`/`applyJobOverrides`/`applyClearJobOverrides`),
   `queue.ts` internals (`updateJob`, `setJobStatus`, `getBulkJobCounterDelta`),
   `export.ts` (`getExportableJobs`, `getSelectedExportableJobs`),
   `import.ts` (`createImageJobId` + several types), `processor.ts`
   (`createBulkProcessPlan` + types), `snapshot.ts`
   (`serializeBulkSessionSnapshot` + interfaces), `strip.ts`
   (`getSelectedBulkStripItem`), `session.ts` (`getOverriddenJobs`,
   `getBatchProgress`). Deliberately NOT deleted now: Phase-3 override-UI
   wiring and the memory-ceiling design may consume some (snapshot
   serialization is designed API). Once Phase 3 lands, prune what's still
   unused.
6. **Drag-teardown micro-gaps (upstream-parity, low impact).** `Range.svelte`
   pointer-drag installs window `pointerup`/`pointercancel` listeners cleaned
   only by their own firing; `pinch-zoom.ts`/`two-up.ts` never stop their
   constructor-local PointerTrackers on disconnect (upstream Squoosh behaves
   the same). Worst case is one stray callback after a mid-drag unmount. Fix
   opportunistically if these files are touched for other reasons.
7. **`session.ts` override paths stay coarse until Phase 3.** Same-format
   overrides keep the wholesale `encoderState` alongside the sparse
   `encoderControls` companion, so `getSettingsOverridePaths` reports
   `encoderState` rather than per-control ids — intentional interim seam (the
   production UI still writes legacy full option objects); resolves with the
   WS-G UI half.

## Pointers (not tracked here)

- Codec version currency, urgency, new codecs → [codec-upgrade-audit.md](codec-upgrade-audit.md).
- WebP 2 removal (dead `codecs/png/` already deleted) → [codec-surface-cleanup.md](codec-surface-cleanup.md).
- Multithreading / COOP-COEP → [threading-enablement.md](threading-enablement.md).
- Remaining Svelte cleanup → [svelte-hardening-plan.md](svelte-hardening-plan.md).
