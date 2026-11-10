import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// Locks in three editor interaction behaviours that were previously only smoke-
// tested by one-off scripts. Each test guards a specific mechanism:
//
//  1. Undo restores a cached result INSTANTLY — the editor caches finished
//     encodes by recipe signature (ResultCache), and a cached CompressOutcome
//     carries its ORIGINAL object URL. So undoing back to a prior recipe must
//     re-surface the exact same blob: URL string; a re-encode would mint a new
//     one. Introduced by the cache + history wiring in d76697a5, with the
//     "undo lands on a cache hit" signature-projection guarantees in be978a9c
//     and da273584.
//
//  2. Typed slider values clamp to the range — the Range component's mirrored
//     number input accepts out-of-range text, but commit() clamps to
//     [min,max] before it reaches options state, and Svelte writes the bound
//     value back to the input. Introduced by 0f034a78.
//
//  3. Divider keyboard shortcuts (1/2/3) are scoped — the <two-up> element's
//     window-level key handler moves the --split-point divider ONLY when the
//     event target is document.body or inside the viewer, so pressing a digit
//     while a toolbar control is focused no longer silently recentres the
//     split. Introduced by 5a10b838.
//
// Style/idioms (fixture loading, .options-2 panel, blob: download link, ⏳
// title polling, native-setter + dispatchEvent for Svelte-bound inputs) are
// copied from resize.spec.ts.
const photo = fileURLToPath(new URL('../fixtures/photo.jpg', import.meta.url));

// The right panel defaults to WebP (buildInitialSides: side 1 = 'webP'), so its
// download link is a real encoded blob and it exposes a Quality slider.
const RIGHT_PANEL = '.options-2';

/** Poll until the right panel's download link has a blob: href, and return it. */
async function rightDownloadHref(page: Page): Promise<string> {
  const download = page.locator(`${RIGHT_PANEL} a.download[href^="blob:"]`);
  await expect(download).toBeVisible({ timeout: 60_000 });
  const href = await download.getAttribute('href');
  expect(href, 'right panel download href missing').toBeTruthy();
  return href!;
}

/** Wait for the busy marker (⏳ in the document title) to clear. */
async function waitIdle(page: Page): Promise<void> {
  await expect
    .poll(async () => (await page.title()).includes('⏳'), { timeout: 60_000 })
    .toBe(false);
}

/**
 * Drive the WebP Quality number input (the Range component's mirrored
 * `input.text-input`) via the native setter + `input` event, the way a real
 * keystroke would, so Svelte's binding + clamp run. Returns the input's value
 * as the DOM reports it AFTER the component has written back.
 */
async function setQuality(page: Page, raw: string): Promise<string> {
  return page.evaluate((value: string) => {
    const root = document.querySelector('.options-2')!;
    const label = [...root.querySelectorAll('label.range')].find((l) =>
      /Quality/.test(l.textContent ?? ''),
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

/** Read the WebP Quality number input's current DOM value. */
async function readQuality(page: Page): Promise<string> {
  return page.evaluate(() => {
    const root = document.querySelector('.options-2')!;
    const label = [...root.querySelectorAll('label.range')].find((l) =>
      /Quality/.test(l.textContent ?? ''),
    );
    const input = label?.querySelector<HTMLInputElement>(
      'input.text-input[type="number"]',
    );
    if (!input) throw new Error('WebP Quality number input not found');
    return input.value;
  });
}

test('undo restores a previous result instantly from cache', async ({
  page,
}) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file][accept="image/*"]', photo);

  // Initial WebP encode settles → hrefA.
  await waitIdle(page);
  const hrefA = await rightDownloadHref(page);

  // Change Quality away from the default (80) to force a re-encode → hrefB.
  const typed = await setQuality(page, '50');
  expect(typed, 'Quality did not accept 50').toBe('50');

  await waitIdle(page);
  await expect
    .poll(
      async () => {
        const href = await page
          .locator(`${RIGHT_PANEL} a.download[href^="blob:"]`)
          .getAttribute('href');
        return href !== hrefA ? href : null;
      },
      { timeout: 60_000 },
    )
    .not.toBeNull();
  const hrefB = await rightDownloadHref(page);
  expect(hrefB, 'a fresh encode should mint a new blob URL').not.toBe(hrefA);

  // The history commit is debounced (HISTORY_COMMIT_DELAY = 350ms); wait for the
  // Undo button to arm rather than sleeping.
  const undo = page.locator('button[aria-label^="Undo"]');
  await expect(undo).toBeEnabled({ timeout: 5000 });
  await undo.click();

  // The load-bearing assertion: undo re-surfaces the EXACT SAME blob URL from
  // cache — proving a cache hit, not a re-encode (which would mint a new URL).
  await expect
    .poll(
      async () =>
        page
          .locator(`${RIGHT_PANEL} a.download[href^="blob:"]`)
          .getAttribute('href'),
      { timeout: 3000 },
    )
    .toBe(hrefA);
  expect(
    (await page.title()).includes('⏳'),
    'undo should be instant — no busy marker',
  ).toBe(false);

  // Symmetric redo: back to hrefB, again from cache.
  const redo = page.locator('button[aria-label^="Redo"]');
  await expect(redo).toBeEnabled({ timeout: 5000 });
  await redo.click();
  await expect
    .poll(
      async () =>
        page
          .locator(`${RIGHT_PANEL} a.download[href^="blob:"]`)
          .getAttribute('href'),
      { timeout: 3000 },
    )
    .toBe(hrefB);
});

test('typed slider values clamp to the range', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file][accept="image/*"]', photo);
  await waitIdle(page);
  // Make sure the WebP Quality control is actually present before typing.
  await rightDownloadHref(page);

  // Above max (100) clamps down to 100.
  await setQuality(page, '400');
  await expect
    .poll(async () => readQuality(page), { timeout: 5000 })
    .toBe('100');

  // Below min (0) clamps up to 0.
  await setQuality(page, '-5');
  await expect.poll(async () => readQuality(page), { timeout: 5000 }).toBe('0');
});

test('divider keys ignore focused controls but work from the stage', async ({
  page,
}) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file][accept="image/*"]', photo);
  await waitIdle(page);
  await rightDownloadHref(page);

  const readSplit = () =>
    page.evaluate(
      () =>
        document
          .querySelector<HTMLElement>('two-up')
          ?.style.getPropertyValue('--split-point') ?? '',
    );

  // The initial ResizeObserver sets --split-point inside a rAF, so poll for it.
  await expect.poll(readSplit, { timeout: 5000 }).not.toBe('');
  const p0 = await readSplit();

  // 1) A toolbar button is focused → the window-level "1" shortcut must be
  //    ignored (target is neither body nor inside the viewer).
  await page.locator('button[aria-label="Zoom out"]').focus();
  await page.keyboard.press('1');
  // Give any (erroneous) handler time to run, then assert nothing moved.
  await expect.poll(readSplit, { timeout: 1000 }).toBe(p0);

  // 2) Focus on body → the same "1" now hard-lefts the divider to 0px.
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.keyboard.press('1');
  await expect.poll(readSplit, { timeout: 3000 }).toBe('0px');

  // "2" recentres → the divider moves back away from the hard-left edge.
  await page.keyboard.press('2');
  await expect
    .poll(async () => Number.parseFloat((await readSplit()) || '0') > 0, {
      timeout: 3000,
    })
    .toBe(true);
});
