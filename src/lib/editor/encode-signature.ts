// The canonical fingerprint of an encode pass's inputs, shared by every
// consumer that must agree on "same recipe": EditorSession's cache/encode
// signature and history signature, and BulkMode's focus-view hydration (which
// pre-seeds a hydrated result under the signature the editor's own encode
// effect will recompute — if the two ever disagreed, hydration would silently
// degrade into a redundant re-encode). Change the projection here and nowhere
// else.

import { stableStringify } from 'shared/stable-stringify';
import type { SideFormat } from '$lib/compress';
import type {
  PreprocessorState,
  ProcessorState,
} from 'client/lazy-app/feature-meta';

/**
 * The canonical OUTPUT-AFFECTING projection of one side's document state: only
 * the active format's options matter (inactive formats can't be edited from
 * the UI), and a resize that doesn't change the output folds to null (disabled
 * resize in the history path; identity resize in the encode path). BOTH the
 * cache/encode signature and the history signature are built from this one
 * projection — that shared origin is what guarantees "undo lands on a cache
 * hit". If the two ever disagreed about what matters, undo would silently
 * degrade into re-encodes.
 */
export function sideRecipe(
  format: SideFormat,
  options: unknown,
  processorState: ProcessorState,
  resizeCounts: boolean,
) {
  return {
    format,
    options: options ?? {},
    quantize: processorState.quantize,
    resize: resizeCounts ? processorState.resize : null,
  };
}

/**
 * A resize only counts as a *real* resize when it targets a size different
 * from the (preprocessed) source. At the source's own dimensions the default
 * interpolating filters are an identity pass, so "enabled at 100%" changes
 * nothing — it shouldn't run, nor read as "Resizing". Unknown source dims
 * (0 before the first result lands) also fold to "not real".
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
 * The signature of one side's complete encode inputs (the source file aside —
 * callers guard file identity separately): the preprocessor plus the canonical
 * side recipe, with the resize folded in only when it actually changes the
 * image. Keys the result cache and detects redundant passes.
 */
export function encodeSignature(
  preprocessorState: PreprocessorState,
  format: SideFormat,
  options: unknown,
  processorState: ProcessorState,
  sourceWidth: number,
  sourceHeight: number,
): string {
  return stableStringify({
    preprocessor: preprocessorState,
    recipe: sideRecipe(
      format,
      options,
      processorState,
      resizeIsReal(processorState, sourceWidth, sourceHeight),
    ),
  });
}

/**
 * Fingerprint of the *effective* resize recipe, for diffing what a pass
 * changed (the "Resizing" vs "Optimizing" badge label). Collapsing "no real
 * resize" to a constant means toggling resize on at 100% — or flipping
 * Premultiply/Linear RGB, which only matter while actually scaling — never
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
