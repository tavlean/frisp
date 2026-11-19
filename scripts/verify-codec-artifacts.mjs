// Verifies every committed codec artifact against codecs/artifacts.sha256.
//
// The .wasm and JS glue under codecs/ are built outside the repo's gates and
// committed as binaries, so nothing else notices when one changes: a stray
// rebuild, a partial commit or a tampered file would ship to every visitor.
// This fails on any artifact whose bytes differ from the manifest, any listed
// artifact that is missing, and any artifact the manifest does not list.
//
// The manifest uses `sha256sum` format, so `shasum -a 256 -c
// codecs/artifacts.sha256` from the repo root checks it without Node.
//
// It guards against unexpected change, not against someone who can commit:
// a deliberate rebuild updates the manifest in the same commit, and the
// manifest diff is what a reviewer reads. After a deliberate rebuild:
//
//   pnpm run verify:codecs --update
//
// then check that every changed line in the diff is an artifact the rebuild
// meant to produce. The procedure is in docs/codec-provenance.md.
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const codecsDir = join(repoRoot, 'codecs');
const manifestPath = join(codecsDir, 'artifacts.sha256');

// Build products: the .wasm, its JS glue and pthread workers, and the type
// declarations shipped beside them. Source files with these extensions are
// listed by exact path in NOT_ARTIFACTS.
const ARTIFACT = /\.(wasm|js|d\.ts)$/;
const NOT_ARTIFACTS = new Set(['codecs/rotate/benchmark.js']);
// Local build trees: fetched sources, CMake and cargo output. All gitignored.
const SKIP_DIRS = new Set(['node_modules', 'target']);

async function listArtifacts(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name))
        found.push(...(await listArtifacts(full)));
      continue;
    }
    const path = relative(repoRoot, full).split(sep).join('/');
    if (ARTIFACT.test(entry.name) && !NOT_ARTIFACTS.has(path)) found.push(path);
  }
  return found;
}

async function hashFile(path) {
  return createHash('sha256')
    .update(await readFile(join(repoRoot, path)))
    .digest('hex');
}

async function readManifest() {
  const text = await readFile(manifestPath, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  const entries = new Map();
  for (const [index, line] of text.split('\n').entries()) {
    if (line === '') continue;
    const match = /^([0-9a-f]{64}) {2}(\S+)$/.exec(line);
    if (!match) {
      throw new Error(
        `${relative(repoRoot, manifestPath)}:${index + 1}: malformed line`,
      );
    }
    entries.set(match[2], match[1]);
  }
  return entries;
}

const artifacts = (await listArtifacts(codecsDir)).sort();
const actual = new Map();
for (const path of artifacts) actual.set(path, await hashFile(path));

if (process.argv.includes('--update')) {
  const lines = [...actual].map(([path, hash]) => `${hash}  ${path}\n`);
  await writeFile(manifestPath, lines.join(''));
  console.log(
    `Wrote ${actual.size} codec artifact checksums to codecs/artifacts.sha256.`,
  );
  process.exit(0);
}

const expected = await readManifest();
const problems = [];
for (const [path, hash] of expected) {
  if (!actual.has(path)) problems.push(`missing    ${path}`);
  else if (actual.get(path) !== hash) problems.push(`changed    ${path}`);
}
for (const path of actual.keys()) {
  if (!expected.has(path)) problems.push(`unlisted   ${path}`);
}

if (problems.length > 0) {
  console.error('Codec artifacts do not match codecs/artifacts.sha256:');
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    '\nIf this is a deliberate rebuild, run `pnpm run verify:codecs --update`' +
      ' and commit the manifest with the artifacts (docs/codec-provenance.md).' +
      '\nIf it is not, restore each listed file with `git checkout -- <path>`.',
  );
  process.exit(1);
}
console.log(
  `Codec artifacts match codecs/artifacts.sha256 (${actual.size} files).`,
);
