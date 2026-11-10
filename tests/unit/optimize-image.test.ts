import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultProcessorState,
  encoderMap,
  type EncoderState,
} from '../../src/client/lazy-app/feature-meta/shared';
import type { ImageRecipe } from '../../src/client/lazy-app/recipe';
import { getDefaultOptions } from '../../src/lib/compress';
import type SvelteKitWorkerBridge from '../../src/lib/sveltekit-worker-bridge';
import { DEFAULT_SVG_OPTIONS } from '../../src/lib/svg/optimize-options';
import { fakeFile } from './fixtures';

const lanes = vi.hoisted(() => ({ optimizeSvgSide: vi.fn() }));

vi.mock('../../src/lib/svg/optimize', () => ({
  optimizeSvgSide: lanes.optimizeSvgSide,
}));

globalThis.ImageData ??= class {
  constructor(
    public data: Uint8ClampedArray,
    public width: number,
    public height: number,
  ) {}
} as unknown as typeof ImageData;
URL.createObjectURL ??= () => 'blob:fake';

const { chooseLane, optimizeImage } =
  await import('../../src/lib/optimize-image');

const JPEG = fakeFile('photo.jpg', { type: 'image/jpeg' });
const PNG = fakeFile('photo.png', { type: 'image/png' });
const SVG = fakeFile('logo.svg', { type: 'image/svg+xml' });
const SOURCE = { width: 1024, height: 683 };

function recipe(
  encoder: EncoderState | 'svg',
  edit: (recipe: ImageRecipe) => void = () => {},
): ImageRecipe {
  const result: ImageRecipe = {
    rotate: 0,
    processors: structuredClone(defaultProcessorState),
    output:
      encoder === 'svg'
        ? { kind: 'svg', options: { ...DEFAULT_SVG_OPTIONS } }
        : { kind: 'raster', encoder },
  };
  edit(result);
  return result;
}

const jxl = (jpegTranscode: boolean) =>
  ({
    type: 'jxl',
    options: { ...getDefaultOptions('jxl'), jpegTranscode },
  }) as EncoderState;
const webP: EncoderState = {
  type: 'webP',
  options: structuredClone(encoderMap.webP.meta.defaultOptions),
};

describe('chooseLane', () => {
  it('sends SVG output to the vector lane, and only for an SVG source', () => {
    expect(chooseLane(SVG, recipe('svg'), SOURCE)).toBe('svg');
    expect(() => chooseLane(PNG, recipe('svg'), SOURCE)).toThrow();
  });

  it('transcodes a JPEG to JXL only with the flag and nothing changing pixels', () => {
    expect(chooseLane(JPEG, recipe(jxl(true)), SOURCE)).toBe('transcode');
    expect(chooseLane(JPEG, recipe(jxl(false)), SOURCE)).toBe('pixels');
    expect(chooseLane(PNG, recipe(jxl(true)), SOURCE)).toBe('pixels');
    expect(chooseLane(JPEG, recipe(webP), SOURCE)).toBe('pixels');
  });

  it('pixel-encodes once a step changes pixels', () => {
    const blocked = [
      recipe(jxl(true), (r) => (r.rotate = 90)),
      recipe(jxl(true), (r) => (r.processors.quantize.enabled = true)),
      recipe(jxl(true), (r) => {
        r.processors.grain.enabled = true;
        r.processors.grain.amount = 10;
      }),
      recipe(jxl(true), (r) =>
        Object.assign(r.processors.resize, {
          enabled: true,
          width: 512,
          height: 342,
        }),
      ),
    ];
    for (const r of blocked) expect(chooseLane(JPEG, r, SOURCE)).toBe('pixels');
  });

  it('still transcodes through no-op steps', () => {
    const inert = [
      recipe(jxl(true), (r) => {
        r.processors.grain.enabled = true;
        r.processors.grain.amount = 0;
      }),
      recipe(jxl(true), (r) =>
        Object.assign(r.processors.resize, { enabled: true, ...SOURCE }),
      ),
    ];
    for (const r of inert)
      expect(chooseLane(JPEG, r, SOURCE)).toBe('transcode');
  });
});

