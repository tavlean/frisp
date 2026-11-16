// Known answers for the owned pixelmatch port. Every expected count below was
// computed once with the real pixelmatch 7.2.0 (threshold 0.1, includeAA off,
// no output buffer) before the package was removed; a change in any of them
// means the port no longer matches upstream. The "counted as AA" figures are
// what upstream reports with includeAA on, kept to show each AA fixture really
// exercises the anti-aliasing exclusion.

import { describe, expect, it } from 'vitest';
import { countMismatchedPixels } from '../../src/shared/pixelmatch';

const W = 16;
const H = 16;

type Paint = (x: number, y: number) => [number, number, number, number];

function render(paint: Paint): Uint8ClampedArray {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) data.set(paint(x, y), (y * W + x) * 4);
  }
  return data;
}

// Deterministic noise so the "identical" case is not a flat fill.
const noise: Paint = (x, y) => {
  const v = (x * 73 + y * 151 + x * y * 7) % 256;
  return [v, (v * 3) % 256, (v * 5) % 256, 255];
};

const flat =
  (v: number): Paint =>
  () => [v, v, v, 255];

// A dark disc on white whose rim is shaded by pixel coverage, like a
// rasterizer's anti-aliasing, centred at (cx, 8).
function disc(cx: number): Paint {
  return (x, y) => {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - 8);
    const coverage = Math.min(1, Math.max(0, 5 - d));
    const v = Math.round(255 * (1 - coverage));
    return [v, v, v, 255];
  };
}

// Same disc in black with coverage carried in alpha instead, so the
// checkerboard blending path runs.
function translucentDisc(cx: number): Paint {
  return (x, y) => {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - 8);
    const coverage = Math.min(1, Math.max(0, 5 - d));
    return [0, 0, 0, Math.round(255 * coverage)];
  };
}

const sparseSpots: [number, number][] = [
  [0, 0],
  [5, 3],
  [10, 10],
  [15, 15],
  [3, 12],
];

function withSpots(base: Paint, spots: [number, number][]): Paint {
  return (x, y) =>
    spots.some(([sx, sy]) => sx === x && sy === y)
      ? [255, 0, 0, 255]
      : base(x, y);
}

const count = (a: Uint8ClampedArray, b: Uint8ClampedArray) =>
  countMismatchedPixels(a, b, W, H, 0.1);

describe('countMismatchedPixels (pixelmatch 7.2.0 port)', () => {
  it('finds nothing in identical images', () => {
    expect(count(render(noise), render(noise))).toBe(0);
  });

  it('counts every pixel of black against white', () => {
    expect(count(render(flat(0)), render(flat(255)))).toBe(256);
  });

  it('counts isolated changed pixels, including at the corners', () => {
    expect(
      count(render(flat(255)), render(withSpots(flat(255), sparseSpots))),
    ).toBe(5);
  });

  // 48 pixels differ byte-wise; upstream with includeAA on counts 36.
  it('ignores an anti-aliased edge moved by one pixel', () => {
    expect(count(render(disc(7.5)), render(disc(8.5)))).toBe(0);
  });

  // Upstream with includeAA on counts 52.
  it('excludes only the anti-aliased part of a two-pixel move', () => {
    expect(count(render(disc(7.5)), render(disc(9.5)))).toBe(12);
  });

  // Upstream with includeAA on counts 28 and 49.
  it('blends translucent pixels against the checkerboard', () => {
    expect(
      count(render(translucentDisc(7.5)), render(translucentDisc(8.5))),
    ).toBe(0);
    expect(
      count(render(translucentDisc(7.5)), render(translucentDisc(9.5))),
    ).toBe(12);
  });

  it('rejects buffers that do not match the dimensions', () => {
    expect(() =>
      countMismatchedPixels(render(noise), render(noise), W, H + 1),
    ).toThrow();
  });
});
