import { describe, expect, it, vi } from 'vitest';
import {
  defaultProcessorState,
  type EncoderState,
  type ProcessorState,
} from '../../src/client/lazy-app/feature-meta/shared';
import {
  encodeFrame,
  prepareFrame,
  type PipelineSteps,
} from '../../src/client/lazy-app/pipeline-core';
import { createResize } from '../../src/features/processors/resize/worker/runtime';

// Node has no ImageData; the Node proof polyfills it the same way.
globalThis.ImageData ??= class {
  constructor(
    public data: Uint8ClampedArray,
    public width: number,
    public height: number,
  ) {}
} as unknown as typeof ImageData;

const frame = (width: number, height: number, fill = 128) =>
  new ImageData(
    new Uint8ClampedArray(width * height * 4).fill(fill),
    width,
    height,
  );

const webP = { type: 'webP', options: {} } as EncoderState;

function recordingSteps(calls: string[]): PipelineSteps {
  return {
    rotate: async (image) => (
      calls.push('rotate'),
      frame(image.height, image.width)
    ),
    resize: async (_image, options) => (
      calls.push('resize'),
      frame(options.width, options.height)
    ),
    quantize: async (image) => (
      calls.push('quantize'),
      frame(image.width, image.height)
    ),
    encode: async () => (calls.push('encode'), new ArrayBuffer(8)),
  };
}

function processors(edit: (state: ProcessorState) => void): ProcessorState {
  const state = structuredClone(defaultProcessorState);
  edit(state);
  return state;
}

describe('prepareFrame', () => {
  it('returns the decoded frame itself at rotation 0', async () => {
    const decoded = frame(4, 2);
    const calls: string[] = [];
    expect(await prepareFrame(decoded, 0, recordingSteps(calls))).toBe(decoded);
    expect(calls).toEqual([]);
  });
});

describe('encodeFrame', () => {
  it('runs resize, grain, quantize, encode in that order', async () => {
    const calls: string[] = [];
    const steps = recordingSteps(calls);
    const quantizeSpy = vi.spyOn(steps, 'quantize');
    await encodeFrame(
      frame(4, 2),
      processors((s) => {
        s.resize = { ...s.resize, enabled: true, width: 2, height: 1 };
        s.grain = { ...s.grain, enabled: true, amount: 12 };
        s.quantize = { ...s.quantize, enabled: true };
      }),
      webP,
      steps,
    );
    expect(calls).toEqual(['resize', 'quantize', 'encode']);
    // Grain ran on the resized frame before quantize saw it.
    expect(quantizeSpy.mock.calls[0][0].width).toBe(2);
  });

  it('skips a resize to the frame size, zero grain, and a disabled palette', async () => {
    const calls: string[] = [];
    const prepared = frame(4, 2);
    const encode = vi.fn(async (image: ImageData) => {
      expect(image).toBe(prepared);
      return new ArrayBuffer(1);
    });
    await encodeFrame(
      prepared,
      processors((s) => {
        s.resize = { ...s.resize, enabled: true, width: 4, height: 2 };
        s.grain = { ...s.grain, enabled: true, amount: 0 };
      }),
      webP,
      { ...recordingSteps(calls), encode },
    );
    expect(calls).toEqual([]);
    expect(encode).toHaveBeenCalledOnce();
  });

  it('never writes to the prepared frame', async () => {
    const prepared = frame(4, 2, 100);
    const before = prepared.data.slice();
    await encodeFrame(
      prepared,
      processors((s) => {
        s.grain = { ...s.grain, enabled: true, amount: 40 };
      }),
      webP,
      recordingSteps([]),
    );
    expect(prepared.data).toEqual(before);
  });

  it('refuses a vector resize, which only the main thread can run', async () => {
    await expect(
      encodeFrame(
        frame(4, 2),
        processors((s) => {
          s.resize = {
            enabled: true,
            method: 'vector',
            width: 2,
            height: 2,
            fitMethod: 'stretch',
          };
        }),
        webP,
        recordingSteps([]),
      ),
    ).rejects.toThrow(/main thread/);
  });
});

describe('worker resize', () => {
  it('leaves its input untouched on a contain-fit crop', async () => {
    const resize = createResize({
      initHqxWasm: vi.fn(async () => ({})) as never,
      initResizeWasm: vi.fn(async () => ({})) as never,
      wasmHqx: vi.fn() as never,
      wasmResize: ((
        _input: Uint8Array,
        _w: number,
        _h: number,
        ow: number,
        oh: number,
      ) => new Uint8Array(ow * oh * 4)) as never,
    });
    const source = frame(4, 2);
    // Distinct pixels so an in-place shuffle would show.
    source.data.forEach((_, i) => (source.data[i] = i));
    const before = source.data.slice();
    await resize(source, {
      method: 'lanczos3',
      width: 2,
      height: 2,
      fitMethod: 'contain',
      premultiply: true,
      linearRGB: true,
    });
    expect(source.data).toEqual(before);
  });
});
