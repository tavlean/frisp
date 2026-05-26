import { sniffMimeType } from '../../../../src/client/lazy-app/image-decode';
import { canvasEncode } from '../../../../src/client/lazy-app/util/canvas';
import { getPercentChange } from '../../../../src/client/lazy-app/bulk/size';
import { processBulkImageJob } from '../../../../src/client/lazy-app/bulk/processor';
import {
  getEffectiveSettings,
  settingsHash,
  type BulkImageSettings,
} from '../../../../src/client/lazy-app/bulk/settings';
import { createImageJob } from '../../../../src/client/lazy-app/bulk/session';
import tinyAvifUrl from 'sw/tiny.avif?url';
import {
  compressImage,
  decodeSourceImage,
  type ImagePipelineWorkerBridge,
  preprocessImage,
  processImage,
} from '../../../../src/client/lazy-app/image-pipeline';
import * as avifMeta from 'features/encoders/avif/shared/meta';
import * as jxlMeta from 'features/encoders/jxl/shared/meta';
import * as mozjpegMeta from 'features/encoders/mozJPEG/shared/meta';
import * as oxipngMeta from 'features/encoders/oxiPNG/shared/meta';
import {
  defaultPreprocessorState,
  defaultProcessorState,
  encoderMap,
} from 'client/lazy-app/feature-meta';
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
  webpDecodedWidth: number;
  webpDecodedHeight: number;
  avifOutputBytes: number;
  avifSignature: string;
  avifRoundTripWidth: number;
  avifRoundTripHeight: number;
  avifDecodedWidth: number;
  avifDecodedHeight: number;
  qoiOutputBytes: number;
  qoiSignature: string;
  qoiDecodedWidth: number;
  qoiDecodedHeight: number;
  jxlOutputBytes: number;
  jxlSignature: string;
  jxlDecodedWidth: number;
  jxlDecodedHeight: number;
  jpegOutputBytes: number;
  jpegSignature: string;
  oxipngOutputBytes: number;
  oxipngSignature: string;
  quantizedWidth: number;
  quantizedHeight: number;
  quantizedUniqueColors: number;
  workerResizedWidth: number;
  workerResizedHeight: number;
  bulkOutputFileName: string;
  bulkOutputMimeType: string;
  bulkOutputBytes: number;
  bulkDownloadUrl: string;
  bulkPercentChange: number;
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

