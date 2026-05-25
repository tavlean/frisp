import type { EncodeOptions } from '../shared/meta';

export interface QoiEncodeWorkerBridge {
  qoiEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: EncodeOptions,
  ): Promise<ArrayBuffer> | Promise<Promise<ArrayBuffer>>;
}

export function encode(
  signal: AbortSignal,
  workerBridge: QoiEncodeWorkerBridge,
  imageData: ImageData,
  options: EncodeOptions,
) {
  return workerBridge.qoiEncode(signal, imageData, options);
}
