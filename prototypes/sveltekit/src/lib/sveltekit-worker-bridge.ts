import { createWorkerBridgeRuntime } from '../../../../src/client/lazy-app/worker-bridge/runtime';
import type { EncodeOptions } from 'features/encoders/webP/shared/meta';
import type { EncodeOptions as QoiEncodeOptions } from 'features/encoders/qoi/shared/meta';
import type { Options as RotateOptions } from 'features/preprocessors/rotate/shared/meta';
import { methodNames } from 'sqush-generated/worker-bridge/meta';
import type {
  QoiWasmUrls,
  WebpWasmUrls,
} from 'sqush-generated/features-worker/webp';
import {
  qoiEncoderWasmUrl,
  svelteKitFeaturesWorkerUrl,
  webpEncoderSimdWasmUrl,
  webpEncoderWasmUrl,
} from './codec-assets';

export interface SvelteKitWorkerBridgeApi {
  webpEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: EncodeOptions,
  ): Promise<ArrayBuffer>;
  rotate(
    signal: AbortSignal,
    data: ImageData,
    options: RotateOptions,
  ): Promise<ImageData>;
  qoiEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: QoiEncodeOptions,
  ): Promise<ArrayBuffer>;
  dispose(): void;
}

interface SvelteKitWorkerBridgeWorkerApi {
  webpEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: EncodeOptions,
    wasmUrls: WebpWasmUrls,
  ): Promise<ArrayBuffer>;
  qoiEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: QoiEncodeOptions,
    wasmUrls: QoiWasmUrls,
  ): Promise<ArrayBuffer>;
  dispose(): void;
}

const SvelteKitWorkerBridgeBase = createWorkerBridgeRuntime(
  methodNames,
  () => new Worker(svelteKitFeaturesWorkerUrl, { type: 'module' }),
) as new () => SvelteKitWorkerBridgeWorkerApi;

export default class SvelteKitWorkerBridge
  extends SvelteKitWorkerBridgeBase
  implements SvelteKitWorkerBridgeApi
{
  declare rotate: SvelteKitWorkerBridgeApi['rotate'];

  webpEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: EncodeOptions,
  ): Promise<ArrayBuffer> {
    return super.webpEncode(signal, imageData, options, {
      baseline: webpEncoderWasmUrl,
      simd: webpEncoderSimdWasmUrl,
    });
  }

  qoiEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: QoiEncodeOptions,
  ): Promise<ArrayBuffer> {
    return super.qoiEncode(signal, imageData, options, {
      encoder: qoiEncoderWasmUrl,
    });
  }
}
