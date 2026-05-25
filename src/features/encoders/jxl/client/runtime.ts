import type { EncodeOptions } from '../shared/meta';

export interface JxlEncodeWorkerBridge {
  jxlEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: EncodeOptions,
  ): Promise<ArrayBuffer> | Promise<Promise<ArrayBuffer>>;
}

export const encode = (
  signal: AbortSignal,
  workerBridge: JxlEncodeWorkerBridge,
  imageData: ImageData,
  options: EncodeOptions,
) => workerBridge.jxlEncode(signal, imageData, options);
