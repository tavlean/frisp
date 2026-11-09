import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// The promoted "frame" landing. These drive the REAL "Browse files" control (the
// filechooser path), which every other spec bypasses via setInputFiles on the
// hidden input — so a broken button, binding, or routing would otherwise ship
// green. Also pins the landing's accessible heading name, the drag/drop routing
// contract (the intro handles drops itself and shields the global overlay), and
// both paste paths (window ⌘V and the async-clipboard button).
const photo = fileURLToPath(new URL('../fixtures/photo.jpg', import.meta.url));
const gradient = fileURLToPath(
  new URL('../fixtures/gradient.png', import.meta.url),
);

/** A fixture serialized for reconstruction as an in-page File. */
interface TransferFile {
  name: string;
  type: string;
  b64: string;
}

async function transferFile(
  path: string,
  name: string,
  type: string,
): Promise<TransferFile> {
  return { name, type, b64: (await readFile(path)).toString('base64') };
}

/**
 * Dispatch a synthetic drag sequence on the intro. Real Files are built
 * in-page and carried by a real DataTransfer; the events are generic Events
 * with `dataTransfer` defined on the instance, because WebKit's DragEvent
 * constructor does not accept `dataTransfer` in its init dict. (Directory
 * drops stay untestable this way — synthetic items have no webkitGetAsEntry
 * entries — so folder traversal is covered by unit tests; see bulk.spec.ts.)
 */
async function dispatchDrag(
  page: Page,
  types: string[],
  files: TransferFile[],
): Promise<void> {
  // page.evaluate does no waiting of its own, so on a slow load it can run
  // before the Intro mounts and the querySelector below misses (the flake
  // measured at 3-in-30 on webkit). Let Playwright's auto-wait gate it; the
  // in-page throw stays as the backstop for mid-test teardown.
  await page.locator('main.intro-frame').waitFor();
  await page.evaluate(
    ([types, files]) => {
      const dataTransfer = new DataTransfer();
      for (const { name, type, b64 } of files) {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        dataTransfer.items.add(new File([bytes], name, { type }));
      }
      const target = document.querySelector('main.intro-frame');
      if (!target) throw new Error('Intro is not on screen.');
      for (const type of types) {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
        target.dispatchEvent(event);
      }
    },
    [types, files] as const,
  );
}

/**
 * Replace `navigator.clipboard.read` before the app boots, so the paste
 * button's async-clipboard path is testable without engine permission prompts
 * (WebKit has no scriptable clipboard grant). The stub returns ClipboardItem
 * lookalikes — the component only touches `.types` and `.getType()`.
 */
async function stubClipboardRead(
  page: Page,
  files: TransferFile[] | 'reject',
): Promise<void> {
  await page.addInitScript((files) => {
    const read =
      files === 'reject'
        ? () => Promise.reject(new DOMException('Denied', 'NotAllowedError'))
        : () =>
            Promise.resolve(
              files.map(({ name, type, b64 }) => {
                const bytes = Uint8Array.from(atob(b64), (c) =>
                  c.charCodeAt(0),
                );
                const blob = new Blob([bytes], { type });
                void name;
                return { types: [type], getType: async () => blob };
              }),
            );
    Object.defineProperty(navigator.clipboard, 'read', {
      configurable: true,
      value: read,
    });
  }, files);
}

