import { afterEach, describe, expect, it, vi } from 'vitest';
import { nativeDecode } from '../../src/worker/offscreen';

globalThis.ImageData ??= class {
  constructor(
    public data: Uint8ClampedArray,
    public width: number,
    public height: number,
  ) {}
} as unknown as typeof ImageData;

const blank = () => new ImageData(new Uint8ClampedArray(2 * 2 * 4), 2, 2);
const opaque = () =>
  new ImageData(new Uint8ClampedArray(2 * 2 * 4).fill(255), 2, 2);

/** A browser whose canvas readbacks return `frames` in order. */
function stubBrowser(...frames: ImageData[]) {
  const getImageData = vi.fn(() => frames.shift()!);
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 2, height: 2, close: () => {} })),
  );
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      getContext() {
        return { drawImage: () => {}, getImageData };
      }
    },
  );
  return getImageData;
}

describe('nativeDecode', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('decodes again when the browser hands back a blank frame', async () => {
    const readback = stubBrowser(blank(), opaque());
    const image = await nativeDecode(new Blob());
    expect(image.data[3]).toBe(255);
    expect(readback).toHaveBeenCalledTimes(2);
  });

  it('keeps a frame that is blank twice, since the source may be', async () => {
    const readback = stubBrowser(blank(), blank());
    const image = await nativeDecode(new Blob());
    expect(image.data.every((byte) => byte === 0)).toBe(true);
    expect(readback).toHaveBeenCalledTimes(2);
  });

  it('decodes a normal frame once', async () => {
    const readback = stubBrowser(opaque());
    await nativeDecode(new Blob());
    expect(readback).toHaveBeenCalledOnce();
  });
});
