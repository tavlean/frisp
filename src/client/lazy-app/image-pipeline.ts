import type { EncoderState } from './feature-meta/shared';
import { encoderMap } from './feature-meta/encoders';
import {
  compressImageWithEncoder,
  decodeImage,
  decodeSourceImage,
  preprocessImage,
  processImage,
  type DecodeWorkerBridge,
  type PreprocessWorkerBridge,
  type ProcessWorkerBridge,
  type WorkerBridgeReturn,
} from './image-pipeline-shared';

export {
  compressImageWithEncoder,
  decodeImage,
  decodeSourceImage,
  preprocessImage,
  processImage,
  processSvg,
} from './image-pipeline-shared';
export type {
  DecodedSourceImage,
  DecodeWorkerBridge,
  ImagePipelineEncoder,
  PreprocessWorkerBridge,
  ProcessWorkerBridge,
  SourceImage,
  WorkerBridgeReturn,
} from './image-pipeline-shared';

export interface ImagePipelineWorkerBridge
  extends DecodeWorkerBridge,
    PreprocessWorkerBridge,
    ProcessWorkerBridge {
  avifEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: Extract<EncoderState, { type: 'avif' }>['options'],
  ): WorkerBridgeReturn<ArrayBuffer>;
  jxlEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: Extract<EncoderState, { type: 'jxl' }>['options'],
  ): WorkerBridgeReturn<ArrayBuffer>;
  mozjpegEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: Extract<EncoderState, { type: 'mozJPEG' }>['options'],
  ): WorkerBridgeReturn<ArrayBuffer>;
  oxipngEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: Extract<EncoderState, { type: 'oxiPNG' }>['options'],
  ): WorkerBridgeReturn<ArrayBuffer>;
  qoiEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: Extract<EncoderState, { type: 'qoi' }>['options'],
  ): WorkerBridgeReturn<ArrayBuffer>;
  webpEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: Extract<EncoderState, { type: 'webP' }>['options'],
  ): WorkerBridgeReturn<ArrayBuffer>;
  wp2Encode(
    signal: AbortSignal,
    imageData: ImageData,
    options: Extract<EncoderState, { type: 'wp2' }>['options'],
  ): WorkerBridgeReturn<ArrayBuffer>;
}

export function compressImage(
  signal: AbortSignal,
  image: ImageData,
  encodeData: EncoderState,
  sourceFilename: string,
  workerBridge: ImagePipelineWorkerBridge,
): Promise<File> {
  switch (encodeData.type) {
    case 'avif':
      return compressImageWithEncoder(
        signal,
        image,
        encodeData.options,
        sourceFilename,
        workerBridge,
        encoderMap.avif,
      );
    case 'browserGIF':
      return compressImageWithEncoder(
        signal,
        image,
        encodeData.options,
        sourceFilename,
        workerBridge,
        encoderMap.browserGIF,
      );
    case 'browserJPEG':
      return compressImageWithEncoder(
        signal,
        image,
        encodeData.options,
        sourceFilename,
        workerBridge,
        encoderMap.browserJPEG,
      );
    case 'browserPNG':
      return compressImageWithEncoder(
        signal,
        image,
        encodeData.options,
        sourceFilename,
        workerBridge,
        encoderMap.browserPNG,
      );
    case 'jxl':
      return compressImageWithEncoder(
        signal,
        image,
        encodeData.options,
        sourceFilename,
        workerBridge,
        encoderMap.jxl,
      );
    case 'mozJPEG':
      return compressImageWithEncoder(
        signal,
        image,
        encodeData.options,
        sourceFilename,
        workerBridge,
        encoderMap.mozJPEG,
      );
    case 'oxiPNG':
      return compressImageWithEncoder(
        signal,
        image,
        encodeData.options,
        sourceFilename,
        workerBridge,
        encoderMap.oxiPNG,
      );
    case 'qoi':
      return compressImageWithEncoder(
        signal,
        image,
        encodeData.options,
        sourceFilename,
        workerBridge,
        encoderMap.qoi,
      );
    case 'webP':
      return compressImageWithEncoder(
        signal,
        image,
        encodeData.options,
        sourceFilename,
        workerBridge,
        encoderMap.webP,
      );
    case 'wp2':
      return compressImageWithEncoder(
        signal,
        image,
        encodeData.options,
        sourceFilename,
        workerBridge,
        encoderMap.wp2,
      );
  }

  const unsupportedEncoder: never = encodeData;
  throw new Error(`Unsupported encoder: ${JSON.stringify(unsupportedEncoder)}`);
}

export const imagePipeline = {
  decodeSourceImage,
  preprocessImage,
  processImage,
  compressImage,
  decodeImage,
};
