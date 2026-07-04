# Presk rename runbook (Sqush → Presk)

> **Status:** in progress · Started 2026-07-04 on branch `rename/presk`.
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
- [ ] **A8 — Verify:** `rm -rf .svelte-kit .tmp node_modules/.vite` → `npm run check` → `npx playwright test` (offline/app-shell/bulk exercise SW + codecs). Fix, re-run.
- [ ] **A9 — Merge:** `git switch main && git merge --ff-only rename/presk`; confirm signatures intact; push.

## Phase B — Deferred: in-code `squoosh` → `presk`

- [ ] Rename stray `squoosh` identifiers/comments in `src/**` (non-attribution).
- [ ] Codec rebuild pass: rename Rust crates `squoosh-oxipng`/`squoosh-resize` (+ hqx) in `Cargo.toml`, rebuild WASM, update generated `pkg/` filenames + every import in `sync-sveltekit-app.mjs` and workers. Verify codecs still load.
- [ ] Keep attribution/provenance untouched.

## Phase C — tavlean.com (separate repo: `…/Development/Websites/tavlean.com`)

> Pulse matches repos by GitHub `origin` remote (case-insensitive). Update in lockstep with the GitHub repo rename or Pulse loses Sqush's history.

- [ ] `scripts/projects-registry.mjs`: entry `name Sqush→Presk`, `github "tavlean/sqush"→"tavlean/presk"`, `repo`/`repos` folder path `Sqush→Presk` (use `repos: [...]` to bridge old+new during transition), `slug sqush→presk`.
- [ ] Rename route folder `src/routes/projects/(_)/sqush/ → …/presk/` (URL `/projects/sqush` → `/projects/presk`). Decide redirect for old URL.
- [ ] Regenerate `pulse-data.json` / `pulse-summaries.json` (confirm generator; don't hand-edit if generated).
- [ ] `docs/project-registry.md`, `docs/assets.md`: update name/slug references.
- [ ] Commit (signed) + deploy tavlean.com.

## Phase D — Folder rename (isolated; after Phase A is committed & pushed)

Run in a fresh terminal (this breaks the current session's cwd + the running vite):
```
# 1. stop any Presk/Sqush vite/watchers first
mv /Users/tav/Development/Tavlean/Sqush /Users/tav/Development/Tavlean/Presk
cd /Users/tav/Development/Tavlean/Presk
git worktree repair                      # fixes the nested worktree's absolute paths
rm -rf .svelte-kit .tmp node_modules/.vite
npm run dev                              # confirm clean boot
```

## User actions (dashboard / manual — I'll prompt you)

- [ ] GitHub: rename repo `tavlean/sqush` → `tavlean/presk` (auto-redirects old URL). Then locally: `git remote set-url origin git@github.com:tavlean/presk.git`.
- [ ] Cloudflare Pages: add custom domain `presk.app`; optionally rename the Pages project; confirm Git integration follows the repo rename and a deploy fires.
- [ ] DNS: point `presk.app` at Pages. Decide whether to keep `sqush.app` as a redirect.
- [ ] Re-export brand art if `logo.webp`/favicons show the wordmark.
- [ ] Update `MEMORY.md` + `docs/project-identity.md` to record the rename.
