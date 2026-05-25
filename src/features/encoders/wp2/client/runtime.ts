import type { EncodeOptions } from '../shared/meta';

export interface Wp2EncodeWorkerBridge {
  wp2Encode(
    signal: AbortSignal,
    imageData: ImageData,
    options: EncodeOptions,
  ): Promise<ArrayBuffer> | Promise<Promise<ArrayBuffer>>;
}

export const encode = (
  signal: AbortSignal,
  workerBridge: Wp2EncodeWorkerBridge,
  imageData: ImageData,
  options: EncodeOptions,
) => workerBridge.wp2Encode(signal, imageData, options);
