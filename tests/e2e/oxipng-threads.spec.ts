import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const photo = fileURLToPath(new URL('../fixtures/photo.jpg', import.meta.url));

// Proves the threaded (wasm-bindgen-rayon) oxipng path actually ENGAGES — i.e.
// the pkg-parallel build's SHARED WebAssembly.Memory lets initThreadPool spawn
// the rayon worker pool — instead of silently falling back to single-thread.
//
// Two signals, because Playwright surfaces nested workers differently per engine:
//   - Chromium reports the rayon pool's workers (the codec runs in a worker; rayon
//     spawns workers from THAT worker) to page.on('worker'), so we see one
//     `workerHelpers` worker per core.
//   - WebKit (Safari's engine) does NOT surface nested workers to page.on('worker'),
//     so the worker COUNT is unreliable there. The robust, engine-agnostic signal is
//     the NETWORK fetch of the `workerHelpers` script (the threaded glue imports it
//     and `new Worker(new URL('./workerHelpers.js', …))` spawns it). We assert that
//     fired and that the runtime's "multithread load failed" fallback warning never
//     did — initThreadPool awaits every worker reaching `ready`, so no-fallback
//     (and no timeout) means the pool genuinely built.
test('oxipng threading engages (no single-thread fallback)', async ({
  page,
  browserName,
}) => {
  let workerHelperWorkers = 0;
  let workerHelperRequests = 0;
  let fallback = false;

  page.on('worker', (w) => {
    if (w.url().includes('workerHelpers')) workerHelperWorkers++;
  });
  page.on('request', (r) => {
    if (r.url().includes('workerHelpers')) workerHelperRequests++;
  });
  page.on('console', (m) => {
    if (/multithread load failed/i.test(m.text())) fallback = true;
  });
  page.on('pageerror', (e) =>
    // eslint-disable-next-line no-console
    console.log(`[PAGEERR ${browserName}] ${String(e)}`),
  );

  await page.goto('/');
  await page.setInputFiles('input[type=file][accept^="image/*"]', photo);
  await page
    .locator('.options-2')
    .locator('select.builtin-select')
    .first()
    .selectOption('oxiPNG');
  await page
    .locator('.options-2 a.download[href^="blob:"]')
    .waitFor({ state: 'visible', timeout: 60_000 });
  await page.waitForTimeout(500);

  const hw = await page.evaluate(() => navigator.hardwareConcurrency);
  // eslint-disable-next-line no-console
  console.log(
    `[OXIPNG-THREADS ${browserName}] hw=${hw} workers=${workerHelperWorkers} ` +
      `requests=${workerHelperRequests} fallback=${fallback}`,
  );

  // The threaded path ran and did not fall back to single-thread. Each engine
  // surfaces a different signal that the rayon worker path executed: Chromium
  // reports both the nested worker objects and the script fetch; WebKit only the
  // network fetch (no nested-worker visibility); Firefox only the worker objects
  // (no nested-worker network visibility). Require at least one positive signal.
  expect(fallback).toBe(false);
  expect(workerHelperWorkers + workerHelperRequests).toBeGreaterThan(0);
});
