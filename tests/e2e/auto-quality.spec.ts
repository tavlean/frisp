import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// Auto quality on the right (WebP) side, through the UI: choose a target, let
// the SSIMULACRA2 search run in the real codec worker, and check what it
// commits. The default right side is WebP at quality 80.
const fixture = (name: string) =>
  fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

const RIGHT = '.options-2';

async function openOnWebp(page: Page, file: string) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await page.setInputFiles('input[type=file][accept="image/*"]', file);
  await page.locator(`${RIGHT} select.builtin-select`).selectOption('webP');
  await expect(page.locator(`${RIGHT} a.download[href^="blob:"]`)).toBeVisible({
    timeout: 120_000,
  });
  return errors;
}

function qualityInput(page: Page) {
  return page
    .locator(`${RIGHT} .range`)
    .filter({ has: page.locator('.label-text', { hasText: /^Quality:$/ }) })
    .locator('input.text-input');
}

/** Choose an Auto target and wait for the search's snackbar. Returns the
 *  snackbar text and how long the search took. */
async function runAuto(page: Page, target: string) {
  const auto = page
    .locator(RIGHT)
    .getByRole('combobox', { name: 'Auto:', exact: true });
  const started = Date.now();
  await auto.selectOption({ label: target });
  // The busy row replaces the select while the search runs, with focus on
  // its Cancel button.
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();
  const message = page.locator('.snackbar .message');
  await expect(message).toHaveText(/^(Auto|Best WebP)/, { timeout: 60_000 });
  return { text: (await message.textContent())!, ms: Date.now() - started };
}

async function readDownload(page: Page) {
  const download = page.locator(`${RIGHT} a.download[href^="blob:"]`);
  await expect(download).toBeVisible();
  const href = (await download.getAttribute('href'))!;
  const name = await download.getAttribute('download');
  const { size, head } = await page.evaluate(async (url: string) => {
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    return { size: bytes.byteLength, head: [...bytes.slice(0, 12)] };
  }, href);
  return { href, name, size, head };
}

const isWebp = (head: number[]) =>
  String.fromCharCode(...head.slice(0, 4)) === 'RIFF' &&
  String.fromCharCode(...head.slice(8, 12)) === 'WEBP';

test('Auto Balanced lowers WebP quality and shows that exact encode', async ({
  page,
  browserName,
}) => {
  const errors = await openOnWebp(page, fixture('photo.jpg'));
  await expect(qualityInput(page)).toHaveValue('80');
  const before = await readDownload(page);

  const { text, ms } = await runAuto(page, 'Balanced');
  // eslint-disable-next-line no-console
  console.log(
    `[auto-quality ${browserName}] photo.jpg Balanced: ${text} in ${ms} ms`,
  );
  const match = /^Auto: Balanced met at quality (\d+) \(score [\d.]+\)\.$/.exec(
    text,
  );
  expect(match, text).not.toBeNull();
  const quality = Number(match![1]);
  expect(quality).toBeLessThan(80);
  await expect(qualityInput(page)).toHaveValue(String(quality));

  // The winning probe was cached under the committed recipe's key, so the
  // result is on screen with no encode pass: the title never shows the
  // working marker, and Save already points at a new file.
  expect(await page.title()).not.toContain('⏳');
  const after = await readDownload(page);
  expect(after.href).not.toBe(before.href);
  expect(after.name).toMatch(/\.webp$/);
  expect(isWebp(after.head)).toBe(true);
  expect(after.size).toBeLessThan(before.size);
  // The Auto row is back, ready for another run.
  await expect(
    page.locator(RIGHT).getByRole('combobox', { name: 'Auto:', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('Auto High completes on a transparent image', async ({
  page,
  browserName,
}) => {
  const errors = await openOnWebp(page, fixture('transparent.png'));
  const { text, ms } = await runAuto(page, 'High');
  // eslint-disable-next-line no-console
  console.log(
    `[auto-quality ${browserName}] transparent.png High: ${text} in ${ms} ms`,
  );
  await expect(
    page.locator(`${RIGHT} a.download[href^="blob:"]`),
  ).toBeVisible();
  const result = await readDownload(page);
  expect(isWebp(result.head)).toBe(true);
  expect(errors).toEqual([]);
});

test('Auto on a 12 MP photo meets the target or leaves quality alone', async ({
  page,
  browserName,
}) => {
  test.slow();
  const errors = await openOnWebp(page, fixture('photo-large.jpg'));
  const { text, ms } = await runAuto(page, 'Balanced');
  // eslint-disable-next-line no-console
  console.log(
    `[auto-quality ${browserName}] photo-large.jpg Balanced: ${text} in ${ms} ms`,
  );
  // The 12 MP budget is 18 s; the search ends within it plus the one probe
  // in flight when it ran out.
  expect(ms).toBeLessThan(40_000);
  const met = /^Auto: Balanced met at quality (\d+) /.exec(text);
  if (met) {
    expect(Number(met[1])).toBeLessThan(100);
    await expect(qualityInput(page)).toHaveValue(met[1]);
  } else {
    // Never a guess committed by the budget: either the honest no-time
    // message with the slider untouched, or a pass found below 100 in time.
    const stopped = /^Auto: stopped after \d+ s at quality (\d+) /.exec(text);
    if (stopped) {
      expect(Number(stopped[1])).toBeLessThan(100);
    } else {
      expect(text).toBe(
        'Auto ran out of time on this large image; quality unchanged.',
      );
      await expect(qualityInput(page)).toHaveValue('80');
    }
  }
  expect(errors).toEqual([]);
});

test('Auto is hidden in lossless mode', async ({ page }) => {
  await openOnWebp(page, fixture('photo.jpg'));
  await expect(
    page.locator(RIGHT).getByRole('combobox', { name: 'Auto:', exact: true }),
  ).toBeVisible();
  await page
    .locator(`${RIGHT} .option-toggle`, { hasText: 'Lossless' })
    .click();
  await expect(
    page.locator(RIGHT).getByRole('combobox', { name: 'Auto:', exact: true }),
  ).toHaveCount(0);
});
