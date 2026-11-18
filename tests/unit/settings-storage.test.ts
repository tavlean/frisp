import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDefaultOptions } from '../../src/lib/compress';
import {
  readSaved,
  sanitizeSavedOptions,
} from '../../src/lib/editor/settings-storage';

const STORAGE_KEY = 'app:settings:v3';

function storeSettings(payload: unknown): void {
  const store = new Map([[STORAGE_KEY, JSON.stringify(payload)]]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
  });
}

// What EditorSession's buildSide does with a saved jpegli side.
function loadedJpegli(saved: Record<string, unknown> | undefined) {
  const defaults = getDefaultOptions('jpegli');
  return saved ? sanitizeSavedOptions(defaults, saved) : defaults;
}

describe('auto-saved settings', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads a saved MozJPEG side as jpegli at the same quality', () => {
    storeSettings({
      sides: [
        { format: 'identity', optionsByFormat: {} },
        {
          format: 'mozJPEG',
          optionsByFormat: {
            mozJPEG: { quality: 62.4, trellis_multipass: true },
          },
        },
      ],
    });

    const [left, right] = readSaved().sides!;
    expect(left.format).toBe('identity');
    expect(right.format).toBe('jpegli');
    expect(loadedJpegli(right.optionsByFormat?.jpegli)).toEqual({
      ...getDefaultOptions('jpegli'),
      quality: 62,
    });
  });

  it('loads a saved MozJPEG side without options as default jpegli', () => {
    storeSettings({ sides: [undefined, { format: 'mozJPEG' }] });

    const right = readSaved().sides![1];
    expect(right.format).toBe('jpegli');
    expect(right.optionsByFormat).toBeUndefined();
    expect(loadedJpegli(right.optionsByFormat?.jpegli)).toEqual(
      getDefaultOptions('jpegli'),
    );
  });

  it('leaves a saved jpegli side untouched', () => {
    const side = {
      format: 'jpegli',
      optionsByFormat: {
        jpegli: { quality: 88, progressive: false, chromaSubsample: 1 },
        mozJPEG: { quality: 40 },
      },
    };
    storeSettings({ sides: [undefined, side] });

    expect(readSaved().sides![1]).toEqual(side);
  });
});
