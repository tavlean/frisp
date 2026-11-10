import type { QoiModule } from '#codecs/qoi/enc/qoi_enc.js';
import type { EncodeOptions } from '../shared/meta';

import { initEmscriptenModule } from '#features/worker-utils/index.ts';

type QoiEncoderModuleFactory = EmscriptenWasm.ModuleFactory<QoiModule>;

export interface QoiEncoderRuntime {
  loadEncoder(): Promise<QoiEncoderModuleFactory>;
}

export function createQoiEncoderRuntime({ loadEncoder }: QoiEncoderRuntime) {
  let emscriptenModule: Promise<QoiModule>;

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
