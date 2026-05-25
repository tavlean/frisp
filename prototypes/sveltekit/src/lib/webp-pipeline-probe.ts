import { sniffMimeType } from '../../../../src/client/lazy-app/image-decode';
import { canvasEncode } from '../../../../src/client/lazy-app/util/canvas';
import { getPercentChange } from '../../../../src/client/lazy-app/bulk/size';
import {
  getEffectiveSettings,
  settingsHash,
  type BulkImageSettings,
} from '../../../../src/client/lazy-app/bulk/settings';
import {
  compressImageWithEncoder,
  decodeSourceImage,
  type DecodeWorkerBridge,
  preprocessImage,
  type PreprocessWorkerBridge,
  processImage,
  type ProcessWorkerBridge,
} from '../../../../src/client/lazy-app/image-pipeline-shared';
import { encode as encodeWebP } from '../../../../src/features/encoders/webP/client/runtime';
import * as webpMeta from 'features/encoders/webP/shared/meta';
import {
  defaultPreprocessorState,
  defaultProcessorState,
  encoderMap,
} from 'client/lazy-app/feature-meta';
import type { EncodeOptions } from 'features/encoders/webP/shared/meta';
import SvelteKitWorkerBridge from './sveltekit-worker-bridge';

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
  qoiOutputBytes: number;
  qoiSignature: string;
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

const pipelinePreprocessorState = {
  ...defaultPreprocessorState,
  rotate: { rotate: 90 as const },
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

export async function runWebpPipelineProbe(
  signal = new AbortController().signal,
): Promise<WebpPipelineProbeResult> {
  const sourceFile = await createSourceFile();
  const detectedSourceMimeType = await sniffMimeType(sourceFile);
  const effectiveSettings = getEffectiveSettings(pipelineSettings);
  const encoderState = effectiveSettings.encoderState;

  if (!encoderState || encoderState.type !== 'webP') {
    throw new Error('WebP pipeline probe requires WebP encoder settings.');
  }

  const workerBridge = new SvelteKitWorkerBridge();
  const pipelineWorkerBridge = workerBridge as unknown as DecodeWorkerBridge &
    PreprocessWorkerBridge &
    ProcessWorkerBridge;
  const decodedSource = await decodeSourceImage(
    signal,
    sourceFile,
    pipelineWorkerBridge,
  );
  const preprocessed = await preprocessImage(
    signal,
    decodedSource.decoded,
    pipelinePreprocessorState,
    pipelineWorkerBridge,
  );
  const source = { ...decodedSource, preprocessed };
  const processed = await processImage(
    signal,
    source,
    effectiveSettings.processorState,
    pipelineWorkerBridge,
  );
  let outputFile: File;
  let qoiOutput: ArrayBuffer;
  try {
    outputFile = await compressImageWithEncoder(
      signal,
      processed,
      encoderState.options as EncodeOptions,
      sourceFile.name,
      workerBridge,
      { meta: webpMeta, encode: encodeWebP },
    );
    qoiOutput = await workerBridge.qoiEncode(signal, processed, {});
  } finally {
    workerBridge.dispose();
  }
  const outputBuffer = await outputFile.arrayBuffer();
  const outputBytes = new Uint8Array(outputBuffer);
  const qoiOutputBytes = new Uint8Array(qoiOutput);
  const ascii = new TextDecoder('ascii');

  return {
    sourceFileName: sourceFile.name,
    sourceMimeType: sourceFile.type,
    sourceBytes: sourceFile.size,
    detectedSourceMimeType,
    decodedWidth: decodedSource.decoded.width,
    decodedHeight: decodedSource.decoded.height,
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
    qoiOutputBytes: qoiOutput.byteLength,
    qoiSignature: ascii.decode(qoiOutputBytes.slice(0, 4)),
    stages: [
      'source generated locally with existing canvasEncode helper',
      'source type sniffed with existing sniffMimeType helper',
      'source decoded through existing image-pipeline decodeSourceImage helper',
      `preprocess ran through existing image-pipeline preprocessImage helper with rotate=${pipelinePreprocessorState.rotate.rotate}`,
      'resize processed through existing image-pipeline processImage helper',
      'encoded through image-pipeline compressImageWithEncoder using the shared WebP runtime and generated SvelteKit features-worker bridge',
      `qoiEncode promoted through the same generated worker surface (${
        qoiOutput.byteLength
      } bytes, ${ascii.decode(qoiOutputBytes.slice(0, 4))})`,
      'export metadata built with existing filename, percent-change, and settings-hash helpers',
    ],
  };
}
