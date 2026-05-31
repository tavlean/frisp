// Single-image compression helper for the SvelteKit slice.
//
// Drives the SAME framework-neutral pipeline the bulk feature uses: decode ->
// preprocess -> resize -> `imagePipeline.compressImage`. compressImage dispatches
// on the encoder type through the generated encoder runtime map, so the
// single-image path and the bulk engine share one code path. Heavy work runs in
// the SvelteKit codec worker
// via SvelteKitWorkerBridge; browser encoders (GIF/JPEG/PNG) encode on the main
// thread through the same map. No per-format switch.

import {
  decodeImage,
  decodeSourceImage,
  imagePipeline,
  preprocessImage,
  processImage,
  type ImagePipelineWorkerBridge,
} from '../../../../src/client/lazy-app/image-pipeline';
import { getPercentChange } from '../../../../src/client/lazy-app/bulk/size';
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
 * Formats surfaced in the editor. Browser-native encoders are feature-detected
 * at runtime because canvas.toBlob support varies by browser.
 */
export const OUTPUT_FORMATS: {
  id: OutputFormat;
  label: string;
  ext: string;
}[] = [
  { id: 'webP', label: 'WebP', ext: encoderMap.webP.meta.extension },
  {
    id: 'wp2',
    label: encoderMap.wp2.meta.label,
    ext: encoderMap.wp2.meta.extension,
  },
  { id: 'avif', label: 'AVIF', ext: encoderMap.avif.meta.extension },
  // Use the engine's own label so it stays in sync (e.g. "JPEG XL (beta)").
  {
    id: 'jxl',
    label: encoderMap.jxl.meta.label,
    ext: encoderMap.jxl.meta.extension,
  },
  { id: 'mozJPEG', label: 'MozJPEG', ext: encoderMap.mozJPEG.meta.extension },
  { id: 'oxiPNG', label: 'OxiPNG', ext: encoderMap.oxiPNG.meta.extension },
  { id: 'qoi', label: 'QOI', ext: encoderMap.qoi.meta.extension },
  // Browser-native encoders (canvas-based, main thread). Offered like the
  // original; feature-detected at runtime via getSupportedFormatIds() since
  // canvas.toBlob support varies (notably GIF is usually unavailable).
  {
    id: 'browserJPEG',
    label: encoderMap.browserJPEG.meta.label,
    ext: encoderMap.browserJPEG.meta.extension,
  },
  {
    id: 'browserPNG',
    label: encoderMap.browserPNG.meta.label,
    ext: encoderMap.browserPNG.meta.extension,
  },
  {
    id: 'browserGIF',
    label: encoderMap.browserGIF.meta.label,
    ext: encoderMap.browserGIF.meta.extension,
  },
];

/** Canvas MIME types for the browser-native encoders (for feature detection). */
const BROWSER_ENCODER_MIME: Partial<Record<OutputFormat, string>> = {
  browserJPEG: 'image/jpeg',
  browserPNG: 'image/png',
  browserGIF: 'image/gif',
};

async function canvasSupportsMime(mime: string): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mime),
    );
    // Browsers that don't support the type fall back to PNG, so check the type.
    return !!blob && blob.type === mime;
  } catch {
    return false;
  }
}

/**
 * The encoders that actually work in this browser. WASM codecs are always
 * supported; the browser-native encoders are probed via canvas.toBlob (the
 * Svelte equivalent of Squoosh's getSupportedEncoderMap featureTest pass).
 */
export async function getSupportedFormatIds(): Promise<Set<OutputFormat>> {
  const ids = new Set<OutputFormat>();
  await Promise.all(
    OUTPUT_FORMATS.map(async ({ id }) => {
      const mime = BROWSER_ENCODER_MIME[id];
      if (!mime || (await canvasSupportsMime(mime))) ids.add(id);
    }),
  );
  return ids;
}

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
 * discriminated-union cast is the prototype adapter's single typing seam.
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
      request.preprocessorState,
      pipelineBridge,
    );

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
      { ...decodedSource, preprocessed },
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
    const outputImageData = await decodeImage(
      signal,
      outputFile,
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
      sourceImageData: processed,
      outputImageData,
      isOriginal: false,
      preprocessedWidth: preprocessed.width,
      preprocessedHeight: preprocessed.height,
    };
  } finally {
    bridge.dispose();
  }
}
