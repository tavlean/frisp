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
import { simd } from 'wasm-feature-detect';
import checkThreadsSupport from 'worker-shared/supports-wasm-threads';
import { createJxlEncoderRuntime } from './runtime';

export type { JxlEncodeRuntimeOptions } from './runtime';

export default createJxlEncoderRuntime({
  supportsThreads: checkThreadsSupport,
  supportsSimd: simd,
  async loadMultiThread() {
    const jxlEncoder = await import('codecs/jxl/enc/jxl_enc_mt');
    return jxlEncoder.default;
  },
  async loadMultiThreadSimd() {
    const jxlEncoder = await import('codecs/jxl/enc/jxl_enc_mt_simd');
    return jxlEncoder.default;
  },
  async loadSingleThread() {
    const jxlEncoder = await import('codecs/jxl/enc/jxl_enc');
    return jxlEncoder.default;
  },
});
