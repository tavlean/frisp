import { expose, transfer } from 'comlink';
import { createAvifDecoderRuntime } from 'features/decoders/avif/worker/runtime';
import avifDecoder from 'app-generated/codecs/avif/dec/avif_dec';
import { createAvifEncoderRuntime } from 'features/encoders/avif/worker/runtime';
import avifEncoder from 'app-generated/codecs/avif/enc/avif_enc';
import type { EncodeOptions as AvifEncodeOptions } from 'features/encoders/avif/shared/meta';
import { createWebpDecoderRuntime } from 'features/decoders/webp/worker/runtime';
import webpDecoder from 'app-generated/codecs/webp/dec/webp_dec';
import { createWebpEncoderRuntime } from 'features/encoders/webP/worker/runtime';
import type { EncodeOptions } from 'features/encoders/webP/shared/meta';
import webpEncoder from 'app-generated/codecs/webp/enc/webp_enc';
import webpEncoderSimd from 'app-generated/codecs/webp/enc/webp_enc_simd';
import { createQoiDecoderRuntime } from 'features/decoders/qoi/worker/runtime';
import qoiDecoder from 'app-generated/codecs/qoi/dec/qoi_dec';
import { createJxlDecoderRuntime } from 'features/decoders/jxl/worker/runtime';
import jxlDecoder from 'app-generated/codecs/jxl/dec/jxl_dec';
import { createQoiEncoderRuntime } from 'features/encoders/qoi/worker/runtime';
import type { EncodeOptions as QoiEncodeOptions } from 'features/encoders/qoi/shared/meta';
import qoiEncoder from 'app-generated/codecs/qoi/enc/qoi_enc';
import { createJxlEncoderRuntime } from 'features/encoders/jxl/worker/runtime';
import type { EncodeOptions as JxlEncodeOptions } from 'features/encoders/jxl/shared/meta';
import jxlEncoder from 'app-generated/codecs/jxl/enc/jxl_enc';
import { createMozjpegEncoderRuntime } from 'features/encoders/mozJPEG/worker/runtime';
import type { EncodeOptions as MozjpegEncodeOptions } from 'features/encoders/mozJPEG/shared/meta';
import mozjpegEncoder from 'app-generated/codecs/mozjpeg/enc/mozjpeg_enc';
import { createJpegliEncoderRuntime } from 'features/encoders/jpegli/worker/runtime';
import type { EncodeOptions as JpegliEncodeOptions } from 'features/encoders/jpegli/shared/meta';
import jpegliEncoder from 'app-generated/codecs/jpegli/enc/jpegli_enc';
import { createOxiPngEncoderRuntime } from 'features/encoders/oxiPNG/worker/runtime';
import type { EncodeOptions as OxipngEncodeOptions } from 'features/encoders/oxiPNG/shared/meta';
import initOxipngWasm, {
  optimise as optimiseOxipng,
} from 'app-generated/codecs/oxipng/pkg/squoosh_oxipng';
import checkThreadsSupport from 'worker-shared/supports-wasm-threads';
import { simd } from 'wasm-feature-detect';
import { applyGrain } from 'features/processors/grain/shared/apply';
import type { Options as GrainOptions } from 'features/processors/grain/shared/meta';
import { createQuantizeRuntime } from 'features/processors/quantize/worker/runtime';
import type { Options as QuantizeOptions } from 'features/processors/quantize/shared/meta';
import imagequant from 'app-generated/codecs/imagequant/imagequant';
import { createResize } from 'features/processors/resize/worker/runtime';
import type { WorkerResizeOptions } from 'features/processors/resize/shared/meta';
import initResizeWasm, {
  resize as wasmResize,
} from 'app-generated/codecs/resize/pkg/squoosh_resize';
import initHqxWasm, {
  resize as wasmHqx,
} from 'app-generated/codecs/hqx/pkg/squooshhqx';
import { createRotate } from 'features/preprocessors/rotate/worker/runtime';
import type { Options as RotateOptions } from 'features/preprocessors/rotate/shared/meta';
import type { EncoderState } from 'client/lazy-app/feature-meta/shared';
import type { PipelineSteps } from 'client/lazy-app/pipeline-core';
import {
  createPipelineOps,
  replyTransfers,
  type OptimizeReply,
  type OptimizeRequest,
  type PrepareReply,
  type PrepareRequest,
} from './pipeline-op';
import { nativeDecode, pixelatedResize } from './offscreen';

