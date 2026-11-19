import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

// Alpha-channel preservation. Encodes the transparent fixture and re-decodes the
// output to confirm a transparent source pixel stays transparent and an opaque
// one stays opaque. Catches a codec change that flattens or corrupts alpha.
//
// Only formats the browser can natively re-decode are checked here (so we can
// sample the output). JPEG formats have no alpha; JXL/QOI aren't natively
// decodable in Chromium, so their alpha isn't sampled here — they're still
// covered by codec-encode.
const transparent = fileURLToPath(
  new URL('../fixtures/transparent.png', import.meta.url),
);

const ALPHA_FORMATS = [
  { id: 'webP', label: 'WebP' },
  { id: 'avif', label: 'AVIF' },
  { id: 'oxiPNG', label: 'OxiPNG' },
];

for (const fmt of ALPHA_FORMATS) {
  test(`${fmt.label} preserves transparency`, async ({ page }) => {
    await page.goto('/');
    await page.setInputFiles(
      'input[type=file][accept^="image/*"]',
      transparent,
    );

    const rightSelect = page.locator('.options-2 select.builtin-select');
    await expect(rightSelect).toBeVisible();
    await rightSelect.selectOption(fmt.id);

    await expect
      .poll(async () => (await page.title()).includes('⏳'), {
        timeout: 60_000,
      })
      .toBe(false);
    const download = page.locator('.options-2 a.download[href^="blob:"]');
    await expect(download).toBeVisible({ timeout: 60_000 });
    const href = await download.getAttribute('href');

    // Re-decode the encoded output and sample the (transparent) corner and the
    // (opaque) disc centre. WebKit's decode can come back all zero bytes when
    // its GPU process dies mid-draw (see nativeDecode in src/worker/
    // offscreen.ts), so a blank readback is decoded once more: a blank OUTPUT
    // stays blank and still fails below.
    const { cornerAlpha, centreAlpha } = await page.evaluate(async (url) => {
      const blob = await (await fetch(url!)).blob();
      const decode = async () => {
        const bmp = await createImageBitmap(blob);
        const cv = new OffscreenCanvas(bmp.width, bmp.height);
        const ctx = cv.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(bmp, 0, 0);
        return ctx.getImageData(0, 0, bmp.width, bmp.height);
      };
      let image = await decode();
      if (image.data.every((byte) => byte === 0)) image = await decode();
      const alphaAt = (x: number, y: number) =>
        image.data[(y * image.width + x) * 4 + 3];
      return {
        cornerAlpha: alphaAt(2, 2),
        centreAlpha: alphaAt(image.width >> 1, image.height >> 1),
      };
    }, href);

    expect(
      cornerAlpha,
      `${fmt.label}: a transparent source pixel should stay transparent`,
    ).toBeLessThan(128);
    expect(
      centreAlpha,
      `${fmt.label}: an opaque source pixel should stay opaque`,
    ).toBeGreaterThan(200);
  });
}
