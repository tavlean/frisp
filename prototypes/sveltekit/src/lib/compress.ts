// Single-image compression helper for the SvelteKit slice.
//
// Drives the SAME framework-neutral pipeline the bulk feature uses: decode ->
// preprocess -> resize -> `imagePipeline.compressImage`. compressImage dispatches
// on the encoder type through the generated encoder runtime map, which now covers
// every active codec (all except blocked wp2), so the single-image path and the
// bulk engine share one code path. Heavy work runs in the SvelteKit codec worker
// via SvelteKitWorkerBridge; browser encoders (GIF/JPEG/PNG) encode on the main
// thread through the same map. No per-format switch.

import {
  decodeSourceImage,
  imagePipeline,
  preprocessImage,
  processImage,
  type ImagePipelineWorkerBridge,
} from '../../../../src/client/lazy-app/image-pipeline';
import { getPercentChange } from '../../../../src/client/lazy-app/bulk/size';
import {
  defaultPreprocessorState,
  defaultProcessorState,
  encoderMap,
  type EncoderState,
  type EncoderType,
} from 'client/lazy-app/feature-meta';
import SvelteKitWorkerBridge from './sveltekit-worker-bridge';

/** Any active encoder the generated surface supports (all codecs except wp2). */
export type OutputFormat = EncoderType;

/**
 * Formats surfaced in the slice's button row. The codec encoders the project
 * focuses on, plus the other single-thread WASM codecs. Browser encoders stay in
 * the type/generated surface but get their own option panels in the editor phase
 * (their quality scales differ), so they are intentionally not listed here yet.
 */
export const OUTPUT_FORMATS: {
  id: OutputFormat;
  label: string;
  ext: string;
}[] = [
  { id: 'webP', label: 'WebP', ext: encoderMap.webP.meta.extension },
  { id: 'avif', label: 'AVIF', ext: encoderMap.avif.meta.extension },
  { id: 'jxl', label: 'JPEG XL', ext: encoderMap.jxl.meta.extension },
  { id: 'mozJPEG', label: 'MozJPEG', ext: encoderMap.mozJPEG.meta.extension },
  { id: 'oxiPNG', label: 'OxiPNG', ext: encoderMap.oxiPNG.meta.extension },
  { id: 'qoi', label: 'QOI', ext: encoderMap.qoi.meta.extension },
];

export interface CompressRequest {
  format: OutputFormat;
  /** The encoder's full option object (e.g. webP EncodeOptions). */
  options: unknown;
  /** Optional resize. When omitted the image keeps its size. */
  resize?: { width: number; height: number };
}

/** A fresh, mutable copy of an encoder's default options (for the UI to bind). */
export function getDefaultOptions(
  format: OutputFormat,
): Record<string, unknown> {
  return structuredClone(
    encoderMap[format].meta.defaultOptions as Record<string, unknown>,
  );
}

export interface CompressOutcome {
  outputFile: File;
  outputUrl: string;
  outputSize: number;
  originalSize: number;
  percentChange: number;
}

function buildProcessorState(request: CompressRequest) {
  return {
    resize: {
      ...defaultProcessorState.resize,
      enabled: Boolean(request.resize),
      width: request.resize?.width ?? defaultProcessorState.resize.width,
      height: request.resize?.height ?? defaultProcessorState.resize.height,
    },
    quantize: {
      ...defaultProcessorState.quantize,
      enabled: false,
    },
  };
}

/**
 * Pair the requested format with its option object. The options come from the UI
 * (each per-encoder panel binds the encoder's own option type), so the
 * discriminated-union cast is the prototype adapter's single typing seam.
 */
function buildEncoderState(request: CompressRequest): EncoderState {
  return { type: request.format, options: request.options } as EncoderState;
}

/**
 * Compress one file. Caller owns `outputUrl` and must revoke it when done.
 */
export async function compressFile(
  file: File,
  request: CompressRequest,
  signal: AbortSignal,
): Promise<CompressOutcome> {
  const bridge = new SvelteKitWorkerBridge();
  const pipelineBridge = bridge as unknown as ImagePipelineWorkerBridge;
  try {
    const decodedSource = await decodeSourceImage(signal, file, pipelineBridge);
    const preprocessed = await preprocessImage(
      signal,
      decodedSource.decoded,
      defaultPreprocessorState,
      pipelineBridge,
    );
    const processed = await processImage(
      signal,
      { ...decodedSource, preprocessed },
      buildProcessorState(request),
      pipelineBridge,
    );

    const outputFile = await imagePipeline.compressImage(
      signal,
      processed,
      buildEncoderState(request),
      file.name,
      pipelineBridge,
    );
    const outputUrl = URL.createObjectURL(outputFile);

    return {
      outputFile,
      outputUrl,
      outputSize: outputFile.size,
      originalSize: file.size,
      percentChange:
        Math.round(getPercentChange(file.size, outputFile.size) * 10) / 10,
    };
  } finally {
    bridge.dispose();
  }
}
