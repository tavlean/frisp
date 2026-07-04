import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// Folder-drop automation is intentionally omitted: synthetic directory drops are
// unreliable across engines, and the folder picker path is covered by unit tests
// plus manual QA per the Stage H spec.
const photo = fileURLToPath(new URL('../fixtures/photo.jpg', import.meta.url));
const gradient = fileURLToPath(
  new URL('../fixtures/gradient.png', import.meta.url),
);
const screenshot = fileURLToPath(
  new URL('../fixtures/screenshot.png', import.meta.url),
);
const tinyFlat = fileURLToPath(
  new URL('../fixtures/tiny-flat.png', import.meta.url),
);

const INTRO_FILE_INPUT = 'input[type=file][accept="image/*"]';
const CELL = '.rich-strip .cell[data-bulk-cell-id]';

type ZipEntry = {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
};

async function loadBulk(page: Page, files: string[]): Promise<void> {
  await page.goto('/');
  await page.setInputFiles(INTRO_FILE_INPUT, files);
  await expect(page.locator('.bulk-mode')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(CELL)).toHaveCount(files.length, {
    timeout: 10_000,
  });
}

async function waitBulkReady(page: Page, expectedCells: number): Promise<void> {
  await expect
    .poll(
      async () =>
        page.locator(CELL).evaluateAll((cells) =>
          cells.map((cell) => ({
            hasDelta: !!cell.querySelector('.delta'),
            working: !!cell.querySelector('.spinner-overlay'),
          })),
        ),
      { timeout: 60_000 },
    )
    .toEqual(
      Array.from({ length: expectedCells }, () => ({
        hasDelta: true,
        working: false,
      })),
    );
}

async function loadReadyBulk(page: Page, files: string[]): Promise<void> {
  await loadBulk(page, files);
  await waitBulkReady(page, files.length);
}

async function saveAllZip(page: Page): Promise<{
  suggestedName: string;
  bytes: Buffer;
}> {
  const saveAll = page.getByRole('button', { name: /Save all/ });
  await expect(saveAll).toBeEnabled({ timeout: 60_000 });
  const downloadPromise = page.waitForEvent('download');
  await saveAll.click();
  const download = await downloadPromise;
  const dir = await mkdtemp(join(tmpdir(), 'presk-bulk-'));
  const path = join(dir, download.suggestedFilename());
  await download.saveAs(path);
  return {
    suggestedName: download.suggestedFilename(),
    bytes: await readFile(path),
  };
}

function countBytes(bytes: Buffer, signature: number[]): number {
  let count = 0;
  for (let i = 0; i <= bytes.length - signature.length; i += 1) {
    if (signature.every((byte, offset) => bytes[i + offset] === byte)) {
      count += 1;
    }
  }
  return count;
}

function parseCentralDirectory(bytes: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  for (let i = 0; i <= bytes.length - 46; i += 1) {
    if (
      bytes[i] !== 0x50 ||
      bytes[i + 1] !== 0x4b ||
      bytes[i + 2] !== 0x01 ||
      bytes[i + 3] !== 0x02
    ) {
      continue;
    }

    const compressedSize = bytes.readUInt32LE(i + 20);
    const uncompressedSize = bytes.readUInt32LE(i + 24);
    const nameLength = bytes.readUInt16LE(i + 28);
    const extraLength = bytes.readUInt16LE(i + 30);
    const commentLength = bytes.readUInt16LE(i + 32);
    const nameStart = i + 46;
    const nameEnd = nameStart + nameLength;
    entries.push({
      name: bytes.subarray(nameStart, nameEnd).toString('utf8'),
      compressedSize,
      uncompressedSize,
    });
    i = nameEnd + extraLength + commentLength - 1;
  }
  return entries;
}

async function setQuality(page: Page, raw: string): Promise<string> {
  return page.evaluate((value: string) => {
    const root = document.querySelector('.options-2')!;
    const label = [...root.querySelectorAll('label.range')].find((item) =>
      /Quality/.test(item.textContent ?? ''),
    );
    const input = label?.querySelector<HTMLInputElement>(
      'input.text-input[type="number"]',
    );
    if (!input) throw new Error('WebP Quality number input not found');
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return input.value;
  }, raw);
}

