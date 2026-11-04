// The editor's view of the one recipe signature (client/lazy-app/recipe.ts):
// EditorSession keys its result cache, redundant-pass check, and history dedupe
// on it, and bulk hashes its outputs with the same `recipeSignature`. BulkMode's
// focus view pre-seeds a result under the key the editor's own encode effect
// will recompute, so if these ever disagreed, hydration would silently degrade
// into a redundant re-encode and undo into re-encodes. Change the projection in
// recipe.ts and nowhere else.

import { stableStringify } from 'shared/stable-stringify';
import type { SideFormat } from '$lib/compress';
import type {
  PreprocessorState,
  ProcessorState,
} from 'client/lazy-app/feature-meta';
import { recipeSignature } from 'client/lazy-app/recipe';
import { recipeFromSide } from './side-recipe';

/**
 * A resize only counts as a *real* resize when it targets a size different
 * from the (preprocessed) source. At the source's own dimensions the default
 * interpolating filters are an identity pass, so "enabled at 100%" changes
 * nothing; it shouldn't run, nor read as "Resizing". Unknown source dims
 * (0 before the first result lands) fold to "not real" here, unlike the
 * signature, which must never let a resized and an unresized output collide.
 */
export function resizeIsReal(
  processorState: ProcessorState,
  sourceWidth: number,
  sourceHeight: number,
): boolean {
  const resize = processorState.resize;
  return (
    resize.enabled &&
    sourceWidth > 0 &&
    sourceHeight > 0 &&
    (resize.width !== sourceWidth || resize.height !== sourceHeight)
  );
}

/**
 * The signature of one side's complete encode inputs (the source file aside;
 * callers guard file identity separately). `sourceWidth`/`sourceHeight` are the
 * PREPROCESSED (already rotated) dims the editor reads off its results, while
 * `recipeSignature` takes the unrotated source and applies the turn itself, so
 * a quarter turn is undone here first.
 */
export function encodeSignature(
  preprocessorState: PreprocessorState,
  format: SideFormat,
  options: unknown,
  processorState: ProcessorState,
  sourceWidth: number,
  sourceHeight: number,
): string {
  const quarter = preprocessorState.rotate.rotate % 180 !== 0;
  return recipeSignature(
    recipeFromSide(
      {
        format,
        optionsByFormat: {
          [format]: (options ?? {}) as Record<string, unknown>,
        },
        processorState,
      },
      preprocessorState,
    ),
    quarter
      ? { width: sourceHeight, height: sourceWidth }
      : { width: sourceWidth, height: sourceHeight },
  );
}

/**
 * Fingerprint of the *effective* resize recipe, for diffing what a pass
 * changed (the "Resizing" vs "Optimizing" badge label). Collapsing "no real
 * resize" to a constant means toggling resize on at 100%, or flipping
 * Premultiply/Linear RGB (which only matter while actually scaling), never
 * masquerades as a resize edit.
 */
export function resizeSignature(
  processorState: ProcessorState,
  sourceWidth: number,
  sourceHeight: number,
): string {
  return resizeIsReal(processorState, sourceWidth, sourceHeight)
    ? stableStringify(processorState.resize)
    : 'off';
}
