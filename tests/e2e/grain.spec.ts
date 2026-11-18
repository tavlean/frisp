import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// Guards the film-grain processor's two contracts (docs/project/specs/
// 2026-07-12-film-grain.md):
//
//  1. Enabling grain genuinely re-encodes — a new blob URL with different
//     bytes (the grain is baked into the pixels, not a preview effect).
//
//  2. Disabling grain folds out of the encode signature (grainIsReal → null),
//     so toggling it back off lands on the ORIGINAL cached result — the exact
//     same blob URL, no re-encode.
//
// Style/idioms (fixture loading, blob: download link, ⏳ title polling) are
// copied from editor-interactions.spec.ts.
const photo = fileURLToPath(new URL('../fixtures/photo.jpg', import.meta.url));

const RIGHT_PANEL = '.options-2';

async function rightDownloadHref(page: Page): Promise<string> {
  const download = page.locator(`${RIGHT_PANEL} a.download[href^="blob:"]`);
  await expect(download).toBeVisible({ timeout: 60_000 });
  const href = await download.getAttribute('href');
  expect(href, 'right panel download href missing').toBeTruthy();
  return href!;
}

async function waitIdle(page: Page): Promise<void> {
  await expect
    .poll(async () => (await page.title()).includes('⏳'), { timeout: 60_000 })
    .toBe(false);
}

async function blobSize(page: Page, href: string): Promise<number> {
  return page.evaluate(
    async (url: string) => (await (await fetch(url)).blob()).size,
    href,
  );
}

test('film grain re-encodes with different bytes and folds out of the signature when off', async ({
  page,
}) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file][accept^="image/*"]', photo);

  await waitIdle(page);
  const hrefPlain = await rightDownloadHref(page);
  const sizePlain = await blobSize(page, hrefPlain);

  // Enable Film grain (default Amount 12) → a fresh encode with new bytes.
  await page.locator('label:has-text("Film grain")').first().click();
  await waitIdle(page);
  await expect
    .poll(
      async () => {
        const href = await page
          .locator(`${RIGHT_PANEL} a.download[href^="blob:"]`)
          .getAttribute('href');
        return href !== hrefPlain ? href : null;
      },
      { timeout: 60_000 },
    )
    .not.toBeNull();
  const hrefGrain = await rightDownloadHref(page);
  const sizeGrain = await blobSize(page, hrefGrain);
  expect(
    sizeGrain,
    'grained output should differ in size from the plain encode',
  ).not.toBe(sizePlain);

  // Disable it again → the recipe folds back to the plain signature, which
  // must be a cache hit: the EXACT original blob URL, with no busy marker.
  await page.locator('label:has-text("Film grain")').first().click();
  await expect
    .poll(
      async () =>
        page
          .locator(`${RIGHT_PANEL} a.download[href^="blob:"]`)
          .getAttribute('href'),
      { timeout: 3000 },
    )
    .toBe(hrefPlain);
  expect(
    (await page.title()).includes('⏳'),
    'disabling grain should land on the cache — no re-encode',
  ).toBe(false);
});
