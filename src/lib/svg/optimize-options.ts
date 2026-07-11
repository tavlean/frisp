/**
 * The SVG lane's complete recipe — the ONLY state hashed into its encode
 * signature. Raster processor/preprocessor state never applies to this lane.
 */
export interface SvgOptimizeOptions {
  /** 'auto' searches candidates behind a visual gate; 'manual' applies the
   *  knobs below directly. Auto respects keepTitleDesc (a semantic policy,
   *  not a size knob) and ignores the other manual toggles. */
  mode: 'auto' | 'manual';
  /** Decimal places for numeric/path data, 0–4. Transform precision is
   *  derived as min(precision + 2, 5) — transforms need headroom (matrix
   *  math amplifies rounding); never set them uniformly. */
  precision: number;
  multipass: boolean;
  /** Keep <title>/<desc> (accessibility metadata). Default ON. */
  keepTitleDesc: boolean;
  /** Aggressive extras — manual mode only; each is individually risky and
   *  the compare view is the safety net. */
  reusePaths: boolean;
  convertStyleToAttrs: boolean;
  removeOffCanvasPaths: boolean;
  removeDimensions: boolean;
}

export const DEFAULT_SVG_OPTIONS: SvgOptimizeOptions = {
  mode: 'auto',
  precision: 3,
  multipass: true,
  keepTitleDesc: true,
  reusePaths: false,
  convertStyleToAttrs: false,
  removeOffCanvasPaths: false,
  removeDimensions: false,
};
