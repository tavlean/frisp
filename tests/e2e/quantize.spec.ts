import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

// Functionally exercises the quantize processor (libimagequant / "Reduce
// palette"): reduce a photo to N colours, encode lossless PNG, decode the
// output and assert it really has <= N unique colours. This is the functional
// guard for libimagequant rebuilds (the encode-only tests don't touch it).
const photo = fileURLToPath(new URL('../fixtures/photo.jpg', import.meta.url));

test('Reduce palette quantizes to the requested colour count', async ({
  page,
}) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file][accept^="image/*"]', photo);

  const panel = page.locator('.options-2');
  // A lossless output (OxiPNG) preserves the quantized palette exactly.
  await panel.locator('select.builtin-select').selectOption('oxiPNG');

  // Enable "Reduce palette" and request 4 colours, driven in-page (the styled
  // Toggle intercepts synthetic clicks). Returns a diagnostic so a wrong
  // assumption surfaces in the failure message instead of a blind timeout.
  const setup = await page.evaluate(async () => {
    const root = document.querySelector('.options-2')!;
    const fire = (el: Element, ...types: string[]) =>
      types.forEach((t) => el.dispatchEvent(new Event(t, { bubbles: true })));
    const setProp = (
      el: HTMLInputElement,
      prop: 'checked' | 'value',
      v: unknown,
    ) =>
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        prop,
      )!.set!.call(el, v);
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const toggleLabels = [...root.querySelectorAll('label.option-toggle')];
    const row = toggleLabels.find((l) =>
      /Reduce palette/.test(l.textContent ?? ''),
    );
    const checkbox = row?.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    if (checkbox && !checkbox.checked) {
      setProp(checkbox, 'checked', true);
      fire(checkbox, 'input', 'change');
    }
    await sleep(400); // let the {#if} + slide transition mount the controls

    const colourRange = [...root.querySelectorAll('label.range')]
      .find((l) => /Colors/.test(l.textContent ?? ''))
      ?.querySelector<HTMLInputElement>('input[type="range"]');
    if (colourRange) {
      setProp(colourRange, 'value', '4');
      fire(colourRange, 'input', 'change');
    }
    return {
      togglesSeen: toggleLabels.map((l) => (l.textContent ?? '').trim()),
      quantizeEnabled: !!checkbox?.checked,
      colourRangeFound: !!colourRange,
    };
  });
  expect(
    setup.colourRangeFound,
    `quantize controls not found (toggles: ${setup.togglesSeen.join(' | ')})`,
  ).toBe(true);

  await expect
    .poll(async () => (await page.title()).includes('⏳'), { timeout: 60_000 })
    .toBe(false);
  const download = panel.locator('a.download[href^="blob:"]');
  await expect(download).toBeVisible({ timeout: 60_000 });
  const href = await download.getAttribute('href');

  const uniqueColours = await page.evaluate(async (url: string) => {
    const bmp = await createImageBitmap(await (await fetch(url)).blob());
    const cv = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = cv.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bmp, 0, 0);
    const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
    const seen = new Set<number>();
    for (let i = 0; i < data.length; i += 4) {
      seen.add(
        ((data[i] << 24) |
          (data[i + 1] << 16) |
          (data[i + 2] << 8) |
          data[i + 3]) >>>
          0,
      );
    }
    return seen.size;
  }, href!);

  expect(
    uniqueColours,
    'quantized output should have at most the 4 requested colours',
  ).toBeLessThanOrEqual(4);
  expect(
    uniqueColours,
    'output should not collapse to a single flat colour',
  ).toBeGreaterThan(1);
});
