import {
  builtinDecode,
  sniffMimeType,
} from '../../../../src/client/lazy-app/image-decode';
import {
  builtinResize,
  canvasEncode,
  type BuiltinResizeMethod,
} from '../../../../src/client/lazy-app/util/canvas';
import { getOutputFileName } from '../../../../src/client/lazy-app/output-filename';
import { getPercentChange } from '../../../../src/client/lazy-app/bulk/size';
import {
  getEffectiveSettings,
  settingsHash,
  type BulkImageSettings,
} from '../../../../src/client/lazy-app/bulk/settings';
import {
  defaultPreprocessorState,
  defaultProcessorState,
  encoderMap,
} from 'client/lazy-app/feature-meta';
import type { EncodeOptions } from 'features/encoders/webP/shared/meta';
import { webpPipelineProbeWorkerUrl } from './codec-assets';
import type {
  WebpPipelineEncodeRequest,
  WebpPipelineEncodeResult,
} from './webp-pipeline-probe.worker';

export interface WebpPipelineProbeResult {
  sourceFileName: string;
  sourceMimeType: string;
  sourceBytes: number;
  detectedSourceMimeType: string;
  decodedWidth: number;
  decodedHeight: number;
  processedWidth: number;
  processedHeight: number;
  outputFileName: string;
  outputMimeType: string;
  outputBytes: number;
  percentChange: number;
  settingsHash: string;
  riffHeader: string;
  webpSignature: string;
  stages: string[];
}

const sourceFileName = 'sveltekit-pipeline-source.png';

const pipelineSettings: BulkImageSettings = {
  encoderState: {
    type: 'webP',
    options: {
      ...encoderMap.webP.meta.defaultOptions,
      quality: 80,
      method: 4,
    },
  },
  processorState: {
    resize: {
      ...defaultProcessorState.resize,
      enabled: true,
      width: 3,
      height: 3,
      method: 'browser-high',
    },
    quantize: {
      ...defaultProcessorState.quantize,
      enabled: false,
    },
  },
};

function createSourceImageData(): ImageData {
  return new ImageData(
    new Uint8ClampedArray([
      236, 72, 153, 255, 59, 130, 246, 255, 16, 185, 129, 255, 250, 204, 21,
      255, 15, 23, 42, 255, 248, 250, 252, 255, 239, 68, 68, 255, 34, 197, 94,
      255, 14, 165, 233, 255, 168, 85, 247, 255, 245, 158, 11, 255, 255, 255,
      255, 255, 30, 41, 59, 255, 20, 184, 166, 255, 244, 63, 94, 255, 99, 102,
      241, 255,
    ]),
    4,
    4,
  );
}

async function createSourceFile(): Promise<File> {
  const blob = await canvasEncode(createSourceImageData(), 'image/png');
  return new File([blob], sourceFileName, {
    type: blob.type || 'image/png',
    lastModified: 1,
  });
}

function encodeWebpInWorker(
  imageData: ImageData,
  options: EncodeOptions,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(webpPipelineProbeWorkerUrl, { type: 'module' });

    worker.onmessage = (
      event: MessageEvent<WebpPipelineEncodeResult | { error: string }>,
    ) => {
      worker.terminate();
      if ('error' in event.data) {
        reject(new Error(event.data.error));
        return;
      }
      resolve(event.data.output);
    };

    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || 'WebP pipeline worker failed.'));
    };

    const request: WebpPipelineEncodeRequest = { imageData, options };
    worker.postMessage(request);
  });
}

export async function runWebpPipelineProbe(
  signal = new AbortController().signal,
): Promise<WebpPipelineProbeResult> {
  const sourceFile = await createSourceFile();
  const detectedSourceMimeType = await sniffMimeType(sourceFile);
  const decoded = await builtinDecode(signal, sourceFile);
  const effectiveSettings = getEffectiveSettings(pipelineSettings);
  const resize = effectiveSettings.processorState.resize;
  const resizeMethod = resize.method.startsWith('browser-')
    ? (resize.method.replace('browser-', '') as BuiltinResizeMethod)
    : undefined;
  const processed =
    resize.enabled && resizeMethod
      ? builtinResize(
          decoded,
          0,
          0,
          decoded.width,
          decoded.height,
          resize.width,
          resize.height,
          resizeMethod,
        )
      : decoded;
  const encoderState = effectiveSettings.encoderState;

  if (!encoderState || encoderState.type !== 'webP') {
    throw new Error('WebP pipeline probe requires WebP encoder settings.');
  }

  const outputBuffer = await encodeWebpInWorker(
    processed,
    encoderState.options as EncodeOptions,
  );
  const outputFile = new File(
    [outputBuffer],
    getOutputFileName(sourceFile.name, encoderMap.webP.meta.extension),
    { type: encoderMap.webP.meta.mimeType, lastModified: 2 },
  );
  const outputBytes = new Uint8Array(outputBuffer);
  const ascii = new TextDecoder('ascii');

  return {
    sourceFileName: sourceFile.name,
    sourceMimeType: sourceFile.type,
    sourceBytes: sourceFile.size,
    detectedSourceMimeType,
    decodedWidth: decoded.width,
    decodedHeight: decoded.height,
    processedWidth: processed.width,
    processedHeight: processed.height,
    outputFileName: outputFile.name,
    outputMimeType: outputFile.type,
    outputBytes: outputFile.size,
    percentChange:
      Math.round(getPercentChange(sourceFile.size, outputFile.size) * 10) / 10,
    settingsHash: settingsHash(effectiveSettings),
    riffHeader: ascii.decode(outputBytes.slice(0, 4)),
    webpSignature: ascii.decode(outputBytes.slice(8, 12)),
    stages: [
      'source generated locally with existing canvasEncode helper',
      'source type sniffed with existing sniffMimeType helper',
      'source decoded with existing builtinDecode helper',
      `preprocess inspected default rotate=${defaultPreprocessorState.rotate.rotate}; no worker rotation needed`,
      'resize processed with existing builtinResize helper',
      'encoded through existing WebP worker encode module in a SvelteKit worker',
      'export metadata built with existing filename, percent-change, and settings-hash helpers',
    ],
  };
}
