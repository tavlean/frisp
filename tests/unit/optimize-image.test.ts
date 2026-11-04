import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultProcessorState,
  type EncoderState,
} from '../../src/client/lazy-app/feature-meta/shared';
import type { SourceImage } from '../../src/client/lazy-app/image-pipeline';
import type { ImageRecipe } from '../../src/client/lazy-app/recipe';
import { getDefaultOptions } from '../../src/lib/compress';
import type SvelteKitWorkerBridge from '../../src/lib/sveltekit-worker-bridge';
import { DEFAULT_SVG_OPTIONS } from '../../src/lib/svg/optimize-options';
import { fakeFile } from './fixtures';

const lanes = vi.hoisted(() => ({
  compressPreprocessed: vi.fn(),
  transcodeJpegToJxl: vi.fn(),
  optimizeSvgSide: vi.fn(),
}));

vi.mock('../../src/lib/compress', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/compress')>()),
  compressPreprocessed: lanes.compressPreprocessed,
  transcodeJpegToJxl: lanes.transcodeJpegToJxl,
}));
vi.mock('../../src/lib/svg/optimize', () => ({
  optimizeSvgSide: lanes.optimizeSvgSide,
}));

const { TranscodeUnsupportedError } = await import('../../src/lib/compress');
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
const webP = {
  type: 'webP',
  options: getDefaultOptions('webP'),
} as EncoderState;

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
  const bridge = {} as SvelteKitWorkerBridge;
  const pixels = { data: new Uint8ClampedArray(4), ...SOURCE };

  function source(file: File): SourceImage {
    return {
      file,
      decoded: pixels,
      preprocessed: pixels,
    } as unknown as SourceImage;
  }

  beforeEach(() => {
    for (const lane of Object.values(lanes)) lane.mockReset();
    lanes.compressPreprocessed.mockResolvedValue({ lane: 'pixels' });
    lanes.transcodeJpegToJxl.mockResolvedValue({ lane: 'transcode' });
    lanes.optimizeSvgSide.mockResolvedValue({ lane: 'svg' });
  });

  it('passes the recipe and the preview choice to the pixel lane', async () => {
    const r = recipe(webP, (r) => (r.rotate = 180));
    await optimizeImage(source(PNG), r, { signal, bridge, preview: false });
    expect(lanes.compressPreprocessed).toHaveBeenCalledWith(
      expect.anything(),
      {
        format: 'webP',
        options: webP.options,
        processorState: r.processors,
        preprocessorState: { rotate: { rotate: 180 } },
      },
      signal,
      bridge,
      false,
    );
  });

  it('transcodes, and falls back to pixels when libjxl declines', async () => {
    const r = recipe(jxl(true));
    expect(
      await optimizeImage(source(JPEG), r, { signal, bridge, preview: true }),
    ).toEqual({ lane: 'transcode' });

    lanes.transcodeJpegToJxl.mockRejectedValue(new TranscodeUnsupportedError());
    expect(
      await optimizeImage(source(JPEG), r, { signal, bridge, preview: true }),
    ).toEqual({ lane: 'pixels', transcodeFellBack: true });
  });

  it('propagates any other transcode failure', async () => {
    const failure = new Error('worker died');
    lanes.transcodeJpegToJxl.mockRejectedValue(failure);
    await expect(
      optimizeImage(source(JPEG), recipe(jxl(true)), {
        signal,
        bridge,
        preview: true,
      }),
    ).rejects.toBe(failure);
    expect(lanes.compressPreprocessed).not.toHaveBeenCalled();
  });

  it('optimizes SVG text at the prepared size', async () => {
    await optimizeImage(source(SVG), recipe('svg'), {
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
  });
});
