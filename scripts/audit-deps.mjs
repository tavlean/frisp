// The dependency audit gate: `npm audit`, with a short list of advisories
// that are known, cannot be fixed yet, and do not reach the shipped app.
//
// Plain `npm audit --audit-level=low` has no way to accept one advisory, so a
// single unfixable finding kept the CI job red, and a red job hides the next
// real advisory. This fails on every advisory that is not listed here, and
// also when a listed one stops being reported, so the list cannot go stale.
import { spawnSync } from 'node:child_process';

const ACCEPTED = {
  // deepmerge mergeObject() prototype poisoning. No patched deepmerge exists,
  // and @sveltejs/vite-plugin-svelte (latest, 7.3.1) depends on it; kit and
  // adapter-static are flagged only for depending on that plugin. It merges
  // Frisp's own build config at build time: no user input, not in the bundle.
  // Accepted 2026-11-10. Remove when the plugin drops or updates deepmerge.
  'GHSA-gcqx-w48m-w2h4': 'deepmerge via @sveltejs/vite-plugin-svelte',
};

// npm audit exits non-zero when it finds anything; the JSON is still on stdout.
const run = spawnSync('npm', ['audit', '--json'], { encoding: 'utf8' });
let report;
try {
  report = JSON.parse(run.stdout);
} catch {
  console.error(run.stderr || run.stdout);
  throw new Error('npm audit did not return JSON.');
}
if (report.error) {
  throw new Error(`npm audit failed: ${JSON.stringify(report.error)}`);
}

const found = new Map();
for (const { via } of Object.values(report.vulnerabilities ?? {})) {
  for (const advisory of via) {
    // A string entry only names the dependency that carries the advisory.
    if (typeof advisory === 'string') continue;
    const id = advisory.url?.split('/').pop() ?? String(advisory.source);
    found.set(id, `${advisory.severity}: ${advisory.name}: ${advisory.title}`);
  }
}

const unexpected = [...found].filter(([id]) => !(id in ACCEPTED));
const gone = Object.keys(ACCEPTED).filter((id) => !found.has(id));

for (const [id, summary] of found) {
  if (id in ACCEPTED) console.log(`accepted ${id} (${ACCEPTED[id]})`);
  else console.error(`ADVISORY ${id} ${summary}`);
}
for (const id of gone) {
  console.error(
    `${id} is accepted in scripts/audit-deps.mjs but npm audit no longer reports it. Remove the entry.`,
  );
}

if (unexpected.length > 0 || gone.length > 0) process.exit(1);
console.log('Dependency audit passed.');
