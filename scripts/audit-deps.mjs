// The dependency audit gate: `pnpm audit`, with a short list of advisories
// that are known, cannot be fixed yet, and do not reach the shipped app.
//
// Plain `pnpm audit --audit-level=low` has no way to accept one advisory, so a
// single unfixable finding kept the CI job red, and a red job hides the next
// real advisory. This fails on every advisory that is not listed here, and
// also when a listed one stops being reported, so the list cannot go stale.
import { spawnSync } from 'node:child_process';

// Empty since 2026-11-17: the one entry, GHSA-gcqx-w48m-w2h4 (deepmerge via
// @sveltejs/vite-plugin-svelte), was withdrawn upstream on 2026-11-16. An
// entry is `'GHSA-id': 'why it is accepted'`, with a dated comment above it.
const ACCEPTED = {};

// pnpm audit exits non-zero when it finds anything; the JSON is still on stdout.
// The binary is called through pnpm itself, whose own output never reaches
// stdout here, so the JSON parses clean.
const run = spawnSync('pnpm', ['audit', '--json'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
let report;
try {
  report = JSON.parse(run.stdout);
} catch {
  console.error(run.stderr || run.stdout);
  throw new Error('pnpm audit did not return JSON.');
}
if (report.error) {
  throw new Error(`pnpm audit failed: ${JSON.stringify(report.error)}`);
}

const found = new Map();
for (const advisory of Object.values(report.advisories ?? {})) {
  const id =
    advisory.github_advisory_id ??
    advisory.url?.split('/').pop() ??
    String(advisory.id);
  found.set(
    id,
    `${advisory.severity}: ${advisory.module_name}: ${advisory.title}`,
  );
}

const unexpected = [...found].filter(([id]) => !(id in ACCEPTED));
const gone = Object.keys(ACCEPTED).filter((id) => !found.has(id));

for (const [id, summary] of found) {
  if (id in ACCEPTED) console.log(`accepted ${id} (${ACCEPTED[id]})`);
  else console.error(`ADVISORY ${id} ${summary}`);
}
for (const id of gone) {
  console.error(
    `${id} is accepted in scripts/audit-deps.mjs but pnpm audit no longer reports it. Remove the entry.`,
  );
}

if (unexpected.length > 0 || gone.length > 0) process.exit(1);
console.log('Dependency audit passed.');