function countUniqueColors(imageData: ImageData): number {
  const colors = new Set<string>();

  for (let index = 0; index < imageData.data.length; index += 4) {
    colors.add(
      `${imageData.data[index]},${imageData.data[index + 1]},${
        imageData.data[index + 2]
      },${imageData.data[index + 3]}`,
    );
  }

  return colors.size;
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
  const pipelineWorkerBridge =
    workerBridge as unknown as ImagePipelineWorkerBridge;
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
  let webpDecoded: ImageData;
  let avifOutput: ArrayBuffer;
  let avifRoundTrip: ImageData;
  let avifDecoded: ImageData;
  let qoiOutput: ArrayBuffer;
  let qoiDecoded: ImageData;
  let jxlOutput: ArrayBuffer;
  let jxlDecoded: ImageData;
  let jpegOutput: ArrayBuffer;
  let oxipngOutput: ArrayBuffer;
  let quantized: ImageData;
  let workerResized: ImageData;
  let bulkOutput: Awaited<ReturnType<typeof processBulkImageJob>>;
  try {
    outputFile = await compressImage(
      signal,
      processed,
      encoderState,
      sourceFile.name,
      workerBridge as unknown as Parameters<typeof compressImage>[4],
    );
    webpDecoded = await workerBridge.webpDecode(signal, outputFile);
    avifOutput = await workerBridge.avifEncode(signal, processed, {
      ...avifMeta.defaultOptions,
      quality: 45,
      speed: 8,
    });
    avifRoundTrip = await workerBridge.avifDecode(
      signal,
      new Blob([avifOutput], { type: 'image/avif' }),
    );
    avifDecoded = await workerBridge.avifDecode(
      signal,
      await fetch(tinyAvifUrl).then((response) => response.blob()),
    );
    qoiOutput = await workerBridge.qoiEncode(signal, processed, {});
    qoiDecoded = await workerBridge.qoiDecode(
      signal,
      new Blob([qoiOutput], { type: 'image/qoi' }),
    );
    jxlOutput = await workerBridge.jxlEncode(signal, processed, {
      ...jxlMeta.defaultOptions,
      quality: 45,
      effort: 3,
    });
    jxlDecoded = await workerBridge.jxlDecode(
      signal,
      new Blob([jxlOutput], { type: 'image/jxl' }),
    );
    jpegOutput = await workerBridge.mozjpegEncode(signal, processed, {
      ...mozjpegMeta.defaultOptions,
      quality: 72,
    });
    oxipngOutput = await workerBridge.oxipngEncode(
      signal,
      processed,
      oxipngMeta.defaultOptions,
    );
    quantized = await workerBridge.quantize(signal, processed, {
      zx: 0,
      maxNumColors: 4,
      dither: 0,
    });
    workerResized = await workerBridge.resize(signal, processed, {
      width: 2,
      height: 2,
      fitMethod: 'stretch',
      method: 'lanczos3',
      premultiply: true,
      linearRGB: true,
    });
    bulkOutput = await processBulkImageJob({
      job: createImageJob('sveltekit-bulk-pipeline-source', sourceFile),
      globalSettings: pipelineSettings,
      workerBridge: pipelineWorkerBridge,
      signal,
      preprocessorState: pipelinePreprocessorState,
      createDownloadUrl: (file) => `prototype://${file.name}`,
    });
  } finally {
    workerBridge.dispose();
  }
  const outputBuffer = await outputFile.arrayBuffer();
  const outputBytes = new Uint8Array(outputBuffer);
  const avifOutputBytes = new Uint8Array(avifOutput);
  const qoiOutputBytes = new Uint8Array(qoiOutput);
  const jxlOutputBytes = new Uint8Array(jxlOutput);
  const jpegOutputBytes = new Uint8Array(jpegOutput);
  const oxipngOutputBytes = new Uint8Array(oxipngOutput);
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
    webpDecodedWidth: webpDecoded.width,
    webpDecodedHeight: webpDecoded.height,
    avifOutputBytes: avifOutput.byteLength,
    avifSignature: ascii.decode(avifOutputBytes.slice(4, 8)),
    avifRoundTripWidth: avifRoundTrip.width,
    avifRoundTripHeight: avifRoundTrip.height,
    avifDecodedWidth: avifDecoded.width,
    avifDecodedHeight: avifDecoded.height,
    qoiOutputBytes: qoiOutput.byteLength,
    qoiSignature: ascii.decode(qoiOutputBytes.slice(0, 4)),
    qoiDecodedWidth: qoiDecoded.width,
    qoiDecodedHeight: qoiDecoded.height,
    jxlOutputBytes: jxlOutput.byteLength,
    jxlSignature: Array.from(jxlOutputBytes.slice(0, 4), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join(' '),
    jxlDecodedWidth: jxlDecoded.width,
    jxlDecodedHeight: jxlDecoded.height,
    jpegOutputBytes: jpegOutput.byteLength,
    jpegSignature: Array.from(jpegOutputBytes.slice(0, 3), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join(' '),
    oxipngOutputBytes: oxipngOutput.byteLength,
    oxipngSignature: Array.from(oxipngOutputBytes.slice(0, 4), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join(' '),
    quantizedWidth: quantized.width,
    quantizedHeight: quantized.height,
    quantizedUniqueColors: countUniqueColors(quantized),
    workerResizedWidth: workerResized.width,
    workerResizedHeight: workerResized.height,
    bulkOutputFileName: bulkOutput.file.name,
    bulkOutputMimeType: bulkOutput.file.type,
    bulkOutputBytes: bulkOutput.file.size,
    bulkDownloadUrl: bulkOutput.downloadUrl,
    bulkPercentChange: Math.round(bulkOutput.percentChange * 10) / 10,
    stages: [
      'source generated locally with existing canvasEncode helper',
      'source type sniffed with existing sniffMimeType helper',
      'source decoded through existing image-pipeline decodeSourceImage helper',
      `preprocess ran through existing image-pipeline preprocessImage helper with rotate=${pipelinePreprocessorState.rotate.rotate}`,
      'resize processed through existing image-pipeline processImage helper',
      'encoded through the production image-pipeline compressImage helper using the generated encode-only runtime metadata map and SvelteKit features-worker bridge',
      `webpDecode promoted through the same generated worker surface (${webpDecoded.width} x ${webpDecoded.height})`,
      `avifEncode promoted through a forced single-thread generated worker surface (${
        avifOutput.byteLength
      } bytes, ${ascii.decode(avifOutputBytes.slice(4, 8))})`,
      `avifEncode round trip decoded through avifDecode (${avifRoundTrip.width} x ${avifRoundTrip.height})`,
      `avifDecode promoted through the same generated worker surface (${avifDecoded.width} x ${avifDecoded.height})`,
      `qoiEncode promoted through the same generated worker surface (${
        qoiOutput.byteLength
      } bytes, ${ascii.decode(qoiOutputBytes.slice(0, 4))})`,
      `qoiDecode promoted through the same generated worker surface (${qoiDecoded.width} x ${qoiDecoded.height})`,
      `jxlEncode promoted through a forced single-thread generated worker surface (${
        jxlOutput.byteLength
      } bytes, ${Array.from(jxlOutputBytes.slice(0, 4), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join(' ')})`,
      `jxlDecode promoted through the same generated worker surface (${jxlDecoded.width} x ${jxlDecoded.height})`,
      `mozjpegEncode promoted through the same generated worker surface (${
        jpegOutput.byteLength
      } bytes, ${Array.from(jpegOutputBytes.slice(0, 3), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join(' ')})`,
      `oxipngEncode promoted through the same generated worker surface (${
        oxipngOutput.byteLength
      } bytes, ${Array.from(oxipngOutputBytes.slice(0, 4), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join(' ')})`,
      `quantize promoted through the same generated worker surface (${
        quantized.width
      } x ${quantized.height}, ${countUniqueColors(quantized)} colors)`,
      `worker resize promoted through the same generated worker surface (${workerResized.width} x ${workerResized.height})`,
      `production processBulkImageJob imported and completed (${bulkOutput.file.name}, ${bulkOutput.file.size} bytes)`,
      'export metadata built with existing filename, percent-change, and settings-hash helpers',
    ],
  };
}
