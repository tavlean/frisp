import { afterEach, describe, expect, it, vi } from 'vitest';
import { nativeDecode, pixelatedResize } from '../../src/worker/offscreen';

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

/** A browser whose canvas readbacks answer with `frames` in order; an Error
 *  in the list is thrown, as WebKit does once its GPU process is gone. */
function stubBrowser(...frames: (ImageData | Error)[]) {
  const getImageData = vi.fn(() => {
    const next = frames.shift()!;
    if (next instanceof Error) throw next;
    return next;
  });
  const bitmaps: { close: () => void }[] = [];
  const createImageBitmap = vi.fn(async () => {
    const bitmap = { width: 2, height: 2, close: vi.fn() };
    bitmaps.push(bitmap);
    return bitmap;
  });
  vi.stubGlobal('createImageBitmap', createImageBitmap);
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      canvas = this;
      getContext() {
        return {
          canvas: this,
          drawImage: () => {},
          putImageData: () => {},
          getImageData,
        };
      }
    },
  );
  return { getImageData, createImageBitmap, bitmaps };
}

describe('nativeDecode', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('decodes the file afresh when the first readback is blank', async () => {
    const browser = stubBrowser(blank(), opaque());
    const image = await nativeDecode(new Blob());
    expect(image.data[3]).toBe(255);
    // A new bitmap: the first one lived in the dead GPU process.
    expect(browser.createImageBitmap).toHaveBeenCalledTimes(2);
    for (const bitmap of browser.bitmaps)
      expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it('decodes again when the readback throws', async () => {
    const browser = stubBrowser(Error('InvalidStateError'), opaque());
    const image = await nativeDecode(new Blob());
    expect(image.data[3]).toBe(255);
    expect(browser.bitmaps).toHaveLength(2);
    for (const bitmap of browser.bitmaps)
      expect(bitmap.close).toHaveBeenCalledOnce();
  });

  it('decodes a normal frame once', async () => {
    const browser = stubBrowser(opaque());
    await nativeDecode(new Blob());
    expect(browser.getImageData).toHaveBeenCalledOnce();
  });
});

describe('pixelatedResize', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('draws again when the readback is blank', async () => {
    const browser = stubBrowser(blank(), opaque());
    const image = await pixelatedResize(opaque(), {
      method: 'browser-pixelated',
      fitMethod: 'stretch',
      width: 2,
      height: 2,
    } as Parameters<typeof pixelatedResize>[1]);
    expect(image.data[3]).toBe(255);
    expect(browser.getImageData).toHaveBeenCalledTimes(2);
  });
});
