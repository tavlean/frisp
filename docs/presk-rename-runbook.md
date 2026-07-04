# Presk rename runbook (Sqush → Presk)

> **Status:** GitHub repo renamed ✅ · Phase A ✅ pushed to `tavlean/presk` · Phase C tavlean.com ✅ pushed (Cloudflare deploying). Remaining: Cloudflare custom domain + DNS + `sqush.app` redirect (user), brand-art re-export (user), Phase B codec-`squoosh` (deferred), Phase D folder rename (deferred).
> **This file intentionally contains the old name "sqush" as rename targets — EXCLUDE it from any automated `sqush→presk` replace.**

Renaming the project from **Sqush** to **Presk**.
- App name: `Sqush` → `Presk`
- Domain: `sqush.app` → `presk.app`
- GitHub repo: `tavlean/sqush` → `tavlean/presk`
- Dev folder: `…/Tavlean/Sqush` → `…/Tavlean/Presk`

## Safety invariants (do not violate)

1. **Commits stay signed & correctly attributed.** Config is verified good: `commit.gpgsign=true`, ssh key `~/.ssh/id_ed25519.pub`, author `tavlean <71072795+tavlean@users.noreply.github.com>`. After each commit, spot-check `git log --show-signature -1`.
2. **Merge to `main` fast-forward only** (`git merge --ff-only`). NEVER `--rebase` (rewrites commit objects → strips signatures → "Unverified").
3. **The worktree stays.** `.claude/worktrees/clever-swartz-2b34ed` (branch `claude/clever-swartz-2b34ed`) is kept. It is nested inside the repo, so a folder rename moves it too — fix its internal absolute paths afterwards with `git worktree repair`. Do NOT `git worktree remove` it.
4. **Keep all Squoosh attribution.** Credit/provenance/history prose that credits the upstream Squoosh project stays. (The `Sqush→Presk` replace is a *different string* from `Squoosh`, so it structurally never touches attribution — good.)

## Two-string model

- **`Sqush` / `sqush`** = our own project name → rename to `Presk` / `presk` **everywhere** (code, docs incl. history, config, assets, SW cache name, internal identifiers). This is **Phase A** (now).
- **`Squoosh` / `squoosh`** = inherited upstream identifiers.
  - Attribution prose → **keep forever**.
  - In-code identifiers (vendored codec files `codecs/**/squoosh_*.{js,wasm,d.ts}`, Rust crate names `squoosh-oxipng`/`squoosh-resize`, stray `squoosh` var/comment names in `src/`) → rename to `presk` in **Phase B (deferred)** — requires a WASM/codec rebuild, so it's isolated to its own pass.

## DO-NOT-auto-touch paths

`codecs/**` (vendored + build artifacts — Phase B, needs rebuild), `LICENSE`/`NOTICE`, `node_modules/**`, `.svelte-kit/**` (generated — regenerated, not hand-edited), and **this runbook**.

---

## Phase A — In-repo Sqush → Presk (this repo, branch `rename/presk`)

Each numbered group = one checkpoint commit.

- [x] **A0 — Prep** ✅ done: stopped Sqush `vite dev`; created branch `rename/presk`; wrote this runbook.
- [x] **A1 — Identity & metadata:** `package.json` (`name`, `homepage`), copyright headers `Sqush Contributors → Presk Contributors`, `package-lock.json` root name.
- [x] **A2 — User-visible strings:** doc title `Sqush — Compress an image` (`editor-session.svelte.ts`), SW-update snackbar copy (`+page.svelte`), diagnostics `<title>`/`<h1>`/body, `Intro.svelte` wordmark `alt`, brand mentions in comments.
- [x] **A3 — Brand asset:** `git mv static/sqush-wordmark.svg static/presk-wordmark.svg` + update ref in `Intro.svelte`. Check `static/logo.webp`/favicons for embedded wordmark art (re-export later if needed — tracked in User Actions).
- [x] **A4 — SW cache name:** `sqush-${version}` → `presk-${version}` in `src/service-worker.ts` (safe cache-bust; activate handler purges old keys).
- [x] **A5 — Internal identifiers:** `registerSqushServiceWorker` → `registerPreskServiceWorker` (def + call sites); `.sqush-editor` CSS class → `.presk-editor` (theme.css, +page.svelte, FocusView, BulkMode).
- [x] **A6 — `sqush-generated` alias (COUPLED — atomic):** rename `sqush-generated → presk-generated` across `scripts/sync-sveltekit-app.mjs`, `scripts/audit-static-output.mjs`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, and importers (`src/lib/codec-assets.ts`, `service-worker-codec-assets.ts`, `sveltekit-worker-bridge.ts`, `webp-encode-probe.worker.ts`). Then `rm -rf .svelte-kit && npm run sync` to regenerate.
- [x] **A7 — Docs:** `Sqush → Presk` across `docs/**` and `README.md`, `AGENTS.md` (preserve every `Squoosh` attribution; leave history docs factually intact, rename own-name only).
- [x] **A8 — Verify:** ✅ `npm run check` green (svelte-check + build + static-output audit); `npx playwright test` = **61 passed / 1 pre-existing skip / 0 failed** (codecs, AVIF+JXL+OxiPNG MT threading, offline SW all pass). squoosh occurrences unchanged (code 99→99, docs 234→234).
- [x] **A9 — Merge:** ✅ ff-only merged to local `main` (`4e939be3..17d33f7c`); all 3 commits `sig=G`, author `tavlean`. **Push pending** — bundled with the GitHub repo rename below.

