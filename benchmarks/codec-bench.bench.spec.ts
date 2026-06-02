import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

/**
 * Codec benchmark across image TYPES. For each fixture (photo / illustration /
 * transparent / big) it encodes through every WASM codec at default settings and
 * records, per codec:
 *   - outputBytes  — exact, deterministic. The "compresses better?" signal.
 *   - medianMs     — encode time (median of warm runs; cold/module-load separate).
 *   - ok           — encode succeeded + produced a non-trivial blob. Reliability.
 *
 * Multiple image types matter because a codec change can help photos but hurt
 * flat illustrations, break alpha, or behave differently on huge images — this
 * surfaces all of that. Writes benchmarks/results/<label>.json; capture one
 * before a codec upgrade and one after, then `npm run bench:compare` them.
 *
 * Timing measures the editor's working window (excludes the ~100ms debounce) and
 * is machine-dependent — only compare reports captured on the same machine.
 */
const fixturePath = (name: string) =>
  fileURLToPath(new URL(`../tests/fixtures/${name}`, import.meta.url));
const resultsDir = fileURLToPath(new URL('./results/', import.meta.url));

// The big 12MP image runs fewer times (each encode is slow) — we mainly want to
// see whether huge inputs behave differently, not a tight timing distribution.
const FIXTURES = [
  { name: 'photo', file: 'photo.jpg', warmup: 1, runs: 3 },
  { name: 'illustration', file: 'illustration.png', warmup: 1, runs: 3 },
  { name: 'transparent', file: 'transparent.png', warmup: 1, runs: 3 },
  // Diverse synthetic stressors (all 512×512 except screenshot at 1280×800):
  // gradients isolate banding-vs-noise, hard-edges stresses ringing, noise is
  // the incompressible worst case, screenshot stresses text + flat + edges.
  { name: 'gradient', file: 'gradient.png', warmup: 1, runs: 3 },
  {
    name: 'gradient-dithered',
    file: 'gradient-dithered.png',
    warmup: 1,
    runs: 3,
  },
  { name: 'hard-edges', file: 'hard-edges.png', warmup: 1, runs: 3 },
  { name: 'noise-synthetic', file: 'noise-synthetic.png', warmup: 1, runs: 3 },
  { name: 'screenshot', file: 'screenshot.png', warmup: 1, runs: 3 },
  { name: 'photo-large', file: 'photo-large.jpg', warmup: 0, runs: 1 },
];

const CODECS = [
  { id: 'webP', label: 'WebP' },
  { id: 'avif', label: 'AVIF' },
  { id: 'jxl', label: 'JPEG XL' },
  { id: 'mozJPEG', label: 'MozJPEG' },
  { id: 'oxiPNG', label: 'OxiPNG' },
  { id: 'qoi', label: 'QOI' },
];

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

test('codec benchmark across image types', async ({ page }) => {
  test.slow();
  await page.goto('/');
  const env = await page.evaluate(() => ({
    cores: navigator.hardwareConcurrency,
    isolated: self.crossOriginIsolated,
    ua: navigator.userAgent,
  }));

  // One encode measured in-page: switch the right side to the target format,
  // time the editor's working window, and read the output size.
  const encodeOnce = (formatId: string) =>
    page.evaluate(async (id: string) => {
      const root = document.querySelector('.options-2')!;
      const select = root.querySelector<HTMLSelectElement>(
        'select.builtin-select',
      )!;
      const download = () =>
        root.querySelector<HTMLAnchorElement>('a.download[href^="blob:"]');
      const setFormat = (val: string) => {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,
          'value',
        )!.set!;
        setter.call(select, val);
        select.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const waitFor = (pred: () => boolean, timeout = 300_000) =>
        new Promise<void>((resolve, reject) => {
          const start = performance.now();
          const tick = setInterval(() => {
            if (pred()) {
              clearInterval(tick);
              resolve();
            } else if (performance.now() - start > timeout) {
              clearInterval(tick);
              reject(new Error('timeout'));
            }
          }, 8);
        });
      const working = () => document.title.includes('⏳');

      setFormat('identity');
      await waitFor(() => !working());
      const prevHref = download()?.href ?? null;

      setFormat(id);
      await waitFor(() => working(), 5_000).catch(() => {});
      const start = performance.now();
      await waitFor(
        () => !working() && !!download() && download()!.href !== prevHref,
      );
      const ms = performance.now() - start;
      const bytes = (await (await fetch(download()!.href)).arrayBuffer())
        .byteLength;
      return { ms, bytes };
    }, formatId);

  const fixtureReports = [];

  for (const fixture of FIXTURES) {
    await page.goto('/');
    await page.setInputFiles('input[type=file]', fixturePath(fixture.file));
    await expect(
      page.locator('.options-2 select.builtin-select'),
    ).toBeVisible();
    const inputBytes = readFileSync(fixturePath(fixture.file)).byteLength;

    console.log(`\n[${fixture.name}] (${(inputBytes / 1024) | 0} KB input)`);
    const codecResults = [];
    for (const codec of CODECS) {
      let cold = 0;
      const runs: number[] = [];
      let bytes = 0;
      let ok = true;
      try {
        for (let i = 0; i < fixture.warmup; i++)
          cold = (await encodeOnce(codec.id)).ms;
        for (let i = 0; i < fixture.runs; i++) {
          const r = await encodeOnce(codec.id);
          runs.push(r.ms);
          bytes = r.bytes;
        }
        ok = bytes > 24;
      } catch {
        ok = false;
      }
      const medianMs = runs.length ? Math.round(median(runs)) : 0;
      codecResults.push({
        format: codec.id,
        label: codec.label,
        ok,
        outputBytes: bytes,
        coldMs: Math.round(cold),
        medianMs,
        runsMs: runs.map((m) => Math.round(m)),
      });
      console.log(
        `  ${codec.label.padEnd(9)} ${ok ? 'ok ' : 'FAIL'} ${String(bytes).padStart(9)} B  ${medianMs}ms`,
      );
      expect(ok, `${codec.label} failed on ${fixture.name}`).toBe(true);
    }
    fixtureReports.push({
      name: fixture.name,
      file: fixture.file,
      inputBytes,
      codecs: codecResults,
    });
  }

  const report = {
    label: process.env.BENCH_LABEL ?? 'current',
    generatedAt: new Date().toISOString(),
    machine: env,
    fixtures: fixtureReports,
  };

  mkdirSync(resultsDir, { recursive: true });
  const out = `${resultsDir}${report.label}.json`;
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(
    `\nBenchmark report written: benchmarks/results/${report.label}.json`,
  );
});
