import type { EncodeOptions } from 'features/encoders/avif/shared/meta';
import { defineControl, type BulkControl } from './types';

type AvifControl = BulkControl<EncodeOptions>;

const MAX_QUALITY = 100;

function isLossless(options: EncodeOptions): boolean {
  return (
    options.quality === MAX_QUALITY &&
    (options.qualityAlpha === -1 || options.qualityAlpha === MAX_QUALITY) &&
    options.subsample === 3
  );
}

function sameLosslessMode(a: EncodeOptions, b: EncodeOptions): boolean {
  return isLossless(a) === isLossless(b);
}

function losslessGuardedEqual(
  fields: AvifControl['fields'],
): AvifControl['equal'] {
  return (a, b) =>
    !sameLosslessMode(a, b) ||
    (isLossless(a) ? true : fields.every((field) => a[field] === b[field]));
}

function modeSharedEqual(fields: AvifControl['fields']): AvifControl['equal'] {
  return (a, b) =>
    !sameLosslessMode(a, b) || fields.every((field) => a[field] === b[field]);
}

export const avifControls: readonly AvifControl[] = [
  defineControl({
    id: 'avif.lossless',
    label: 'Lossless',
    fields: ['quality', 'qualityAlpha', 'subsample'],
    equal: (a, b) => isLossless(a) === isLossless(b),
  }),
  defineControl({
    id: 'avif.quality',
    label: 'Quality',
    fields: ['quality'],
    equal: losslessGuardedEqual(['quality']),
  }),
  defineControl({
    id: 'avif.effort',
    label: 'Effort',
    fields: ['speed'],
    equal: modeSharedEqual(['speed']),
  }),
  defineControl({
    id: 'avif.subsample-chroma',
    label: 'Subsample chroma',
    fields: ['subsample'],
    equal: losslessGuardedEqual(['subsample']),
  }),
  defineControl({
    id: 'avif.sharp-yuv-downsampling',
    label: 'Sharp YUV Downsampling',
    fields: ['enableSharpYUV'],
    equal: losslessGuardedEqual(['enableSharpYUV']),
  }),
  defineControl({
    id: 'avif.separate-alpha-quality',
    label: 'Separate alpha quality',
    fields: ['qualityAlpha'],
    equal: losslessGuardedEqual(['qualityAlpha']),
  }),
  defineControl({
    id: 'avif.extra-chroma-compression',
    label: 'Extra chroma compression',
    fields: ['chromaDeltaQ'],
    equal: losslessGuardedEqual(['chromaDeltaQ']),
  }),
  defineControl({
    id: 'avif.sharpness',
    label: 'Sharpness',
    fields: ['sharpness'],
    equal: losslessGuardedEqual(['sharpness']),
  }),
  defineControl({
    id: 'avif.noise-synthesis',
    label: 'Noise synthesis',
    fields: ['denoiseLevel'],
    equal: losslessGuardedEqual(['denoiseLevel']),
  }),
  defineControl({
    id: 'avif.tuning',
    label: 'Tuning',
    fields: ['tune'],
    equal: losslessGuardedEqual(['tune']),
  }),
  defineControl({
    id: 'avif.log2-of-tile-rows',
    label: 'Log2 of tile rows',
    fields: ['tileRowsLog2'],
    equal: modeSharedEqual(['tileRowsLog2']),
  }),
  defineControl({
    id: 'avif.log2-of-tile-cols',
    label: 'Log2 of tile cols',
    fields: ['tileColsLog2'],
    equal: modeSharedEqual(['tileColsLog2']),
  }),
];
