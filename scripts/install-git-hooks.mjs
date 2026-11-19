// Points git at the committed hooks in .githooks/ (one hook: pre-commit, which
// runs scripts/format-staged.mjs). It is the `prepare` step, but
// pnpm-workspace.yaml sets ignoreScripts, so on a fresh clone it runs only when asked:
// `pnpm run prepare`, once. The setting lives in the repository's git config,
// which every worktree shares.
//
// Skipped when CI is set: a hook is useless there. Never throws: a checkout
// without a writable .git must not fail an install.
import { execFileSync } from 'node:child_process';

if (process.env.CI) {
  process.exit(0);
}

try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
    stdio: 'inherit',
  });
} catch (error) {
  console.warn(
    '[prepare] skipped git-hook install:',
    error instanceof Error ? error.message : error,
  );
}
