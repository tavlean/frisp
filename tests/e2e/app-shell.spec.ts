import { expect, test } from '@playwright/test';
import { APP_NAME } from '../../src/shared/brand';

// Boot + cross-origin-isolation. If COOP/COEP regress, WASM threads silently
// die — this catches that, plus any console/page errors on load.
test.describe('app shell', () => {
  test('boots cross-origin isolated with no console errors', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('/');
    await expect(page.getByRole('heading', { name: APP_NAME })).toBeVisible();

    // The whole point of the threading work: the page must be cross-origin
    // isolated so SharedArrayBuffer (and therefore WASM threads) is available.
    const isolated = await page.evaluate(() => self.crossOriginIsolated);
    expect(
      isolated,
      'page must be cross-origin isolated (COOP/COEP) — without it WASM threads cannot run',
    ).toBe(true);

    const sharedArrayBuffer = await page.evaluate(
      () => typeof SharedArrayBuffer !== 'undefined',
    );
    expect(sharedArrayBuffer).toBe(true);

    expect(
      errors,
      `console/page errors on load:\n${errors.join('\n')}`,
    ).toEqual([]);
  });
});