export interface AvifWasmUrls {
  decoder: string;
  encoder: string;
  encoderMt: string;
  encoderMtWorker: string;
  encoderMtScript: string;
}

export interface WebpWasmUrls {
  baseline: string;
  decoder: string;
  simd: string;
}

export interface QoiWasmUrls {
  decoder: string;
  encoder: string;
}

export interface JxlWasmUrls {
  decoder: string;
  encoder: string;
  encoderMt: string;
  encoderMtWorker: string;
  encoderMtScript: string;
  encoderMtSimd: string;
  encoderMtSimdWorker: string;
  encoderMtSimdScript: string;
}

export interface MozjpegWasmUrls {
  encoder: string;
}

export interface JpegliWasmUrls {
  encoder: string;
}

export interface OxipngWasmUrls {
  singleThread: string;
  multiThread: string;
}

export interface ImagequantWasmUrls {
  processor: string;
}

export interface ResizeWasmUrls {
  hqx: string;
  resize: string;
}

export interface RotateWasmUrls {
  preprocessor: string;
}

/** Every WASM URL group, sent with each pipeline op so whichever codec the
 *  recipe reaches can locate its module. */
export interface CodecUrls {
  avif: AvifWasmUrls;
  webp: WebpWasmUrls;
  qoi: QoiWasmUrls;
  jxl: JxlWasmUrls;
  mozjpeg: MozjpegWasmUrls;
  jpegli: JpegliWasmUrls;
  oxipng: OxipngWasmUrls;
  imagequant: ImagequantWasmUrls;
  resize: ResizeWasmUrls;
  rotate: RotateWasmUrls;
}

/** What every pipeline op needs besides its request. A separate argument so
 *  the request object the caller marked for transfer reaches Comlink as is. */
export interface WorkerContext {
  urls: CodecUrls;
  /** OxiPNG thread-pool size. The pool is built once per worker, so the
   *  first threaded OxiPNG encode in a worker's life fixes it. */
  threads: number;
}

// Threaded (Emscripten pthread) codec glue URLs, stashed by locateCodecWasm so
// the runtimes' loadMultiThread closures can dynamically import the right glue
// and hand it to the pthread workers as mainScriptUrlOrBlob. Undefined until a
// threaded encode is requested.
let avifMtScriptUrl: string | undefined;
let jxlMtScriptUrl: string | undefined;
let jxlMtSimdScriptUrl: string | undefined;

function locateCodecWasm({
  avif,
  imagequant,
  jpegli,
  jxl,
  mozjpeg,
  qoi,
  webp,
}: {
  avif?: AvifWasmUrls;
  imagequant?: ImagequantWasmUrls;
  jpegli?: JpegliWasmUrls;
  jxl?: JxlWasmUrls;
  mozjpeg?: MozjpegWasmUrls;
  qoi?: QoiWasmUrls;
  webp?: WebpWasmUrls;
}): void {
  avifMtScriptUrl = avif?.encoderMtScript;
  jxlMtScriptUrl = jxl?.encoderMtScript;
  jxlMtSimdScriptUrl = jxl?.encoderMtSimdScript;
  globalThis.__appEmscriptenLocateFile = (path) => {
    if (path === 'avif_dec.wasm') return avif?.decoder ?? path;
    if (path === 'avif_enc.wasm') return avif?.encoder ?? path;
    if (path === 'avif_enc_mt.wasm') return avif?.encoderMt ?? path;
    if (path === 'avif_enc_mt.worker.js') return avif?.encoderMtWorker ?? path;
    if (path === 'webp_enc.wasm') return webp?.baseline ?? path;
    if (path === 'webp_dec.wasm') return webp?.decoder ?? path;
    if (path === 'webp_enc_simd.wasm') return webp?.simd ?? path;
    if (path === 'qoi_enc.wasm') return qoi?.encoder ?? path;
    if (path === 'qoi_dec.wasm') return qoi?.decoder ?? path;
    if (path === 'jxl_enc.wasm') return jxl?.encoder ?? path;
    if (path === 'jxl_dec.wasm') return jxl?.decoder ?? path;
    if (path === 'jxl_enc_mt.wasm') return jxl?.encoderMt ?? path;
    if (path === 'jxl_enc_mt.worker.js') return jxl?.encoderMtWorker ?? path;
    if (path === 'jxl_enc_mt_simd.wasm') return jxl?.encoderMtSimd ?? path;
    if (path === 'jxl_enc_mt_simd.worker.js')
      return jxl?.encoderMtSimdWorker ?? path;
    if (path === 'mozjpeg_enc.wasm') return mozjpeg?.encoder ?? path;
    if (path === 'jpegli_enc.wasm') return jpegli?.encoder ?? path;
    if (path === 'imagequant.wasm') return imagequant?.processor ?? path;
    return path;
  };
}

