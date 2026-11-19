# Dependency Modernization

Last updated: 2026-11-10.

The `svelte` branch now uses the SvelteKit/Vite dependency graph at the repo
root. The previous Rollup/Preact dependency modernization notes are historical
and no longer describe this branch.

## Current Baseline

- Svelte 5
- SvelteKit 3 (config in `vite.config.ts`, no `svelte.config.js`)
- Vite 8
- TypeScript 6
- adapter-static 4
- Comlink, client-zip, fflate, svgo: the four npm packages that reach the browser

Three small packages are owned copies in the repo since 2026-11-17, not npm
dependencies: `wasm-feature-detect` (`src/shared/wasm-features.ts`),
`pointer-tracker` (`src/lib/editor/output/pointer-tracking.ts`) and `pixelmatch`
(`src/shared/pixelmatch.ts`). Each file's header records the upstream version,
the licence and what was trimmed.

`npm install` on the root lockfile pruned the old Rollup/Preact packages.

## Policy

- The package manager is pnpm, pinned once in `packageManager` in
  `package.json` (npm until 2026-11-19). Every version in `package.json` is
  exact, and `pnpm-workspace.yaml` sets `saveExact`, `ignoreScripts` and
  `minimumReleaseAge` (7 days). Update a dependency only for a
  change we need (a fix that reaches us, a feature we will use), and read what
  changed in it and in anything it pulls in first. Do not update for the sake
  of being current.
- Before adding a package, check whether the platform or a few dozen owned
  lines cover the use. The 2026-11-17 audit
  ([worklog](project/worklog.md)) is the reference for which packages were
  kept and why.
- `wrangler` is not in the lockfile. `scripts/deploy.mjs` names the one
  version it accepts and runs it from PATH.
- GitHub Actions are pinned to commit SHAs, with the release in a comment.
- Use `pnpm run check` after dependency changes.
- Use `pnpm run audit` after lockfile changes. It runs
  `scripts/audit-deps.mjs`: `pnpm audit`, failing on every advisory except the
  ones accepted in that file, each with its reason and date. It also fails
  when an accepted advisory is no longer reported, so the list cannot go
  stale. Accepted as of 2026-11-17: none. The one earlier entry,
  `GHSA-gcqx-w48m-w2h4` (deepmerge), was withdrawn upstream on 2026-11-16.
- Do not run `pnpm audit --fix` blindly.
- Do not change codec package lockfiles unless actively rebuilding that codec.
- Keep build/dependency changes separate from product feature work.

## Resolved

- svelte-check: **4.3.4 → 4.6.0 (2026-06-10)**. Required for the TypeScript 6
  baseline: 4.3.4's bundled volar wrapper calls the removed internal
  `program.forEachResolvedModule`, so svelte-check crashed with
  `TypeError: forEachResolvedModule is not a function` whenever any diagnostic
  triggered the code-fix/symlink-cache path (e.g. a bad named import anywhere
  in the program — which is also why it surfaced only intermittently). If that
  error ever reappears, suspect a svelte-check/TypeScript version skew first.
- Prettier 3 is in use (`prettier` ^3.8.3 with `prettier-plugin-svelte`).
- Husky/lint-staged: **removed entirely on 2026-06-02** rather than modernized.
  This is a solo project, so the pre-commit hook's only real benefit (enforcing
  format across contributors) didn't apply, and its auto-`prettier --write`
  reflowed Markdown and mangled docs. Deleted `.husky/`, the `husky`/`lint-staged`
  devDeps, the `prepare` script, and the `lint-staged` config; also dropped `md`
  from the Prettier globs. See [the project brief](project/brief.md).
- Git hooks: **re-added a code-only pre-commit hook on 2026-07-01.**
  `package.json` now uses `simple-git-hooks` (`pre-commit: pnpm exec lint-staged`) with
  a `lint-staged` config that formats code globs only
  (`*.{js,css,json,ts,tsx,svelte}`), plus a `prepare` script
  (`node scripts/install-git-hooks.mjs`) that installs the hook. `*.md` is
  deliberately kept out of the glob so the hook never reflows Markdown — the
  behavior that got the old Husky hook removed. This setup is lighter than Husky
  (no `.husky/` dir), so the Markdown-mangling problem does not come back.
- Git hooks: **the hook packages were replaced by a repo-owned script on
  2026-11-17.** `simple-git-hooks` and `lint-staged` are gone; the same
  code-only behaviour now lives in `.githooks/pre-commit` and
  `scripts/format-staged.mjs`. Details in
  [build-and-runtime.md](build-and-runtime.md).

## Near-Term Follow-Up

- Revisit SvelteKit/Vite patch updates after the migration branch is accepted.
