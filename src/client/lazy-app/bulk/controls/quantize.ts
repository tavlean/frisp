import type { ProcessorState } from 'client/lazy-app/feature-meta/shared';
import { defineControl, type BulkControl } from './types';

type QuantizeOptions = ProcessorState['quantize'];

export const quantizeControls: readonly BulkControl<QuantizeOptions>[] = [
  defineControl({
    id: 'quantize.colors',
    label: 'Colors',
    fields: ['maxNumColors'],
  }),
  defineControl({
    id: 'quantize.dithering',
    label: 'Dithering',
    fields: ['dither'],
  }),
];
