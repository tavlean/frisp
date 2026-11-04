import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

/**
 * Codec benchmark across image TYPES. For each fixture (photo / illustration /
 * transparent / big) it encodes through every WASM codec at default settings and
 * records, per codec:
 *   - outputBytes:  exact, deterministic. The "compresses better?" signal.
 *   - medianMs:     cache-cold, module-warm encode time (median across runs).
 *   - coldMs:       the same encode with the codec's module still to load
 *                    (0 on `photo-large`, which skips the warm-up; see FIXTURES).
 *   - ok:           encode succeeded + produced a non-trivial blob. Reliability.
 *
 * Multiple image types matter because a codec change can help photos but hurt
 * flat illustrations, break alpha, or behave differently on huge images; this
 * surfaces all of that. Writes benchmarks/results/<label>.json; capture one
 * before a codec upgrade and one after, then `npm run bench:compare` them.
 *
 * Timing measures the editor's working window (excludes the ~100ms debounce) and
 * is machine-dependent; only compare reports captured on the same machine.
 *
 * THE MEASUREMENT SHAPE IS LOAD-BEARING, so read this before changing the loop.
 * The editor keeps an in-session `ResultCache` keyed by the encode signature, so
 * a given recipe encodes for real exactly ONCE per page session; ask for it a
 * second time and you time a cache hit (~9ms of poll tick), not an encode. Two
 * rules fall out, and both are why the loop looks the way it does:
 *   1. Each measured run needs its own page session (`page.goto`), because the
 *      default-settings recipe can only miss the cache once per session.
 *   2. Inside a session the codec's WASM module must already be loaded before
 *      the measured encode, or module instantiation lands inside the timing
 *      window (it costs anywhere from ~50ms to seconds). The LEFT side does that
 *      warm-up, and `WARMUP_MARKER` keeps its encodes under a cache key the
 *      right side will never ask for.
 * The right side therefore always measures a cache-cold, module-warm encode at
 * the app's real defaults.
 */
const fixturePath = (name: string) =>
  fileURLToPath(new URL(`../tests/fixtures/${name}`, import.meta.url));
const resultsDir = fileURLToPath(new URL('./results/', import.meta.url));

// The big 12MP image runs once (each encode is slow); we mainly want to see
// whether huge inputs behave differently, not a tight timing distribution.
//
// It is also the one fixture that skips the left-side warm-up. Three live 12MP
// results (the Original, the warm-up, the measured one) come to ~288 MB of
// retained pixel buffers against the ResultCache's 256 MiB budget, and when the
// cache is over budget with every older entry pinned it evicts (and revokes the
// object URL of) the entry it was just handed, which is the one the benchmark
// is about to read. So `photo-large` keeps the single-side memory profile and
// pays module load inside its timing, which is fine: its number has always been
// a regression signal rather than a measurement.
const FIXTURES = [
  { name: 'photo', file: 'photo.jpg', runs: 3, warmUp: true },
  { name: 'illustration', file: 'illustration.png', runs: 3, warmUp: true },
  { name: 'transparent', file: 'transparent.png', runs: 3, warmUp: true },
  // Diverse synthetic stressors (all 512×512 except screenshot at 1280×800):
  // gradients isolate banding-vs-noise, hard-edges stresses ringing, noise is
  // the incompressible worst case, screenshot stresses text + flat + edges.
  { name: 'gradient', file: 'gradient.png', runs: 3, warmUp: true },
  {
    name: 'gradient-dithered',
    file: 'gradient-dithered.png',
    runs: 3,
    warmUp: true,
  },
  { name: 'hard-edges', file: 'hard-edges.png', runs: 3, warmUp: true },
  {
    name: 'noise-synthetic',
    file: 'noise-synthetic.png',
    runs: 3,
    warmUp: true,
  },
  { name: 'screenshot', file: 'screenshot.png', runs: 3, warmUp: true },
  { name: 'photo-large', file: 'photo-large.jpg', runs: 1, warmUp: false },
];

// MozJPEG left the picker on 2026-11-04 (jpegli is the one JPEG), and the
// bench drives the picker, so it is no longer measured here.
const CODECS = [
  { id: 'webP', label: 'WebP' },
  { id: 'avif', label: 'AVIF' },
  { id: 'jxl', label: 'JPEG XL' },
  { id: 'jpegli', label: 'jpegli' },
  { id: 'oxiPNG', label: 'OxiPNG' },
];

