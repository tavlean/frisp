import type { EncodeOptions } from '../shared/meta';

export interface AvifEncodeWorkerBridge {
  avifEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: EncodeOptions,
  ): Promise<ArrayBuffer> | Promise<Promise<ArrayBuffer>>;
}

export const encode = (
  signal: AbortSignal,
  workerBridge: AvifEncodeWorkerBridge,
  imageData: ImageData,
  options: EncodeOptions,
) => workerBridge.avifEncode(signal, imageData, options);
