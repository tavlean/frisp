import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const photo = fileURLToPath(new URL('../fixtures/photo.jpg', import.meta.url));

// AVIF and JXL ship Emscripten-pthread `_mt` / `_mt_simd` builds. This proves the
// threaded path actually ENGAGES (the main codec worker loads the threaded glue +
// shared-memory wasm and spawns the pthread pool) instead of silently falling back
// to single-thread.
//
// Cross-engine signal: like oxipng, Chromium surfaces the nested pthread workers
// to page.on('worker') while WebKit does not — so the worker COUNT is unreliable in
// WebKit. The robust, engine-agnostic signal is the NETWORK fetch of the threaded
// `<codec>_enc_mt(_simd).wasm`, which is `threaded-only` (NOT precached), so it is
// fetched ONLY when the threaded path runs in the (top-level) codec worker; plus
// the absence of the runtime's "multithread load failed" warning (the runtime
// awaits the Emscripten module init, which awaits the pthread pool, so no-fallback
// and no-timeout ⇒ the pool genuinely built).
const CODECS = [
  {
    id: 'avif',
    label: 'AVIF',
    mt: 'avif_enc_mt',
    warn: /AVIF multithread load failed/i,
  },
  {
    id: 'jxl',
    label: 'JPEG XL',
    mt: 'jxl_enc_mt',
    warn: /JPEG XL multithread load failed/i,
  },
];

for (const codec of CODECS) {
  test(`${codec.label} threading engages (no single-thread fallback)`, async ({
    page,
    browserName,
  }) => {
    let mtWasmRequests = 0;
    let workerScriptRequests = 0;
    let pthreadWorkers = 0;
    let fallback = false;

    // Match both the plain and the SIMD variant: JXL ships `jxl_enc_mt` and
    // `jxl_enc_mt_simd`, and modern engines pick the SIMD one. `codec.mt` is the
    // shared prefix, and `.worker` distinguishes the pthread worker from the glue.
    const isWorker = (url: string) =>
      url.includes(codec.mt) && url.includes('.worker');
    page.on('worker', (w) => {
      if (isWorker(w.url())) pthreadWorkers++;
    });
    page.on('request', (r) => {
      const url = r.url();
      if (url.includes(codec.mt) && url.endsWith('.wasm')) mtWasmRequests++;
      if (isWorker(url)) workerScriptRequests++;
    });
    page.on('console', (m) => {
      if (codec.warn.test(m.text())) fallback = true;
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
      .selectOption(codec.id);
    await page
      .locator('.options-2 a.download[href^="blob:"]')
      .waitFor({ state: 'visible', timeout: 80_000 });
    await page.waitForTimeout(500);

    const hw = await page.evaluate(() => navigator.hardwareConcurrency);
    // eslint-disable-next-line no-console
    console.log(
      `[${codec.label}-THREADS ${browserName}] hw=${hw} mtWasm=${mtWasmRequests} ` +
        `workers=${pthreadWorkers} workerReq=${workerScriptRequests} fallback=${fallback}`,
    );

    // The threaded wasm was loaded (so the threaded path ran) and the runtime did
    // not fall back to single-thread.
    expect(fallback).toBe(false);
    expect(mtWasmRequests).toBeGreaterThan(0);
  });
}