const decodeAvif = createAvifDecoderRuntime({
  loadDecoder: async () => avifDecoder,
});
const encodeAvif = createAvifEncoderRuntime({
  supportsThreads: checkThreadsSupport,
  async loadMultiThread() {
    if (!avifMtScriptUrl) {
      throw new Error('AVIF multithread script URL is unavailable.');
    }
    globalThis.__appEmscriptenMainScriptUrlOrBlob = avifMtScriptUrl;
    const avifEncoderMt = await import(/* @vite-ignore */ avifMtScriptUrl);
    return avifEncoderMt.default;
  },
  async loadSingleThread() {
    globalThis.__appEmscriptenMainScriptUrlOrBlob = undefined;
    return avifEncoder;
  },
});
const decodeWebp = createWebpDecoderRuntime({
  loadDecoder: async () => webpDecoder,
});
const encodeWebp = createWebpEncoderRuntime({
  detectSimd: async () => true,
  loadBaseline: async () => webpEncoder,
  loadSimd: async () => webpEncoderSimd,
});
const decodeQoi = createQoiDecoderRuntime({
  loadDecoder: async () => qoiDecoder,
});
const encodeQoi = createQoiEncoderRuntime({
  loadEncoder: async () => qoiEncoder,
});
const decodeJxl = createJxlDecoderRuntime({
  loadDecoder: async () => jxlDecoder,
});
// The only runtime exposing two operations (encode + transcodeJpeg) instead of
// one function, so that both reach the same loaded module.
const jxl = createJxlEncoderRuntime({
  supportsThreads: checkThreadsSupport,
  supportsSimd: simd,
  async loadSingleThread() {
    globalThis.__appEmscriptenMainScriptUrlOrBlob = undefined;
    return jxlEncoder;
  },
  async loadMultiThread() {
    if (!jxlMtScriptUrl) {
      throw new Error('JPEG XL multithread script URL is unavailable.');
    }
    globalThis.__appEmscriptenMainScriptUrlOrBlob = jxlMtScriptUrl;
    const jxlEncoderMt = await import(/* @vite-ignore */ jxlMtScriptUrl);
    return jxlEncoderMt.default;
  },
  async loadMultiThreadSimd() {
    if (!jxlMtSimdScriptUrl) {
      throw new Error('JPEG XL multithread SIMD script URL is unavailable.');
    }
    globalThis.__appEmscriptenMainScriptUrlOrBlob = jxlMtSimdScriptUrl;
    const jxlEncoderMtSimd = await import(
      /* @vite-ignore */ jxlMtSimdScriptUrl
    );
    return jxlEncoderMtSimd.default;
  },
});
const encodeMozjpeg = createMozjpegEncoderRuntime({
  loadEncoder: async () => mozjpegEncoder,
});
const encodeJpegli = createJpegliEncoderRuntime({
  loadEncoder: async () => jpegliEncoder,
});
const encodeOxipng = createOxiPngEncoderRuntime({
  supportsThreads: checkThreadsSupport,
  async loadMultiThread(wasmUrl) {
    const {
      default: initOxipngMtWasm,
      initThreadPool,
      optimise: optimiseOxipngMt,
    } = await import('app-generated/codecs/oxipng/pkg-parallel/squoosh_oxipng');
    await initOxipngMtWasm(wasmUrl);
    await initThreadPool(oxipngThreads);
    return optimiseOxipngMt;
  },
  async loadSingleThread(wasmUrl) {
    await initOxipngWasm(wasmUrl);
    return optimiseOxipng;
  },
});
// Set from each op's WorkerContext; read once, when OxiPNG's pool is built.
let oxipngThreads = navigator.hardwareConcurrency;
const quantize = createQuantizeRuntime({
  loadQuantizer: async () => imagequant,
});
const resize = createResize({
  initHqxWasm,
  initResizeWasm,
  wasmHqx,
  wasmResize,
});
let rotate: ReturnType<typeof createRotate> | undefined;

