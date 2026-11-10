import type { QuantizerModule } from '#codecs/imagequant/imagequant.js';
import type { Options } from '../shared/meta';

import { initEmscriptenModule } from '#features/worker-utils/index.ts';

type QuantizerModuleFactory = EmscriptenWasm.ModuleFactory<QuantizerModule>;

export interface QuantizeRuntime {
  loadQuantizer(): Promise<QuantizerModuleFactory>;
}

export function createQuantizeRuntime({ loadQuantizer }: QuantizeRuntime) {
  let emscriptenModule: Promise<QuantizerModule>;

  async function init() {
    const quantizer = await loadQuantizer();
    return initEmscriptenModule(quantizer);
  }

  return async function process(
    data: ImageData,
    opts: Options,
  ): Promise<ImageData> {
    if (!emscriptenModule) {
      emscriptenModule = init();
    }

    const module = await emscriptenModule;

    const result = opts.zx
      ? module.zx_quantize(data.data, data.width, data.height, opts.dither)
      : module.quantize(
          data.data,
          data.width,
          data.height,
          opts.maxNumColors,
          opts.dither,
        );

    const pixels = new Uint8ClampedArray(result.length);
    pixels.set(result);

    return new ImageData(pixels, data.width, data.height);
  };
}
