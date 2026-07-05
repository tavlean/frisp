# Worklog

Short session-by-session build log: what changed, why, and the gotchas a future
session must know. Newest first. (Live project state stays in
[STATUS.md](STATUS.md); this is the narrative trail.)

## 2026-07-05 — Rename-proofing + sqush.app sunset Worker

**Why:** the maintainer may rename the app again; a rename must be a small task,
not a project. Also fixed the zombie-service-worker trap on the old domain.

**What changed:**

- **Rename-proofing refactor** (Codex-executed, spec + review + verification by
  Claude): `src/shared/brand.ts` (`APP_NAME`) is now the only place the name
  lives in code; every internal identifier de-branded (`.editor-root`,
  `app-generated` alias, `__appEmscripten*` globals, `registerServiceWorker`,
  SW cache `app-${version}`, localStorage `app:*` keys — FROZEN schema now,
  renamed one final time while the domain cutover had client storage reset
  anyway; bulk ids `bulk-N`; `static/wordmark.svg`). Bulk ZIP download name
  still branded, derived from `APP_NAME`. Full details: runbook Phase E.
- **`infra/sqush-sunset/`**: Cloudflare Worker for the sqush.app zone — serves
  a self-destructing service worker at `/service-worker.js` and 301s all else
  to frisp.app. NOT yet deployed (needs user: deploy + disable the zone's
  Single Redirect Rule — redirect rules run before Workers, so the rule must go
  for the Worker to see traffic). Steps: runbook Phase F.
- Living docs re-pointed at the new identifiers; `project-identity.md` now
  documents the (cheap) future-rename procedure; runbook gained Phases E/F and
  a reconciled user-action checklist.

**Verification:** `npm run check` green; full Playwright e2e 61 passed /
1 expected WebKit skip, both browsers (run by Claude, not just the delegate).

**Gotchas:**

- `wasm-bindgen` bakes Rust crate names into `.wasm` import strings — the
  `squoosh_*` codec artifacts CANNOT be renamed without a rebuild (runbook
  Phase B; fold into the next codec upgrade; build-green is NOT sufficient,
  only e2e catches it).
- The Codex sandbox can't bind the Playwright preview-server port; e2e must be
  run outside it.

## 2026-07-05 (later) — Presk → frisp rename + Pages→Workers move

Full cutover executed in one session (naming decision + infra). See the
Postscript in `docs/presk-rename-runbook.md` for the complete record.
Key state: app lives at **frisp.app** on Cloudflare **Worker `frisp`**
(static assets, root `wrangler.jsonc`); both sqush.app and presk.app 301 to
it via the shared sunset Worker; old Pages project dormant. Brand casing:
lowercase `frisp` in UI/wordmark, "Frisp" in prose.

**Gotchas:**

- Cloudflare Pages projects can't change their `*.pages.dev` subdomain —
  that plus Workers being the recommended platform drove the move.
- Workers static assets: `_headers`/`_redirects` work as on Pages (verified
  live), but SPA fallback is `not_found_handling` serving `/index.html` —
  the adapter's `200.html` ships unused.
- Workers Builds CI not yet connected (manual `wrangler deploy` until the
  user finishes the dashboard connect step).

## 2026-07-05 (later) — E2E CI flakiness hardening

Two-layer fix after the rename push surfaced flaky e2e failures on GitHub
runners (all passed locally):
- **Systemic net** (`playwright.config.ts`): `retries: 2` on CI (0 locally, so
  real flakes still surface in dev); per-test `timeout` 90s→120s on CI for
  webkit WASM codec cold-starts.
- **Root-cause fix** (`bulk.spec.ts:166`): the "per-image override" test raced
  the options-panel re-render — selecting a cell flips the scope tab's
  aria-selected BEFORE the panel rebinds the Quality input to per-image scope,
  so a setQuality() fired in that window drops its `input` event on a
  being-replaced node (override never registers → override-dot never appears →
  full-timeout failure). Wrapped set+assert in `expect(...).toPass()` so the
  idempotent quality change re-fires once the panel settles. Verified: 12
  consecutive passes with retries OFF (was flaking ~every CI run).

Not touched: the ~15 other sub-20s per-assertion timeouts in the suite — most
are intentional stability checks (assert a value did NOT change), and retries
covers any genuine environmental flake. Don't lengthen them.
