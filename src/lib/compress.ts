// Single-image compression helper for the SvelteKit slice.
//
// Drives the SAME framework-neutral pipeline the bulk feature uses: decode ->
// preprocess -> resize -> `imagePipeline.compressImage`. compressImage dispatches
// on the encoder type through the generated encoder runtime map, so the
// single-image path and the bulk engine share one code path. Heavy work runs in
// the SvelteKit codec worker via SvelteKitWorkerBridge. No per-format switch.

import {
  decodeImage,
  decodeSourceImage,
  imagePipeline,
  preprocessImage,
  processImage,
  type ImagePipelineWorkerBridge,
  type SourceImage,
} from 'client/lazy-app/image-pipeline';
import { getPercentChange } from 'client/lazy-app/bulk/size';
import {
  encoderMap,
  type EncoderState,
  type EncoderType,
  type PreprocessorState,
  type ProcessorState,
} from 'client/lazy-app/feature-meta';
import SvelteKitWorkerBridge from './sveltekit-worker-bridge';

/** Any encoder the generated SvelteKit surface supports. */
export type OutputFormat = EncoderType;

/**
 * A side's chosen output. `'identity'` is Squoosh's "Original" pseudo-encoder:
 * the side shows the (preprocessed) source pixels unchanged and downloads the
 * original file. Every other value is a real encoder.
 */
export type SideFormat = OutputFormat | 'identity';

export const IDENTITY: 'identity' = 'identity';

/**
 * Formats surfaced in the editor. Every entry is a WASM encoder that's always
 * available, so the list is static — no runtime feature detection needed.
 */
export const OUTPUT_FORMATS: {
  id: OutputFormat;
  /** User-facing format name (what the output file actually is). */
  label: string;
  /** Underlying encoder/engine, surfaced as a tooltip — not in the label. */
  tooltip: string;
  ext: string;
}[] = [
  {
    id: 'webP',
    label: 'WebP',
    tooltip: 'libwebp',
    ext: encoderMap.webP.meta.extension,
  },
  {
    id: 'avif',
    label: 'AVIF',
    tooltip: 'libaom',
    ext: encoderMap.avif.meta.extension,
  },
  // JXL's format name matches its codec label, so pull it from meta (kept in
  // sync there). MozJPEG/OxiPNG below are overridden to the plain format name
  // since the encoder brand (MozJPEG/OxiPNG) isn't what the user gets — a
  // standard JPEG/PNG is. The encoder brand lives in the tooltip instead.
  {
    id: 'jxl',
    label: encoderMap.jxl.meta.label,
    tooltip: 'libjxl',
    ext: encoderMap.jxl.meta.extension,
  },
  {
    id: 'mozJPEG',
    label: 'JPEG',
    tooltip: 'MozJPEG',
    ext: encoderMap.mozJPEG.meta.extension,
  },
  {
    id: 'oxiPNG',
    label: 'PNG',
    tooltip: 'OxiPNG',
    ext: encoderMap.oxiPNG.meta.extension,
  },
  // QOI is intentionally not offered as an output: it's a fast/simple lossless
  // format with effectively no support outside specialised tools, so it isn't a
  // useful target for a compression tool. The QOI *decoder* stays wired up, so
  // importing .qoi files still works.
];

export interface CompressRequest {
  format: SideFormat;
  /** The encoder's full option object (e.g. webP EncodeOptions). */
  options: unknown;
  /** Resize + quantize processor state (enabled flags + options). */
  processorState: ProcessorState;
  /** Preprocessor state (rotate). */
  preprocessorState: PreprocessorState;
}

/** A fresh, mutable copy of an encoder's default options (for the UI to bind). */
export function getDefaultOptions(format: SideFormat): Record<string, unknown> {
  // The Original/identity side has no encoder options.
  if (format === IDENTITY) return {};
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
  /** The processed source fed to the encoder (left/"before" preview). */
  sourceImageData: ImageData;
  /** The encoded output decoded back to pixels (right/"after" preview). */
  outputImageData: ImageData;
  /** True for the Original/identity side (no encoding happened). */
  isOriginal: boolean;
  /**
   * Dimensions of the preprocessed (rotated, pre-resize) source. Unlike
   * `sourceImageData` — which is the resized/processed input for an encoder
   * side — these always reflect the true post-rotation source size, so the UI
   * can seed resize inputs / compute aspect ratio correctly even after a rotate.
   */
  preprocessedWidth: number;
  preprocessedHeight: number;
}

