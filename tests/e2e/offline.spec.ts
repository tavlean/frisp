import { expect, test } from '@playwright/test';
import { APP_NAME } from '../../src/shared/brand';

// Local-first guarantee: after the service worker installs, a reload while
// offline must still serve the app shell.
test('reloads offline after the service worker installs', async ({
  page,
  context,
  browserName,
}) => {
  // Playwright-WebKit throws "WebKit encountered an internal error" on
  // page.reload() while context.setOffline(true) — its offline emulation doesn't
  // support reload-while-offline. This is a harness limitation, not an app bug:
  // the service-worker caching itself is verified by the same test on Chromium.
  test.skip(
    browserName === 'webkit',
    'Playwright-WebKit setOffline + reload is unsupported (harness limitation)',
  );

  // On loopback hosts (localhost) the SW is opt-in via `?sw=1` (persisted), so
  // it never pollutes a dev origin by accident. Production hosts register it
  // unconditionally; here we opt in so the offline path is exercised.
  await page.goto('/?sw=1');
  await expect(page.getByRole('heading', { name: APP_NAME })).toBeVisible();

  // Wait for the service worker to take control.
  await page.waitForFunction(
    () => navigator.serviceWorker?.controller != null,
    null,
    { timeout: 30_000 },
  );

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: APP_NAME })).toBeVisible();
  await context.setOffline(false);
});
