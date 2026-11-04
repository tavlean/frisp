import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// The export contract: whatever Save, Share, or the ZIP hands the user must be
// the result of the recipe currently on screen, under a name that matches its
// bytes. Each test here reproduced a way that contract broke (first-principles
// review 2026-11-02, section 1) before its fix landed.

const FILE_INPUT = 'input[type=file][accept="image/*"]';
const RIGHT_PANEL = '.options-2';
const CELL = '.rich-strip .cell[data-bulk-cell-id]';
const photo = fileURLToPath(new URL('../fixtures/photo.jpg', import.meta.url));
const gradient = fileURLToPath(
  new URL('../fixtures/gradient.png', import.meta.url),
);
const photoLarge = fileURLToPath(
  new URL('../fixtures/photo-large.jpg', import.meta.url),
);
const screenshot = fileURLToPath(
  new URL('../fixtures/screenshot.png', import.meta.url),
);

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <circle cx="48.123456" cy="48.123456" r="36.654321" fill="#6c5ce7" stroke="#2d3436" stroke-width="2.000000"/>
</svg>`;

const ascii = (head: number[], a: number, b: number) =>
  String.fromCharCode(...head.slice(a, b));

async function waitBulkReady(page: Page, cells: number): Promise<void> {
  await expect
    .poll(
      async () =>
        page.locator(CELL).evaluateAll((nodes) =>
          nodes.map((cell) => ({
            done: !!cell.querySelector('.delta'),
            working: !!cell.querySelector('.spinner-overlay'),
          })),
        ),
      { timeout: 90_000 },
    )
    .toEqual(
      Array.from({ length: cells }, () => ({ done: true, working: false })),
    );
}

/** Download one bulk cell's output; returns its name and the first bytes. */
async function downloadCell(
  page: Page,
  index: number,
): Promise<{ name: string; bytes: Buffer }> {
  const cell = page.locator(CELL).nth(index);
  const button = cell.getByRole('button', { name: /^Download / });
  const downloadPromise = page.waitForEvent('download');
  // The button is a hover affordance over the thumbnail, which intercepts a
  // pointer click; invoke it directly.
  await button.evaluate((node: HTMLButtonElement) => node.click());
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return { name: download.suggestedFilename(), bytes: Buffer.concat(chunks) };
}

test('Save never offers the previous result under the new format name', async ({
  page,
}) => {
  await page.goto('/');
  await page.setInputFiles(FILE_INPUT, photo);
  await expect(
    page.locator(`${RIGHT_PANEL} a.download[href^="blob:"]`),
  ).toBeVisible({ timeout: 60_000 });

  // Switch WebP to AVIF and sample the Save link on the next frame: inside the
  // window before the delayed spinner shows, where the old WebP bytes used to
  // stay downloadable under an .avif name.
  const sample = await page.evaluate(async () => {
    const select = document.querySelector<HTMLSelectElement>(
      '.options-2 select.builtin-select',
    )!;
    select.value = 'avif';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const link = document.querySelector<HTMLAnchorElement>(
      '.options-2 a.download',
    )!;
    const href = link.getAttribute('href');
    const name = link.getAttribute('download');
    if (!href || !name) return { enabled: false as const };
    const bytes = new Uint8Array(await (await fetch(href)).arrayBuffer());
    return { enabled: true as const, name, head: [...bytes.slice(0, 12)] };
  });

  if (sample.enabled) {
    expect(sample.name).toMatch(/\.avif$/);
    expect(ascii(sample.head, 4, 8), 'bytes must be AVIF').toBe('ftyp');
  }

  // And once the AVIF pass lands, Save offers exactly that.
  await expect(
    page.locator(`${RIGHT_PANEL} a.download[href^="blob:"]`),
  ).toHaveAttribute('download', /\.avif$/, { timeout: 60_000 });
});

test.fixme('rotating an image in bulk rotates its exported file', async ({
  page,
}) => {
  await page.goto('/');
  await page.setInputFiles(FILE_INPUT, [photo, gradient]);
  await waitBulkReady(page, 2);

  await page.locator(CELL).nth(0).locator('.thumb').click();
  await page.getByRole('button', { name: 'Rotate' }).click();
  await waitBulkReady(page, 2);

  const { bytes } = await downloadCell(page, 0);
  const size = await page.evaluate(
    async (data: number[]) => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
      return { width: bitmap.width, height: bitmap.height };
    },
    [...bytes],
  );
  // photo.jpg is 1024x683; a quarter turn makes it portrait.
  expect(size).toEqual({ width: 683, height: 1024 });
});

test.fixme('a batch of SVGs gets the same vector optimization as one SVG', async ({
  page,
}) => {
  await page.goto('/');
  await page.setInputFiles(FILE_INPUT, [
    { name: 'a.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(SVG) },
    { name: 'b.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(SVG) },
  ]);
  await waitBulkReady(page, 2);

  const { name, bytes } = await downloadCell(page, 0);
  expect(name).toMatch(/\.svg$/);
  expect(bytes.toString('utf8')).toMatch(/^\s*(<\?xml[^>]*>\s*)?<svg/);
});

test.fixme('changing settings during the first pass leaves no job stale', async ({
  page,
}) => {
  await page.goto('/');
  await page.setInputFiles(FILE_INPUT, [photoLarge, gradient, screenshot]);
  await expect(page.locator(CELL)).toHaveCount(3, { timeout: 10_000 });

  // Flip the global format while the first pass is still running, then every
  // job must settle on AVIF: none may stay finished under the old recipe.
  await page
    .locator(`${RIGHT_PANEL} select.builtin-select`)
    .selectOption('avif');
  await expect
    .poll(
      async () =>
        page
          .locator(CELL)
          .evaluateAll((nodes) =>
            nodes.map(
              (cell) =>
                cell
                  .querySelector('button[aria-label^="Download "]')
                  ?.getAttribute('aria-label') ?? 'pending',
            ),
          ),
      { timeout: 90_000 },
    )
    .toEqual([
      'Download photo-large.avif',
      'Download gradient.avif',
      'Download screenshot.avif',
    ]);
  await waitBulkReady(page, 3);

  for (let index = 0; index < 3; index += 1) {
    const { name, bytes } = await downloadCell(page, index);
    expect(name, `cell ${index} name`).toMatch(/\.avif$/);
    expect(ascii([...bytes.subarray(0, 12)], 4, 8), `cell ${index} bytes`).toBe(
      'ftyp',
    );
  }
});

test.fixme('the first SVG optimized offline works without a prior online SVG', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit',
    'Playwright-WebKit setOffline + reload is unsupported (harness limitation)',
  );
  await page.goto('/?sw=1');
  await page.waitForFunction(
    () => navigator.serviceWorker?.controller != null,
    null,
    { timeout: 30_000 },
  );

  // setOffline alone does not reach dedicated workers in Chromium, so also
  // fail every request that leaves the service worker for the network.
  await context.setOffline(true);
  await context.route('**/*', (route) => route.abort('internetdisconnected'));
  await page.reload();
  await page.setInputFiles(FILE_INPUT, {
    name: 'offline.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(SVG),
  });
  await expect(page.locator(`${RIGHT_PANEL} .type-label`)).toHaveText('SVG', {
    timeout: 30_000,
  });
  const link = page.locator(`${RIGHT_PANEL} a.download[href^="blob:"]`);
  await expect(link).toBeVisible({ timeout: 30_000 });
  // Optimized, not the untouched source passed through: SVGO trims the
  // six-decimal coordinates, so the output must be smaller than the input.
  const href = (await link.getAttribute('href'))!;
  const outputBytes = await page.evaluate(
    async (url: string) => (await (await fetch(url)).arrayBuffer()).byteLength,
    href,
  );
  expect(outputBytes).toBeLessThan(Buffer.byteLength(SVG));
  await context.setOffline(false);
});
