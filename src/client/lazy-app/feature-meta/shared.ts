import * as avifEncoderMeta from 'features/encoders/avif/shared/meta';
import * as jxlEncoderMeta from 'features/encoders/jxl/shared/meta';
import * as mozJPEGEncoderMeta from 'features/encoders/mozJPEG/shared/meta';
import * as oxiPNGEncoderMeta from 'features/encoders/oxiPNG/shared/meta';
import * as qoiEncoderMeta from 'features/encoders/qoi/shared/meta';
import * as webPEncoderMeta from 'features/encoders/webP/shared/meta';
import * as quantizeProcessorMeta from 'features/processors/quantize/shared/meta';
import * as resizeProcessorMeta from 'features/processors/resize/shared/meta';
import * as rotatePreprocessorMeta from 'features/preprocessors/rotate/shared/meta';

export type EncoderState =
  | { type: 'avif'; options: avifEncoderMeta.EncodeOptions }
  | { type: 'jxl'; options: jxlEncoderMeta.EncodeOptions }
  | { type: 'mozJPEG'; options: mozJPEGEncoderMeta.EncodeOptions }
  | { type: 'oxiPNG'; options: oxiPNGEncoderMeta.EncodeOptions }
  | { type: 'qoi'; options: qoiEncoderMeta.EncodeOptions }
  | { type: 'webP'; options: webPEncoderMeta.EncodeOptions };

export type EncoderOptions =
  | avifEncoderMeta.EncodeOptions
  | jxlEncoderMeta.EncodeOptions
  | mozJPEGEncoderMeta.EncodeOptions
  | oxiPNGEncoderMeta.EncodeOptions
  | qoiEncoderMeta.EncodeOptions
  | webPEncoderMeta.EncodeOptions;

export const encoderMap = {
  avif: { meta: avifEncoderMeta },
  jxl: { meta: jxlEncoderMeta },
  mozJPEG: { meta: mozJPEGEncoderMeta },
  oxiPNG: { meta: oxiPNGEncoderMeta },
  qoi: { meta: qoiEncoderMeta },
  webP: { meta: webPEncoderMeta },
} as const;

export type EncoderType = keyof typeof encoderMap;

interface Enableable {
  enabled: boolean;
}

export interface ProcessorOptions {
  quantize: quantizeProcessorMeta.Options;
  resize: resizeProcessorMeta.Options;
}

export interface ProcessorState {
  quantize: Enableable & quantizeProcessorMeta.Options;
  resize: Enableable & resizeProcessorMeta.Options;
}

export const defaultProcessorState: ProcessorState = {
  quantize: { enabled: false, ...quantizeProcessorMeta.defaultOptions },
  resize: { enabled: false, ...resizeProcessorMeta.defaultOptions },
};

export interface PreprocessorState {
  rotate: rotatePreprocessorMeta.Options;
}

export const defaultPreprocessorState: PreprocessorState = {
  rotate: rotatePreprocessorMeta.defaultOptions,
};
