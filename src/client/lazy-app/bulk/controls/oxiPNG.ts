import type { EncodeOptions } from 'features/encoders/oxiPNG/shared/meta';
import { defineControl, type BulkControl } from './types';

export const oxiPNGControls: readonly BulkControl<EncodeOptions>[] = [
  defineControl({
    id: 'oxipng.effort',
    label: 'Effort',
    fields: ['level'],
  }),
  defineControl({
    id: 'oxipng.interlace',
    label: 'Interlace',
    fields: ['interlace'],
  }),
];
