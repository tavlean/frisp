import type { EncodeOptions } from 'features/encoders/jxl/shared/meta';
import { defineControl, type BulkControl } from './types';

type JxlControl = BulkControl<EncodeOptions>;

function isLossless(options: EncodeOptions): boolean {
  return options.quality === 100;
}

function sameLosslessMode(a: EncodeOptions, b: EncodeOptions): boolean {
  return isLossless(a) === isLossless(b);
}

function losslessGuardedEqual(
  fields: JxlControl['fields'],
): JxlControl['equal'] {
  return (a, b) =>
    !sameLosslessMode(a, b) ||
    (isLossless(a) ? true : fields.every((field) => a[field] === b[field]));
}

function losslessOnlyEqual(fields: JxlControl['fields']): JxlControl['equal'] {
  return (a, b) =>
    !sameLosslessMode(a, b) ||
    (!isLossless(a) ? true : fields.every((field) => a[field] === b[field]));
}

function modeSharedEqual(fields: JxlControl['fields']): JxlControl['equal'] {
  return (a, b) =>
    !sameLosslessMode(a, b) || fields.every((field) => a[field] === b[field]);
}

export const jxlControls: readonly JxlControl[] = [
  defineControl({
    id: 'jxl.lossless',
    label: 'Lossless',
    fields: ['quality', 'lossyPalette', 'lossyModular'],
    equal: (a, b) => isLossless(a) === isLossless(b),
    apply: (source, target) => {
      target.quality = source.quality;
      target.lossyPalette = isLossless(source) ? source.lossyPalette : false;
      target.lossyModular =
        !isLossless(source) && source.quality < 7 ? true : source.lossyModular;
    },
  }),
  defineControl({
    id: 'jxl.slight-loss',
    label: 'Slight loss',
    fields: ['lossyPalette'],
    equal: losslessOnlyEqual(['lossyPalette']),
  }),
  defineControl({
    id: 'jxl.quality',
    label: 'Quality',
    fields: ['quality', 'lossyModular'],
    equal: losslessGuardedEqual(['quality', 'lossyModular']),
    apply: (source, target) => {
      target.quality = source.quality;
      target.lossyModular = source.quality < 7 ? true : source.lossyModular;
    },
  }),
  defineControl({
    id: 'jxl.effort',
    label: 'Effort',
    fields: ['effort'],
    equal: modeSharedEqual(['effort']),
  }),
  defineControl({
    id: 'jxl.alternative-lossy-mode',
    label: 'Alternative lossy mode',
    fields: ['lossyModular'],
    equal: losslessGuardedEqual(['lossyModular']),
    apply: (source, target) => {
      target.lossyModular = target.quality < 7 ? true : source.lossyModular;
    },
  }),
  defineControl({
    id: 'jxl.auto-edge-filter',
    label: 'Auto edge filter',
    fields: ['epf'],
    equal: losslessGuardedEqual(['epf']),
  }),
  defineControl({
    id: 'jxl.optimize-for-decoding-speed-worse-compression',
    label: 'Optimize for decoding speed (worse compression)',
    fields: ['decodingSpeedTier'],
    equal: losslessGuardedEqual(['decodingSpeedTier']),
  }),
  defineControl({
    id: 'jxl.noise-equivalent-to-iso',
    label: 'Noise equivalent to ISO',
    fields: ['photonNoiseIso'],
    equal: losslessGuardedEqual(['photonNoiseIso']),
  }),
  defineControl({
    id: 'jxl.progressive-rendering',
    label: 'Progressive rendering',
    fields: ['progressive'],
    equal: modeSharedEqual(['progressive']),
  }),
];