// Helpers installed into the page by the init script below, so both measuring
// functions share one definition instead of re-declaring them inside every
// `page.evaluate` (whose bodies are serialized and cannot close over this file).
declare global {
  interface Window {
    __bench: {
      waitFor(predicate: () => boolean, timeoutMs?: number): Promise<void>;
      /** True while EITHER side is encoding; the title spinner is global. */
      working(): boolean;
      selectFormat(select: HTMLSelectElement, value: string): void;
    };
  }
}

// Marker key seeded into the LEFT side's persisted options. Unknown option keys
// survive settings-storage's merge, land in the encode signature (which
// stable-stringifies the whole options object), and are ignored by the codec
// bindings; so the left side encodes exactly the same bytes at exactly the same
// cost under a key the right side will never ask for. Never seeded on the right:
// the measured side must run the app's pristine defaults.
const WARMUP_MARKER = '__benchWarmupSide';

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

test('codec benchmark across image types', async ({ page }) => {
  test.slow();

  // Runs before every navigation, so each page session starts from the same
  // known settings: both sides on Original (uploading a fixture therefore
  // triggers no encode of its own) and the left side marked as the warm-up side.
  await page.addInitScript(
    ({ marker, formats }) => {
      localStorage.setItem(
        'app:settings:v3',
        JSON.stringify({
          sides: [
            {
              format: 'identity',
              optionsByFormat: Object.fromEntries(
                formats.map((format) => [format, { [marker]: 1 }]),
              ),
            },
            { format: 'identity' },
          ],
        }),
      );

      window.__bench = {
        waitFor: (predicate, timeoutMs = 300_000) =>
          new Promise((resolve, reject) => {
            const started = performance.now();
            const tick = setInterval(() => {
              if (predicate()) {
                clearInterval(tick);
                resolve();
              } else if (performance.now() - started > timeoutMs) {
                clearInterval(tick);
                reject(new Error('timeout'));
              }
            }, 8);
          }),
        working: () => document.title.includes('⏳'),
        selectFormat: (select, value) => {
          // Bypass Svelte's bound value so the change event carries the new
          // value the way a real user selection would.
          Object.getOwnPropertyDescriptor(
            HTMLSelectElement.prototype,
            'value',
          )!.set!.call(select, value);
          select.dispatchEvent(new Event('change', { bubbles: true }));
        },
      };
    },
    { marker: WARMUP_MARKER, formats: CODECS.map((codec) => codec.id) },
  );

  await page.goto('/');
  const env = await page.evaluate(() => ({
    cores: navigator.hardwareConcurrency,
    isolated: self.crossOriginIsolated,
    ua: navigator.userAgent,
  }));

  /**
   * Load the codec's WASM module on the LEFT side, so it is out of the way
   * before the right side is timed. Returns the warm-up's own duration; the
   * same encode with the module still to load, which is what `coldMs` reports.
   *
   * The left side is always on Original when this is called, and Original shows
   * the image info card (with its "Compare as…" popover) instead of a format
   * select; so the format is chosen from the popover. Its buttons carry no
   * format id, so the target is matched on the label the right side's select
   * shows for the same id: both come from OUTPUT_FORMATS, which keeps the labels
   * out of this file.
   *
   * It parks the left side back on Original afterwards, so the measured encode
   * runs against an otherwise-idle editor and the warm-up's result stops being
   * pinned in the cache.
   */
  const warmUpLeft = (formatId: string) =>
    page.evaluate(async (id: string) => {
      const { waitFor, working, selectFormat } = window.__bench;
      const left = document.querySelector('.options-1')!;
      const label = [
        ...document.querySelectorAll<HTMLOptionElement>(
          '.options-2 select.builtin-select option',
        ),
      ]
        .find((option) => option.value === id)!
        .textContent!.trim();
      left.querySelector<HTMLButtonElement>('.compare-trigger')!.click();
      await waitFor(() => !!left.querySelector('.compare-option'), 5_000);
      [...left.querySelectorAll<HTMLButtonElement>('.compare-option')]
        .find((button) => button.textContent!.trim() === label)!
        .click();

      await waitFor(() => working(), 5_000).catch(() => {});
      const start = performance.now();
      await waitFor(() => !working());
      const ms = performance.now() - start;

      selectFormat(
        left.querySelector<HTMLSelectElement>('select.builtin-select')!,
        'identity',
      );
      await waitFor(() => !working());
      return ms;
    }, formatId);

  /**
   * The measured encode: park the right side on Original, switch it to the
   * target format, and time the editor's working window. In a fresh session this
   * is the first (and only) time the format's default-settings recipe is asked
   * for, so it always misses the ResultCache.
   */
  const encodeRight = (formatId: string) =>
    page.evaluate(async (id: string) => {
      const { waitFor, working, selectFormat } = window.__bench;
      const root = document.querySelector('.options-2')!;
      const select = root.querySelector<HTMLSelectElement>(
        'select.builtin-select',
      )!;
      const download = () =>
        root.querySelector<HTMLAnchorElement>('a.download[href^="blob:"]');

      selectFormat(select, 'identity');
      await waitFor(() => !working());
      const prevHref = download()?.href ?? null;

      selectFormat(select, id);
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
  // Assertions are deferred to the end so a failure still leaves a full report
  // on disk to diagnose from.
  const failures: string[] = [];

  for (const fixture of FIXTURES) {
    const inputBytes = readFileSync(fixturePath(fixture.file)).byteLength;
    console.log(`\n[${fixture.name}] (${(inputBytes / 1024) | 0} KB input)`);

    // Per codec, accumulated across the runs. `sizes` is a Set because a second
    // run reporting different bytes means the encode is not deterministic, which
    // invalidates the whole "size is the trustworthy signal" premise; so it is
    // reported rather than averaged away.
    const acc = new Map(
      CODECS.map((codec) => [
        codec.id,
        {
          cold: 0,
          runs: [] as number[],
          sizes: new Set<number>(),
          ok: true,
          error: '',
        },
      ]),
    );

    for (let run = 0; run < fixture.runs; run++) {
      // A fresh session per run: the ResultCache dies with the page, so the
      // measured encode below is a genuine cache miss every time.
      await page.goto('/');
      await page.setInputFiles('input[type=file]', fixturePath(fixture.file));
      await expect(
        page.locator('.options-2 select.builtin-select'),
      ).toBeVisible();

      for (const codec of CODECS) {
        const state = acc.get(codec.id)!;
        try {
          const warmupMs = fixture.warmUp ? await warmUpLeft(codec.id) : 0;
          const measured = await encodeRight(codec.id);
          if (run === 0) state.cold = warmupMs;
          state.runs.push(measured.ms);
          state.sizes.add(measured.bytes);
          state.ok = state.ok && measured.bytes > 24;
        } catch (error) {
          state.ok = false;
          state.error = error instanceof Error ? error.message : String(error);
        }
      }
    }

    const codecResults = CODECS.map((codec) => {
      const state = acc.get(codec.id)!;
      const sizes = [...state.sizes];
      const medianMs = state.runs.length ? Math.round(median(state.runs)) : 0;
      const result = {
        format: codec.id,
        label: codec.label,
        ok: state.ok,
        outputBytes: sizes[0] ?? 0,
        coldMs: Math.round(state.cold),
        medianMs,
        runsMs: state.runs.map((ms) => Math.round(ms)),
        ...(sizes.length > 1 ? { nondeterministicBytes: sizes } : {}),
      };
      console.log(
        `  ${codec.label.padEnd(9)} ${state.ok ? 'ok ' : 'FAIL'} ${String(
          result.outputBytes,
        ).padStart(9)} B  ${medianMs}ms (cold ${result.coldMs}ms)${
          sizes.length > 1 ? `  ⚠ NONDETERMINISTIC: ${sizes.join(' / ')}` : ''
        }`,
      );
      if (!state.ok) {
        failures.push(
          `${codec.label} failed on ${fixture.name}${state.error ? `: ${state.error}` : ''}`,
        );
      }
      if (sizes.length > 1) {
        failures.push(
          `${codec.label} produced different sizes across runs on ${fixture.name}: ${sizes.join(' / ')}`,
        );
      }
      return result;
    });

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

  expect(failures, failures.join('\n')).toEqual([]);
});
