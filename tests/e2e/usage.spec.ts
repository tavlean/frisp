import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

// Usage counting sends only from the production host (src/lib/usage.ts). The
// preview build runs on localhost, so a real session there must make no
// request to the endpoint at all.
const photo = fileURLToPath(new URL('../fixtures/photo.jpg', import.meta.url));

test('a session off the production host sends no usage beacon', async ({
  page,
}) => {
  const usage: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/usage') {
      usage.push(request.url());
    }
  });

  await page.goto('/');
  await page.setInputFiles('input[type=file][accept="image/*"]', photo);
  const right = page.locator('.options-2 select.builtin-select');
  await expect(right).toBeVisible({ timeout: 10_000 });
  await right.selectOption('avif');
  await expect(right).toHaveValue('avif');
  await expect
    .poll(async () => (await page.title()).includes('⏳'), { timeout: 60_000 })
    .toBe(false);

  expect(usage).toEqual([]);
});
