// Production deploy, start to finish: `npm run deploy`.
//
// It deploys only what is already on origin/main, from a clean tree, so the
// live build always matches a pushed commit (the build is named after that
// commit; see commitVersionName in vite.config.ts). It runs the gates, hands
// the build to wrangler, then asks production what it is serving.
//
// `npm run deploy -- --dry-run` does everything except change production.
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const dryRun = process.argv.includes('--dry-run');
const sh = (command) => execSync(command, { encoding: 'utf8' }).trim();
function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
function stop(message) {
  console.error(`deploy: ${message}`);
  process.exit(1);
}

if (sh('git status --porcelain') !== '') {
  stop('the working tree has uncommitted changes. Commit or remove them.');
}
run('git', ['fetch', '--quiet', 'origin', 'main']);
const head = sh('git rev-parse HEAD');
if (sh('git rev-parse origin/main') !== head) {
  stop('HEAD is not origin/main. Push first; only pushed commits deploy.');
}

// check = typecheck, build, static-output audit. The e2e suite is the
// caller's job (AGENTS.md): it takes minutes and has usually just run.
run('npm', ['run', 'check']);
run('npm', ['run', 'test:unit']);
run('npx', ['wrangler', 'deploy', ...(dryRun ? ['--dry-run'] : [])]);
if (dryRun) {
  console.log('deploy: dry run finished; production was not changed.');
  process.exit(0);
}

// The site's address is whatever wrangler routes to, so a rename has one
// place to change.
const pattern = readFileSync('wrangler.jsonc', 'utf8').match(
  /"pattern":\s*"([^"]+)"/,
)?.[1];
if (!pattern) stop('no route pattern in wrangler.jsonc to verify against.');
const origin = `https://${pattern}`;
const expected = head.slice(0, 12);

let live = '';
for (let attempt = 0; attempt < 12 && live !== expected; attempt += 1) {
  if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 5000));
  try {
    const response = await fetch(`${origin}/_app/version.json`, {
      cache: 'no-store',
    });
    live = (await response.json()).version;
  } catch {
    // The edge can take a moment to switch; keep trying.
  }
}
if (live !== expected) {
  stop(`${origin} serves version "${live}", expected "${expected}".`);
}
const home = await fetch(origin);
const missing = await fetch(`${origin}/deploy-check/not-a-page`);
if (home.status !== 200 || missing.status !== 404) {
  stop(
    `${origin} answered ${home.status} for / and ${missing.status} for an unknown path (expected 200 and 404).`,
  );
}
console.log(`deploy: ${origin} is serving ${expected}.`);
