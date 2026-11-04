import { describe, expect, it } from 'vitest';
import {
  boxDownscale,
  scorePair,
  scoreScaleFactor,
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

describe('scorePair', () => {
  it('shrinks both frames by the same factor above 4 MP only', () => {
    const [a, b] = scorePair(blank(4000, 3000), blank(4000, 3000));
    expect([a.width, a.height, b.width, b.height]).toEqual([
      2000, 1500, 2000, 1500,
    ]);
    const small = blank(1024, 683);
    expect(scorePair(small, small)[0]).toBe(small);
  });
});
