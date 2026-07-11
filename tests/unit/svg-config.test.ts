import { describe, expect, it } from 'vitest';
import { optimize } from 'svgo';
import { DEFAULT_SVG_OPTIONS } from '../../src/lib/svg/optimize-options';
import {
  buildCandidateId,
  buildSvgoConfig,
  describeWinner,
  type SvgCandidate,
} from '../../src/lib/svg/svgo-config';

describe('SVG optimization configuration', () => {
  it('defines the complete default recipe', () => {
    expect(DEFAULT_SVG_OPTIONS).toEqual({
      mode: 'auto',
      precision: 3,
      multipass: true,
      keepTitleDesc: true,
      reusePaths: false,
      convertStyleToAttrs: false,
      removeOffCanvasPaths: false,
      removeDimensions: false,
    });
  });

  it('builds stable candidate ids', () => {
    expect(buildCandidateId(2, [])).toBe('p2');
    expect(buildCandidateId(2, ['reusePaths'])).toBe('p2+reusePaths');
  });

  it('describes auto-search winners', () => {
    expect(describeWinner('p2+reusePaths+convertStyleToAttrs')).toBe(
      'precision 2 · reused paths · styles → attributes',
    );
    expect(describeWinner('p3!')).toBe(
      'precision 3 — verify preview (auto gate failed)',
    );
  });

  it('sets precision overrides and preserves metadata when requested', () => {
    expect(
      buildSvgoConfig({
        precision: 2,
        multipass: true,
        keepTitleDesc: true,
        addons: [],
      }),
    ).toEqual({
      multipass: true,
      plugins: [
        {
          name: 'preset-default',
          params: {
            overrides: {
              cleanupNumericValues: { floatPrecision: 2 },
              convertPathData: { floatPrecision: 2, transformPrecision: 4 },
              convertTransform: {
                floatPrecision: 2,
                transformPrecision: 4,
                degPrecision: 4,
              },
              removeDesc: false,
            },
          },
        },
      ],
    });
  });

  it('caps transform precision and omits the removeDesc override when disabled', () => {
    const config = buildSvgoConfig({
      precision: 4,
      multipass: false,
      keepTitleDesc: false,
      addons: [],
    });
    expect(config.multipass).toBe(false);
    expect(config).not.toHaveProperty('plugins.0.params.overrides.removeDesc');
    expect(config).toHaveProperty(
      'plugins.0.params.overrides.convertPathData.transformPrecision',
      5,
    );
  });

  it('appends addons, removeXlink, and removeDimensions in order', () => {
    const config = buildSvgoConfig({
      precision: 2,
      multipass: true,
      keepTitleDesc: true,
      addons: ['convertStyleToAttrs', 'reusePaths', 'removeOffCanvasPaths'],
      removeDimensions: true,
    });
    expect(config.plugins?.slice(1)).toEqual([
      'convertStyleToAttrs',
      'reusePaths',
      'removeXlink',
      'removeOffCanvasPaths',
      'removeDimensions',
    ]);
    expect(JSON.stringify(config)).not.toContain('removeViewBox');
  });

  it.each<SvgCandidate['addons'][number]>([
    'reusePaths',
    'convertStyleToAttrs',
    'removeOffCanvasPaths',
  ])('is accepted by SVGO with addon %s', (addon) => {
    const config = buildSvgoConfig({
      precision: 2,
      multipass: true,
      keepTitleDesc: true,
      addons: [addon],
    });
    const result = optimize(
      '<svg viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>',
      config,
    );
    expect(result.data).toContain('<svg');
  });
});
