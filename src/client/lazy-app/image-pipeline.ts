import {
  blobToImg,
  blobToText,
  builtinDecode,
  sniffMimeType,
  canDecodeImageType,
} from './image-decode';
import type { ImageMimeTypes } from './image-decode';
import { abortable, assertSignal, isAbortError } from './abort';
import { parseSvgViewBoxSize } from './util/svg';
import type {
  PreprocessorState,
  ProcessorState,
  EncoderState,
} from './feature-meta/shared';
import { encoderMap } from './feature-meta/encoders';
import { resize } from 'features/processors/resize/client/runtime';
import { getOutputFileName } from './output-filename';
import { drawableToImageData } from './util/canvas';

export interface SourceImage {
  file: File;
  decoded: ImageData;
  preprocessed: ImageData;
  vectorImage?: HTMLImageElement;
}

export interface DecodedSourceImage {
  file: File;
  decoded: ImageData;
  vectorImage?: HTMLImageElement;
}

type ComlinkReturn<T> = Promise<T> | Promise<Promise<T>>;

export interface ImagePipelineWorkerBridge {
  avifDecode(signal: AbortSignal, blob: Blob): ComlinkReturn<ImageData>;
  webpDecode(signal: AbortSignal, blob: Blob): ComlinkReturn<ImageData>;
  jxlDecode(signal: AbortSignal, blob: Blob): ComlinkReturn<ImageData>;
  wp2Decode(signal: AbortSignal, blob: Blob): ComlinkReturn<ImageData>;
  qoiDecode(signal: AbortSignal, blob: Blob): ComlinkReturn<ImageData>;
  rotate(
    signal: AbortSignal,
    data: ImageData,
    options: PreprocessorState['rotate'],
  ): ComlinkReturn<ImageData>;
  resize: Parameters<typeof resize>[3]['resize'];
  quantize(
    signal: AbortSignal,
    data: ImageData,
    options: ProcessorState['quantize'],
  ): ComlinkReturn<ImageData>;
  avifEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: Extract<EncoderState, { type: 'avif' }>['options'],
  ): ComlinkReturn<ArrayBuffer>;
  jxlEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: Extract<EncoderState, { type: 'jxl' }>['options'],
  ): ComlinkReturn<ArrayBuffer>;
  mozjpegEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: Extract<EncoderState, { type: 'mozJPEG' }>['options'],
  ): ComlinkReturn<ArrayBuffer>;
  oxipngEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: Extract<EncoderState, { type: 'oxiPNG' }>['options'],
  ): ComlinkReturn<ArrayBuffer>;
  qoiEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: Extract<EncoderState, { type: 'qoi' }>['options'],
  ): ComlinkReturn<ArrayBuffer>;
  webpEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: Extract<EncoderState, { type: 'webP' }>['options'],
  ): ComlinkReturn<ArrayBuffer>;
  wp2Encode(
    signal: AbortSignal,
    imageData: ImageData,
    options: Extract<EncoderState, { type: 'wp2' }>['options'],
  ): ComlinkReturn<ArrayBuffer>;
}

export interface ImagePipelineEncoder<WorkerBridgeType, Options> {
  meta: {
    extension: string;
    mimeType: ImageMimeTypes;
  };
  encode(
    signal: AbortSignal,
    workerBridge: WorkerBridgeType,
    imageData: ImageData,
    options: Options,
  ): Promise<Blob | ArrayBuffer>;
}

export async function decodeImage(
  signal: AbortSignal,
  blob: Blob,
  workerBridge: ImagePipelineWorkerBridge,
): Promise<ImageData> {
  assertSignal(signal);
  const mimeType = await abortable(signal, sniffMimeType(blob));
  const canDecode = await abortable(signal, canDecodeImageType(mimeType));

  try {
    if (!canDecode) {
      if (mimeType === 'image/avif') {
        return await workerBridge.avifDecode(signal, blob);
      }
      if (mimeType === 'image/webp') {
        return await workerBridge.webpDecode(signal, blob);
      }
      if (mimeType === 'image/jxl') {
        return await workerBridge.jxlDecode(signal, blob);
      }
      if (mimeType === 'image/webp2') {
        return await workerBridge.wp2Decode(signal, blob);
      }
      if (mimeType === 'image/qoi') {
        return await workerBridge.qoiDecode(signal, blob);
      }
    }
    // Otherwise fall through and try built-in decoding for a laugh.
    return await builtinDecode(signal, blob);
  } catch (err) {
    if (isAbortError(err)) throw err;
    const error = Error("Couldn't decode image");
    if (err instanceof Error) {
      try {
        Object.defineProperty(error, 'cause', {
          value: err,
          configurable: true,
        });
      } catch {
        // Older browsers may not allow adding a cause. The user-facing error is still useful.
      }
    }
    throw error;
  }
}

export async function decodeSourceImage(
  signal: AbortSignal,
  file: File,
  workerBridge: ImagePipelineWorkerBridge,
): Promise<DecodedSourceImage> {
  assertSignal(signal);

  // Special-case SVG. We need to avoid createImageBitmap because of
  // https://bugs.chromium.org/p/chromium/issues/detail?id=606319.
  // Also, we cache the HTMLImageElement so vector resizing can use it later.
  if (file.type.startsWith('image/svg+xml')) {
    const vectorImage = await processSvg(signal, file);
    return {
      file,
      vectorImage,
      decoded: drawableToImageData(vectorImage),
    };
  }

  return {
    file,
    decoded: await decodeImage(signal, file, workerBridge),
  };
}

