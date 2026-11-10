import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// Svelte plays a local transition only when the block that owns the element
// already existed, so a reveal can silently stop animating after a refactor
// with nothing else failing. These pin that the shared motion helpers really
// run, and that reduced motion removes the reveal's movement.
const photo = fileURLToPath(new URL('../fixtures/photo.jpg', import.meta.url));

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'Animation checks run on Chromium only.',
);

/**
 * Starts watching for `selector` in the page and resolves with how many
 * animations it carries on the first frame it exists. Call it BEFORE the
 * action that inserts the element: the transitions last 200 to 300ms, so a
 * check made after Playwright's own round trips could arrive too late.
 */
function animationsOnArrival(page: Page, selector: string, text: string) {
  return page.evaluate(
    ([selector, text]) =>
      new Promise<number>((resolve) => {
        const find = () =>
          [...document.querySelectorAll(selector)].find((el) =>
            el.textContent?.includes(text),
          );
        const tick = () => {
          const el = find();
          if (el) resolve(el.getAnimations().length);
          else requestAnimationFrame(tick);
        };
        tick();
      }),
    [selector, text] as const,
  );
}

async function revealFilterStrength(page: Page): Promise<number> {
  await page.goto('/');
  await page.setInputFiles('input[type=file][accept="image/*"]', photo);
  const panel = page.locator('.options-2');
  await panel.locator('select.builtin-select').selectOption('webP');
  await panel.locator('label.option-reveal', { hasText: 'Advanced' }).click();

  const row = panel.locator('.option-one-cell', { hasText: 'Filter strength' });
  const autoFilter = panel.locator('label.option-toggle', {
    hasText: 'Auto adjust filter strength',
  });
  await expect(row).toBeVisible();
  await autoFilter.click();
  await expect(row).toHaveCount(0);

  const arrival = animationsOnArrival(
    page,
    '.options-2 .option-one-cell',
    'Filter strength',
  );
  await autoFilter.click();
  return arrival;
}

test('an option row with the slide prop animates when revealed', async ({
  page,
}) => {
  expect(await revealFilterStrength(page)).toBeGreaterThan(0);
});

test('reduced motion reveals the same row without animating', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await revealFilterStrength(page)).toBe(0);
});

test('the snackbar animates on its first show', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, 'read', {
      configurable: true,
      value: () => Promise.resolve([]),
    });
  });
  await page.goto('/');
  const arrival = animationsOnArrival(
    page,
    '.snackbar',
    'No image found on the clipboard.',
  );
  await page.getByRole('button', { name: 'paste' }).click();
  expect(await arrival).toBeGreaterThan(0);
});
