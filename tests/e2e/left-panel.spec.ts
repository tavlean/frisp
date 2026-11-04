import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const photo = fileURLToPath(new URL('../fixtures/photo.jpg', import.meta.url));

const LEFT_PANEL = '.options-1';
const LEFT_INFO = `${LEFT_PANEL} .image-info-panel`;
const LEFT_SELECT = `${LEFT_PANEL} select.builtin-select`;
const RIGHT_SELECT = '.options-2 select.builtin-select';

async function loadPhoto(page: Page): Promise<void> {
  await page.goto('/');
  await page.setInputFiles('input[type=file][accept="image/*"]', photo);
  await expect(page.locator(LEFT_INFO)).toBeVisible({ timeout: 10_000 });
}

async function waitIdle(page: Page): Promise<void> {
  await expect
    .poll(async () => (await page.title()).includes('⏳'), { timeout: 60_000 })
    .toBe(false);
}

async function chooseCompareAs(page: Page, label: string): Promise<void> {
  await page
    .locator(LEFT_INFO)
    .getByRole('button', { name: 'Compare as…' })
    .click();
  const options = page.locator(`${LEFT_INFO} .compare-option`);
  // The popover renders OUTPUT_FORMATS one for one (`src/lib/compress.ts`), so
  // this count moves whenever a codec is added or removed.
  await expect(options).toHaveCount(5);
  await options.filter({ hasText: label }).dispatchEvent('click');
}

async function expectInfoPanel(page: Page): Promise<void> {
  await expect(page.locator(LEFT_INFO)).toBeVisible();
  await expect(page.locator(LEFT_SELECT)).toHaveCount(0);
  await expect(page.locator('select.builtin-select')).toHaveCount(1);
  await expect(page.locator(RIGHT_SELECT)).toBeVisible();
}

async function expectLeftOptionsPanel(page: Page): Promise<void> {
  const leftSelect = page.locator(LEFT_SELECT);
  await expect(leftSelect).toBeVisible({ timeout: 10_000 });
  await expect(leftSelect).toHaveValue('webP');
  await expect(
    page.locator(`${LEFT_PANEL} a.download[href^="blob:"]`),
  ).toBeVisible({
    timeout: 60_000,
  });
}

async function undo(page: Page): Promise<void> {
  await page.keyboard.press(
    process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z',
  );
}

async function redo(page: Page): Promise<void> {
  await page.keyboard.press(
    process.platform === 'darwin' ? 'Meta+Shift+Z' : 'Control+Y',
  );
}

test('loaded photo defaults the left column to image info', async ({
  page,
}) => {
  await loadPhoto(page);

  await expect(page.locator(`${LEFT_INFO} .filename`)).toHaveText('photo.jpg');
  await expect(
    page
      .locator(`${LEFT_INFO} .row`)
      .filter({ has: page.locator('dt', { hasText: 'Dimensions' }) })
      .locator('dd'),
  ).toHaveText(/\d+ × \d+/);
  await expect(
    page
      .locator(`${LEFT_INFO} .row`)
      .filter({ has: page.locator('dt', { hasText: 'Aspect' }) })
      .locator('.chip'),
  ).toBeVisible();
  await expect(page.locator('select.builtin-select')).toHaveCount(1);
});

test('Compare as opens a live left-side WebP encoder', async ({ page }) => {
  await loadPhoto(page);

  await chooseCompareAs(page, 'WebP');
  await expectLeftOptionsPanel(page);
});

test('left compare can return through select or close button', async ({
  page,
}) => {
  await loadPhoto(page);
  await chooseCompareAs(page, 'WebP');
  await expectLeftOptionsPanel(page);

  await page.locator(LEFT_SELECT).selectOption('identity');
  await expectInfoPanel(page);

  await chooseCompareAs(page, 'WebP');
  await expectLeftOptionsPanel(page);
  await page
    .locator(
      `${LEFT_PANEL} button[aria-label="Close comparison — back to image info"]`,
    )
    .click();
  await expectInfoPanel(page);
});

test('undo and redo restore the contextual left panel state', async ({
  page,
}) => {
  await loadPhoto(page);
  await chooseCompareAs(page, 'WebP');
  await expectLeftOptionsPanel(page);

  const undoButton = page.locator('button[aria-label^="Undo"]');
  await expect(undoButton).toBeEnabled({ timeout: 5000 });
  await undo(page);
  await expectInfoPanel(page);

  const redoButton = page.locator('button[aria-label^="Redo"]');
  await expect(redoButton).toBeEnabled({ timeout: 5000 });
  await redo(page);
  await expectLeftOptionsPanel(page);
  await waitIdle(page);
});
