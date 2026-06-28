import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

// Regression guard for the two-up display footprint. When the right (output) side
// is resized SMALLER than the source, its canvas must keep the SAME on-screen
// footprint as the left (original) side — the smaller raster is stretched to fill
// the original source box (CSS width/height pinned to the preprocessed dims) so
// the two-up split stays aligned. The bug: the port only pinned the box when
// fitMethod==='contain', so a default ('stretch') downscale shrank the output
// canvas in place and the comparison became meaningless.
const photo = fileURLToPath(new URL('../fixtures/photo.jpg', import.meta.url));

test('resized-down output keeps the original footprint in the two-up view', async ({
  page,
}) => {
  await page.goto('/');
  await page.setInputFiles('input[type=file]', photo);

  const panel = page.locator('.options-2');
  // Lossless PNG so the resized raster is preserved exactly (parity with resize.spec).
  await panel.locator('select.builtin-select').first().selectOption('oxiPNG');

  const setup = await page.evaluate(async () => {
    const root = document.querySelector('.options-2')!;
    const fire = (el: Element, ...types: string[]) =>
      types.forEach((t) => el.dispatchEvent(new Event(t, { bubbles: true })));
    const setVal = (
      el: HTMLInputElement,
      prop: 'value' | 'checked',
      v: unknown,
    ) =>
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        prop,
      )!.set!.call(el, v);
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const enabler = [...root.querySelectorAll('label.option-toggle')].find(
      (l) => /Resize/.test(l.textContent ?? ''),
    );
    const cb = enabler?.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    if (cb && !cb.checked) {
      setVal(cb, 'checked', true);
      fire(cb, 'input', 'change');
    }
    await sleep(400); // let the {#if} mount ResizeOptions

    // Leave fitMethod at its default ('stretch') — that's the path the bug broke.
    const methodSel = [
      ...root.querySelectorAll<HTMLSelectElement>('select.builtin-select'),
    ].find((s) => [...s.options].some((o) => o.value === 'lanczos3'));
    if (methodSel) {
      methodSel.value = 'lanczos3';
      fire(methodSel, 'input', 'change');
    }

    const widthInput = [...root.querySelectorAll('label')]
      .find((l) => /Width/.test(l.textContent ?? ''))
      ?.querySelector<HTMLInputElement>('input[type="number"]');
    if (widthInput) {
      setVal(widthInput, 'value', '256');
      fire(widthInput, 'input', 'change');
    }
    await sleep(300);
    return { enabled: !!cb?.checked, widthFound: !!widthInput };
  });
  expect(setup.enabled, 'Resize toggle was not enabled').toBe(true);
  expect(setup.widthFound, 'Width input not found').toBe(true);

  // Wait until the right canvas actually holds the 256px-wide resized raster.
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const c = document.querySelectorAll<HTMLCanvasElement>(
            'canvas.pinch-target',
          );
          return c[1]?.width ?? 0;
        }),
      { timeout: 60_000 },
    )
    .toBe(256);

  const m = await page.evaluate(() => {
    const c = document.querySelectorAll<HTMLCanvasElement>(
      'canvas.pinch-target',
    );
    const [left, right] = [c[0], c[1]];
    return {
      leftAttr: left.width, // intrinsic raster width (source dims)
      rightAttr: right.width, // intrinsic raster width (resized = 256)
      leftCss: getComputedStyle(left).width, // displayed CSS box
      rightCss: getComputedStyle(right).width,
      leftRect: left.getBoundingClientRect().width, // on-screen footprint
      rightRect: right.getBoundingClientRect().width,
    };
  });

  // The output really IS downscaled (intrinsic raster shrank)...
  expect(m.rightAttr, 'right raster should be the resized 256px').toBe(256);
  expect(m.leftAttr, 'left raster should be the larger source').toBeGreaterThan(
    256,
  );
  // ...but its DISPLAYED box is pinned to the source dims, so the two sides share
  // the same on-screen footprint (the fix). Pre-fix, rightRect collapsed to ~256.
  expect(
    m.rightCss,
    'right CSS box should equal left CSS box (pinned to source)',
  ).toBe(m.leftCss);
  expect(
    Math.abs(m.rightRect - m.leftRect),
    `footprints should match (left=${m.leftRect} right=${m.rightRect})`,
  ).toBeLessThan(2);
  expect(
    m.rightRect,
    'right footprint must not collapse to the resized raster width',
  ).toBeGreaterThan(256);
});
