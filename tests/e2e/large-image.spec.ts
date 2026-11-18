import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

// Large-input smoke: a 4000×3000 (12 MP) photo must encode without crashing or
// running out of memory. WebP is fast enough at this size to keep the suite
// quick; the heavy codecs (AVIF/JXL) on big images are timed in the benchmark.
const large = fileURLToPath(
  new URL('../fixtures/photo-large.jpg', import.meta.url),
);

test('encodes a large 12 MP image without crashing (WebP)', async ({
  page,
}) => {
  test.slow();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/');
  await page.setInputFiles('input[type=file][accept^="image/*"]', large);

  const rightSelect = page.locator('.options-2 select.builtin-select');
  await expect(rightSelect).toBeVisible();
  await rightSelect.selectOption('webP');

  await expect
    .poll(async () => (await page.title()).includes('⏳'), { timeout: 120_000 })
    .toBe(false);
  const download = page.locator('.options-2 a.download[href^="blob:"]');
  await expect(download).toBeVisible({ timeout: 120_000 });

  const href = await download.getAttribute('href');
  const size = await page.evaluate(
    async (url: string) => (await (await fetch(url)).arrayBuffer()).byteLength,
    href!,
  );
  expect(size, 'large-image WebP output should be a real file').toBeGreaterThan(
    1000,
  );
  expect(errors, 'no page errors encoding a large image').toEqual([]);
});