export async function preprocessImage(
  signal: AbortSignal,
  data: ImageData,
  preprocessorState: PreprocessorState,
  workerBridge: ImagePipelineWorkerBridge,
): Promise<ImageData> {
  assertSignal(signal);
  let processedData = data;

  if (preprocessorState.rotate.rotate !== 0) {
    processedData = await workerBridge.rotate(
      signal,
      processedData,
      preprocessorState.rotate,
    );
  }

  return processedData;
}

export async function processImage(
  signal: AbortSignal,
  source: SourceImage,
  processorState: ProcessorState,
  workerBridge: ImagePipelineWorkerBridge,
): Promise<ImageData> {
  assertSignal(signal);
  let result = source.preprocessed;

  if (processorState.resize.enabled) {
    result = await resize(signal, source, processorState.resize, workerBridge);
  }
  if (processorState.quantize.enabled) {
    result = await workerBridge.quantize(
      signal,
      result,
      processorState.quantize,
    );
  }
  return result;
}

export async function compressImage(
  signal: AbortSignal,
  image: ImageData,
  encodeData: EncoderState,
  sourceFilename: string,
  workerBridge: ImagePipelineWorkerBridge,
): Promise<File> {
  assertSignal(signal);

  const encoder = encoderMap[encodeData.type];
  let compressedData: Blob | ArrayBuffer;

  switch (encodeData.type) {
    case 'avif':
      compressedData = await encoderMap.avif.encode(
        signal,
        workerBridge,
        image,
        encodeData.options,
      );
      break;
    case 'browserGIF':
      compressedData = await encoderMap.browserGIF.encode(
        signal,
        workerBridge,
        image,
        encodeData.options,
      );
      break;
    case 'browserJPEG':
      compressedData = await encoderMap.browserJPEG.encode(
        signal,
        workerBridge,
        image,
        encodeData.options,
      );
      break;
    case 'browserPNG':
      compressedData = await encoderMap.browserPNG.encode(
        signal,
        workerBridge,
        image,
        encodeData.options,
      );
      break;
    case 'jxl':
      compressedData = await encoderMap.jxl.encode(
        signal,
        workerBridge,
        image,
        encodeData.options,
      );
      break;
    case 'mozJPEG':
      compressedData = await encoderMap.mozJPEG.encode(
        signal,
        workerBridge,
        image,
        encodeData.options,
      );
      break;
    case 'oxiPNG':
      compressedData = await encoderMap.oxiPNG.encode(
        signal,
        workerBridge,
        image,
        encodeData.options,
      );
      break;
    case 'qoi':
      compressedData = await encoderMap.qoi.encode(
        signal,
        workerBridge,
        image,
        encodeData.options,
      );
      break;
    case 'webP':
      compressedData = await encoderMap.webP.encode(
        signal,
        workerBridge,
        image,
        encodeData.options,
      );
      break;
    case 'wp2':
      compressedData = await encoderMap.wp2.encode(
        signal,
        workerBridge,
        image,
        encodeData.options,
      );
      break;
  }

  // This type ensures the image mimetype is consistent with our mimetype sniffer
  const type: ImageMimeTypes = encoder.meta.mimeType;

  return new File(
    [compressedData],
    getOutputFileName(sourceFilename, encoder.meta.extension),
    { type },
  );
}

export async function compressImageWithEncoder<WorkerBridgeType, Options>(
  signal: AbortSignal,
  image: ImageData,
  options: Options,
  sourceFilename: string,
  workerBridge: WorkerBridgeType,
  encoder: ImagePipelineEncoder<WorkerBridgeType, Options>,
): Promise<File> {
  assertSignal(signal);

  const compressedData = await encoder.encode(
    signal,
    workerBridge,
    image,
    options,
  );

  return new File(
    [compressedData],
    getOutputFileName(sourceFilename, encoder.meta.extension),
    { type: encoder.meta.mimeType },
  );
}

export async function processSvg(
  signal: AbortSignal,
  blob: Blob,
): Promise<HTMLImageElement> {
  assertSignal(signal);
  // Firefox throws if you try to draw an SVG to canvas that doesn't have width/height.
  // In Chrome it loads, but drawImage behaves weirdly.
  // This function sets width/height if it isn't already set.
  const parser = new DOMParser();
  const text = await abortable(signal, blobToText(blob));
  const document = parser.parseFromString(text, 'image/svg+xml');
  const svg = document.documentElement!;

  if (svg.hasAttribute('width') && svg.hasAttribute('height')) {
    return blobToImg(blob);
  }

  const viewBox = svg.getAttribute('viewBox');
  if (viewBox === null) throw Error('SVG must have width/height or viewBox');

  const viewBoxSize = parseSvgViewBoxSize(viewBox);
  if (!viewBoxSize) throw Error('Invalid SVG viewBox');
  svg.setAttribute('width', viewBoxSize.width);
  svg.setAttribute('height', viewBoxSize.height);

  const serializer = new XMLSerializer();
  const newSource = serializer.serializeToString(document);
  return abortable(
    signal,
    blobToImg(new Blob([newSource], { type: 'image/svg+xml' })),
  );
}
