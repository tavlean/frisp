// The codec worker's image operations: one call takes a source and a recipe
// and returns encoded bytes (plus, when asked, the output decoded back for the
// compare view). Before this, every processor step was its own worker round
// trip with a full-frame structured clone each way, and the output was
// decoded again on the main thread.
//
// Memory model: one cached source per worker, the decoded frame plus at most
// one rotation of it, keyed by the caller's source key. A different key
// replaces it, so a worker never holds more than two source frames. The cache
// lives exactly as long as the worker: the bridge terminates the worker on
// abort and after 60 s idle, and the next call decodes again (a file source)
// or answers `needs-source` (a pixel source the main thread must resend).
//
// Ownership: the cached frames are never transferred and never written to
// (PipelineSteps promises the latter). Everything a reply carries is fresh and
// listed by replyTransfers, so the caller receives it without a copy.
//
// Codec-neutral: codec-worker.ts supplies the host, tests supply a fake.

import { chooseLane, type LaneFile } from 'client/lazy-app/lane';
import { sniffMimeType } from 'client/lazy-app/image-decode';
import {
  encodeFrame,
  prepareFrame,
  type PipelineSteps,
} from 'client/lazy-app/pipeline-core';
import type { ImageRecipe, Rotation } from 'client/lazy-app/recipe';

/** A source as the worker receives it. A File crosses by reference (no byte
 *  copy) and is decoded here; pixels (an SVG rasterized on the main thread)
 *  arrive transferred and become the cache. */
export type WorkerSource =
  | { kind: 'file'; file: File }
  | { kind: 'pixels'; image: ImageData };

export interface OptimizeRequest {
  /** Identity of the decoded source; see src/lib/source-key.ts. */
  key: string;
  /** What lane choice reads from the source file. */
  file: LaneFile;
  /** Always sent for a file source; for pixels only after `needs-source`. */
  source?: WorkerSource;
  /** A raster recipe. The SVG lane never reaches the worker. */
  recipe: ImageRecipe;
  /** Decode the output back for the compare view. */
  preview: boolean;
}

export type OptimizeReply =
  | { kind: 'needs-source' }
  | {
      kind: 'encoded';
      bytes: ArrayBuffer;
      preview?: ImageData;
      /** The unrotated decoded size. */
      decodedWidth: number;
      decodedHeight: number;
      /** The size after rotation, before resize. */
      preparedWidth: number;
      preparedHeight: number;
      /** libjxl refused the lossless transcode; this is a pixel encode. */
      transcodeFellBack: boolean;
    };

export interface PrepareRequest {
  source: WorkerSource;
  rotate: Rotation;
}

export interface PrepareReply {
  /** The rotated frame. Fresh, and the caller's. */
  image: ImageData;
  decodedWidth: number;
  decodedHeight: number;
}

type WasmDecodedType = 'image/avif' | 'image/webp' | 'image/jxl' | 'image/qoi';

export interface CodecHost {
  steps: PipelineSteps;
  /** Decode with the browser (createImageBitmap plus OffscreenCanvas). */
  nativeDecode(blob: Blob): Promise<ImageData>;
  /** WASM decoders for formats a browser may not decode natively. */
  wasmDecode: Record<WasmDecodedType, (blob: Blob) => Promise<ImageData>>;
  /** Repack a JPEG's coefficients as JXL; null when libjxl refuses it. */
  transcodeJpeg(jpeg: ArrayBuffer): Promise<ArrayBuffer | null>;
}

/** Everything a reply hands over, for Comlink's transfer list. */
export function replyTransfers(
  reply: OptimizeReply | PrepareReply | ImageData,
): Transferable[] {
  if ('kind' in reply) {
    if (reply.kind === 'needs-source') return [];
    return reply.preview
      ? [reply.bytes, reply.preview.data.buffer]
      : [reply.bytes];
  }
  return 'image' in reply ? [reply.image.data.buffer] : [reply.data.buffer];
}

