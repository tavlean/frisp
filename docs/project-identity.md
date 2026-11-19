# Project identity

Last updated: 2026-07-25.

Frisp is the current project name.

## Current identity

- App name: **Frisp** — capitalized everywhere it is *displayed* (UI, prose,
  titles, wordmarks). The lowercase `frisp` is an *identifier* only: the CLI
  command, npm package, domain, and machine-facing filenames. Both forms are
  defined ONCE in `src/shared/brand.ts` — `APP_NAME` (`'Frisp'`, display) and
  `APP_SLUG` (`'frisp'`, identifier). Rule of thumb: referring to the product →
  `APP_NAME`; quoting a command/package/filename → `APP_SLUG`.
- Package name: `frisp`
- GitHub repo: `tavlean/frisp`
- Default branch: `main`
- Homepage metadata: `https://frisp.app`

## Renaming the app (should it ever happen again)

The 2026-07-05 rename-proofing pass (runbook Phase E) isolated the brand. A
rename now touches ONLY:

1. `src/shared/brand.ts` — `APP_NAME` (display) and `APP_SLUG` (identifier).
2. `package.json` — `name` + `homepage`.
3. Brand art: `static/logo.svg`, `static/favicon.svg`,
   `src/lib/brand/logomark.svg` (+ the `static/favicon.png` raster if
   restyled; re-run `pnpm run pwa-icons` so `static/icon-192.png`,
   `static/icon-512.png`, and `static/apple-touch-icon.png` pick up the new
   mark).
4. Prose docs / README — a grep-replace of the old name (attribution excluded).
5. `src/app.html`: the name and the absolute URL in the search and
   link-preview tags, plus `static/robots.txt`, `static/sitemap.xml`, and the
   `name`/`short_name` in `static/manifest.webmanifest`. These are
   the ONE place outside `brand.ts` where the brand is written in code, because a
   static HTML template cannot import a module and those tags have to be in the
   prerendered shell for crawlers to see them (`docs/seo.md` has the reasoning
   and the rejected alternatives). Re-run `pnpm run social-card` afterwards so the
   card picks up the new wordmark.
6. Domain + repo + deployment plumbing (see `docs/rename-record.md` for
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
  (`docs/rename-record.md` is the migration record).

## Historical identity

Frisp is derived from GoogleChromeLabs' Squoosh project. Keep that history clear in docs, credits, license notes, and architecture explanations. Do not rename every historical `Squoosh` reference to `Frisp`; many of those references explain upstream behavior or provenance.

## Local folder note

The local checkout lives at `/Users/tav/Development/Tavlean/Frisp` (renamed
from `…/Tavlean/Sqush` on 2026-07-05, runbook Phase D).
