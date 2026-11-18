import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import type { JXLModule as Decoder } from '../../codecs/jxl/dec/jxl_dec';
import type { JXLModule as Encoder } from '../../codecs/jxl/enc/jxl_enc';

// Lossless JPEG XL must decode to the exact pixels it was given. The wasm
// decoder once sent sRGB images through skcms, whose float round trip moved
// dark red values down a level (codec-build-notes.md, libjxl gotcha 30).
// Noise is the input that showed it: every value occurs, including the dark
// ones where the error lived.

const root = resolve(import.meta.dirname, '../..');

// What Node lacks and the decoder constructs: a plain RGBA holder.
globalThis.ImageData ??= class ImageData {
  constructor(
    public data: Uint8ClampedArray,
    public width: number,
    public height: number,
  ) {}
} as unknown as typeof ImageData;

/** The emsdk 3.1.0 Node glue reads `require` and `__dirname` as free
 *  variables while it starts; handing it the WASM bytes skips its fetch. */
async function load<T>(path: string): Promise<T> {
  const file = resolve(root, 'codecs', path);
  const factory = (await import(/* @vite-ignore */ pathToFileURL(file).href))
    .default;
  const wasmBinary = await readFile(file.replace(/\.js$/, '.wasm'));
  const globals = globalThis as Record<string, unknown>;
  globals.require = createRequire(file);
  globals.__dirname = dirname(file);
  try {
    return await factory({ wasmBinary, noInitialRun: true });
  } finally {
    delete globals.require;
    delete globals.__dirname;
  }
}

/** Seeded RGBA noise (mulberry32), alpha included. */
function noise(width: number, height: number): Uint8ClampedArray<ArrayBuffer> {
  let seed = 0x9e3779b9;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i++) {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    data[i] = (t ^ (t >>> 14)) >>> 24;
  }
  return data;
}

let encoder: Encoder;
let decoder: Decoder;
beforeAll(async () => {
  encoder = await load<Encoder>('jxl/enc/jxl_node_enc.js');
  decoder = await load<Decoder>('jxl/dec/jxl_node_dec.js');
});

describe('the JPEG XL wasm decoder', () => {
  it('returns the exact pixels of a lossless encode', () => {
    const [width, height] = [192, 192];
    const pixels = noise(width, height);
    const encoded = encoder.encode(pixels, width, height, {
      effort: 1,
      quality: 100,
      progressive: false,
      epf: -1,
      lossyPalette: false,
      decodingSpeedTier: 0,
      photonNoiseIso: 0,
      lossyModular: false,
    });
    expect(encoded).not.toBeNull();
    // Copied so the view's buffer types as ArrayBuffer, as BufferSource needs.
    const decoded = decoder.decode(new Uint8Array(encoded!));
    expect(decoded).not.toBeNull();
    expect([decoded!.width, decoded!.height]).toEqual([width, height]);
    let mismatches = 0;
    for (let i = 0; i < pixels.length; i++) {
      if (decoded!.data[i] !== pixels[i]) mismatches++;
    }
    expect(mismatches).toBe(0);
  });
});
