import { describe, expect, it } from 'vitest';
import {
  defaultProcessorState,
  type ProcessorState,
} from '../../src/client/lazy-app/feature-meta/shared';
import {
  encoderControls,
  processorControls,
} from '../../src/client/lazy-app/bulk/controls';
import type { BulkControl } from '../../src/client/lazy-app/bulk/controls';
import { defaultOptions as avifDefaults } from '../../src/features/encoders/avif/shared/meta';
import { defaultOptions as jxlDefaults } from '../../src/features/encoders/jxl/shared/meta';
import {
  defaultOptions as mozJPEGDefaults,
  MozJpegColorSpace,
} from '../../src/features/encoders/mozJPEG/shared/meta';
import { defaultOptions as oxiPNGDefaults } from '../../src/features/encoders/oxiPNG/shared/meta';
import { defaultOptions as webPDefaults } from '../../src/features/encoders/webP/shared/meta';

interface ControlCase<T extends object> {
  id: string;
  base: T;
  mutate: (source: T) => void;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isControlEqual<T extends object>(
  control: BulkControl<T>,
  a: T,
  b: T,
): boolean {
  return control.equal
    ? control.equal(a, b)
    : control.fields.every((field) => a[field] === b[field]);
}

function expectControlRoundTrip<T extends object>(
  controls: readonly BulkControl<T>[],
  controlCase: ControlCase<T>,
): void {
  const control = controls.find((item) => item.id === controlCase.id);
  expect(control, controlCase.id).toBeTruthy();
  if (!control) return;

  const source = clone(controlCase.base);
  const target = clone(controlCase.base);
  controlCase.mutate(source);

  expect(isControlEqual(control, source, target), control.id).toBe(false);
  control.apply(source, target);
  expect(isControlEqual(control, source, target), control.id).toBe(true);
  for (const field of control.fields) {
    expect(target[field], `${control.id}:${field}`).toEqual(source[field]);
  }
}

const webPLossless = {
  ...webPDefaults,
  lossless: 1,
  method: 4,
  quality: 75,
};

const jxlLossless = {
  ...jxlDefaults,
  quality: 100,
  lossyPalette: false,
};

const registryCases = [
  {
    name: 'webP',
    controls: encoderControls.webP,
    cases: [
      {
        id: 'webp.lossless',
        base: webPDefaults,
        mutate: (source) => {
          source.lossless = 1;
          source.method = 4;
          source.quality = 75;
        },
      },
      {
        id: 'webp.lossless-effort',
        base: webPLossless,
        mutate: (source) => {
          source.method = 5;
          source.quality = 90;
        },
      },
      {
        id: 'webp.slight-loss',
        base: webPLossless,
        mutate: (source) => {
          source.near_lossless = 80;
        },
      },
      {
        id: 'webp.discrete-tone-image',
        base: webPLossless,
        mutate: (source) => {
          source.image_hint = 3;
        },
      },
      {
        id: 'webp.quality',
        base: webPDefaults,
        mutate: (source) => {
          source.quality = 61;
        },
      },
      {
        id: 'webp.effort',
        base: webPDefaults,
        mutate: (source) => {
          source.method = 3;
        },
      },
      {
        id: 'webp.preserve-transparent-data',
        base: webPDefaults,
        mutate: (source) => {
          source.exact = 1;
        },
      },
      {
        id: 'webp.compress-alpha',
        base: webPDefaults,
        mutate: (source) => {
          source.alpha_compression = 0;
        },
      },
      {
        id: 'webp.alpha-quality',
        base: webPDefaults,
        mutate: (source) => {
          source.alpha_quality = 72;
        },
      },
      {
        id: 'webp.alpha-filter-quality',
        base: webPDefaults,
        mutate: (source) => {
          source.alpha_filtering = 2;
        },
      },
      {
        id: 'webp.auto-adjust-filter-strength',
        base: webPDefaults,
        mutate: (source) => {
          source.autofilter = 1;
        },
      },
      {
        id: 'webp.filter-strength',
        base: webPDefaults,
        mutate: (source) => {
          source.filter_strength = 42;
        },
      },
      {
        id: 'webp.strong-filter',
        base: { ...webPDefaults, filter_type: 0 },
        mutate: (source) => {
          source.filter_type = 1;
        },
      },
      {
        id: 'webp.filter-sharpness',
        base: webPDefaults,
        mutate: (source) => {
          source.filter_sharpness = 3;
        },
      },
      {
        id: 'webp.sharp-rgb-yuv-conversion',
        base: webPDefaults,
        mutate: (source) => {
          source.use_sharp_yuv = 1;
        },
      },
      {
        id: 'webp.passes',
        base: webPDefaults,
        mutate: (source) => {
          source.pass = 2;
        },
      },
      {
        id: 'webp.spatial-noise-shaping',
        base: webPDefaults,
        mutate: (source) => {
          source.sns_strength = 30;
        },
      },
      {
        id: 'webp.preprocess',
        base: webPDefaults,
        mutate: (source) => {
          source.preprocessing = 1;
        },
      },
      {
        id: 'webp.segments',
        base: webPDefaults,
        mutate: (source) => {
          source.segments = 2;
        },
      },
      {
        id: 'webp.partitions',
        base: webPDefaults,
        mutate: (source) => {
          source.partitions = 2;
        },
      },
    ],
  },
  {
    name: 'avif',
    controls: encoderControls.avif,
    cases: [
      {
        id: 'avif.lossless',
        base: avifDefaults,
        mutate: (source) => {
          source.quality = 100;
          source.qualityAlpha = -1;
          source.subsample = 3;
        },
      },
      {
        id: 'avif.quality',
        base: avifDefaults,
        mutate: (source) => {
          source.quality = 64;
        },
      },
      {
        id: 'avif.effort',
        base: avifDefaults,
        mutate: (source) => {
          source.speed = 2;
        },
      },
      {
        id: 'avif.subsample-chroma',
        base: avifDefaults,
        mutate: (source) => {
          source.subsample = 2;
        },
      },
      {
        id: 'avif.sharp-yuv-downsampling',
        base: avifDefaults,
        mutate: (source) => {
          source.enableSharpYUV = true;
        },
      },
      {
        id: 'avif.separate-alpha-quality',
        base: avifDefaults,
        mutate: (source) => {
          source.qualityAlpha = 72;
        },
      },
      {
        id: 'avif.extra-chroma-compression',
        base: avifDefaults,
        mutate: (source) => {
          source.chromaDeltaQ = true;
        },
      },
      {
        id: 'avif.sharpness',
        base: avifDefaults,
        mutate: (source) => {
          source.sharpness = 3;
        },
      },
      {
        id: 'avif.noise-synthesis',
        base: avifDefaults,
        mutate: (source) => {
          source.denoiseLevel = 8;
        },
      },
      {
        id: 'avif.tuning',
        base: avifDefaults,
        mutate: (source) => {
          source.tune = 2;
        },
      },
      {
        id: 'avif.log2-of-tile-rows',
        base: avifDefaults,
        mutate: (source) => {
          source.tileRowsLog2 = 2;
        },
      },
      {
        id: 'avif.log2-of-tile-cols',
        base: avifDefaults,
        mutate: (source) => {
          source.tileColsLog2 = 2;
        },
      },
    ],
  },
  {
    name: 'jxl',
    controls: encoderControls.jxl,
    cases: [
      {
        id: 'jxl.lossless',
        base: jxlDefaults,
        mutate: (source) => {
          source.quality = 100;
          source.lossyPalette = true;
          source.lossyModular = false;
        },
      },
      {
        id: 'jxl.slight-loss',
        base: jxlLossless,
        mutate: (source) => {
          source.lossyPalette = true;
        },
      },
      {
        id: 'jxl.quality',
        base: jxlDefaults,
        mutate: (source) => {
          source.quality = 5;
          source.lossyModular = true;
        },
      },
      {
        id: 'jxl.effort',
        base: jxlDefaults,
        mutate: (source) => {
          source.effort = 5;
        },
      },
      {
        id: 'jxl.alternative-lossy-mode',
        base: jxlDefaults,
        mutate: (source) => {
          source.lossyModular = true;
        },
      },
      {
        id: 'jxl.auto-edge-filter',
        base: jxlDefaults,
        mutate: (source) => {
          source.epf = 2;
        },
      },
      {
        id: 'jxl.optimize-for-decoding-speed-worse-compression',
        base: jxlDefaults,
        mutate: (source) => {
          source.decodingSpeedTier = 2;
        },
      },
      {
        id: 'jxl.noise-equivalent-to-iso',
        base: jxlDefaults,
        mutate: (source) => {
          source.photonNoiseIso = 800;
        },
      },
      {
        id: 'jxl.progressive-rendering',
        base: jxlDefaults,
        mutate: (source) => {
          source.progressive = true;
        },
      },
    ],
  },
  {
    name: 'mozJPEG',
    controls: encoderControls.mozJPEG,
    cases: [
      {
        id: 'mozjpeg.quality',
        base: mozJPEGDefaults,
        mutate: (source) => {
          source.quality = 60;
        },
      },
      {
        id: 'mozjpeg.channels',
        base: mozJPEGDefaults,
        mutate: (source) => {
          source.color_space = MozJpegColorSpace.RGB;
        },
      },
      {
        id: 'mozjpeg.auto-subsample-chroma',
        base: mozJPEGDefaults,
        mutate: (source) => {
          source.auto_subsample = false;
        },
      },
      {
        id: 'mozjpeg.subsample-chroma-by',
        base: mozJPEGDefaults,
        mutate: (source) => {
          source.chroma_subsample = 4;
        },
      },
      {
        id: 'mozjpeg.separate-chroma-quality',
        base: mozJPEGDefaults,
        mutate: (source) => {
          source.separate_chroma_quality = true;
        },
      },
      {
        id: 'mozjpeg.chroma-quality',
        base: mozJPEGDefaults,
        mutate: (source) => {
          source.chroma_quality = 55;
        },
      },
      {
        id: 'mozjpeg.pointless-spec-compliance',
        base: mozJPEGDefaults,
        mutate: (source) => {
          source.baseline = true;
        },
      },
      {
        id: 'mozjpeg.progressive-rendering',
        base: mozJPEGDefaults,
        mutate: (source) => {
          source.progressive = false;
        },
      },
      {
        id: 'mozjpeg.optimize-huffman-table',
        base: { ...mozJPEGDefaults, optimize_coding: false },
        mutate: (source) => {
          source.optimize_coding = true;
        },
      },
      {
        id: 'mozjpeg.smoothing',
        base: mozJPEGDefaults,
        mutate: (source) => {
          source.smoothing = 25;
        },
      },
      {
        id: 'mozjpeg.quantization',
        base: mozJPEGDefaults,
        mutate: (source) => {
          source.quant_table = 4;
        },
      },
      {
        id: 'mozjpeg.trellis-multipass',
        base: mozJPEGDefaults,
        mutate: (source) => {
          source.trellis_multipass = true;
        },
      },
      {
        id: 'mozjpeg.optimize-zero-block-runs',
        base: mozJPEGDefaults,
        mutate: (source) => {
          source.trellis_opt_zero = true;
        },
      },
      {
        id: 'mozjpeg.optimize-after-trellis-quantization',
        base: mozJPEGDefaults,
        mutate: (source) => {
          source.trellis_opt_table = true;
        },
      },
      {
        id: 'mozjpeg.trellis-quantization-passes',
        base: mozJPEGDefaults,
        mutate: (source) => {
          source.trellis_loops = 3;
        },
      },
    ],
  },
  {
    name: 'oxiPNG',
    controls: encoderControls.oxiPNG,
    cases: [
      {
        id: 'oxipng.effort',
        base: oxiPNGDefaults,
        mutate: (source) => {
          source.level = 4;
        },
      },
      {
        id: 'oxipng.interlace',
        base: oxiPNGDefaults,
        mutate: (source) => {
          source.interlace = true;
        },
      },
    ],
  },
] as const;

describe('bulk control registries', () => {
  for (const registryCase of registryCases) {
    it(`round-trips every ${registryCase.name} encoder control`, () => {
      expect(registryCase.controls.map((control) => control.id)).toEqual(
        registryCase.cases.map((controlCase) => controlCase.id),
      );
      for (const controlCase of registryCase.cases) {
        expectControlRoundTrip(registryCase.controls, controlCase);
      }
    });
  }

  it('round-trips every resize control', () => {
    const base = defaultProcessorState.resize as ProcessorState['resize'];
    const cases: ControlCase<ProcessorState['resize']>[] = [
      {
        id: 'resize.preset',
        base,
        mutate: (source) => {
          source.width = 640;
          source.height = 480;
        },
      },
      {
        id: 'resize.width',
        base,
        mutate: (source) => {
          source.width = 640;
        },
      },
      {
        id: 'resize.height',
        base,
        mutate: (source) => {
          source.height = 480;
        },
      },
      {
        id: 'resize.fit-method',
        base,
        mutate: (source) => {
          source.fitMethod = 'contain';
        },
      },
      {
        id: 'resize.method',
        base,
        mutate: (source) => {
          source.method = 'mitchell';
        },
      },
      {
        id: 'resize.premultiply-alpha-channel',
        base,
        mutate: (source) => {
          source.premultiply = false;
        },
      },
      {
        id: 'resize.linear-rgb',
        base,
        mutate: (source) => {
          source.linearRGB = false;
        },
      },
    ];

    expect(processorControls.resize.map((control) => control.id)).toEqual(
      cases.map((controlCase) => controlCase.id),
    );
    for (const controlCase of cases) {
      expectControlRoundTrip(processorControls.resize, controlCase);
    }
  });

  it('round-trips every quantize control', () => {
    const base = defaultProcessorState.quantize;
    const cases: ControlCase<ProcessorState['quantize']>[] = [
      {
        id: 'quantize.colors',
        base,
        mutate: (source) => {
          source.maxNumColors = 128;
        },
      },
      {
        id: 'quantize.dithering',
        base,
        mutate: (source) => {
          source.dither = 0.5;
        },
      },
    ];

    expect(processorControls.quantize.map((control) => control.id)).toEqual(
      cases.map((controlCase) => controlCase.id),
    );
    for (const controlCase of cases) {
      expectControlRoundTrip(processorControls.quantize, controlCase);
    }
  });

  it('reports only the mode control while lossless mode differs', () => {
    const source = { ...webPLossless, exact: 1 };
    const target = webPDefaults;
    const changed = encoderControls.webP
      .filter((control) => !isControlEqual(control, source, target))
      .map((control) => control.id);

    expect(changed).toEqual(['webp.lossless']);
  });
});
