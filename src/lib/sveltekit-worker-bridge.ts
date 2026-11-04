import { transfer } from 'comlink';
import { createWorkerBridgeRuntime } from 'client/lazy-app/worker-bridge/runtime';
import { getCodecAssetUrl } from 'shared/codec-assets';
import type {
  OptimizeReply,
  OptimizeRequest,
  PrepareReply,
  PrepareRequest,
} from '../worker/pipeline-op';
import type {
  AvifWasmUrls,
  CodecUrls,
  WorkerContext,
  ImagequantWasmUrls,
  JpegliWasmUrls,
  JxlWasmUrls,
  MozjpegWasmUrls,
  OxipngWasmUrls,
  QoiWasmUrls,
  ResizeWasmUrls,
  RotateWasmUrls,
  Ssimulacra2WasmUrls,
  WebpWasmUrls,
} from '../worker/codec-worker';
import {
  svelteKitFeaturesWorkerUrl,
  svelteKitCodecAssetRecords,
} from './codec-assets';

const methodNames = [
  'optimize',
  'prepare',
  'decodeOutput',
  'ssimulacra2Score',
] as const;

export interface SvelteKitWorkerBridgeApi {
  /** One encode: the worker decodes or reuses the source and runs every step.
   *  A pixel source in the request is transferred (the caller loses it). */
  optimize(
    signal: AbortSignal,
    request: OptimizeRequest,
  ): Promise<OptimizeReply>;
  /** The rotated source frame, decoded in the worker and transferred out. */
  prepare(signal: AbortSignal, request: PrepareRequest): Promise<PrepareReply>;
  /** An encoded file decoded for display. */
  decodeOutput(signal: AbortSignal, blob: Blob): Promise<ImageData>;
  /**
   * The SSIMULACRA2 score of `dist` against `ref` (100 identical, 90 visually
   * lossless, -1000 when a side is under 8 px). Rejects on a dimension
   * mismatch. Both images are copied to the worker, never transferred, so the
   * caller keeps using them.
   */
  ssimulacra2Score(
    signal: AbortSignal,
    ref: ImageData,
    dist: ImageData,
  ): Promise<number>;
  dispose(): void;
}

interface SvelteKitWorkerBridgeWorkerApi {
  optimize(
    signal: AbortSignal,
    request: OptimizeRequest,
    context: WorkerContext,
  ): Promise<OptimizeReply>;
  prepare(
    signal: AbortSignal,
    request: PrepareRequest,
    context: WorkerContext,
  ): Promise<PrepareReply>;
  decodeOutput(
    signal: AbortSignal,
    blob: Blob,
    context: WorkerContext,
  ): Promise<ImageData>;
  ssimulacra2Score(
    signal: AbortSignal,
    ref: ImageData,
    dist: ImageData,
    wasmUrls: Ssimulacra2WasmUrls,
  ): Promise<number>;
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

const jpegliWasmUrls = {
  encoder: codecAssetUrl('jpegli:encoder:default'),
} satisfies JpegliWasmUrls;

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

const ssimulacra2WasmUrls = {
  metric: codecAssetUrl('ssimulacra2:metric:default'),
} satisfies Ssimulacra2WasmUrls;

const codecUrls = {
  avif: avifWasmUrls,
  webp: webpWasmUrls,
  qoi: qoiWasmUrls,
  jxl: jxlWasmUrls,
  mozjpeg: mozjpegWasmUrls,
  jpegli: jpegliWasmUrls,
  oxipng: oxipngWasmUrls,
  imagequant: imagequantWasmUrls,
  resize: resizeWasmUrls,
  rotate: rotateWasmUrls,
  ssimulacra2: ssimulacra2WasmUrls,
} satisfies CodecUrls;

/** Pixels the main thread hands to the worker, for Comlink's transfer list. */
function sourceTransfers(request: { source?: OptimizeRequest['source'] }) {
  return request.source?.kind === 'pixels'
    ? [request.source.image.data.buffer]
    : [];
}

export interface SvelteKitWorkerBridgeOptions {
  /** OxiPNG thread-pool size for this bridge's worker. Defaults to every
   *  core; bulk splits the cores between its concurrent slots. */
  threads?: number;
}

export default class SvelteKitWorkerBridge
  extends SvelteKitWorkerBridgeBase
  implements SvelteKitWorkerBridgeApi
{
  readonly #context: WorkerContext;

  constructor({ threads }: SvelteKitWorkerBridgeOptions = {}) {
    super();
    this.#context = {
      urls: codecUrls,
      threads: Math.max(1, threads ?? navigator.hardwareConcurrency),
    };
  }

  optimize(
    signal: AbortSignal,
    request: OptimizeRequest,
  ): Promise<OptimizeReply> {
    return super.optimize(
      signal,
      transfer(request, sourceTransfers(request)),
      this.#context,
    );
  }

  prepare(signal: AbortSignal, request: PrepareRequest): Promise<PrepareReply> {
    return super.prepare(
      signal,
      transfer(request, sourceTransfers(request)),
      this.#context,
    );
  }

  decodeOutput(signal: AbortSignal, blob: Blob): Promise<ImageData> {
    return super.decodeOutput(signal, blob, this.#context);
  }

  ssimulacra2Score(
    signal: AbortSignal,
    ref: ImageData,
    dist: ImageData,
  ): Promise<number> {
    return super.ssimulacra2Score(signal, ref, dist, ssimulacra2WasmUrls);
  }
}
