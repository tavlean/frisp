import { createWorkerBridgeRuntime } from '../../../../src/client/lazy-app/worker-bridge/runtime';
import type { EncodeOptions } from 'features/encoders/webP/shared/meta';
import type { EncodeOptions as QoiEncodeOptions } from 'features/encoders/qoi/shared/meta';
import type { EncodeOptions as MozjpegEncodeOptions } from 'features/encoders/mozJPEG/shared/meta';
import type { EncodeOptions as OxipngEncodeOptions } from 'features/encoders/oxiPNG/shared/meta';
import type { Options as QuantizeOptions } from 'features/processors/quantize/shared/meta';
import type { WorkerResizeOptions } from 'features/processors/resize/shared/meta';
import type { Options as RotateOptions } from 'features/preprocessors/rotate/shared/meta';
import { methodNames } from 'sqush-generated/worker-bridge/meta';
import type {
  ImagequantWasmUrls,
  MozjpegWasmUrls,
  OxipngWasmUrls,
  QoiWasmUrls,
  ResizeWasmUrls,
  WebpWasmUrls,
} from 'sqush-generated/features-worker/webp';
import {
  hqxWasmUrl,
  imagequantWasmUrl,
  mozjpegEncoderWasmUrl,
  oxipngWasmUrl,
  qoiDecoderWasmUrl,
  qoiEncoderWasmUrl,
  resizeWasmUrl,
  svelteKitFeaturesWorkerUrl,
  webpDecoderWasmUrl,
  webpEncoderSimdWasmUrl,
  webpEncoderWasmUrl,
} from './codec-assets';

export interface SvelteKitWorkerBridgeApi {
  webpEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: EncodeOptions,
  ): Promise<ArrayBuffer>;
  webpDecode(signal: AbortSignal, blob: Blob): Promise<ImageData>;
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
  qoiDecode(signal: AbortSignal, blob: Blob): Promise<ImageData>;
  mozjpegEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: MozjpegEncodeOptions,
  ): Promise<ArrayBuffer>;
  oxipngEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: OxipngEncodeOptions,
  ): Promise<ArrayBuffer>;
  quantize(
    signal: AbortSignal,
    imageData: ImageData,
    options: QuantizeOptions,
  ): Promise<ImageData>;
  resize(
    signal: AbortSignal,
    imageData: ImageData,
    options: WorkerResizeOptions,
  ): Promise<ImageData>;
  dispose(): void;
}

interface SvelteKitWorkerBridgeWorkerApi {
  webpEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: EncodeOptions,
    wasmUrls: WebpWasmUrls,
  ): Promise<ArrayBuffer>;
  webpDecode(
    signal: AbortSignal,
    blob: Blob,
    wasmUrls: WebpWasmUrls,
  ): Promise<ImageData>;
  qoiEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: QoiEncodeOptions,
    wasmUrls: QoiWasmUrls,
  ): Promise<ArrayBuffer>;
  qoiDecode(
    signal: AbortSignal,
    blob: Blob,
    wasmUrls: QoiWasmUrls,
  ): Promise<ImageData>;
  mozjpegEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: MozjpegEncodeOptions,
    wasmUrls: MozjpegWasmUrls,
  ): Promise<ArrayBuffer>;
  oxipngEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: OxipngEncodeOptions,
    wasmUrls: OxipngWasmUrls,
  ): Promise<ArrayBuffer>;
  quantize(
    signal: AbortSignal,
    imageData: ImageData,
    options: QuantizeOptions,
    wasmUrls: ImagequantWasmUrls,
  ): Promise<ImageData>;
  resize(
    signal: AbortSignal,
    imageData: ImageData,
    options: WorkerResizeOptions,
    wasmUrls: ResizeWasmUrls,
  ): Promise<ImageData>;
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
      decoder: webpDecoderWasmUrl,
      simd: webpEncoderSimdWasmUrl,
    });
  }

  webpDecode(signal: AbortSignal, blob: Blob): Promise<ImageData> {
    return super.webpDecode(signal, blob, {
      baseline: webpEncoderWasmUrl,
      decoder: webpDecoderWasmUrl,
      simd: webpEncoderSimdWasmUrl,
    });
  }

  qoiEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: QoiEncodeOptions,
  ): Promise<ArrayBuffer> {
    return super.qoiEncode(signal, imageData, options, {
      decoder: qoiDecoderWasmUrl,
      encoder: qoiEncoderWasmUrl,
    });
  }

  qoiDecode(signal: AbortSignal, blob: Blob): Promise<ImageData> {
    return super.qoiDecode(signal, blob, {
      decoder: qoiDecoderWasmUrl,
      encoder: qoiEncoderWasmUrl,
    });
  }

  mozjpegEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: MozjpegEncodeOptions,
  ): Promise<ArrayBuffer> {
    return super.mozjpegEncode(signal, imageData, options, {
      encoder: mozjpegEncoderWasmUrl,
    });
  }

  oxipngEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: OxipngEncodeOptions,
  ): Promise<ArrayBuffer> {
    return super.oxipngEncode(signal, imageData, options, {
      singleThread: oxipngWasmUrl,
    });
  }

  quantize(
    signal: AbortSignal,
    imageData: ImageData,
    options: QuantizeOptions,
  ): Promise<ImageData> {
    return super.quantize(signal, imageData, options, {
      processor: imagequantWasmUrl,
    });
  }

  resize(
    signal: AbortSignal,
    imageData: ImageData,
    options: WorkerResizeOptions,
  ): Promise<ImageData> {
    return super.resize(signal, imageData, options, {
      hqx: hqxWasmUrl,
      resize: resizeWasmUrl,
    });
  }
}
