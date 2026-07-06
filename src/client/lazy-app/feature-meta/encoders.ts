import { encoderMap as sharedEncoderMap } from './shared';
import * as avifEncoderRuntime from 'features/encoders/avif/client/runtime';
import * as jxlEncoderRuntime from 'features/encoders/jxl/client/runtime';
import * as mozJPEGEncoderRuntime from 'features/encoders/mozJPEG/client/runtime';
import * as oxiPNGEncoderRuntime from 'features/encoders/oxiPNG/client/runtime';
import * as qoiEncoderRuntime from 'features/encoders/qoi/client/runtime';
import * as webPEncoderRuntime from 'features/encoders/webP/client/runtime';

export type { EncoderOptions, EncoderState, EncoderType } from './shared';
export { encoderMap as encoderMetaMap } from './shared';

export const encoderMap = {
  avif: { ...sharedEncoderMap.avif, ...avifEncoderRuntime },
  jxl: { ...sharedEncoderMap.jxl, ...jxlEncoderRuntime },
  mozJPEG: { ...sharedEncoderMap.mozJPEG, ...mozJPEGEncoderRuntime },
  oxiPNG: { ...sharedEncoderMap.oxiPNG, ...oxiPNGEncoderRuntime },
  qoi: { ...sharedEncoderMap.qoi, ...qoiEncoderRuntime },
  webP: { ...sharedEncoderMap.webP, ...webPEncoderRuntime },
} as const;
