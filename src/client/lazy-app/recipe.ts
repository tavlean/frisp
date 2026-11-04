// What one image becomes: rotation, pixel processors, and an output. The single
// editor's sides and bulk's settings both reduce to this, and every consumer
// that must agree on "same result" (the editor's result cache and history
// dedupe, bulk output hashes and stale detection) keys on `recipeSignature`.
// Two schemes that each folded no-op steps on their own drifted apart once
// already, so the folding rules live here and nowhere else.
//
// Framework-neutral: the engine imports this, so it must never import $lib.

import {
  grainIsReal,
  type EncoderState,
  type ProcessorState,
} from 'client/lazy-app/feature-meta/shared';
import { stableStringify } from 'shared/stable-stringify';

/** Quarter turns, the same values PreprocessorState.rotate.rotate holds. */
export type Rotation = 0 | 90 | 180 | 270;

/** Options for the SVG lane; same shape as src/lib/svg/optimize-options.ts
 *  SvgOptimizeOptions. Declared structurally here so the engine never
 *  imports $lib. */
export type SvgOutputOptions = Record<string, unknown>;

export type RecipeOutput =
  | { kind: 'raster'; encoder: EncoderState }
  | { kind: 'svg'; options: SvgOutputOptions };

export interface ImageRecipe {
  rotate: Rotation;
  processors: ProcessorState;
  output: RecipeOutput;
}

export interface SourceDimensions {
  width: number;
  height: number;
}

/**
 * Whether the resize targets a size other than the source as it reaches the
 * resizer, which is after rotation. The pipeline skips a resize to the frame's
 * own size, so an "enabled at 100%" resize must fold away or it would split one
 * output across two keys. Unknown dimensions count as real: folding there would
 * let a resized output and an unresized one share a key.
 */
function resizeCounts(recipe: ImageRecipe, source?: SourceDimensions): boolean {
  const resize = recipe.processors.resize;
  if (!resize.enabled) return false;
  if (!source || !(source.width > 0) || !(source.height > 0)) return true;
  const quarter = recipe.rotate % 180 !== 0;
  const width = quarter ? source.height : source.width;
  const height = quarter ? source.width : source.height;
  return resize.width !== width || resize.height !== height;
}

/** The canonical, output-affecting projection: no-op steps fold to null, the
 *  SVG lane ignores rotation and processors, a resize at the (rotated) source
 *  size folds to null. Unknown dimensions (0 or missing) count a resize as
 *  real. */
export function normalizedRecipe(
  recipe: ImageRecipe,
  source?: SourceDimensions,
): unknown {
  const { output, processors } = recipe;
  // The SVG lane rewrites the source text; nothing raster ever touches it.
  if (output.kind === 'svg') return { output };
  return {
    rotate: recipe.rotate,
    grain: grainIsReal(processors.grain) ? processors.grain : null,
    quantize: processors.quantize.enabled ? processors.quantize : null,
    resize: resizeCounts(recipe, source) ? processors.resize : null,
    // The JXL jpegTranscode flag rides inside the options, so a transcoded
    // result and a pixel-encoded one never share a key.
    output,
  };
}

/** stableStringify(normalizedRecipe(...)). THE key for result caches, bulk
 *  output hashes, history dedupe, and stale detection. */
export function recipeSignature(
  recipe: ImageRecipe,
  source?: SourceDimensions,
): string {
  return stableStringify(normalizedRecipe(recipe, source));
}

/** Whether the recipe changes pixels (rotation, real resize, real grain,
 *  palette). Replaces settingsChangePixels and preprocessingIsNeutral. */
export function recipeChangesPixels(
  recipe: ImageRecipe,
  source?: SourceDimensions,
): boolean {
  if (recipe.output.kind === 'svg') return false;
  const { processors } = recipe;
  return (
    recipe.rotate !== 0 ||
    grainIsReal(processors.grain) ||
    processors.quantize.enabled ||
    resizeCounts(recipe, source)
  );
}
