import { expect, test } from '@playwright/test';

// `.qoi` input is decoded by the QOI WASM decoder alone: no browser decodes
// QOI natively, and the QOI encoder stopped shipping on 2026-11-17. This opens
// a QOI image, saves it as lossless PNG, and compares every pixel of the PNG
// with the pixels written into the QOI file, so a broken decoder (or a missing
// decoder asset) fails here.

const WIDTH = 40;
const HEIGHT = 24;

// Opaque pixels with a different colour in every column and row, so a
// transposed or shifted decode cannot match by accident.
function pixel(x: number, y: number): [number, number, number] {
  return [(x * 6) % 256, (y * 10) % 256, (x * 3 + y * 7) % 256];
}

// The smallest valid QOI stream: a 14-byte header, one QOI_OP_RGB chunk per
// pixel, and the 8-byte end marker (https://qoiformat.org/qoi-specification.pdf).
function qoiImage(): Buffer {
  const bytes = [...Buffer.from('qoif')];
  const u32 = (n: number) => [
    n >>> 24,
    (n >>> 16) & 255,
    (n >>> 8) & 255,
    n & 255,
  ];
  bytes.push(...u32(WIDTH), ...u32(HEIGHT), 3, 0);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) bytes.push(0xfe, ...pixel(x, y));
  }
  bytes.push(0, 0, 0, 0, 0, 0, 0, 1);
  return Buffer.from(bytes);
}

test('opens and decodes a .qoi that has no image MIME type', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/');
  await page.setInputFiles('input[type=file][accept^="image/*"]', {
    name: 'grid.qoi',
    // A browser reports an empty type for a `.qoi` from disk. Playwright
    // turns an empty type into application/octet-stream, which is as far from
    // `image/*`: the editor must admit the file by extension and the worker
    // must pick the decoder by sniffing bytes.
    mimeType: '',
    buffer: qoiImage(),
  });

  const rightSelect = page.locator('.options-2 select.builtin-select');
  await expect(rightSelect).toBeVisible();
  await rightSelect.selectOption('oxiPNG');

  await expect
    .poll(async () => (await page.title()).includes('⏳'), { timeout: 60_000 })
    .toBe(false);
  const download = page.locator('.options-2 a.download[href^="blob:"]');
  await expect(download).toBeVisible({ timeout: 60_000 });
  const href = await download.getAttribute('href');
  expect(href).toBeTruthy();

  const decoded = await page.evaluate(async (url: string) => {
    const bitmap = await createImageBitmap(await (await fetch(url)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    return { width: bitmap.width, height: bitmap.height, data: [...data] };
  }, href!);

  expect([decoded.width, decoded.height]).toEqual([WIDTH, HEIGHT]);
  const mismatches: string[] = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const i = (y * WIDTH + x) * 4;
      const got = decoded.data.slice(i, i + 4);
      const want = [...pixel(x, y), 255];
      if (got.join() !== want.join()) {
        mismatches.push(`(${x},${y}) got ${got.join()} want ${want.join()}`);
      }
    }
  }
  expect(mismatches.slice(0, 5)).toEqual([]);
  expect(errors).toEqual([]);
});
