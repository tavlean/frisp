import type {
  default as initResizeWasm,
  resize as wasmResize,
} from '#codecs/resize/pkg/squoosh_resize.js';
import type {
  default as initHqxWasm,
  resize as wasmHqx,
} from '#codecs/hqx/pkg/squooshhqx.js';
import type { WorkerResizeOptions } from '../shared/meta';
import { getContainOffsets } from '../shared/util';

type InitResizeWasm = typeof initResizeWasm;
type WasmResize = typeof wasmResize;
type InitHqxWasm = typeof initHqxWasm;
type WasmHqx = typeof wasmHqx;

interface HqxResizeOptions extends WorkerResizeOptions {
  method: 'hqx';
}

function optsIsHqxOpts(opts: WorkerResizeOptions): opts is HqxResizeOptions {
  return opts.method === 'hqx';
}

// Copies the kept rows into a new buffer: the input may be the codec
// worker's cached source frame, which a later call reads again. (An in-place
// copyWithin here once corrupted that frame for every following resize.)
function crop(
  data: ImageData,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
): ImageData {
  const input = new Uint32Array(
    data.data.buffer,
    data.data.byteOffset,
    data.width * data.height,
  );
  const output = new Uint32Array(sw * sh);
  for (let y = 0; y < sh; y += 1) {
    const start = (y + sy) * data.width + sx;
    output.set(input.subarray(start, start + sw), y * sw);
  }
  return new ImageData(new Uint8ClampedArray(output.buffer), sw, sh);
}

interface ClampOpts {
  min?: number;
  max?: number;
}

function clamp(
  num: number,
  { min = Number.MIN_VALUE, max = Number.MAX_VALUE }: ClampOpts,
): number {
  return Math.min(Math.max(num, min), max);
}

// Positional map: the array index IS the filter id passed to the WASM `resize`
// crate (Type::Triangle=0, Catrom=1, Mitchell=2, Lanczos3=3). The ORDER is an
// ABI contract with the Rust enum — do NOT reorder, and do NOT replace this with
// shared/meta's `workerResizeMethods` (that list also contains `hqx`, which is
// not a crate filter: hqx is handled separately above and rewritten to `catrom`
// before it reaches here).
const resizeMethods: WorkerResizeOptions['method'][] = [
  'triangle',
  'catrom',
  'mitchell',
  'lanczos3',
];

export interface ResizeWasmUrls {
  hqx?: string;
  resize?: string;
}

export interface ResizeRuntime {
  initHqxWasm: InitHqxWasm;
  initResizeWasm: InitResizeWasm;
  wasmHqx: WasmHqx;
  wasmResize: WasmResize;
}

export function createResize({
  initHqxWasm,
  initResizeWasm,
  wasmHqx,
  wasmResize,
}: ResizeRuntime) {
  let resizeWasmReady: Promise<unknown>;
  let hqxWasmReady: Promise<unknown>;

  async function hqx(
    input: ImageData,
    opts: HqxResizeOptions,
    wasmUrls?: ResizeWasmUrls,
  ): Promise<ImageData> {
    if (!hqxWasmReady) {
      hqxWasmReady = initHqxWasm(wasmUrls?.hqx);
    }

    await hqxWasmReady;

    const widthRatio = opts.width / input.width;
    const heightRatio = opts.height / input.height;
    const ratio = Math.max(widthRatio, heightRatio);
    const factor = clamp(Math.ceil(ratio), { min: 1, max: 4 }) as 1 | 2 | 3 | 4;

    if (factor === 1) return input;

    const result = wasmHqx(
      new Uint32Array(input.data.buffer),
      input.width,
      input.height,
      factor,
    );

    const pixels = new Uint8ClampedArray(result.length * 4);
    pixels.set(new Uint8ClampedArray(result.buffer));

    return new ImageData(pixels, input.width * factor, input.height * factor);
  }

  return async function resize(
    data: ImageData,
    opts: WorkerResizeOptions,
    wasmUrls?: ResizeWasmUrls,
  ): Promise<ImageData> {
    let input = data;

    if (!resizeWasmReady) {
      resizeWasmReady = initResizeWasm(wasmUrls?.resize);
    }

    if (optsIsHqxOpts(opts)) {
      input = await hqx(input, opts, wasmUrls);
      // Regular resize to make up the difference
      opts = { ...opts, method: 'catrom' };
    }

    await resizeWasmReady;

    if (opts.fitMethod === 'contain') {
      const { sx, sy, sw, sh } = getContainOffsets(
        data.width,
        data.height,
        opts.width,
        opts.height,
      );
      input = crop(
        input,
        Math.round(sx),
        Math.round(sy),
        Math.round(sw),
        Math.round(sh),
      );
    }

    const result = wasmResize(
      new Uint8Array(input.data.buffer),
      input.width,
      input.height,
      opts.width,
      opts.height,
      resizeMethods.indexOf(opts.method),
      opts.premultiply,
      opts.linearRGB,
    );

    const pixels = new Uint8ClampedArray(result.length);
    pixels.set(result);

    return new ImageData(pixels, opts.width, opts.height);
  };
}