test.describe('landing', () => {
  test('renders its affordances and a stable, app-named heading', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(
      page.getByRole('button', { name: 'Browse files' }),
    ).toBeVisible();
    // The quiet paste action beside Browse (shown when the async clipboard is
    // available, which it is in both test engines on a secure origin).
    await expect(page.getByRole('button', { name: 'paste' })).toBeVisible();
    // The visible headline is aria-hidden and swaps on drag; the heading's
    // accessible name stays stable and carries the app identity.
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(
      /Frisp/,
    );
  });

  test('the Browse button opens the picker; one image enters the single editor', async ({
    page,
  }) => {
    await page.goto('/');
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Browse files' }).click();
    await (await chooser).setFiles(photo);

    await expect(page.locator('.options-2')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.bulk-mode')).toHaveCount(0);
  });

  test('the Browse button multi-selects into bulk mode', async ({ page }) => {
    await page.goto('/');
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Browse files' }).click();
    await (await chooser).setFiles([photo, gradient]);

    await expect(page.locator('.bulk-mode')).toBeVisible({ timeout: 10_000 });
  });

  test('a drag over the intro swaps the headline and never wakes the global overlay', async ({
    page,
  }) => {
    await page.goto('/');
    const file = await transferFile(photo, 'photo.jpg', 'image/jpeg');

    // The intro owns drag feedback: viewfinder state + headline swap. The
    // app-wide fileDrop overlay (.drop-valid) must stay asleep — the intro
    // stops propagation so a drop routes exactly once.
    await dispatchDrag(page, ['dragenter', 'dragover'], [file]);
    await expect(page.locator('.intro-frame.dragging')).toBeVisible();
    await expect(page.locator('.headline-visible')).toContainText(
      'Release to add.',
    );
    await expect(page.locator('.app-root.drop-valid')).toHaveCount(0);

    // Leaving without dropping restores the idle invitation.
    await dispatchDrag(page, ['dragleave'], [file]);
    await expect(page.locator('.intro-frame.dragging')).toHaveCount(0);
    await expect(page.locator('.headline-visible')).toContainText(
      'images to optimize.',
    );
  });

  test('dropping one image on the intro enters the single editor', async ({
    page,
  }) => {
    await page.goto('/');
    const file = await transferFile(photo, 'photo.jpg', 'image/jpeg');
    await dispatchDrag(page, ['dragenter', 'dragover', 'drop'], [file]);

    await expect(page.locator('.options-2')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.bulk-mode')).toHaveCount(0);
  });

  test('dropping two images on the intro enters bulk mode', async ({
    page,
  }) => {
    await page.goto('/');
    await dispatchDrag(
      page,
      ['dragenter', 'dragover', 'drop'],
      [
        await transferFile(photo, 'photo.jpg', 'image/jpeg'),
        await transferFile(gradient, 'gradient.png', 'image/png'),
      ],
    );

    await expect(page.locator('.bulk-mode')).toBeVisible({ timeout: 10_000 });
  });

  test('a keyboard paste of an image enters the single editor', async ({
    page,
  }) => {
    await page.goto('/');
    const file = await transferFile(photo, 'photo.jpg', 'image/jpeg');
    // The window paste listener belongs to the mounted intro, and SvelteKit 3
    // can mount after the load event `goto` waits for.
    await expect(page.getByRole('button', { name: 'paste' })).toBeVisible();

    // ⌘/Ctrl+V lands as a window paste event carrying files in clipboardData
    // (the synchronous path — no async clipboard, no permission prompt).
    await page.evaluate(({ name, type, b64 }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File([bytes], name, { type }));
      const event = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: dataTransfer });
      window.dispatchEvent(event);
    }, file);

    await expect(page.locator('.options-2')).toBeVisible({ timeout: 10_000 });
  });

  test('the paste button reads an image off the clipboard into the editor', async ({
    page,
  }) => {
    await stubClipboardRead(page, [
      await transferFile(photo, 'photo.jpg', 'image/jpeg'),
    ]);
    await page.goto('/');
    await page.getByRole('button', { name: 'paste' }).click();

    await expect(page.locator('.options-2')).toBeVisible({ timeout: 10_000 });
  });

  test('the paste button reports an imageless clipboard', async ({ page }) => {
    await stubClipboardRead(page, []);
    await page.goto('/');
    await page.getByRole('button', { name: 'paste' }).click();

    await expect(page.locator('.snackbar .message')).toHaveText(
      'No image found on the clipboard.',
    );
  });

  test('the paste button reports a failed clipboard read', async ({ page }) => {
    await stubClipboardRead(page, 'reject');
    await page.goto('/');
    await page.getByRole('button', { name: 'paste' }).click();

    await expect(page.locator('.snackbar .message')).toHaveText(
      "Couldn't read the clipboard.",
    );
  });
});