test('multi-file entry opens bulk mode and renders ready strip totals', async ({
  page,
}) => {
  await loadReadyBulk(page, [photo, gradient, screenshot]);

  await expect
    .poll(
      async () =>
        page
          .locator('.batch-info .stat-output .figure')
          .first()
          .evaluate((node) => node.textContent?.trim() ?? ''),
      { timeout: 5000 },
    )
    .not.toBe('');
});

test('single-file entry keeps the classic two-up editor', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles(INTRO_FILE_INPUT, photo);

  await expect(page.locator('.options-2')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.bulk-mode')).toHaveCount(0);
  await expect(page.locator('.rich-strip')).toHaveCount(0);
});

test('per-image quality change marks the selected strip cell as overridden', async ({
  page,
}) => {
  await loadReadyBulk(page, [photo, gradient, screenshot]);

  const secondCell = page.locator(CELL).nth(1);
  await secondCell.locator('.thumb').click();
  await expect(
    page.locator('.scope-tabs .tab-image[aria-selected="true"]'),
  ).toHaveText('This image');

  await setQuality(page, '55');
  await expect(secondCell.locator('.override-dot')).toBeVisible({
    timeout: 5000,
  });
});

test('save all exports a zip with one entry per ready image', async ({
  page,
}) => {
  await loadReadyBulk(page, [photo, gradient, screenshot]);

  const { suggestedName, bytes } = await saveAllZip(page);
  expect(suggestedName).toMatch(/\.zip$/);
  expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  expect(countBytes(bytes, [0x50, 0x4b, 0x01, 0x02])).toBe(3);
});

test('keep-original export guard keeps tiny inflated PNG only while enabled', async ({
  page,
}) => {
  const tinySourceSize = (await stat(tinyFlat)).size;
  await loadReadyBulk(page, [tinyFlat, photo]);

  const kept = await saveAllZip(page);
  const keptEntries = parseCentralDirectory(kept.bytes);
  expect(keptEntries.map((entry) => entry.name)).toContain('tiny-flat.png');
  expect(
    keptEntries.find((entry) => entry.name === 'tiny-flat.png')
      ?.uncompressedSize,
  ).toBe(tinySourceSize);

  await loadReadyBulk(page, [tinyFlat, photo]);
  await page.locator('.keep-originals input[type="checkbox"]').uncheck();
  const unguarded = await saveAllZip(page);
  const unguardedEntries = parseCentralDirectory(unguarded.bytes);
  const tinyWebp = unguardedEntries.find(
    (entry) => entry.name === 'tiny-flat.webp',
  );
  expect(
    tinyWebp,
    'unguarded export should include encoded tiny WebP',
  ).toBeTruthy();
  expect(
    tinyWebp!.uncompressedSize,
    'tiny fixture must verify the inflated-output assumption',
  ).toBeGreaterThan(tinySourceSize);
});

test('remove undo restores the cached output without a new working state', async ({
  page,
}) => {
  await loadReadyBulk(page, [photo, gradient, screenshot]);

  const targetCell = page.locator(CELL).nth(1);
  const targetId = await targetCell.getAttribute('data-bulk-cell-id');
  expect(targetId).toBeTruthy();
  await targetCell.hover();
  await targetCell.locator('button.remove').click();

  await expect(page.locator(CELL)).toHaveCount(2);
  const snackbar = page.locator('.snackbar');
  await expect(snackbar).toBeVisible();
  await expect(snackbar.getByRole('button', { name: 'Undo' })).toBeVisible();

  await snackbar.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator(CELL)).toHaveCount(3);

  const restoredCell = page.locator(`${CELL}[data-bulk-cell-id="${targetId}"]`);
  await expect(restoredCell.locator('.delta')).toBeVisible({ timeout: 1000 });
  await expect
    .poll(
      async () =>
        restoredCell.evaluate((cell) => ({
          hasDelta: !!cell.querySelector('.delta'),
          working: !!cell.querySelector('.spinner-overlay'),
        })),
      { timeout: 1500 },
    )
    .toEqual({ hasDelta: true, working: false });
});
