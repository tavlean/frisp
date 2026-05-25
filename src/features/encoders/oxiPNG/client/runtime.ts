import type { EncodeOptions } from '../shared/meta';

export interface OxiPngEncodeWorkerBridge {
  oxipngEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: EncodeOptions,
  ): Promise<ArrayBuffer> | Promise<Promise<ArrayBuffer>>;
}

export async function encode(
  signal: AbortSignal,
  workerBridge: OxiPngEncodeWorkerBridge,
  imageData: ImageData,
  options: EncodeOptions,
) {
  return workerBridge.oxipngEncode(signal, imageData, options);
}
