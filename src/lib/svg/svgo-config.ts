// The single translation point from Frisp's SVG controls and auto-search
// candidates to SVGO's plugin schema. Keeping it pure makes candidate ids and
// plugin order stable across the UI, worker, and visual gate.

import type { Config } from 'svgo/browser';

/** One concrete candidate: a full SVGO run configuration. */
export interface SvgCandidate {
  /** Stable id surfaced in the UI winner badge, e.g. 'p2+reusePaths'. */
  id: string;
  precision: number;
  addons: ('reusePaths' | 'convertStyleToAttrs' | 'removeOffCanvasPaths')[];
  config: Config;
}

export function buildCandidateId(
  precision: number,
  addons: SvgCandidate['addons'],
): string {
  return [`p${precision}`, ...addons].join('+');
}

export function buildSvgoConfig(opts: {
  precision: number;
  multipass: boolean;
  keepTitleDesc: boolean;
  addons: SvgCandidate['addons'];
  removeDimensions?: boolean;
}): Config {
  const transformPrecision = Math.min(opts.precision + 2, 5);
  const plugins: NonNullable<Config['plugins']> = [
    {
      name: 'preset-default',
      params: {
        overrides: {
          cleanupNumericValues: { floatPrecision: opts.precision },
          convertPathData: {
            floatPrecision: opts.precision,
            transformPrecision,
          },
          convertTransform: {
            floatPrecision: opts.precision,
            transformPrecision,
            // Pinned (default 3) so angular rounding never varies between
            // SVGO releases — candidate ids must stay deterministic.
            degPrecision: transformPrecision,
          },
          ...(opts.keepTitleDesc ? { removeDesc: false } : {}),
        },
      },
    },
  ];

  for (const addon of opts.addons) {
    plugins.push(addon);
    if (addon === 'reusePaths') plugins.push('removeXlink');
  }
  if (opts.removeDimensions) plugins.push('removeDimensions');

  return { multipass: opts.multipass, plugins };
}
