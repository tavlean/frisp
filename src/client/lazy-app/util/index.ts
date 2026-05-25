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
 * Compare two objects, returning a boolean indicating if
 * they have the same properties and strictly equal values.
 */
export function shallowEqual(one: object, two: object): boolean {
  const oneRecord = one as Record<string, unknown>;
  const twoRecord = two as Record<string, unknown>;

  for (const i in oneRecord) {
    if (oneRecord[i] !== twoRecord[i]) return false;
  }
  for (const i in twoRecord) {
    if (!(i in oneRecord)) return false;
  }
  return true;
}

/**
 * @param field An HTMLInputElement, but the casting is done here to tidy up onChange.
 * @param defaultVal Value to return if 'field' doesn't exist.
 */
export function inputFieldValueAsNumber(
  field?: HTMLInputElement | null,
  defaultVal: number = 0,
): number {
  if (!field) return defaultVal;
  return Number(inputFieldValue(field));
}

/**
 * @param field An HTMLInputElement, but the casting is done here to tidy up onChange.
 * @param defaultVal Value to return if 'field' doesn't exist.
 */
export function inputFieldCheckedAsNumber(
  field?: HTMLInputElement | null,
  defaultVal: number = 0,
): number {
  if (!field) return defaultVal;
  return Number(inputFieldChecked(field));
}

/**
 * @param field An HTMLInputElement, but the casting is done here to tidy up onChange.
 * @param defaultVal Value to return if 'field' doesn't exist.
 */
export function inputFieldChecked(
  field?: HTMLInputElement | null,
  defaultVal: boolean = false,
): boolean {
  if (!field) return defaultVal;
  return field.checked;
}

/**
 * @param field An HTMLInputElement, but the casting is done here to tidy up onChange.
 * @param defaultVal Value to return if 'field' doesn't exist.
 */
export function inputFieldValue(
  field?: HTMLInputElement | null,
  defaultVal: string = '',
): string {
  if (!field) return defaultVal;
  return field.value;
}

/**
 * Creates a promise that resolves when the user types the konami code.
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

interface TransitionOptions {
  from?: number;
  to?: number;
  duration?: number;
  easing?: string;
}

export async function transitionHeight(
  el: HTMLElement,
  opts: TransitionOptions,
): Promise<void> {
  const {
    from = el.getBoundingClientRect().height,
    to = el.getBoundingClientRect().height,
    duration = 1000,
    easing = 'ease-in-out',
  } = opts;

  if (from === to || duration === 0) {
    el.style.height = to + 'px';
    return;
  }

  el.style.height = from + 'px';
  // Force a style calc so the browser picks up the start value.
  getComputedStyle(el).transform;
  el.style.transition = `height ${duration}ms ${easing}`;
  el.style.height = to + 'px';

  return new Promise<void>((resolve) => {
    const listener = (event: Event) => {
      if (event.target !== el) return;
      el.style.transition = '';
      el.removeEventListener('transitionend', listener);
      el.removeEventListener('transitioncancel', listener);
      resolve();
    };

    el.addEventListener('transitionend', listener);
    el.addEventListener('transitioncancel', listener);
  });
}

/**
 * Simple event listener that prevents the default.
 */
export function preventDefault(event: Event) {
  event.preventDefault();
}