## Phase B — Deferred: in-code `squoosh` → `presk`

- [ ] Rename stray `squoosh` identifiers/comments in `src/**` (non-attribution).
- [ ] Codec rebuild pass: rename Rust crates `squoosh-oxipng`/`squoosh-resize` (+ hqx) in `Cargo.toml`, rebuild WASM, update generated `pkg/` filenames + every import in `sync-sveltekit-app.mjs` and workers. Verify codecs still load.
- [ ] Keep attribution/provenance untouched.

## Phase C — tavlean.com (separate repo: `…/Development/Websites/tavlean.com`) — DO right after GitHub rename

> Pulse matches repos by GitHub `origin` remote (case-insensitive) — do this in lockstep with the GitHub rename or Pulse loses Sqush's history. Generator: `scripts/build-pulse.mjs`. ⚠ An unrelated dirty file exists (`projects/(_)/rankedagi-raycast/logo.svg`) — stage only Presk files.

- [x] `scripts/projects-registry.mjs` entry: `name Presk`, `slug presk`, `github tavlean/presk`; **kept `repo:'Tavlean/Sqush'`** (folder deferred → flip to `Tavlean/Presk` at Phase D).
- [x] `git mv` route folder `projects/(_)/sqush/ → …/presk/`; content updated (name, `presk.app`, github URL, `/projects/presk`, `requireProjectWithTabs('presk')`); fork-of-Squoosh attribution kept.
- [x] **Redirect `/projects/sqush → /projects/presk`** via `static/_redirects` (308). ⚠ Learning: a route stub broke prerender (projects are globbed by `_meta` and sorted), and `hooks.server.ts` is dead on `adapter-static` — `_redirects` is the Cloudflare Pages mechanism.
- [x] Rebuilt Pulse (`npm run sync:pulse`) → `pulse-data.json` regenerated (77 sqush hrefs → presk); one historical day-summary name fixed too.
- [x] `docs/project-registry.md` updated (`assets.md` had no `sqush`).
- [x] Build green; 2 signed commits (`8a9760b`, `ffa9020`) pushed → Cloudflare auto-deploys. Unrelated `rankedagi-raycast/logo.svg` left untouched.

## Phase D — Folder rename (DEFERRED by choice — app never references the folder name, so nothing breaks)

Run in a fresh terminal when ready (this breaks any live session's cwd + running vite):
```
# 1. stop any Presk/Sqush vite/watchers first
mv /Users/tav/Development/Tavlean/Sqush /Users/tav/Development/Tavlean/Presk
cd /Users/tav/Development/Tavlean/Presk
git worktree repair                      # fixes the nested worktree's absolute paths
rm -rf .svelte-kit .tmp node_modules/.vite
npm run dev                              # confirm clean boot
```

## User actions (dashboard / manual — I'll prompt you)

- [ ] **← NEXT: GitHub — rename repo `tavlean/sqush` → `tavlean/presk`** (Settings → General → Repository name; auto-redirects old URL). Tell me when done → I `git remote set-url origin git@github.com:tavlean/presk.git`, push the 4 signed commits, then run Phase C.
- [ ] Cloudflare Pages: add custom domain `presk.app`; optionally rename the Pages project; confirm Git integration follows the repo rename and a deploy fires.
- [ ] DNS: point `presk.app` at Pages. **Keep `sqush.app` → `presk.app` redirect** (decision: keep).
- [ ] **Re-export brand art — outlined wordmark still spells "Sqush":** `static/presk-wordmark.svg` (single `<path>`, not text) + `static/logo.webp` + tavlean project `logo.webp`. Regenerate as "Presk" in the same typeface.
- [ ] Update `MEMORY.md` + `docs/project-identity.md` to record the rename (I'll do this once fully landed).
