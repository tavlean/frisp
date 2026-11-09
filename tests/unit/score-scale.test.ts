import { describe, expect, it } from 'vitest';
import {
  boxDownscale,
  cropRegion,
  scorePairs,
  scoreScaleFactor,
  scoreTiles,
} from '../../src/worker/score-scale';

globalThis.ImageData ??= class {
  constructor(
    public data: Uint8ClampedArray,
    public width: number,
    public height: number,
  ) {}
} as unknown as typeof ImageData;

const blank = (width: number, height: number) =>
  new ImageData(new Uint8ClampedArray(width * height * 4), width, height);

describe('scoreScaleFactor', () => {
  it('scores frames up to 4 MP at full size', () => {
    expect(scoreScaleFactor(1024, 683)).toBe(1);
    expect(scoreScaleFactor(2000, 2000)).toBe(1);
    // Over 4 MP with the long edge already within 2048: factor 1.
    expect(scoreScaleFactor(2040, 2000)).toBe(1);
  });

  it('brings the long edge to at most 2048 px above 4 MP', () => {
    for (const [w, h] of [
      [4000, 3000],
      [3000, 4000],
      [6000, 4000],
      [8192, 5464],
      [2100, 2100],
    ]) {
      const factor = scoreScaleFactor(w, h);
      expect(Math.max(w, h) / factor).toBeLessThanOrEqual(2048);
      // The smallest such whole factor.
      if (factor > 1)
        expect(Math.max(w, h) / (factor - 1)).toBeGreaterThan(2048);
    }
    expect(scoreScaleFactor(4000, 3000)).toBe(2);
  });
});

describe('boxDownscale', () => {
  it('averages each block, per channel', () => {
    const image = blank(4, 2);
    // Left 2x2 block: red 0, 100, 200, 100 -> 100. Alpha 255 everywhere.
    const reds = [0, 100, 50, 50, 200, 100, 50, 50];
    reds.forEach((red, pixel) => {
      image.data[pixel * 4] = red;
      image.data[pixel * 4 + 3] = 255;
    });
    const out = boxDownscale(image, 2);
    expect([out.width, out.height]).toEqual([2, 1]);
    expect([...out.data]).toEqual([100, 0, 0, 255, 50, 0, 0, 255]);
  });

  it('drops a partial edge block and never writes to its input', () => {
    const image = blank(5, 3);
    image.data.fill(10);
    const before = image.data.slice();
    const out = boxDownscale(image, 2);
    expect([out.width, out.height]).toEqual([2, 1]);
    expect([...out.data]).toEqual(new Array(8).fill(10));
    expect(image.data).toEqual(before);
  });

  it('returns the frame itself at factor 1', () => {
    const image = blank(3, 3);
    expect(boxDownscale(image, 1)).toBe(image);
  });
});

describe('cropRegion', () => {
  it('copies a rectangle at full resolution without touching its input', () => {
    const image = blank(4, 3);
    // Each pixel's red channel holds its index.
    for (let i = 0; i < 12; i++) image.data[i * 4] = i;
    const before = image.data.slice();
    const out = cropRegion(image, { x: 1, y: 1, width: 2, height: 2 });
    expect([out.width, out.height]).toEqual([2, 2]);
    expect([0, 1, 2, 3].map((p) => out.data[p * 4])).toEqual([5, 6, 9, 10]);
    expect(image.data).toEqual(before);
  });
});

describe('scoreTiles', () => {
  it('scores frames up to 4 MP whole', () => {
    expect(scoreTiles(2000, 2000)).toBeNull();
  });

  it('places four in-bounds tiles, one centred in each quadrant', () => {
    for (const [w, h] of [
      [4000, 3000],
      [3000, 4000],
      [6000, 4000],
      [8192, 5464],
    ]) {
      const tiles = scoreTiles(w, h)!;
      expect(tiles).toHaveLength(4);
      const factor = scoreScaleFactor(w, h);
      for (const [i, tile] of tiles.entries()) {
        expect(tile.x).toBeGreaterThanOrEqual(0);
        expect(tile.y).toBeGreaterThanOrEqual(0);
        expect(tile.x + tile.width).toBeLessThanOrEqual(w);
        expect(tile.y + tile.height).toBeLessThanOrEqual(h);
        // Centred in its own quadrant (row-major order).
        const cx = tile.x + tile.width / 2;
        const cy = tile.y + tile.height / 2;
        expect(Math.abs(cx - ((i % 2) + 0.5) * (w / 2))).toBeLessThanOrEqual(1);
        expect(
          Math.abs(cy - (Math.floor(i / 2) + 0.5) * (h / 2)),
        ).toBeLessThanOrEqual(1);
      }
      // Together they cost what the frame shrunk by `factor` would.
      const pixels = tiles.reduce((sum, t) => sum + t.width * t.height, 0);
      expect(pixels).toBeLessThanOrEqual((w / factor) * (h / factor));
      expect(pixels).toBeGreaterThan(
        0.95 * (w / factor) * (h / factor) - 4 * (w + h),
      );
    }
    expect(scoreTiles(4000, 3000)![0]).toEqual({
      x: 500,
      y: 375,
      width: 1000,
      height: 750,
    });
  });

  it('gives up on a frame too thin for useful tiles', () => {
    expect(scoreTiles(40000, 120)).toBeNull();
  });
});

describe('scorePairs', () => {
  it('scores a small frame as itself', () => {
    const small = blank(1024, 683);
    const pairs = scorePairs(small, small);
    expect(pairs).toHaveLength(1);
    expect(pairs[0][0]).toBe(small);
  });

  it('scores a large frame as four matching full-resolution tiles', () => {
    const ref = blank(4000, 3000);
    const dist = blank(4000, 3000);
    const pairs = scorePairs(ref, dist);
    expect(pairs).toHaveLength(4);
    for (const [a, b] of pairs) {
      expect([a.width, a.height, b.width, b.height]).toEqual([
        1000, 750, 1000, 750,
      ]);
    }
  });

  it('shrinks a thin large frame alike instead', () => {
    const ref = blank(40000, 120);
    const [[a, b], ...rest] = scorePairs(ref, blank(40000, 120));
    expect(rest).toHaveLength(0);
    const factor = scoreScaleFactor(40000, 120);
    expect([a.width, b.width]).toEqual([
      Math.floor(40000 / factor),
      Math.floor(40000 / factor),
    ]);
  });
});
