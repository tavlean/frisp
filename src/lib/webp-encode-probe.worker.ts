import { createWebpEncoderRuntime } from 'features/encoders/webP/worker/runtime';
import { defaultOptions } from 'features/encoders/webP/shared/meta';
import webpEncoder from 'app-generated/codecs/webp/enc/webp_enc';
import webpEncoderSimd from 'app-generated/codecs/webp/enc/webp_enc_simd';

interface WebpEncodeProbeRequest {
  type: 'encode';
  wasmUrls: {
    baseline: string;
    simd: string;
  };
}

function createSyntheticImageData(): ImageData {
  return new ImageData(
    new Uint8ClampedArray([
      255, 0, 0, 255, 0, 128, 255, 255, 255, 255, 255, 255, 0, 0, 0, 255,
    ]),
    2,
    2,
  );
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join(' ');
}

const encodeWebp = createWebpEncoderRuntime({
  detectSimd: async () => true,
  loadBaseline: async () => webpEncoder,
  loadSimd: async () => webpEncoderSimd,
});

async function encodeSyntheticWebp() {
  const output = await encodeWebp(createSyntheticImageData(), {
    ...defaultOptions,
    quality: 80,
  });
  const bytes = new Uint8Array(output);
  const riffHeader = new TextDecoder('ascii').decode(bytes.slice(0, 4));

  self.postMessage({
    outputBytes: bytes.byteLength,
    magicBytes: hex(bytes.slice(0, 12)),
    riffHeader,
  });
}

self.addEventListener(
  'message',
  (event: MessageEvent<WebpEncodeProbeRequest>) => {
    if (event.data.type !== 'encode') return;

    globalThis.__appEmscriptenLocateFile = (path) => {
      if (path === 'webp_enc.wasm') return event.data.wasmUrls.baseline;
      if (path === 'webp_enc_simd.wasm') return event.data.wasmUrls.simd;
      return path;
    };

    encodeSyntheticWebp().catch((error: unknown) => {
      self.postMessage({
        error: error instanceof Error ? error.message : String(error),
      });
    });
  },
);
