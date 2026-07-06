import type { ProcessorState } from 'client/lazy-app/feature-meta/shared';
import { defineControl, type BulkControl } from './types';

export type ResizeControlOptions = ProcessorState['resize'] & {
  premultiply: boolean;
  linearRGB: boolean;
};

export const resizeControls: readonly BulkControl<ResizeControlOptions>[] = [
  defineControl({
    id: 'resize.preset',
    label: 'Preset',
    fields: ['width', 'height'],
  }),
  defineControl({
    id: 'resize.width',
    label: 'Width',
    fields: ['width'],
  }),
  defineControl({
    id: 'resize.height',
    label: 'Height',
    fields: ['height'],
  }),
  defineControl({
    id: 'resize.fit-method',
    label: 'Fit method',
    fields: ['fitMethod'],
  }),
  defineControl({
    id: 'resize.method',
    label: 'Method',
    fields: ['method'],
  }),
  defineControl({
    id: 'resize.premultiply-alpha-channel',
    label: 'Premultiply alpha channel',
    fields: ['premultiply'],
  }),
  defineControl({
    id: 'resize.linear-rgb',
    label: 'Linear RGB',
    fields: ['linearRGB'],
  }),
];
