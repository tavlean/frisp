# Project identity

Last updated: 2026-07-05.

Frisp is the current project name.

## Current identity

- App name: frisp — lowercase in the UI; use "Frisp" in prose. In code, defined
  ONCE in `src/shared/brand.ts` (`APP_NAME`).
- Package name: `frisp`
- GitHub repo: `tavlean/frisp`
- Default branch: `main`
- Homepage metadata: `https://frisp.app`

## Renaming the app (should it ever happen again)

The 2026-07-05 rename-proofing pass (runbook Phase E) isolated the brand. A
rename now touches ONLY:

1. `src/shared/brand.ts` — `APP_NAME`.
2. `package.json` — `name` + `homepage`.
3. Brand art: `static/wordmark.svg` (+ `static/logo.webp`/favicons if restyled).
4. Prose docs / README — a grep-replace of the old name (attribution excluded).
5. Domain + repo + deployment plumbing (see `docs/presk-rename-runbook.md` for
   the full external checklist: GitHub rename, DNS, old-domain sunset Worker —
   reuse `infra/sqush-sunset/` as the template for freeing PWA users pinned to
   the old origin).

Internal identifiers (CSS classes, cache names, localStorage keys, build
aliases, function names) are deliberately brand-free — do NOT rebrand them.
The localStorage keys (`app:settings:*`, `app:side-settings:*`) are frozen
storage schema (see the HARD RULE in `src/lib/editor/settings-storage.ts`).

## Name history

- `tavlean/SquooshPlus` — the original fork name (historical only).
- **Sqush** (`tavlean/sqush`, sqush.app) — the working name up to 2026-07-05.
- **Presk** (`tavlean/presk`, presk.app) — historical, renamed 2026-07-05 and
  dropped the same day for Plesk confusion.
- **Frisp** (`tavlean/frisp`, frisp.app) — current, renamed 2026-07-05
  (`docs/presk-rename-runbook.md` is the migration record).

## Historical identity

Frisp is derived from GoogleChromeLabs' Squoosh project. Keep that history clear in docs, credits, license notes, and architecture explanations. Do not rename every historical `Squoosh` reference to `Frisp`; many of those references explain upstream behavior or provenance.

## Local folder note

The local checkout lives at `/Users/tav/Development/Tavlean/Frisp` (renamed
from `…/Tavlean/Sqush` on 2026-07-05, runbook Phase D).