describe('optimizeImage', () => {
  const signal = new AbortController().signal;
  const frame = new ImageData(new Uint8ClampedArray(16), 2, 2);
  const svgRaster = () =>
    Promise.resolve({
      image: {} as HTMLImageElement,
      raster: new ImageData(
        new Uint8ClampedArray(SOURCE.width * SOURCE.height * 4),
        SOURCE.width,
        SOURCE.height,
      ),
    });
  const encoded = (edit: object = {}) => ({
    kind: 'encoded',
    bytes: new ArrayBuffer(10),
    decodedWidth: 4,
    decodedHeight: 2,
    preparedWidth: 2,
    preparedHeight: 4,
    transcodeFellBack: false,
    ...edit,
  });
  let optimize: ReturnType<typeof vi.fn>;
  let bridge: SvelteKitWorkerBridge;

  beforeEach(() => {
    lanes.optimizeSvgSide.mockReset();
    lanes.optimizeSvgSide.mockResolvedValue({ lane: 'svg' });
    optimize = vi.fn(async () => encoded());
    bridge = { optimize } as unknown as SvelteKitWorkerBridge;
  });

  it('sends a raster recipe to the worker in one call, with the file', async () => {
    const r = recipe(webP, (r) => (r.rotate = 90));
    const outcome = await optimizeImage({ file: PNG }, r, {
      signal,
      bridge,
      preview: false,
    });
    expect(optimize).toHaveBeenCalledOnce();
    expect(optimize).toHaveBeenCalledWith(signal, {
      key: expect.stringMatching(/^src-/),
      file: { type: 'image/png', name: 'photo.png' },
      source: { kind: 'file', file: PNG },
      recipe: r,
      preview: false,
    });
    expect(outcome.outputFile.name).toBe('photo.webp');
    expect(outcome.outputFile.type).toBe('image/webp');
    expect(outcome.preprocessedWidth).toBe(2);
    expect(outcome.transcodeFellBack).toBeUndefined();
  });

  it('keys one file the same way every time', async () => {
    await optimizeImage({ file: PNG }, recipe(webP), {
      signal,
      bridge,
      preview: false,
    });
    await optimizeImage({ file: PNG }, recipe(webP), {
      signal,
      bridge,
      preview: false,
    });
    await optimizeImage({ file: JPEG }, recipe(webP), {
      signal,
      bridge,
      preview: false,
    });
    const keys = optimize.mock.calls.map(([, request]) => request.key);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('asks the worker for a score only when told to, and returns it', async () => {
    optimize.mockResolvedValueOnce(encoded({ score: 71.25 }));
    const scored = await optimizeImage({ file: PNG }, recipe(webP), {
      signal,
      bridge,
      preview: true,
      score: true,
    });
    expect(optimize.mock.calls[0][1].score).toBe(true);
    expect(scored.score).toBe(71.25);
    const plain = await optimizeImage({ file: PNG }, recipe(webP), {
      signal,
      bridge,
      preview: true,
    });
    expect(optimize.mock.calls[1][1]).not.toHaveProperty('score');
    expect(plain).not.toHaveProperty('score');
  });

  it('reports a transcode that fell back to pixels', async () => {
    optimize.mockResolvedValueOnce(encoded({ transcodeFellBack: true }));
    const outcome = await optimizeImage({ file: JPEG }, recipe(jxl(true)), {
      signal,
      bridge,
      preview: true,
    });
    expect(outcome.transcodeFellBack).toBe(true);
    expect(outcome.outputFile.name).toBe('photo.jxl');
  });

  it('shows the Original from the prepared frame without the worker', async () => {
    const identity = {
      type: 'identity',
      options: {},
    } as unknown as EncoderState;
    const prepared = vi.fn(async () => frame);
    const outcome = await optimizeImage(
      { file: PNG, prepared },
      recipe(identity, (r) => (r.rotate = 270)),
      { signal, bridge, preview: true },
    );
    expect(prepared).toHaveBeenCalledWith(270);
    expect(optimize).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({
      isOriginal: true,
      outputImageData: frame,
      outputFile: PNG,
    });
  });

  it('sends an SVG raster only when the worker asks for it', async () => {
    optimize.mockResolvedValueOnce({ kind: 'needs-source' });
    await optimizeImage({ file: SVG, svg: svgRaster }, recipe(webP), {
      signal,
      bridge,
      preview: true,
    });
    expect(optimize).toHaveBeenCalledTimes(2);
    expect(optimize.mock.calls[0][1].source).toBeUndefined();
    expect(optimize.mock.calls[1][1].source).toMatchObject({
      kind: 'pixels',
      image: { width: SOURCE.width, height: SOURCE.height },
    });
  });

  it('optimizes SVG text at the rasterized size', async () => {
    await optimizeImage({ file: SVG, svg: svgRaster }, recipe('svg'), {
      signal,
      bridge,
      preview: true,
      svgText: Promise.resolve('<svg/>'),
    });
    expect(lanes.optimizeSvgSide).toHaveBeenCalledWith(
      '<svg/>',
      'logo.svg',
      DEFAULT_SVG_OPTIONS,
      SOURCE.width,
      SOURCE.height,
      signal,
    );
    expect(optimize).not.toHaveBeenCalled();
  });
});
