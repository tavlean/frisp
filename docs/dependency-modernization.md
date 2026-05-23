# Dependency modernization

The current toolchain is old but coherent: Rollup 2, TypeScript 4.9, PostCSS 7, cssnano 4, Prettier 2, and Preact 10.5.

The cleanup goal is to reduce audit risk without destabilizing workers, WASM, CSS modules, service-worker output, or static prerendering.

## Current audit shape

Recent `npm audit` state after the first safe dependency refresh:

- 48 total issues.
- 0 critical.
- 5 high.
- 43 moderate.
- 0 low.

Most findings are development/build-chain transitive dependencies, mainly from:

- PostCSS 7 and cssnano 4 ecosystem packages;
- old Rollup plugins;
- `glob`/`minimatch` chains;
- `serialize-javascript` via terser tooling.

Do not run `npm audit fix --force` blindly.

## Upgrade order

### 1. Low-risk package refresh

Keep these as small batches and run `npm run check` after each batch:

- `@surma/rollup-plugin-off-main-thread`
- `comlink`
- `mime-types`
- `prettier` within v2
- `typescript` within v4
- `wasm-feature-detect`

Keep Prettier on v2 initially to avoid formatting churn.

Status: first safe refresh completed for OMT, Comlink, MIME packages, Prettier 2, TypeScript 4, wasm-feature-detect, and small dev/type patch updates.

Do not include Preact in this safe batch. A trial upgrade from Preact `10.5.5` to `10.29.2` failed TypeScript checks because newer Preact JSX types conflict with this app's old custom option component prop typing. Treat Preact as a separate migration.

### 2. CSS stack migration

Upgrade the CSS toolchain as a coordinated batch:

- `postcss`;
- `cssnano`;
- `postcss-modules`;
- `postcss-nested`;
- `postcss-simple-vars`;
- `postcss-url`.

Risk area: `lib/css-plugin.js`.

Verify:

- CSS module `.d.ts` files are still generated correctly;
- asset URL rewriting still works;
- production build CSS still loads;
- app shell renders after a hard refresh.

### 3. Rollup 2 plugin maintenance

Before jumping to Rollup 4, update Rollup plugins to versions that still work with Rollup 2 where possible:

- `@rollup/plugin-commonjs`;
- `@rollup/plugin-node-resolve`;
- `@rollup/plugin-replace`;
- `@rollup/plugin-terser`;
- `@web/rollup-plugin-import-meta-assets`.

Watch for:

- `@rollup/plugin-replace` option/default changes, especially `preventAssignment`;
- terser/serialization output changes;
- worker and service-worker bundle differences.

### 4. High-risk major migrations

Do these later and separately:

- Rollup 2 to Rollup 4;
- TypeScript 4 to TypeScript 5 or newer;
- Preact 10.5 to newer Preact 10 releases;
- Prettier 2 to Prettier 3;
- `del` 5 to newer versions;
- `dedent` 0.7 to 1.x;
- `idb-keyval` 3 to newer versions;
- `preact-render-to-string` 5 to 6.

These can require ESM/API changes and broader browser verification.

## Lockfile policy

- Root `package-lock.json` is the main application lockfile.
- Codec sub-package lockfiles may be older and should be left alone unless actively rebuilding that codec.
- Codec lockfile churn can affect WASM rebuild reproducibility.

## Windows notes

The CI matrix includes Ubuntu and Windows, which should remain mandatory.

Known script caveat:

- `npm run dev` and `npm run serve` use POSIX-style environment syntax.
- CI does not run those commands today.
- Do not add them to Windows CI unless they are rewritten through Node or another cross-platform approach.

## Verification

Use Node from `.nvmrc`:

```sh
nvm use
npm ci
npm run check
npm audit
```

For each dependency batch:

```sh
npm outdated
npm ls --depth=0
npm run build
npm run smoke:build
npm run test:bulk
npm run typecheck
```

For changes touching Rollup, TypeScript, PostCSS, terser, service workers, workers, WASM, or generated feature metadata, also run a browser smoke test against the production build.
