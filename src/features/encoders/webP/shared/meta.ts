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
import type { EncodeOptions } from 'codecs/webp/enc/webp_enc';

export { EncodeOptions };

export const label = 'WebP';
export const mimeType = 'image/webp';
export const extension = 'webp';
// These come from struct WebPConfig in encode.h. We diverge from upstream
// Squoosh on two values: quality 80 (was 75) and method 6 — the highest effort,
// best compression (was 4) — as the project's preferred WebP default, since WebP
// is the default right-side encoder and stays sub-second even at method 6.
export const defaultOptions: EncodeOptions = {
  quality: 80,
  target_size: 0,
  target_PSNR: 0,
  method: 6,
  sns_strength: 50,
  filter_strength: 60,
  filter_sharpness: 0,
  filter_type: 1,
  partitions: 0,
  segments: 4,
  pass: 1,
  show_compressed: 0,
  preprocessing: 0,
  autofilter: 0,
  partition_limit: 0,
  alpha_compression: 1,
  alpha_filtering: 1,
  alpha_quality: 100,
  lossless: 0,
  exact: 0,
  image_hint: 0,
  emulate_jpeg_size: 0,
  thread_level: 0,
  low_memory: 0,
  near_lossless: 100,
  use_delta_palette: 0,
  use_sharp_yuv: 0,
};
