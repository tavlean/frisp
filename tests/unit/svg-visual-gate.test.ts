import { describe, expect, it } from 'vitest';
import { gatePasses, paintedUnion } from '../../src/lib/svg/visual-gate';

function image(width: number, height: number, painted: [number, number][]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [x, y] of painted) data[(y * width + x) * 4 + 3] = 255;
  return { data, width, height } as ImageData;
}

describe('SVG visual gate', () => {
  it('passes identical buffers', () => {
    const original = image(8, 8, [[2, 2]]);
    expect(gatePasses(original, original, 1)).toBe(true);
  });

  it('rejects a moved 2px dot on a small painted area', () => {
    const original = image(8, 8, [
      [1, 1],
      [2, 1],
    ]);
    const candidate = image(8, 8, [
      [3, 1],
      [4, 1],
    ]);
    expect(
      gatePasses(
        original,
        candidate,
        paintedUnion(original.data, candidate.data),
      ),
    ).toBe(false);
  });

  it('counts painted union rather than transparent canvas pixels', () => {
    const a = image(10, 10, [
      [1, 1],
      [2, 2],
    ]);
    const b = image(10, 10, [
      [2, 2],
      [3, 3],
    ]);
    expect(paintedUnion(a.data, b.data)).toBe(3);
  });
});
