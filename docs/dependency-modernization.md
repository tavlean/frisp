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
- Comlink
- pointer-tracker
- wasm-feature-detect

`npm install` on the root lockfile pruned the old Rollup/Preact packages.

## Policy

- Use `npm run check` after dependency changes.
- Use `npm run audit` after lockfile changes.
- Do not run `npm audit fix --force` blindly.
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
  `package.json` now uses `simple-git-hooks` (`pre-commit: npx lint-staged`) with
  a `lint-staged` config that formats code globs only
  (`*.{js,css,json,ts,tsx,svelte}`), plus a `prepare` script
  (`node scripts/install-git-hooks.mjs`) that installs the hook. `*.md` is
  deliberately kept out of the glob so the hook never reflows Markdown — the
  behavior that got the old Husky hook removed. This setup is lighter than Husky
  (no `.husky/` dir), so the Markdown-mangling problem does not come back.

## Near-Term Follow-Up

- Revisit SvelteKit/Vite patch updates after the migration branch is accepted.
