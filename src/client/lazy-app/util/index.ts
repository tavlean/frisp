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
export { abortable, assertSignal, isAbortError } from '../abort';
export {
  blobToArrayBuffer,
  blobToImg,
  blobToText,
  builtinDecode,
  canDecodeImageType,
  sniffMimeType,
} from '../image-decode';
export type { ImageMimeTypes } from '../image-decode';

/** If render engine is Safari */
export const isSafari =
  /Safari\//.test(navigator.userAgent) &&
  !/Chrom(e|ium)\//.test(navigator.userAgent);

/**
 * Resolves when the user types the Konami code (↑ ↑ ↓ ↓ ← → ← → B A).
 *
 * Intentionally retained from upstream Squoosh, where it unlocked the hidden
 * "ZX" (ZX Spectrum) palette in the Reduce-palette panel. The engine side is
 * still present (quantize honours `opts.zx` via `zx_quantize`), but the Svelte
 * UI does not yet wire up the trigger, so this currently has no caller. Kept
 * deliberately so we can revisit and put our own spin on the easter-egg — see
 * docs/svelte-hardening-plan.md ("Deferred / revisit").
 */
export function konami(): Promise<void> {
  return new Promise((resolve) => {
    // Keycodes for: ↑ ↑ ↓ ↓ ← → ← → B A
    const expectedPattern = '38384040373937396665';
    let rollingPattern = '';

    const listener = (event: KeyboardEvent) => {
      rollingPattern += event.keyCode;
      rollingPattern = rollingPattern.slice(-expectedPattern.length);
      if (rollingPattern === expectedPattern) {
        window.removeEventListener('keydown', listener);
        resolve();
      }
    };

    window.addEventListener('keydown', listener);
  });
}

/**
 * Simple event listener that prevents the default.
 */
export function preventDefault(event: Event) {
  event.preventDefault();
}
