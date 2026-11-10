import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// The worker-side pipeline's promise (docs/project/specs/
// 2026-11-04-worker-side-pipeline.md): an encode sends the codec worker a
// file and a recipe, never a frame of pixels to copy. Before it, rotate,
// palette reduction, and the encode were each a round trip carrying a
// structured clone of the whole frame. This watches every message the page
// posts to any worker and fails on a large buffer that is not transferred.

const photo = fileURLToPath(new URL('../fixtures/photo.jpg', import.meta.url));
const BIG = 64 * 1024;

declare global {
  interface Window {
    __workerPosts: { cloned: string[] }[];
  }
}

async function watchWorkerPosts(page: Page): Promise<void> {
  await page.addInitScript((big: number) => {
    window.__workerPosts = [];
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (
      this: Worker,
      message: unknown,
      options?: Transferable[] | StructuredSerializeOptions,
    ) {
      const transfer = new Set<unknown>(
        Array.isArray(options) ? options : (options?.transfer ?? []),
      );
      const cloned: string[] = [];
      const seen = new Set<unknown>();
      const walk = (value: unknown, path: string): void => {
        if (!value || typeof value !== 'object' || seen.has(value)) return;
        seen.add(value);
        if (value instanceof Blob) return; // shared by reference
        if (value instanceof ImageData) {
          if (value.data.byteLength >= big && !transfer.has(value.data.buffer))
            cloned.push(`${path} (ImageData ${value.width}x${value.height})`);
          return;
        }
        if (ArrayBuffer.isView(value)) {
          if (value.byteLength >= big && !transfer.has(value.buffer))
            cloned.push(`${path} (${value.byteLength} bytes)`);
          return;
        }
        if (value instanceof ArrayBuffer) {
          if (value.byteLength >= big && !transfer.has(value))
            cloned.push(`${path} (${value.byteLength} bytes)`);
          return;
        }
        for (const [key, child] of Object.entries(value))
          walk(child, `${path}.${key}`);
      };
      walk(message, 'message');
      window.__workerPosts.push({ cloned });
      return post.call(
        this,
        message,
        Array.isArray(options) ? { transfer: options } : options,
      );
    };
  }, BIG);
}

test('an encode posts no full-frame copy to a worker', async ({ page }) => {
  await watchWorkerPosts(page);

  await page.goto('/');
  await page.setInputFiles('input[type=file][accept="image/*"]', photo);
  const panel = page.locator('.options-2');
  const download = panel.locator('a.download[href^="blob:"]');
  await expect(download).toBeVisible({ timeout: 60_000 });

  // Rotate, then reduce the palette: two steps that each used to be a
  // separate worker round trip with the frame cloned in and out.
  await page.getByRole('button', { name: 'Rotate' }).click();
  await page.evaluate(async () => {
    const root = document.querySelector('.options-2')!;
    const row = [...root.querySelectorAll('label.option-toggle')].find((l) =>
      /Reduce palette/.test(l.textContent ?? ''),
    );
    const checkbox = row?.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    if (!checkbox) throw Error('Reduce palette toggle not found');
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'checked',
    )!.set!.call(checkbox, true);
    checkbox.dispatchEvent(new Event('input', { bubbles: true }));
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // Settled on the rotated, palette-reduced result: 683 wide, 1024 tall.
  await expect
    .poll(
      async () => {
        if ((await page.title()).includes('⏳')) return null;
        const href = await download.getAttribute('href');
        return page.evaluate(async (url: string | null) => {
          if (!url) return null;
          const blob = await (await fetch(url)).blob();
          const bitmap = await createImageBitmap(blob);
          return [bitmap.width, bitmap.height];
        }, href);
      },
      { timeout: 60_000 },
    )
    .toEqual([683, 1024]);

  const posts = await page.evaluate(() => window.__workerPosts);
  expect(posts.length).toBeGreaterThan(0);
  expect(posts.flatMap((post) => post.cloned)).toEqual([]);
});

// Guards the guard: the watcher must flag a frame posted without a transfer,
// or the test above could pass by seeing nothing.
test('the watcher flags a cloned frame and ignores a transferred one', async ({
  page,
}) => {
  await watchWorkerPosts(page);
  await page.goto('/');
  const flagged = await page.evaluate(() => {
    const url = URL.createObjectURL(
      new Blob(['onmessage = () => {}'], { type: 'text/javascript' }),
    );
    const worker = new Worker(url);
    const frame = () => new ImageData(256, 256);
    worker.postMessage({ frame: frame() });
    const moved = frame();
    worker.postMessage({ frame: moved }, [moved.data.buffer]);
    worker.terminate();
    return window.__workerPosts.map((post) => post.cloned.length);
  });
  expect(flagged).toEqual([1, 0]);
});