/**
 * Pair the requested format with its option object. The options come from the UI
 * (each per-encoder panel binds the encoder's own option type), so the
 * discriminated-union cast is the SvelteKit adapter's single typing seam.
 */
function buildEncoderState(request: CompressRequest): EncoderState {
  // Only called after the identity branch returns, so `format` is a real
  // encoder here; cast through unknown since the param type is the wider union.
  return {
    type: request.format,
    options: request.options,
  } as unknown as EncoderState;
}

/**
 * Compress an already-decoded/preprocessed source. Caller owns `outputUrl` and
 * must revoke it when done.
 *
 * The caller also owns `bridge` and its lifecycle. The bridge runtime is built
 * to be long-lived — lazy worker start, idle-timeout reclaim, terminate-on-abort
 * with lazy restart — so passing a persistent per-side bridge means consecutive
 * passes reuse a warm worker (WASM already instantiated, pthread pool already
 * spawned) instead of paying full startup on every debounced option tweak.
 */
export async function compressPreprocessed(
  source: SourceImage,
  request: CompressRequest,
  signal: AbortSignal,
  bridge: SvelteKitWorkerBridge,
): Promise<CompressOutcome> {
  const pipelineBridge = bridge as unknown as ImagePipelineWorkerBridge;
  const { file, preprocessed } = source;

  // Original/identity side: no processing or encoding. Show the preprocessed
  // source on both before/after, and download the original file as-is.
  if (request.format === IDENTITY) {
    const outputUrl = URL.createObjectURL(file);
    return {
      outputFile: file,
      outputUrl,
      outputSize: file.size,
      originalSize: file.size,
      percentChange: 0,
      sourceImageData: preprocessed,
      outputImageData: preprocessed,
      isOriginal: true,
      preprocessedWidth: preprocessed.width,
      preprocessedHeight: preprocessed.height,
    };
  }

  const processed = await processImage(
    signal,
    source,
    request.processorState,
    pipelineBridge,
  );

  const outputFile = await imagePipeline.compressImage(
    signal,
    processed,
    buildEncoderState(request),
    file.name,
    pipelineBridge,
  );
  // Decode the output back to pixels so the editor can show the real codec
  // result (artifacts and all), the way Squoosh does. Same dimensions as the
  // processed source, so the two-up before/after view aligns.
  const outputImageData = await decodeImage(signal, outputFile, pipelineBridge);
  const outputUrl = URL.createObjectURL(outputFile);

  return {
    outputFile,
    outputUrl,
    outputSize: outputFile.size,
    originalSize: file.size,
    percentChange:
      Math.round(getPercentChange(file.size, outputFile.size) * 10) / 10,
    sourceImageData: processed,
    outputImageData,
    isOriginal: false,
    preprocessedWidth: preprocessed.width,
    preprocessedHeight: preprocessed.height,
  };
}

/**
 * Compress one file. Caller owns `outputUrl` and must revoke it when done.
 *
 * The caller also owns `bridge` and its lifecycle. The bridge runtime is built
 * to be long-lived — lazy worker start, idle-timeout reclaim, terminate-on-abort
 * with lazy restart — so passing a persistent per-side bridge means consecutive
 * passes reuse a warm worker (WASM already instantiated, pthread pool already
 * spawned) instead of paying full startup on every debounced option tweak.
 */
export async function compressFile(
  file: File,
  request: CompressRequest,
  signal: AbortSignal,
  bridge: SvelteKitWorkerBridge,
): Promise<CompressOutcome> {
  const pipelineBridge = bridge as unknown as ImagePipelineWorkerBridge;
  const decodedSource = await decodeSourceImage(signal, file, pipelineBridge);
  const preprocessed = await preprocessImage(
    signal,
    decodedSource.decoded,
    request.preprocessorState,
    pipelineBridge,
  );

  return compressPreprocessed(
    { ...decodedSource, preprocessed },
    request,
    signal,
    bridge,
  );
}
