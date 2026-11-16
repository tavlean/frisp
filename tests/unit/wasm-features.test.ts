// Node's V8 supports WebAssembly SIMD, threads, SharedArrayBuffer and
// MessageChannel, so both probes must report true here. A false means a probe
// module or the SharedArrayBuffer transfer step broke.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { simd, threads } from '../../src/shared/wasm-features';

describe('wasm feature detection', () => {
  it('detects SIMD', async () => {
    expect(await simd()).toBe(true);
  });

  it('detects threads', async () => {
    expect(await threads()).toBe(true);
  });

  // The page without cross-origin isolation: the module would still validate,
  // so only the SharedArrayBuffer step can say no.
  describe('without usable shared memory', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('reports no threads when SharedArrayBuffer is missing', async () => {
      vi.stubGlobal('SharedArrayBuffer', undefined);
      expect(await threads()).toBe(false);
    });

    it('reports no threads when the buffer cannot be posted', async () => {
      vi.stubGlobal(
        'MessageChannel',
        class {
          port1 = {
            postMessage() {
              throw new DOMException('not cloneable', 'DataCloneError');
            },
          };
        },
      );
      expect(await threads()).toBe(false);
    });
  });
});
