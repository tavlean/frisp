import { createWorkerBridgeRuntime } from 'client/lazy-app/worker-bridge/runtime';
import { getCodecAssetUrl } from 'shared/codec-assets';
import type { EncodeOptions as AvifEncodeOptions } from 'features/encoders/avif/shared/meta';
import type { EncodeOptions } from 'features/encoders/webP/shared/meta';
import type { EncodeOptions as QoiEncodeOptions } from 'features/encoders/qoi/shared/meta';
import type { EncodeOptions as JxlEncodeOptions } from 'features/encoders/jxl/shared/meta';
import type { EncodeOptions as MozjpegEncodeOptions } from 'features/encoders/mozJPEG/shared/meta';
import type { EncodeOptions as OxipngEncodeOptions } from 'features/encoders/oxiPNG/shared/meta';
import type { Options as QuantizeOptions } from 'features/processors/quantize/shared/meta';
import type { WorkerResizeOptions } from 'features/processors/resize/shared/meta';
import type { Options as RotateOptions } from 'features/preprocessors/rotate/shared/meta';
import { methodNames } from 'app-generated/worker-bridge/meta';
import type {
  AvifWasmUrls,
  ImagequantWasmUrls,
  JxlWasmUrls,
  MozjpegWasmUrls,
  OxipngWasmUrls,
  QoiWasmUrls,
  ResizeWasmUrls,
  RotateWasmUrls,
  WebpWasmUrls,
} from 'app-generated/features-worker/webp';
import {
  svelteKitFeaturesWorkerUrl,
  svelteKitCodecAssetRecords,
} from './codec-assets';

export interface SvelteKitWorkerBridgeApi {
  avifDecode(signal: AbortSignal, blob: Blob): Promise<ImageData>;
  avifEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: AvifEncodeOptions,
  ): Promise<ArrayBuffer>;
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
  jxlEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: JxlEncodeOptions,
  ): Promise<ArrayBuffer>;
  jxlDecode(signal: AbortSignal, blob: Blob): Promise<ImageData>;
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
  avifDecode(
    signal: AbortSignal,
    blob: Blob,
    wasmUrls: AvifWasmUrls,
  ): Promise<ImageData>;
  avifEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: AvifEncodeOptions,
    wasmUrls: AvifWasmUrls,
  ): Promise<ArrayBuffer>;
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
  jxlEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: JxlEncodeOptions,
    wasmUrls: JxlWasmUrls,
  ): Promise<ArrayBuffer>;
  jxlDecode(
    signal: AbortSignal,
    blob: Blob,
    wasmUrls: JxlWasmUrls,
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
  rotate(
    signal: AbortSignal,
    data: ImageData,
    options: RotateOptions,
    wasmUrls: RotateWasmUrls,
  ): Promise<ImageData>;
  dispose(): void;
}

const SvelteKitWorkerBridgeBase = createWorkerBridgeRuntime(
  methodNames,
  () => new Worker(svelteKitFeaturesWorkerUrl, { type: 'module' }),
) as new () => SvelteKitWorkerBridgeWorkerApi;

const codecAssetUrl = (logicalKey: string): string =>
  getCodecAssetUrl(svelteKitCodecAssetRecords, logicalKey);

const avifWasmUrls = {
  decoder: codecAssetUrl('avif:decoder:default'),
  encoder: codecAssetUrl('avif:encoder:single-thread'),
  encoderMt: codecAssetUrl('avif:encoder:multi-thread'),
  encoderMtWorker: codecAssetUrl('avif:encoder:multi-thread-worker'),
  encoderMtScript: codecAssetUrl('avif:encoder:multi-thread-script'),
} satisfies AvifWasmUrls;

const webpWasmUrls = {
  baseline: codecAssetUrl('webp:encoder:baseline'),
  decoder: codecAssetUrl('webp:decoder:default'),
  simd: codecAssetUrl('webp:encoder:simd'),
} satisfies WebpWasmUrls;

const qoiWasmUrls = {
  decoder: codecAssetUrl('qoi:decoder:default'),
  encoder: codecAssetUrl('qoi:encoder:default'),
} satisfies QoiWasmUrls;

