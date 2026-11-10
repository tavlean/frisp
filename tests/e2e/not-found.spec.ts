import { expect, test } from '@playwright/test';

// Unknown paths render the app's own error page with a way home. Nested paths
// matter most: the fallback shell must load its assets from absolute URLs, or a
// deep path boots to a blank page. This runs against `vite preview`; the real
// 404 status comes from the host (wrangler.jsonc), which preview does not model.
for (const path of ['/nope', '/a/b/c']) {
  test(`${path} shows the not-found page`, async ({ page }) => {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeVisible();
    const home = page.getByRole('link', { name: /^Back to / });
    await expect(home).toBeVisible();
    await expect(home).toHaveAttribute('href', '/');
  });
}
