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
import type { EncodeOptions as WasmEncodeOptions } from 'codecs/jxl/enc/jxl_enc';

/**
 * The wasm encoder's options plus one app-level field. `jpegTranscode` picks a
 * different pipeline rather than a different encoder setting (the transcode
 * lane in src/worker/pipeline-op.ts), but it belongs in the options object
 * all the same: it changes the output bytes, so it has to reach the encode signature that keys
 * the result cache and the undo history. The wasm encoder never sees it:
 * embind reads only the fields it has registered.
 */
export interface EncodeOptions extends WasmEncodeOptions {
  jpegTranscode: boolean;
}

export const label = 'JPEG XL';
export const mimeType = 'image/jxl';
export const extension = 'jxl';
export const defaultOptions: EncodeOptions = {
  effort: 7,
  quality: 75,
  progressive: false,
  epf: -1,
  lossyPalette: false,
  decodingSpeedTier: 0,
  photonNoiseIso: 0,
  lossyModular: false,
  jpegTranscode: false,
};
