import { expose } from 'comlink';
import encodeWebp from '../../../../src/features/encoders/webP/worker/webpEncode';
import type { EncodeOptions } from 'features/encoders/webP/shared/meta';
import type { WebpWasmUrls } from './sveltekit-worker-bridge';

function locateWebpWasm(wasmUrls: WebpWasmUrls): void {
  globalThis.__squshEmscriptenLocateFile = (path) => {
    if (path === 'webp_enc.wasm') return wasmUrls.baseline;
    if (path === 'webp_enc_simd.wasm') return wasmUrls.simd;
    return path;
  };
}

const workerApi = {
  webpEncode(
    imageData: ImageData,
    options: EncodeOptions,
    wasmUrls: WebpWasmUrls,
  ): Promise<ArrayBuffer> {
    locateWebpWasm(wasmUrls);
    return encodeWebp(imageData, options);
  },
};

expose(workerApi);
