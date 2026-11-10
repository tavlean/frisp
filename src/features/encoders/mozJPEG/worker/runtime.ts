import type { MozJPEGModule } from '#codecs/mozjpeg/enc/mozjpeg_enc.js';
import type { EncodeOptions } from '../shared/meta';

import { initEmscriptenModule } from '#features/worker-utils/index.ts';

type MozjpegEncoderModuleFactory = EmscriptenWasm.ModuleFactory<MozJPEGModule>;

export interface MozjpegEncoderRuntime {
  loadEncoder(): Promise<MozjpegEncoderModuleFactory>;
}

export function createMozjpegEncoderRuntime({
  loadEncoder,
}: MozjpegEncoderRuntime) {
  let emscriptenModule: Promise<MozJPEGModule>;

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
    const resultView = module.encode(
      data.data,
      data.width,
      data.height,
      options,
    );
    // wasm can't run on SharedArrayBuffers, so we hard-cast to ArrayBuffer.
    return resultView.buffer as ArrayBuffer;
  };
}
