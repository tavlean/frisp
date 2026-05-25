import type { EncodeOptions } from '../shared/meta';

export interface MozJpegEncodeWorkerBridge {
  mozjpegEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: EncodeOptions,
  ): Promise<ArrayBuffer> | Promise<Promise<ArrayBuffer>>;
}

export function encode(
  signal: AbortSignal,
  workerBridge: MozJpegEncodeWorkerBridge,
  imageData: ImageData,
  options: EncodeOptions,
) {
  return workerBridge.mozjpegEncode(signal, imageData, options);
}
