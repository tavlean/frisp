import { describe, expect, it } from 'vitest';
import {
  getEffectiveSettings,
  getSettingsOverridePaths,
  hasSettingsOverrides,
  resolveSettingsForSource,
  settingsHash,
} from '../../src/client/lazy-app/bulk/settings';
import { settings } from './fixtures';

describe('bulk settings helpers', () => {
  it('deep-merges sparse processor overrides without mutating global settings', () => {
    const globalSettings = settings();

    const effective = getEffectiveSettings(globalSettings, {
      processorState: {
        resize: {
          enabled: true,
          width: 320,
        },
      },
    });

    expect(effective.processorState.resize).toMatchObject({
      ...globalSettings.processorState.resize,
      enabled: true,
      width: 320,
    });
    expect(globalSettings.processorState.resize.enabled).toBe(false);
  });

  it('replaces encoder state when an image override supplies one', () => {
    const effective = getEffectiveSettings(settings(), {
      encoderState: {
        type: 'qoi',
        options: {},
      },
    });

    expect(effective.encoderState?.type).toBe('qoi');
  });

  it('keeps settings hashes stable regardless of object key insertion order', () => {
    const left = settings({
      processorState: {
        resize: {
          enabled: true,
          width: 640,
          height: 480,
          method: 'lanczos3',
          fitMethod: 'stretch',
          premultiply: true,
          linearRGB: true,
        },
        quantize: {
          enabled: false,
          numColors: 256,
          dither: 1,
        },
      },
    });
    const right = {
      processorState: {
        quantize: {
          dither: 1,
          numColors: 256,
          enabled: false,
        },
        resize: {
          linearRGB: true,
          premultiply: true,
          fitMethod: 'stretch',
          method: 'lanczos3',
          height: 480,
          width: 640,
          enabled: true,
        },
      },
      encoderState: left.encoderState,
    };

    expect(settingsHash(left)).toBe(settingsHash(right));
  });

  it('collapses disabled processor options out of the settings hash', () => {
    const left = settings();
    const right = settings({
      processorState: {
        resize: {
          enabled: false,
          width: 999,
          height: 777,
          method: 'mitchell',
          fitMethod: 'contain',
          premultiply: false,
          linearRGB: false,
        },
        quantize: {
          enabled: false,
          numColors: 8,
          dither: 0.25,
        },
      },
    });

    expect(settingsHash(left, { width: 800, height: 600 })).toBe(
      settingsHash(right, { width: 800, height: 600 }),
    );
  });

  it('collapses enabled identity resize out of the per-source settings hash', () => {
    const resizeOff = settings({
      processorState: {
        ...settings().processorState,
        resize: {
          ...settings().processorState.resize,
          enabled: false,
          width: 800,
          height: 600,
        },
      },
    });
    const resizeIdentity = settings({
      processorState: {
        ...settings().processorState,
        resize: {
          ...settings().processorState.resize,
          enabled: true,
          width: 800,
          height: 600,
        },
      },
    });

    expect(settingsHash(resizeIdentity, { width: 800, height: 600 })).toBe(
      settingsHash(resizeOff, { width: 800, height: 600 }),
    );
  });

  it('resolves percentage resize presets against each job before hashing', () => {
    const global = settings({
      resizeReference: { width: 1000, height: 500 },
      processorState: {
        ...settings().processorState,
        resize: {
          ...settings().processorState.resize,
          enabled: true,
          width: 500,
          height: 250,
        },
      },
    });

    const resolved = resolveSettingsForSource(global, {
      width: 300,
      height: 150,
    });

    expect(resolved.processorState.resize).toMatchObject({
      enabled: true,
      width: 150,
      height: 75,
    });
    expect(settingsHash(global, { width: 300, height: 150 })).toBe(
      settingsHash(resolved, { width: 300, height: 150 }),
    );
  });

  it('detects only defined override values', () => {
    expect(hasSettingsOverrides(undefined)).toBe(false);
    expect(
      hasSettingsOverrides({
        processorState: {
          resize: {
            width: undefined,
          },
        },
      }),
    ).toBe(false);
    expect(
      hasSettingsOverrides({
        processorState: {
          resize: {
            enabled: false,
          },
        },
      }),
    ).toBe(true);
  });

  it('returns dot paths for defined overrides', () => {
    expect(
      getSettingsOverridePaths({
        encoderState: {
          type: 'qoi',
          options: {},
        },
        processorState: {
          resize: {
            enabled: true,
            width: 320,
          },
          quantize: {
            numColors: undefined,
          },
        },
      }),
    ).toEqual([
      'encoderState',
      'processorState.resize.enabled',
      'processorState.resize.width',
    ]);
  });
});
