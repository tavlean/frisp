// WebAssembly feature detection, owned copy of the two probes Frisp uses from
// wasm-feature-detect 1.8.0 (https://github.com/GoogleChromeLabs/wasm-feature-detect).
// Copyright 2019 Google Inc. Licensed under the Apache License, Version 2.0
// (http://www.apache.org/licenses/LICENSE-2.0). Distributed on an "AS IS"
// BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
//
// Trimmed: every probe except `simd` and `threads`. The byte arrays are copied
// verbatim from the package's dist/esm/index.js; do not edit them by hand.
//
// Runs in the page, the codec worker and the service worker, so it may only
// touch globals all three have.

export async function simd(): Promise<boolean> {
  return WebAssembly.validate(
    new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10,
      1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
    ]),
  );
}

const threadsProbe = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 5, 4, 1, 3, 1, 1,
  10, 11, 1, 9, 0, 65, 0, 254, 16, 2, 0, 26, 11,
]);

export async function threads(): Promise<boolean> {
  try {
    // A shared-memory module can validate while SharedArrayBuffer is still
    // unusable (no cross-origin isolation), so the buffer must survive a real
    // structured clone. Without MessageChannel, upstream skips this step.
    if (typeof MessageChannel !== 'undefined') {
      new MessageChannel().port1.postMessage(new SharedArrayBuffer(1));
    }
    return WebAssembly.validate(threadsProbe);
  } catch {
    return false;
  }
}
