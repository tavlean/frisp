import type { EncodeOptions } from 'features/encoders/webP/shared/meta';
import { defineControl, type BulkControl } from './types';

type WebpControl = BulkControl<EncodeOptions>;

const losslessPresets: [number, number][] = [
  [0, 0],
  [1, 20],
  [2, 25],
  [3, 30],
  [3, 50],
  [4, 50],
  [4, 75],
  [4, 90],
  [5, 90],
  [6, 100],
];
const losslessPresetDefault = 6;

function isLossless(options: EncodeOptions): boolean {
  return !!options.lossless;
}

function sameLosslessMode(a: EncodeOptions, b: EncodeOptions): boolean {
  return isLossless(a) === isLossless(b);
}

function lossyEqual(fields: WebpControl['fields']): WebpControl['equal'] {
  return (a, b) =>
    !sameLosslessMode(a, b) ||
    (isLossless(a) ? true : fields.every((field) => a[field] === b[field]));
}

function losslessEqual(fields: WebpControl['fields']): WebpControl['equal'] {
  return (a, b) =>
    !sameLosslessMode(a, b) ||
    (!isLossless(a) ? true : fields.every((field) => a[field] === b[field]));
}

function modeSharedEqual(fields: WebpControl['fields']): WebpControl['equal'] {
  return (a, b) =>
    !sameLosslessMode(a, b) || fields.every((field) => a[field] === b[field]);
}

function losslessPreset(options: EncodeOptions): number {
  const index = losslessPresets.findIndex(
    ([method, quality]) =>
      method === options.method && quality === options.quality,
  );
  return index === -1 ? losslessPresetDefault : index;
}

export const webPControls: readonly WebpControl[] = [
  defineControl({
    id: 'webp.lossless',
    label: 'Lossless',
    fields: ['lossless', 'method', 'quality'],
    equal: (a, b) => isLossless(a) === isLossless(b),
  }),
  defineControl({
    id: 'webp.lossless-effort',
    label: 'Effort',
    fields: ['method', 'quality'],
    equal: (a, b) =>
      !sameLosslessMode(a, b) ||
      (!isLossless(a) ? true : losslessPreset(a) === losslessPreset(b)),
  }),
  defineControl({
    id: 'webp.slight-loss',
    label: 'Slight loss',
    fields: ['near_lossless'],
    equal: losslessEqual(['near_lossless']),
  }),
  defineControl({
    id: 'webp.discrete-tone-image',
    label: 'Discrete tone image',
    fields: ['image_hint'],
    equal: losslessEqual(['image_hint']),
  }),
  defineControl({
    id: 'webp.quality',
    label: 'Quality',
    fields: ['quality'],
    equal: lossyEqual(['quality']),
  }),
  defineControl({
    id: 'webp.effort',
    label: 'Effort',
    fields: ['method'],
    equal: lossyEqual(['method']),
  }),
  defineControl({
    id: 'webp.preserve-transparent-data',
    label: 'Preserve transparent data',
    fields: ['exact'],
    equal: modeSharedEqual(['exact']),
  }),
  defineControl({
    id: 'webp.compress-alpha',
    label: 'Compress alpha',
    fields: ['alpha_compression'],
    equal: lossyEqual(['alpha_compression']),
  }),
  defineControl({
    id: 'webp.alpha-quality',
    label: 'Alpha quality',
    fields: ['alpha_quality'],
    equal: lossyEqual(['alpha_quality']),
  }),
  defineControl({
    id: 'webp.alpha-filter-quality',
    label: 'Alpha filter quality',
    fields: ['alpha_filtering'],
    equal: lossyEqual(['alpha_filtering']),
  }),
  defineControl({
    id: 'webp.auto-adjust-filter-strength',
    label: 'Auto adjust filter strength',
    fields: ['autofilter'],
    equal: lossyEqual(['autofilter']),
  }),
  defineControl({
    id: 'webp.filter-strength',
    label: 'Filter strength',
    fields: ['filter_strength'],
    equal: lossyEqual(['filter_strength']),
  }),
  defineControl({
    id: 'webp.strong-filter',
    label: 'Strong filter',
    fields: ['filter_type'],
    equal: lossyEqual(['filter_type']),
  }),
  defineControl({
    id: 'webp.filter-sharpness',
    label: 'Filter sharpness',
    fields: ['filter_sharpness'],
    equal: lossyEqual(['filter_sharpness']),
  }),
  defineControl({
    id: 'webp.sharp-rgb-yuv-conversion',
    label: 'Sharp RGB->YUV conversion',
    fields: ['use_sharp_yuv'],
    equal: lossyEqual(['use_sharp_yuv']),
  }),
  defineControl({
    id: 'webp.passes',
    label: 'Passes',
    fields: ['pass'],
    equal: lossyEqual(['pass']),
  }),
  defineControl({
    id: 'webp.spatial-noise-shaping',
    label: 'Spatial noise shaping',
    fields: ['sns_strength'],
    equal: lossyEqual(['sns_strength']),
  }),
  defineControl({
    id: 'webp.preprocess',
    label: 'Preprocess',
    fields: ['preprocessing'],
    equal: lossyEqual(['preprocessing']),
  }),
  defineControl({
    id: 'webp.segments',
    label: 'Segments',
    fields: ['segments'],
    equal: lossyEqual(['segments']),
  }),
  defineControl({
    id: 'webp.partitions',
    label: 'Partitions',
    fields: ['partitions'],
    equal: lossyEqual(['partitions']),
  }),
];
