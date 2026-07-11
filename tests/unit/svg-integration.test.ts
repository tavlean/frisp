import { describe, expect, it } from 'vitest';
import { defaultProcessorState } from '../../src/client/lazy-app/feature-meta/shared';
import { getDefaultOptions } from '../../src/lib/compress';
import { sideRecipe } from '../../src/lib/editor/encode-signature';
import {
  parseSavedSide,
  sanitizeSavedOptions,
} from '../../src/lib/editor/settings-storage';
import { DEFAULT_SVG_OPTIONS } from '../../src/lib/svg/optimize-options';
import { keepOriginalSvg } from '../../src/lib/svg/optimize';

describe('SVG lane integration', () => {
  it('folds raster processor state out of SVG recipes', () => {
    const changed = structuredClone(defaultProcessorState);
    changed.grain.enabled = true;
    changed.grain.amount = 50;
    changed.quantize.enabled = true;
    changed.resize.enabled = true;
    changed.resize.width = 320;

    expect(sideRecipe('svg', DEFAULT_SVG_OPTIONS, changed, true)).toEqual(
      sideRecipe('svg', DEFAULT_SVG_OPTIONS, defaultProcessorState, false),
    );
  });

  it('round-trips SVG options and default-fills old option payloads', () => {
    const options = {
      ...DEFAULT_SVG_OPTIONS,
      mode: 'manual' as const,
      precision: 2,
    };
    const parsed = parseSavedSide(
      JSON.stringify({
        format: 'svg',
        optionsByFormat: { svg: options },
        processorState: defaultProcessorState,
      }),
    );

    expect(parsed?.format).toBe('svg');
    expect(parsed?.optionsByFormat?.svg).toEqual(options);
    expect(
      sanitizeSavedOptions(getDefaultOptions('svg'), { precision: 2 }),
    ).toEqual({ ...DEFAULT_SVG_OPTIONS, precision: 2 });
  });

  it('keeps the original text when optimization is not smaller', () => {
    const text = '<svg><path d="M0 0"/></svg>';
    const source = {
      text,
      rawBytes: new TextEncoder().encode(text).length,
      gzipBytes: 40,
    };
    const result = keepOriginalSvg(source, {
      text: `${text} `,
      rawBytes: source.rawBytes + 1,
      gzipBytes: 1,
    });

    expect(result.text).toBe(text);
    expect(result.rawBytes).toBe(source.rawBytes);
    expect(result.gzipBytes).toBe(40);
    expect(result.keptOriginal).toBe(true);
  });
});
