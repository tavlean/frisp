// Runs Frisp's real browser SVG pipeline; this is intentionally not an SVGO
// reimplementation in Node.
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import process from 'node:process';

const root = new URL('../..', import.meta.url).pathname;
const corpusDir = join(root, 'benchmarks/svg/corpus');
const args = process.argv.slice(2);
const value = (flag) => {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
};
const limitValue = value('--limit');
const limit =
  limitValue === undefined ? Infinity : Number.parseInt(limitValue, 10);
if (!(limit > 0)) throw Error('--limit must be a positive integer');
const suppliedBaseUrl = value('--base-url');
const baseUrl = suppliedBaseUrl ?? 'http://127.0.0.1:5190';
let server;

async function waitForServer(url) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw Error(`Dev server did not become ready at ${url}`);
}

async function timed(page, method, sourceText) {
  const started = performance.now();
  const evaluation = page.evaluate(
    async ({ method, sourceText }) => {
      const bench = window.__svgBench;
      if (!bench) return { error: 'SVG benchmark API is not ready' };
      return bench[method](sourceText);
    },
    { method, sourceText },
  );
  const timeout = new Promise((resolve) =>
    setTimeout(() => resolve({ error: 'Timed out after 60 seconds' }), 60_000),
  );
  const result = await Promise.race([evaluation, timeout]);
  return { result, ms: Math.round((performance.now() - started) * 10) / 10 };
}

async function writeOutput(tool, relativePath, text) {
  const path = join(root, 'benchmarks/svg/external', tool, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}

try {
  if (!suppliedBaseUrl) {
    server = spawn(
      'pnpm',
      [
        'run',
        'dev',
        '--host',
        '127.0.0.1',
        '--port',
        '5190',
        '--strictPort',
      ],
      {
        cwd: root,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
      },
    );
    server.stdout.pipe(process.stdout);
    server.stderr.pipe(process.stderr);
  }
  await waitForServer(`${baseUrl}/bench-svg`);
  const manifest = JSON.parse(
    await readFile(join(corpusDir, 'MANIFEST.json'), 'utf8'),
  );
  const entries = manifest.slice(0, limit);
  const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseUrl}/bench-svg`);
  await page.waitForFunction(() => Boolean(window.__svgBench));
  const records = [];

  for (const [index, entry] of entries.entries()) {
    const sourceText = await readFile(join(corpusDir, entry.path), 'utf8');
    const inputBytes = Buffer.byteLength(sourceText);
    // Node zlib and browser fflate are comparable, but not always byte-identical.
    // Cross-tool comparison must recompress every output with the same encoder.
    const inputGzipBytes = gzipSync(sourceText, { level: 9 }).length;
    const safeRun = await timed(page, 'runSafe', sourceText);
    const autoRun = await timed(page, 'runAuto', sourceText);
    const errors = [safeRun.result.error, autoRun.result.error].filter(Boolean);
    const record = {
      path: entry.path,
      stratum: entry.stratum,
      inputBytes,
      inputGzipBytes,
      safe: safeRun.result.error
        ? undefined
        : {
            rawBytes: safeRun.result.rawBytes,
            gzipBytes: safeRun.result.gzipBytes,
            ms: safeRun.ms,
          },
      auto: autoRun.result.error
        ? undefined
        : {
            rawBytes: autoRun.result.rawBytes,
            gzipBytes: autoRun.result.gzipBytes,
            winner: autoRun.result.winner,
            verified: autoRun.result.verified,
            ms: autoRun.ms,
          },
      ...(errors.length ? { error: errors.join('; ') } : {}),
    };
    records.push(record);
    if (!safeRun.result.error)
      await writeOutput('frisp-safe', entry.path, safeRun.result.svg);
    if (!autoRun.result.error)
      await writeOutput(
        'frisp-auto',
        entry.path,
        autoRun.result.svg ?? autoRun.result.text,
      );
    console.log(
      `[${index + 1}/${entries.length}] ${entry.path}${errors.length ? ` — ${errors.join('; ')}` : ''}`,
    );
  }

  await browser.close();
  const result = {
    date: new Date().toISOString(),
    sha,
    corpusCount: entries.length,
    records,
  };
  const resultDir = join(root, 'benchmarks/svg/results');
  await mkdir(resultDir, { recursive: true });
  const resultPath = join(resultDir, `frisp-${sha}.json`);
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Wrote ${resultPath.replace(`${root}/`, '')}`);
} finally {
  if (server && server.exitCode === null) {
    if (process.platform === 'win32') server.kill();
    else process.kill(-server.pid, 'SIGTERM');
  }
}
