// The Node proof of the headless boundary (docs/project/specs/
// 2026-11-04-worker-side-pipeline.md): the SAME pipeline core the browser's
// codec worker runs (prepareFrame, encodeFrame, and the same codec runtimes),
// driven inside a worker_thread over the committed `*_node_*` codec artifacts.
// tests/unit/node-pipeline.test.ts bundles this file and runs it. Nothing here
// ships; it keeps the core honest about needing no DOM.

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parentPort, workerData } from 'node:worker_threads';
import {
  encodeFrame,
  prepareFrame,
  type PipelineSteps,
} from '#client/lazy-app/pipeline-core.ts';
import { defaultProcessorState } from '#client/lazy-app/feature-meta/shared.ts';
import { createRotate } from '#features/preprocessors/rotate/worker/runtime.ts';
import { createResize } from '#features/processors/resize/worker/runtime.ts';
import { createWebpEncoderRuntime } from '#features/encoders/webP/worker/runtime.ts';
import { defaultOptions as webpDefaults } from '#features/encoders/webP/shared/meta.ts';

export interface ProofInput {
  /** Repository root, where codecs/ lives. */
  root: string;
  /** A JPEG to decode. */
  jpeg: string;
}

export interface ProofReply {
  decoded: { width: number; height: number };
  bytes: number;
  /** The container tags at bytes 0 to 3 and 8 to 11. */
  riff: [string, string];
  /** The WebP decoded back with webp_node_dec. */
  roundTrip: { width: number; height: number };
}

// What Node lacks and the codecs construct: a plain RGBA holder.
globalThis.ImageData ??= class ImageData {
  constructor(
    public data: Uint8ClampedArray,
    public width: number,
    public height: number,
  ) {}
} as unknown as typeof ImageData;

const { root, jpeg } = workerData as ProofInput;
const codec = (path: string) => join(root, 'codecs', path);

/**
 * An Emscripten Node factory that works from ESM. The older artifacts read
 * `require` and `__dirname` as free variables when the factory runs, and try
 * `fetch` for a file path; handing them the WASM bytes skips the fetch.
 */
async function nodeFactory<T>(path: string) {
  const factory = (await import(pathToFileURL(codec(path)).href)).default;
  const wasmBinary = await readFile(codec(path).replace(/\.js$/, '.wasm'));
  const globals = globalThis as Record<string, unknown>;
  return (options: object = {}): Promise<T> => {
    globals.require = createRequire(codec(path));
    globals.__dirname = dirname(codec(path));
    try {
      return factory({ ...options, wasmBinary, noInitialRun: true });
    } finally {
      delete globals.require;
      delete globals.__dirname;
    }
  };
}

interface Decoder {
  decode(data: BufferSource): ImageData | null;
}

const resizeGlue = await import(
  pathToFileURL(codec('resize/pkg/squoosh_resize.js')).href
);
const resizeBytes = await readFile(codec('resize/pkg/squoosh_resize_bg.wasm'));
const webpFactory = await nodeFactory('webp/enc/webp_node_enc.js');

const resize = createResize({
  initResizeWasm: () => resizeGlue.default({ module_or_path: resizeBytes }),
  initHqxWasm: () => Promise.reject(Error('hqx is not in the Node proof')),
  wasmResize: resizeGlue.resize,
  wasmHqx: () => {
    throw Error('hqx is not in the Node proof');
  },
});
const rotate = createRotate(() => readFile(codec('rotate/rotate.wasm')));
const encodeWebp = createWebpEncoderRuntime({
  detectSimd: async () => false,
  loadBaseline: async () => webpFactory as never,
  loadSimd: async () => webpFactory as never,
});

const steps: PipelineSteps = {
  rotate: (image, turn) => rotate(image, { rotate: turn }),
  resize: (image, options) => {
    if (options.method === 'browser-pixelated') {
      throw Error('Canvas resize is not in the Node proof');
    }
    return resize(image, options);
  },
  quantize: () => Promise.reject(Error('No Node imagequant build')),
  encode: (image, encoder) => {
    if (encoder.type !== 'webP')
      throw Error(`${encoder.type} is not in the proof`);
    return encodeWebp(image, encoder.options);
  },
};

const jpegDecoder = await (
  await nodeFactory<Decoder>('mozjpeg/dec/mozjpeg_node_dec.js')
)();
const webpDecoder = await (
  await nodeFactory<Decoder>('webp/dec/webp_node_dec.js')
)();

const decoded = jpegDecoder.decode(await readFile(jpeg));
if (!decoded) throw Error('mozjpeg could not decode the JPEG');

const prepared = await prepareFrame(decoded, 90, steps);
const processors = structuredClone(defaultProcessorState);
processors.resize = {
  ...processors.resize,
  enabled: true,
  method: 'lanczos3',
  fitMethod: 'stretch',
  width: 342,
  height: 512,
  premultiply: true,
  linearRGB: true,
};
processors.grain = { ...processors.grain, enabled: true, amount: 12 };
const bytes = await encodeFrame(
  prepared,
  processors,
  { type: 'webP', options: webpDefaults },
  steps,
);

const back = webpDecoder.decode(new Uint8Array(bytes));
const reply: ProofReply = {
  decoded: { width: decoded.width, height: decoded.height },
  bytes: bytes.byteLength,
  riff: [
    String.fromCharCode(...new Uint8Array(bytes, 0, 4)),
    String.fromCharCode(...new Uint8Array(bytes, 8, 4)),
  ],
  roundTrip: { width: back?.width ?? 0, height: back?.height ?? 0 },
};
parentPort!.postMessage(reply);
