import type {
  EncoderOptions,
  EncoderType,
} from 'client/lazy-app/feature-meta/shared';
import { avifControls } from './avif';
import { jxlControls } from './jxl';
import { mozJPEGControls } from './mozJPEG';
import { oxiPNGControls } from './oxiPNG';
import { quantizeControls } from './quantize';
import { resizeControls } from './resize';
import { webPControls } from './webP';
import type { BulkControl } from './types';

export type { BulkControl } from './types';

export const encoderControls = {
  avif: avifControls,
  jxl: jxlControls,
  mozJPEG: mozJPEGControls,
  oxiPNG: oxiPNGControls,
  webP: webPControls,
} as const;

export const processorControls = {
  quantize: quantizeControls,
  resize: resizeControls,
};

export function controlsForEncoderType(
  type: EncoderType,
): readonly BulkControl<EncoderOptions>[] {
  if (type === 'qoi') return [];
  return encoderControls[
    type
  ] as unknown as readonly BulkControl<EncoderOptions>[];
}