function rotateWith(wasmUrls: RotateWasmUrls): ReturnType<typeof createRotate> {
  rotate ??= createRotate(wasmUrls.preprocessor);
  return rotate;
}

// The URLs of the op in progress. Ops run one at a time per worker (the
// bridge queues them), so the steps below can read this instead of threading
// URLs through PipelineSteps, which Node implements without URLs at all.
let currentUrls: CodecUrls | undefined;
const urls = (): CodecUrls => {
  if (!currentUrls) throw Error('No codec URLs for this operation.');
  return currentUrls;
};

type EncodeFn = (image: ImageData, options: unknown) => Promise<ArrayBuffer>;
const encoders: Record<EncoderState['type'], EncodeFn> = {
  avif: encodeAvif as EncodeFn,
  jpegli: encodeJpegli as EncodeFn,
  jxl: ((image, options) =>
    jxl.encode(image, options as JxlEncodeOptions)) as EncodeFn,
  mozJPEG: encodeMozjpeg as EncodeFn,
  oxiPNG: ((image, options) =>
    encodeOxipng(image, options as OxipngEncodeOptions, {
      wasmUrls: urls().oxipng,
    })) as EncodeFn,
  qoi: encodeQoi as EncodeFn,
  webP: encodeWebp as EncodeFn,
};

const steps: PipelineSteps = {
  rotate: (image, rotate) => rotateWith(urls().rotate)(image, { rotate }),
  resize: async (image, options) =>
    options.method === 'browser-pixelated'
      ? pixelatedResize(image, options)
      : resize(image, options, urls().resize),
  quantize: (image, options) => quantize(image, options),
  encode: (image, encoder) => encoders[encoder.type](image, encoder.options),
};

const pipeline = createPipelineOps({
  steps,
  nativeDecode,
  wasmDecode: {
    'image/avif': decodeAvif,
    'image/webp': decodeWebp,
    'image/jxl': decodeJxl,
    'image/qoi': decodeQoi,
  },
  transcodeJpeg: (jpeg) => jxl.transcodeJpeg(jpeg),
});

function enter(context: WorkerContext): void {
  currentUrls = context.urls;
  oxipngThreads = context.threads;
  locateCodecWasm(context.urls);
}

const transferBuffer = async (p: Promise<ArrayBuffer>) => {
  const b = await p;
  return transfer(b, [b]);
};

const transferImage = async (p: Promise<ImageData>) => {
  const i = await p;
  return transfer(i, [i.data.buffer]);
};

