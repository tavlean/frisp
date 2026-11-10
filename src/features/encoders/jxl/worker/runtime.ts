/**
 * Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import type { JXLModule } from '#codecs/jxl/enc/jxl_enc.js';
import type { EncodeOptions } from '../shared/meta';

import { initEmscriptenModule } from '#features/worker-utils/index.ts';

type JxlEncoderModuleFactory = EmscriptenWasm.ModuleFactory<JXLModule>;

export interface JxlEncodeRuntimeOptions {
  supportsThreads?: () => Promise<boolean>;
  supportsSimd?: () => Promise<boolean>;
}

export interface JxlEncoderRuntime {
  loadMultiThread: () => Promise<JxlEncoderModuleFactory>;
  loadMultiThreadSimd: () => Promise<JxlEncoderModuleFactory>;
  loadSingleThread: () => Promise<JxlEncoderModuleFactory>;
  supportsThreads: () => Promise<boolean>;
  supportsSimd: () => Promise<boolean>;
}

export function createJxlEncoderRuntime({
  loadMultiThread,
  loadMultiThreadSimd,
  loadSingleThread,
  supportsThreads,
  supportsSimd,
}: JxlEncoderRuntime) {
  let emscriptenModule: Promise<JXLModule>;

  async function init({
    supportsThreads: detectThreads = supportsThreads,
    supportsSimd: detectSimd = supportsSimd,
  }: JxlEncodeRuntimeOptions = {}) {
    if (await detectThreads()) {
      try {
        const moduleFactory = (await detectSimd())
          ? await loadMultiThreadSimd()
          : await loadMultiThread();
        return await initEmscriptenModule(moduleFactory);
      } catch (err) {
        // Multithread setup can fail (nested-worker / pthread URL resolution
        // under the bundler). Fall back to single-thread so encoding still works
        // rather than hard-failing.
        // eslint-disable-next-line no-console
        console.warn(
          'JPEG XL multithread load failed; using single-thread.',
          err,
        );
      }
    }

    const moduleFactory = await loadSingleThread();
    return initEmscriptenModule(moduleFactory);
  }

  function load(runtimeOptions?: JxlEncodeRuntimeOptions): Promise<JXLModule> {
    if (!emscriptenModule) emscriptenModule = init(runtimeOptions);
    return emscriptenModule;
  }

  // Copied out of the wasm heap: the returned view aliases module memory, which
  // the next call is free to reuse or grow out from under it.
  function detach(result: Uint8Array): ArrayBuffer {
    const output = new Uint8Array(result.byteLength);
    output.set(result);
    return output.buffer as ArrayBuffer;
  }

  // Two operations rather than one, because they share the module: instantiating
  // this encoder twice in the same worker would cost a second 2.5 MB of wasm for
  // an entrypoint that lives in the same binary.
  return {
    async encode(
      data: ImageData,
      options: EncodeOptions,
      runtimeOptions?: JxlEncodeRuntimeOptions,
    ): Promise<ArrayBuffer> {
      const module = await load(runtimeOptions);
      const result = module.encode(data.data, data.width, data.height, options);

      if (!result) throw new Error('Encoding error.');

      return detach(result);
    },

    /** null when libjxl cannot losslessly transcode this JPEG (see the wrapper). */
    async transcodeJpeg(
      jpeg: ArrayBuffer,
      runtimeOptions?: JxlEncodeRuntimeOptions,
    ): Promise<ArrayBuffer | null> {
      const module = await load(runtimeOptions);
      const result = module.transcodeJPEG(new Uint8Array(jpeg));

      return result ? detach(result) : null;
    },
  };
}
