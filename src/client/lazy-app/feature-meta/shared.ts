import * as avifEncoderMeta from '#features/encoders/avif/shared/meta.ts';
import * as jpegliEncoderMeta from '#features/encoders/jpegli/shared/meta.ts';
import * as jxlEncoderMeta from '#features/encoders/jxl/shared/meta.ts';
import * as mozJPEGEncoderMeta from '#features/encoders/mozJPEG/shared/meta.ts';
import * as oxiPNGEncoderMeta from '#features/encoders/oxiPNG/shared/meta.ts';
import * as qoiEncoderMeta from '#features/encoders/qoi/shared/meta.ts';
import * as webPEncoderMeta from '#features/encoders/webP/shared/meta.ts';
import * as grainProcessorMeta from '#features/processors/grain/shared/meta.ts';
import * as quantizeProcessorMeta from '#features/processors/quantize/shared/meta.ts';
import * as resizeProcessorMeta from '#features/processors/resize/shared/meta.ts';
import * as rotatePreprocessorMeta from '#features/preprocessors/rotate/shared/meta.ts';

export type EncoderState =
  | { type: 'avif'; options: avifEncoderMeta.EncodeOptions }
  | { type: 'jpegli'; options: jpegliEncoderMeta.EncodeOptions }
  | { type: 'jxl'; options: jxlEncoderMeta.EncodeOptions }
  | { type: 'mozJPEG'; options: mozJPEGEncoderMeta.EncodeOptions }
  | { type: 'oxiPNG'; options: oxiPNGEncoderMeta.EncodeOptions }
  | { type: 'qoi'; options: qoiEncoderMeta.EncodeOptions }
  | { type: 'webP'; options: webPEncoderMeta.EncodeOptions };

export type EncoderOptions =
  | avifEncoderMeta.EncodeOptions
  | jpegliEncoderMeta.EncodeOptions
  | jxlEncoderMeta.EncodeOptions
  | mozJPEGEncoderMeta.EncodeOptions
  | oxiPNGEncoderMeta.EncodeOptions
  | qoiEncoderMeta.EncodeOptions
  | webPEncoderMeta.EncodeOptions;

export const encoderMap = {
  avif: { meta: avifEncoderMeta },
  jpegli: { meta: jpegliEncoderMeta },
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
  grain: grainProcessorMeta.Options;
  quantize: quantizeProcessorMeta.Options;
  resize: resizeProcessorMeta.Options;
}

export interface ProcessorState {
  grain: Enableable & grainProcessorMeta.Options;
  quantize: Enableable & quantizeProcessorMeta.Options;
  resize: Enableable & resizeProcessorMeta.Options;
}

export const defaultProcessorState: ProcessorState = {
  grain: { enabled: false, ...grainProcessorMeta.defaultOptions },
  quantize: { enabled: false, ...quantizeProcessorMeta.defaultOptions },
  resize: { enabled: false, ...resizeProcessorMeta.defaultOptions },
};

/**
 * Grain only affects the output when it's enabled at a non-zero amount, so
 * every consumer that fingerprints or runs the pipeline (encode signature,
 * bulk recipe normalization, encodeFrame) folds "enabled at 0" to a true
 * no-op through this one predicate.
 */
export function grainIsReal(grain: ProcessorState['grain']): boolean {
  return grain.enabled && grain.amount > 0;
}

export interface PreprocessorState {
  rotate: rotatePreprocessorMeta.Options;
}

export const defaultPreprocessorState: PreprocessorState = {
  rotate: rotatePreprocessorMeta.defaultOptions,
};