const workerApi = {
  /** Decode (or reuse) the source, run the recipe, encode, and optionally
   *  decode the output back. See pipeline-op.ts. */
  async optimize(
    request: OptimizeRequest,
    context: WorkerContext,
  ): Promise<OptimizeReply> {
    enter(context);
    const reply = await pipeline.optimize(request);
    return transfer(reply, replyTransfers(reply));
  },
  async prepare(
    request: PrepareRequest,
    context: WorkerContext,
  ): Promise<PrepareReply> {
    enter(context);
    const reply = await pipeline.prepare(request);
    return transfer(reply, replyTransfers(reply));
  },
  async decodeOutput(blob: Blob, context: WorkerContext): Promise<ImageData> {
    enter(context);
    const image = await pipeline.decodeOutput(blob);
    return transfer(image, replyTransfers(image));
  },
  avifDecode(blob: Blob, wasmUrls: AvifWasmUrls): Promise<ImageData> {
    locateCodecWasm({ avif: wasmUrls });
    return transferImage(decodeAvif(blob));
  },
  avifEncode(
    imageData: ImageData,
    options: AvifEncodeOptions,
    wasmUrls: AvifWasmUrls,
  ): Promise<ArrayBuffer> {
    locateCodecWasm({ avif: wasmUrls });
    return transferBuffer(encodeAvif(imageData, options));
  },
  webpEncode(
    imageData: ImageData,
    options: EncodeOptions,
    wasmUrls: WebpWasmUrls,
  ): Promise<ArrayBuffer> {
    locateCodecWasm({ webp: wasmUrls });
    return transferBuffer(encodeWebp(imageData, options));
  },
  webpDecode(blob: Blob, wasmUrls: WebpWasmUrls): Promise<ImageData> {
    locateCodecWasm({ webp: wasmUrls });
    return transferImage(decodeWebp(blob));
  },
  qoiDecode(blob: Blob, wasmUrls: QoiWasmUrls): Promise<ImageData> {
    locateCodecWasm({ qoi: wasmUrls });
    return transferImage(decodeQoi(blob));
  },
  qoiEncode(
    imageData: ImageData,
    options: QoiEncodeOptions,
    wasmUrls: QoiWasmUrls,
  ): Promise<ArrayBuffer> {
    locateCodecWasm({ qoi: wasmUrls });
    return transferBuffer(encodeQoi(imageData, options));
  },
  jxlDecode(blob: Blob, wasmUrls: JxlWasmUrls): Promise<ImageData> {
    locateCodecWasm({ jxl: wasmUrls });
    return transferImage(decodeJxl(blob));
  },
  jxlEncode(
    imageData: ImageData,
    options: JxlEncodeOptions,
    wasmUrls: JxlWasmUrls,
  ): Promise<ArrayBuffer> {
    locateCodecWasm({ jxl: wasmUrls });
    return transferBuffer(jxl.encode(imageData, options));
  },
  // Not transferBuffer: the result is nullable, and a null has nothing to
  // transfer.
  async jxlTranscode(
    jpeg: ArrayBuffer,
    wasmUrls: JxlWasmUrls,
  ): Promise<ArrayBuffer | null> {
    locateCodecWasm({ jxl: wasmUrls });
    const output = await jxl.transcodeJpeg(jpeg);
    return output ? transfer(output, [output]) : null;
  },
  mozjpegEncode(
    imageData: ImageData,
    options: MozjpegEncodeOptions,
    wasmUrls: MozjpegWasmUrls,
  ): Promise<ArrayBuffer> {
    locateCodecWasm({ mozjpeg: wasmUrls });
    return transferBuffer(encodeMozjpeg(imageData, options));
  },
  jpegliEncode(
    imageData: ImageData,
    options: JpegliEncodeOptions,
    wasmUrls: JpegliWasmUrls,
  ): Promise<ArrayBuffer> {
    locateCodecWasm({ jpegli: wasmUrls });
    return transferBuffer(encodeJpegli(imageData, options));
  },
  oxipngEncode(
    imageData: ImageData,
    options: OxipngEncodeOptions,
    wasmUrls: OxipngWasmUrls,
  ): Promise<ArrayBuffer> {
    return transferBuffer(
      encodeOxipng(imageData, options, {
        wasmUrls,
      }),
    );
  },
  grain(
    imageData: ImageData,
    options: GrainOptions & { enabled: boolean },
  ): Promise<ImageData> {
    // Pure JS — no WASM to locate.
    return transferImage(Promise.resolve(applyGrain(imageData, options)));
  },
  quantize(
    imageData: ImageData,
    options: QuantizeOptions,
    wasmUrls: ImagequantWasmUrls,
  ): Promise<ImageData> {
    locateCodecWasm({ imagequant: wasmUrls });
    return transferImage(quantize(imageData, options));
  },
  resize(
    imageData: ImageData,
    options: WorkerResizeOptions,
    wasmUrls: ResizeWasmUrls,
  ): Promise<ImageData> {
    return transferImage(resize(imageData, options, wasmUrls));
  },
  rotate(
    data: ImageData,
    options: RotateOptions,
    wasmUrls: RotateWasmUrls,
  ): Promise<ImageData> {
    return transferImage(rotateWith(wasmUrls)(data, options));
  },
};

export type SvelteKitProcessorWorkerApi = typeof workerApi;

expose(workerApi);