function decodeError(cause: unknown): Error {
  const error = Error("Couldn't decode image");
  Object.defineProperty(error, 'cause', { value: cause, configurable: true });
  return error;
}

export function createPipelineOps(host: CodecHost) {
  let cache: {
    key: string;
    decoded: ImageData;
    rotated?: { rotate: Rotation; image: ImageData };
  } | null = null;

  /** Native first; the WASM decoder when the browser cannot (JXL in
   *  Chromium, say). QOI has no native decoder anywhere. */
  async function decode(blob: Blob): Promise<ImageData> {
    try {
      const type = await sniffMimeType(blob);
      const wasm =
        type in host.wasmDecode
          ? host.wasmDecode[type as WasmDecodedType]
          : undefined;
      if (type === 'image/qoi') return await wasm!(blob);
      try {
        return await host.nativeDecode(blob);
      } catch (error) {
        if (wasm) return await wasm(blob);
        throw error;
      }
    } catch (error) {
      throw decodeError(error);
    }
  }

  async function frameFor(source: WorkerSource): Promise<ImageData> {
    return source.kind === 'file' ? decode(source.file) : source.image;
  }

  async function cachedSource(
    key: string,
    source: WorkerSource | undefined,
  ): Promise<ImageData | null> {
    if (cache?.key === key) return cache.decoded;
    if (!source) return null;
    // Drop the old frames before decoding, so peak memory is one source.
    cache = null;
    const decoded = await frameFor(source);
    cache = { key, decoded };
    return decoded;
  }

  async function cachedPrepared(rotate: Rotation): Promise<ImageData> {
    const entry = cache!;
    if (rotate === 0) return entry.decoded;
    if (entry.rotated?.rotate !== rotate) {
      entry.rotated = {
        rotate,
        image: await prepareFrame(entry.decoded, rotate, host.steps),
      };
    }
    return entry.rotated.image;
  }

  return {
    async optimize(request: OptimizeRequest): Promise<OptimizeReply> {
      const { recipe } = request;
      if (recipe.output.kind !== 'raster') {
        throw Error('The SVG lane runs on the main thread.');
      }
      const decoded = await cachedSource(request.key, request.source);
      if (!decoded) return { kind: 'needs-source' };
      const { width, height } = decoded;
      const quarter = recipe.rotate % 180 !== 0;

      let bytes: ArrayBuffer | null = null;
      let transcodeFellBack = false;
      if (
        chooseLane(request.file, recipe, { width, height }) === 'transcode' &&
        request.source?.kind === 'file'
      ) {
        bytes = await host.transcodeJpeg(
          await request.source.file.arrayBuffer(),
        );
        transcodeFellBack = bytes === null;
      }
      bytes ??= await encodeFrame(
        await cachedPrepared(recipe.rotate),
        recipe.processors,
        recipe.output.encoder,
        host.steps,
      );

      return {
        kind: 'encoded',
        bytes,
        // A Blob copies its bytes, so `bytes` stays free to transfer.
        preview: request.preview ? await decode(new Blob([bytes])) : undefined,
        decodedWidth: width,
        decodedHeight: height,
        preparedWidth: quarter ? height : width,
        preparedHeight: quarter ? width : height,
        transcodeFellBack,
      };
    },

    /** The rotated source for a main-thread view. Bypasses the cache: the
     *  frame is the caller's, so it is transferred rather than copied. */
    async prepare({ source, rotate }: PrepareRequest): Promise<PrepareReply> {
      const decoded = await frameFor(source);
      const image = await prepareFrame(decoded, rotate, host.steps);
      return {
        image,
        decodedWidth: decoded.width,
        decodedHeight: decoded.height,
      };
    },

    /** An encoded file decoded for display (an adopted bulk output). */
    decodeOutput(blob: Blob): Promise<ImageData> {
      return decode(blob);
    },
  };
}
