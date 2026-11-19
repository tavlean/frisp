import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isBlankFrame, readPixels } from '../../src/shared/canvas-readback';

globalThis.ImageData ??= class {
  constructor(
    public data: Uint8ClampedArray,
    public width: number,
    public height: number,
  ) {}
} as unknown as typeof ImageData;

const blank = () => new ImageData(new Uint8ClampedArray(2 * 2 * 4), 2, 2);
const drawn = () => {
  const data = new Uint8ClampedArray(2 * 2 * 4);
  data[data.length - 1] = 255; // one opaque pixel, last in the scan
  return new ImageData(data, 2, 2);
};

describe('isBlankFrame', () => {
  it('is true only when every byte is zero', () => {
    expect(isBlankFrame(blank())).toBe(true);
    expect(isBlankFrame(drawn())).toBe(false);
  });

  it('reads only the view, not the rest of a shared buffer', () => {
    const buffer = new Uint8ClampedArray(32).fill(255);
    const view = new Uint8ClampedArray(buffer.buffer, 16, 16).fill(0);
    expect(isBlankFrame(new ImageData(view, 2, 2))).toBe(true);
  });
});

describe('readPixels', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns a good first frame without drawing again', async () => {
    const draw = vi.fn(drawn);
    await expect(readPixels(draw)).resolves.toMatchObject({ width: 2 });
    expect(draw).toHaveBeenCalledOnce();
  });

  it('draws again, one task later, after a blank frame', async () => {
    const draw = vi.fn().mockReturnValueOnce(blank()).mockReturnValue(drawn());
    const result = readPixels(draw);
    await vi.advanceTimersToNextTimerAsync();
    expect(isBlankFrame(await result)).toBe(false);
    expect(draw).toHaveBeenCalledTimes(2);
  });

  it('does not redraw before the task, when WebKit has not relaunched yet', async () => {
    const draw = vi.fn().mockReturnValueOnce(blank()).mockReturnValue(drawn());
    void readPixels(draw);
    await Promise.resolve();
    await Promise.resolve();
    expect(draw).toHaveBeenCalledOnce();
    await vi.runAllTimersAsync();
    expect(draw).toHaveBeenCalledTimes(2);
  });

  it('draws again after a throw, and a second throw is final', async () => {
    const draw = vi
      .fn()
      .mockImplementationOnce(() => {
        throw Error('first');
      })
      .mockImplementation(() => {
        throw Error('second');
      });
    const result = readPixels(draw);
    const settled = expect(result).rejects.toThrow('second');
    await vi.runAllTimersAsync();
    await settled;
    expect(draw).toHaveBeenCalledTimes(2);
  });

  it('keeps a frame that is blank twice, since the source may be', async () => {
    const draw = vi.fn(async () => blank());
    const result = readPixels(draw);
    await vi.runAllTimersAsync();
    expect(isBlankFrame(await result)).toBe(true);
    expect(draw).toHaveBeenCalledTimes(2);
  });
});
