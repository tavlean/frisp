import { expect, test, type Page } from '@playwright/test';

const FILE_INPUT = 'input[type=file][accept^="image/*"]';
const RIGHT_PANEL = '.options-2';
const SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <title>Decorative orbit icon</title>
  <style>.orbit { fill: #6c5ce7; stroke: #2d3436; stroke-width: 2.000000; }</style>
  <circle class="orbit" cx="64.123456" cy="64.123456" r="48.654321" />
  <path class="orbit" d="M 18.123456 64.123456 C 32.654321 28.123456, 95.345678 28.123456, 109.876543 64.123456 C 95.345678 100.123456, 32.654321 100.123456, 18.123456 64.123456 Z" />
</svg>`;
const INPUT_BYTES = Buffer.byteLength(SVG);

async function importSvg(
  page: Page,
  name = 'test.svg',
  mimeType = 'image/svg+xml',
) {
  await page.setInputFiles(FILE_INPUT, {
    name,
    mimeType,
    buffer: Buffer.from(SVG),
  });
}

async function waitIdle(page: Page): Promise<void> {
  await expect
    .poll(async () => (await page.title()).includes('⏳'), { timeout: 60_000 })
    .toBe(false);
}

async function resultHref(page: Page): Promise<string> {
  const download = page.locator(`${RIGHT_PANEL} a.download[href^="blob:"]`);
  await expect(download).toBeVisible({ timeout: 60_000 });
  return (await download.getAttribute('href'))!;
}

test('optimizes SVG, keeps vector previews crisp, and re-encodes in manual mode', async ({
  page,
}) => {
  await page.goto('/');
  await importSvg(page);
  await waitIdle(page);

  await expect(page.locator(`${RIGHT_PANEL} .type-label`)).toHaveText('SVG');
  await expect(page.locator(`${RIGHT_PANEL} .gzip-size`)).toBeVisible();
  await expect(page.locator(`${RIGHT_PANEL} .auto-winner`)).toHaveText(
    /^Auto:/,
  );

  const autoHref = await resultHref(page);
  const output = await page.evaluate(async (url: string) => {
    const response = await fetch(url);
    return {
      size: (await response.clone().arrayBuffer()).byteLength,
      text: await response.text(),
    };
  }, autoHref);
  expect(output.text.replace(/^\uFEFF?\s*(?:<\?xml[^>]*>\s*)?/, '')).toMatch(
    /^<svg\b/,
  );
  expect(output.size).toBeLessThan(INPUT_BYTES);

  const previews = page.locator('.svg-preview');
  await expect(previews).toHaveCount(2);
  const before = await previews
    .first()
    .evaluate((image) => Number.parseFloat(getComputedStyle(image).width));
  await page
    .locator('pinch-zoom')
    .first()
    .evaluate((element: any) =>
      element.setTransform({ scale: 8, x: 0, y: 0, allowChangeEvent: true }),
    );
  await expect
    .poll(() =>
      previews
        .first()
        .evaluate((image) => Number.parseFloat(getComputedStyle(image).width)),
    )
    .toBeGreaterThan(before * 7.5);

  await page
    .locator(`${RIGHT_PANEL} label:has-text("Mode:") select`)
    .selectOption('manual');
  const manualInitialHref = await resultHref(page);
  const precision = page.locator(
    `${RIGHT_PANEL} label:has-text("Precision:") input[type="range"]`,
  );
  await precision.fill('1');
  await waitIdle(page);
  await expect.poll(() => resultHref(page)).not.toBe(manualInitialHref);
});

test('loads an uppercase .SVG name without a MIME type', async ({ page }) => {
  await page.goto('/');
  await importSvg(page, 'TEST.SVG', '');
  await waitIdle(page);
  await expect(page.locator(`${RIGHT_PANEL} .type-label`)).toHaveText('SVG');
  await expect(
    page.locator(`${RIGHT_PANEL} a.download[href^="blob:"]`),
  ).toBeVisible();
});

test('optimizes SVG offline after the worker is runtime-cached once', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit',
    'Playwright-WebKit cannot reload while context offline',
  );
  await page.goto('/?sw=1');
  await page.waitForFunction(
    () => navigator.serviceWorker?.controller != null,
    null,
    {
      timeout: 30_000,
    },
  );
  await importSvg(page);
  await waitIdle(page);
  await resultHref(page);

  await context.setOffline(true);
  await page.reload();
  await importSvg(page, 'offline.svg', '');
  await waitIdle(page);
  await expect(
    page.locator(`${RIGHT_PANEL} a.download[href^="blob:"]`),
  ).toBeVisible();
  await context.setOffline(false);
});
