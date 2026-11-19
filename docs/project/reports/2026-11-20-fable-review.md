# Whole-project review, 2026-11-20

A read-only pass over the code, config and docs at commit `7431c2bd`, by three
audit agents (engine and bulk, delivery layer, docs and structure) with each
finding then checked against the code by the driver. Nothing was run to
reproduce a bug: "confirmed" means the code path was read end to end,
"plausible" means it needs a specific timing or was not traced fully.
Ranked by value. Sizes: S under an hour, M a session, L more.

## 1. The bulk output cache can revoke the URL of the output it just stored (confirmed, S)

- Evidence: [runtime.ts:173](../../../src/lib/bulk/runtime.ts) puts the
  finished output in the session and then calls `rememberOutput`.
  [store.svelte.ts:636](../../../src/lib/bulk/store.svelte.ts) calls
  `#outputCache.put(...)` and only then `#pinCurrentOutputs()`.
  [output-cache.ts:121](../../../src/lib/bulk/output-cache.ts) `#evictBudget`
  walks every entry oldest first, counts pinned bytes against the 192 MiB
  budget, and does not spare the entry `put` just inserted.
- Why it matters: once the outputs on screen alone pass 192 MiB (about 100
  lossless PNGs at 2 MB), every `put` evicts all unpinned entries, is still
  over budget, reaches the new entry (not yet pinned) and revokes its URL.
  The job shows as encoded with a dead `downloadUrl`: download, preview and
  zip fail. This is exactly the large-batch case roadmap change C is about
  to measure. `ResultCache` already guards it with `protectedKey`
  ([result-cache.ts:70](../../../src/lib/result-cache.ts)).
- Fix: never evict the entry being inserted, and either leave pinned bytes
  out of the budget test or stop when only pinned entries remain. Add a unit
  test where pinned bytes exceed `maxBytes`
  (`tests/unit/output-cache.test.ts` never does).
- Related, same fix: a cache hit in the drain loop
  ([runtime.ts:141](../../../src/lib/bulk/runtime.ts)) puts an output in the
  session without pinning it.

## 2. Undo of a removal can restore a job whose URL was revoked (plausible, S)

- Evidence: `#removeJobIds` re-pins after the jobs leave the session
  ([store.svelte.ts:869](../../../src/lib/bulk/store.svelte.ts)), so the
  removed jobs' outputs are unpinned while they wait in `#pendingRemoval`.
  A completion elsewhere in the batch can then evict them. On Undo,
  `#restoreCachedOrQueueStale` keeps `job.output` untouched when its hash
  still matches ([store.svelte.ts:601](../../../src/lib/bulk/store.svelte.ts)).
- Why it matters: same dead-URL symptom as 1, after a remove and undo during
  a running batch.
- Fix: include `#pendingRemoval` outputs in `#pinCurrentOutputs`, or on
  restore requeue any job whose output is no longer in the cache.

## 3. No Content-Security-Policy, so "nothing leaves your device" is a promise, not a guarantee (confirmed, M)

- Evidence: [static/_headers](../../../static/_headers) sets only COOP and
  COEP. No CSP in `src/`, `static/`, `vite.config.ts` or `wrangler.jsonc`.
- Why it matters: `connect-src 'self'` would make the browser enforce the
  product's core claim against a compromised dependency or injected script.
  COEP blocks loading cross-origin resources, not sending data out.
- Fix: add a CSP for `/*`, roughly `default-src 'self'; script-src 'self'
  'wasm-unsafe-eval'; worker-src 'self' blob:; img-src 'self' blob: data:;
  connect-src 'self'; style-src 'self' 'unsafe-inline'`. SvelteKit's inline
  bootstrap needs kit's `csp` hash mode. Full e2e in both engines before
  deploy, since a wrong policy breaks WASM or workers outright.

## 4. The bulk store and the editor session have no unit tests (confirmed, M)

- Evidence: `grep -rl "bulk/store" tests` finds nothing;
  `editor-session.svelte.ts` appears in tests only as a type import. They
  are 1179 and 1460 lines and carry the state the next roadmap items change
  (resource budget, named targets). Findings 1 and 2 live in this gap.
- Fix: a store test against a fake runtime (pinning past the budget, remove
  and undo mid-run, own-copy versus shared recipe, Reset), then a session
  test for format switch, history, and effect disposal.

## 5. The frozen `app:settings:v3` format is not pinned by a fixture (confirmed, S)

- Evidence: [settings-storage.test.ts](../../../tests/unit/settings-storage.test.ts)
  builds its payloads from current code (`getDefaultOptions`), so a renamed
  field still passes.
- Fix: commit a literal payload as production writes it today, assert it
  loads to the expected state and that a save writes the same keys.

## 6. `format:check` takes about 75 s, most of it walking `codecs/` (plausible, S)

- Evidence: `package.json` runs `prettier --check "**/*.{js,css,json,ts,tsx,svelte}"`.
  `codecs/` holds 15358 files including nested `node_modules`, and Prettier
  expands the glob before it applies `.prettierignore`.
- Fix: name the roots (`{src,tests,scripts,benchmarks,infra,packages}/**` plus
  root files) in `format` and `format:check`; time before and after.

## 7. `POST /api/usage` accepts forged requests with no rate limit (confirmed, S)

- Evidence: [worker.ts:66](../../../src/edge/worker.ts) trusts `Origin` and
  accepts a missing `Sec-Fetch-Site`; both are trivial outside a browser.
- Why it matters: anyone with curl can inflate the counts the product
  decisions will lean on. Privacy is unaffected (nothing identifying is stored).
- Fix: a Workers rate limit keyed on the client IP (held for the window
  only, never written to the dataset; say so in the privacy comment), or
  record the accepted risk in the worker header.

## 8. The service worker runtime-caches every distinct same-origin URL (confirmed, S)

- Evidence: [service-worker.ts:153](../../../src/service-worker.ts)
  `cache.put(event.request, copy)` for any 200, keyed with the query string.
- Why it matters: `/?utm=...` variants each store a copy of the shell until
  the next deploy. Small, but unbounded within a version.
- Fix: key navigations on the pathname, or on one app-shell entry.

## 9. Small cleanups

- The QOI encoder registry entry is orphaned, as the roadmap already says:
  only `src/client/lazy-app/feature-meta/shared.ts:6` imports
  `#features/encoders/qoi`. Remove it and `src/features/encoders/qoi/`; keep
  the decoder and everything under `codecs/`. Run e2e (`qoi-decode.spec.ts`). S.
- `src/client/lazy-app/` is the live engine under a Squoosh-era name, and
  hygiene passes keep reading it as dead code. One line in `docs/overview.md`
  now; rename to `src/engine/` when the CLI work starts. S, then M.
- Stale headers: `brief.md` "Last updated" and "Current state" say 2026-11-10,
  `roadmap.md` and `lab.md` say 2026-11-04, all with later entries. S.
- `static/_headers` says "Cloudflare Pages"; hosting is a Worker with assets. S.
- Four copies of the per-format options switch (production plus three lab
  skins) tax every options-model or keyboard change. Picking the re-style
  direction retires them; until then a shared switch component would. M.

## Checked and found sound

Bulk runtime cancel, rerun latch and per-slot bridges; auto-quality probe
cleanup; `ResultCache`; editor encode URL ownership; settings hydration; the
service worker's cross-origin bypass and old-cache cleanup; the edge worker's
privacy claims; the pnpm migration (one wrong rewrite, `pnpm exec -y` for
`npx -y` in AGENTS.md, was fixed with this report). Not reviewed in depth:
`snapshot.ts`, `session.ts`, `src/worker/`, the lab routes.
