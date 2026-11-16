// The pre-commit hook (.githooks/pre-commit): Prettier over the staged code
// files, so CI's format job stays green without thought. Code globs only:
// Markdown is never auto-formatted (AGENTS.md).
//
// A file staged in full is formatted in place and staged again. A file with
// further unstaged edits is only checked, against the staged content: writing
// it would either pull the unstaged edits into the commit or leave the commit
// unformatted, so the commit stops and the fix is left to the author.
import { spawnSync } from 'node:child_process';

const CODE = /\.(?:js|css|json|ts|tsx|svelte)$/;
// The package's own entry file, not node_modules/.bin: that is a shell shim
// on Windows, which node cannot run.
const PRETTIER = ['node_modules/prettier/bin/prettier.cjs'];

// stderr goes to the terminal so a git failure never stops a commit silently;
// no buffer cap, because `git show` returns a whole staged file.
function git(args, options = {}) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    maxBuffer: Infinity,
    stdio: ['pipe', 'pipe', 'inherit'],
    ...options,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout;
}
const list = (args) =>
  git([...args, '-z'])
    .split('\0')
    .filter(Boolean);

const staged = list([
  'diff',
  '--cached',
  '--name-only',
  '--diff-filter=ACMR',
]).filter((file) => CODE.test(file));
if (staged.length === 0) process.exit(0);

const dirty = new Set(list(['diff', '--name-only']));
const whole = staged.filter((file) => !dirty.has(file));
const partial = staged.filter((file) => dirty.has(file));

if (whole.length > 0) {
  const write = spawnSync(
    process.execPath,
    [...PRETTIER, '--write', '--log-level=warn', '--', ...whole],
    { stdio: 'inherit' },
  );
  if (write.status !== 0) process.exit(write.status ?? 1);
  // Not `git add`: it reads each path as a glob, so a staged src/[id]/a.ts
  // would also stage an unstaged src/i/a.ts. update-index takes paths as
  // written.
  git(['update-index', '-z', '--stdin'], { input: whole.join('\0') });
}

const unformatted = partial.filter((file) => {
  const check = spawnSync(
    process.execPath,
    [...PRETTIER, '--check', '--log-level=silent', '--stdin-filepath', file],
    { input: git(['show', `:${file}`]) },
  );
  return check.status !== 0;
});
if (unformatted.length > 0) {
  console.error(
    'pre-commit: these files are staged in part and the staged part is not ' +
      'formatted. Run Prettier on them and stage the result:\n  ' +
      unformatted.join('\n  '),
  );
  process.exit(1);
}
