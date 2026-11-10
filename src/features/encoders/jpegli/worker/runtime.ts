import type { JpegliModule } from '#codecs/jpegli/enc/jpegli_enc.js';
import type { EncodeOptions } from '../shared/meta';

import { initEmscriptenModule } from '#features/worker-utils/index.ts';

type JpegliEncoderModuleFactory = EmscriptenWasm.ModuleFactory<JpegliModule>;

export interface JpegliEncoderRuntime {
  loadEncoder(): Promise<JpegliEncoderModuleFactory>;
}

export function createJpegliEncoderRuntime({
  loadEncoder,
}: JpegliEncoderRuntime) {
  let emscriptenModule: Promise<JpegliModule>;

  async function init() {
    const encoder = await loadEncoder();
    return initEmscriptenModule(encoder);
  }

  return async function encode(
    data: ImageData,
    options: EncodeOptions,
  ): Promise<ArrayBuffer> {
    if (!emscriptenModule) {
      emscriptenModule = init();
    }

    const module = await emscriptenModule;
    const result = module.encode(data.data, data.width, data.height, options);

    // jpegli signals a failed encode by returning null rather than aborting the
    // module (see the error handler in jpegli_enc.cpp), so the null is real and
    // has to be turned back into a rejection here.
    if (!result) throw new Error('Encoding error.');

    // wasm can't run on SharedArrayBuffers, so we hard-cast to ArrayBuffer.
    return result.buffer as ArrayBuffer;
  };
}
