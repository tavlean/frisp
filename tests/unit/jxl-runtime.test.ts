import { describe, expect, it, vi } from 'vitest';
import { createJxlEncoderRuntime } from '../../src/features/encoders/jxl/worker/runtime';
import { defaultOptions } from '../../src/features/encoders/jxl/shared/meta';

describe('the JPEG XL encoder runtime', () => {
  it('never passes the retired lossy palette option to the encoder', async () => {
    const encode = vi.fn(() => new Uint8Array([1, 2, 3]));
    const factory = (async () => ({ encode })) as never;
    const runtime = createJxlEncoderRuntime({
      loadMultiThread: async () => factory,
      loadMultiThreadSimd: async () => factory,
      loadSingleThread: async () => factory,
      supportsThreads: async () => false,
      supportsSimd: async () => false,
    });
    const image = { data: new Uint8ClampedArray(4), width: 1, height: 1 };

    await runtime.encode(image as ImageData, {
      ...defaultOptions,
      quality: 100,
      lossyPalette: true,
    });

    expect(encode).toHaveBeenCalledWith(
      image.data,
      1,
      1,
      expect.objectContaining({ quality: 100, lossyPalette: false }),
    );
  });
});
