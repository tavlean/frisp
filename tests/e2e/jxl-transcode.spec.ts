import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

// The lossless JPEG-to-JXL transcode: libjxl repacks the source JPEG's own DCT
// coefficients instead of re-encoding pixels. This is the only editor path that
// bypasses the decode/preprocess pipeline, so it needs its own guard: the
// codec-encode suite would keep passing with the whole branch broken.
const photo = fileURLToPath(new URL('../fixtures/photo.jpg', import.meta.url));
const photoBytes = statSync(photo).size;

const ascii = (head: number[], a: number, b: number) =>
  String.fromCharCode(...head.slice(a, b));

/**
 * Flip a right-side checkbox by its label text, from inside the page: the
 * styled Checkbox hides the real input, so synthetic clicks land nowhere. The
 * other processor specs drive their toggles the same way. Reports what it saw,
 * so a renamed label fails with a readable message instead of a blind timeout.
 */
function setToggle([labelText, on]: [string, boolean]) {
  const root = document.querySelector('.options-2')!;
  const labels = [...root.querySelectorAll('label.option-toggle')];
  const row = labels.find((label) =>
    (label.textContent ?? '').trim().startsWith(labelText),
  );
  const checkbox = row?.querySelector<HTMLInputElement>(
    'input[type="checkbox"]',
  );
  if (checkbox && checkbox.checked !== on && !checkbox.disabled) {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'checked',
    )!.set!.call(checkbox, on);
    for (const type of ['input', 'change'])
      checkbox.dispatchEvent(new Event(type, { bubbles: true }));
  }
  return {
    found: !!checkbox,
    disabled: !!checkbox?.disabled,
    labelsSeen: labels.map((label) => (label.textContent ?? '').trim()),
  };
}

test('transcodes a JPEG into a smaller, valid JXL', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));

  await page.goto('/');
  await page.setInputFiles('input[type=file][accept^="image/*"]', photo);

  const panel = page.locator('.options-2');
  await panel.locator('select.builtin-select').first().selectOption('jxl');

  const toggled = await page.evaluate(setToggle, [
    'Lossless transcode',
    true,
  ] as [string, boolean]);
  expect(
    toggled.found,
    `transcode toggle missing (labels: ${toggled.labelsSeen.join(' | ')})`,
  ).toBe(true);
  expect(toggled.disabled, 'transcode should be offered on a clean JPEG').toBe(
    false,
  );

  await expect
    .poll(async () => (await page.title()).includes('⏳'), { timeout: 60_000 })
    .toBe(false);
  const download = panel.locator('a.download[href^="blob:"]');
  await expect(download).toBeVisible({ timeout: 60_000 });
  const href = await download.getAttribute('href');

  const { size, head } = await page.evaluate(async (url: string) => {
    const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
    return { size: buf.byteLength, head: [...buf.slice(0, 16)] };
  }, href!);

  // The container signature, not the bare-codestream one: the reconstruction
  // data rides in a box, which only the container format has. A bare codestream
  // here would mean the output still decodes but is no longer reversible.
  expect(
    ascii(head, 4, 8),
    `expected a JXL container, got [${head.join(', ')}]`,
  ).toBe('JXL ');
  expect(size, 'a transcode should beat the source JPEG').toBeLessThan(
    photoBytes,
  );
  expect(errors, 'page errors during the transcode').toEqual([]);
});

test('disables the transcode toggle while a resize is active', async ({
  page,
}) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file][accept^="image/*"]', photo);

  const panel = page.locator('.options-2');
  await panel.locator('select.builtin-select').first().selectOption('jxl');

  const resize = await page.evaluate(setToggle, ['Resize', true] as [
    string,
    boolean,
  ]);
  expect(resize.found, 'resize enabler missing').toBe(true);

  // The resize has to be REAL to block the transcode: enabled at the source's
  // own dimensions changes no pixels, and the encode signature folds that away
  // too. So give it a width the source does not already have.
  await page.evaluate(() => {
    const root = document.querySelector('.options-2')!;
    const width = [...root.querySelectorAll('label')]
      .find((label) => /Width/.test(label.textContent ?? ''))
      ?.querySelector<HTMLInputElement>('input[type="number"]');
    if (!width) return;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!.call(width, '256');
    for (const type of ['input', 'change'])
      width.dispatchEvent(new Event(type, { bubbles: true }));
  });

  const transcode = panel
    .locator('label.option-toggle')
    .filter({ hasText: 'Lossless transcode' })
    .locator('input[type="checkbox"]');
  await expect(transcode).toBeDisabled({ timeout: 10_000 });
});