const jxlWasmUrls = {
  decoder: codecAssetUrl('jxl:decoder:default'),
  encoder: codecAssetUrl('jxl:encoder:single-thread'),
  encoderMt: codecAssetUrl('jxl:encoder:multi-thread'),
  encoderMtWorker: codecAssetUrl('jxl:encoder:multi-thread-worker'),
  encoderMtScript: codecAssetUrl('jxl:encoder:multi-thread-script'),
  encoderMtSimd: codecAssetUrl('jxl:encoder:multi-thread-simd'),
  encoderMtSimdWorker: codecAssetUrl('jxl:encoder:multi-thread-simd-worker'),
  encoderMtSimdScript: codecAssetUrl('jxl:encoder:multi-thread-simd-script'),
} satisfies JxlWasmUrls;

const mozjpegWasmUrls = {
  encoder: codecAssetUrl('mozjpeg:encoder:default'),
} satisfies MozjpegWasmUrls;

const oxipngWasmUrls = {
  singleThread: codecAssetUrl('oxipng:encoder:single-thread'),
  multiThread: codecAssetUrl('oxipng:encoder:multi-thread'),
} satisfies OxipngWasmUrls;

const imagequantWasmUrls = {
  processor: codecAssetUrl('imagequant:processor:default'),
} satisfies ImagequantWasmUrls;

const resizeWasmUrls = {
  hqx: codecAssetUrl('hqx:processor:hqx'),
  resize: codecAssetUrl('resize:processor:default'),
} satisfies ResizeWasmUrls;

const rotateWasmUrls = {
  preprocessor: codecAssetUrl('rotate:preprocessor:default'),
} satisfies RotateWasmUrls;

export default class SvelteKitWorkerBridge
  extends SvelteKitWorkerBridgeBase
  implements SvelteKitWorkerBridgeApi
{
  avifDecode(signal: AbortSignal, blob: Blob): Promise<ImageData> {
    return super.avifDecode(signal, blob, avifWasmUrls);
  }

  avifEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: AvifEncodeOptions,
  ): Promise<ArrayBuffer> {
    return super.avifEncode(signal, imageData, options, avifWasmUrls);
  }

  webpEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: EncodeOptions,
  ): Promise<ArrayBuffer> {
    return super.webpEncode(signal, imageData, options, webpWasmUrls);
  }

  webpDecode(signal: AbortSignal, blob: Blob): Promise<ImageData> {
    return super.webpDecode(signal, blob, webpWasmUrls);
  }

  qoiEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: QoiEncodeOptions,
  ): Promise<ArrayBuffer> {
    return super.qoiEncode(signal, imageData, options, qoiWasmUrls);
  }

  qoiDecode(signal: AbortSignal, blob: Blob): Promise<ImageData> {
    return super.qoiDecode(signal, blob, qoiWasmUrls);
  }

  jxlEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: JxlEncodeOptions,
  ): Promise<ArrayBuffer> {
    return super.jxlEncode(signal, imageData, options, jxlWasmUrls);
  }

  jxlDecode(signal: AbortSignal, blob: Blob): Promise<ImageData> {
    return super.jxlDecode(signal, blob, jxlWasmUrls);
  }

  mozjpegEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: MozjpegEncodeOptions,
  ): Promise<ArrayBuffer> {
    return super.mozjpegEncode(signal, imageData, options, mozjpegWasmUrls);
  }

  oxipngEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: OxipngEncodeOptions,
  ): Promise<ArrayBuffer> {
    return super.oxipngEncode(signal, imageData, options, oxipngWasmUrls);
  }

  quantize(
    signal: AbortSignal,
    imageData: ImageData,
    options: QuantizeOptions,
  ): Promise<ImageData> {
    return super.quantize(signal, imageData, options, imagequantWasmUrls);
  }

  resize(
    signal: AbortSignal,
    imageData: ImageData,
    options: WorkerResizeOptions,
  ): Promise<ImageData> {
    return super.resize(signal, imageData, options, resizeWasmUrls);
  }

  rotate(
    signal: AbortSignal,
    data: ImageData,
    options: RotateOptions,
  ): Promise<ImageData> {
    return super.rotate(signal, data, options, rotateWasmUrls);
  }
}
