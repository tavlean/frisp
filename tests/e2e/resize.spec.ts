import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

// Functionally exercises the WASM resize processor (Rust `resize` crate, lanczos3):
// resize a photo, encode lossless PNG, decode the output and assert the dimensions
// match the request AND the image isn't garbage. This is the functional guard for
// resize rebuilds — the typed-pixel-slice rewrite (0.5.5 -> 0.8.9) could silently
// produce wrong-sized or corrupt output that the encode-only tests never touch.
const photo = fileURLToPath(new URL('../fixtures/photo.jpg', import.meta.url));

test('WASM resize outputs the requested size and a valid image', async ({
  page,
}) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', photo);

  const panel = page.locator('.options-2');
  // Lossless PNG preserves the resized pixels exactly.
  await panel.locator('select.builtin-select').first().selectOption('browserPNG');

  const setup = await page.evaluate(async () => {
    const root = document.querySelector('.options-2')!;
    const fire = (el: Element, ...types: string[]) =>
      types.forEach((t) => el.dispatchEvent(new Event(t, { bubbles: true })));
    const setVal = (
      el: HTMLInputElement,
      prop: 'value' | 'checked',
      v: unknown,
    ) =>
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, prop)!.set!.call(
        el,
        v,
      );
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // Enable the "Resize" section-enabler toggle.
    const enabler = [...root.querySelectorAll('label.option-toggle')].find((l) =>
      /Resize/.test(l.textContent ?? ''),
    );
    const cb = enabler?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (cb && !cb.checked) {
      setVal(cb, 'checked', true);
      fire(cb, 'input', 'change');
    }
    await sleep(400); // let the {#if} mount ResizeOptions

    // Method -> lanczos3 (the WASM path) — the select that offers it.
    const methodSel = [
      ...root.querySelectorAll<HTMLSelectElement>('select.builtin-select'),
    ].find((s) => [...s.options].some((o) => o.value === 'lanczos3'));
    if (methodSel) {
      methodSel.value = 'lanczos3';
      fire(methodSel, 'input', 'change');
    }

    // Width -> 256 (whatever maintain-aspect does to height, width stays 256).
    const widthInput = [...root.querySelectorAll('label')]
      .find((l) => /Width/.test(l.textContent ?? ''))
      ?.querySelector<HTMLInputElement>('input[type="number"]');
    if (widthInput) {
      setVal(widthInput, 'value', '256');
      fire(widthInput, 'input', 'change');
    }
    await sleep(300);

    return {
      enabled: !!cb?.checked,
      methodValue: methodSel?.value ?? null,
      widthFound: !!widthInput,
    };
  });
  expect(setup.enabled, 'Resize toggle was not enabled').toBe(true);
  expect(setup.methodValue, 'Method not set to lanczos3 (WASM path)').toBe(
    'lanczos3',
  );
  expect(setup.widthFound, 'Width input not found').toBe(true);

  await expect
    .poll(async () => (await page.title()).includes('⏳'), { timeout: 60_000 })
    .toBe(false);
  const download = panel.locator('a.download[href^="blob:"]');
  await expect(download).toBeVisible({ timeout: 60_000 });
  const href = await download.getAttribute('href');

  const out = await page.evaluate(async (url: string) => {
    const bmp = await createImageBitmap(await (await fetch(url)).blob());
    const cv = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = cv.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bmp, 0, 0);
    const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
    const seen = new Set<number>();
    for (let i = 0; i < data.length; i += 4)
      seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    return { w: bmp.width, h: bmp.height, colors: seen.size };
  }, href!);

  expect(out.w, `resized width should be 256 (got ${out.w}x${out.h})`).toBe(256);
  expect(out.w, 'output should be smaller than the 1024 source').toBeLessThan(
    1024,
  );
  expect(
    out.colors,
    'resized output should not be a flat colour (garbage check)',
  ).toBeGreaterThan(50);
});
