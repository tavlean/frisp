// Converts between an EditorSession side (format, options per format,
// processors) plus the session-wide rotation and the framework-neutral
// ImageRecipe. Pure on purpose: no runes, so the engine-level tests and bulk
// can use it, and callers decide when to snapshot reactive state.

import type {
  EncoderState,
  PreprocessorState,
} from 'client/lazy-app/feature-meta';
import type { ImageRecipe, SvgOutputOptions } from 'client/lazy-app/recipe';
import type { SideState } from './editor-session.svelte';

/**
 * The recipe a side currently describes. Only the active format's options
 * matter, since inactive formats cannot be edited from the UI. The result
 * aliases the side's objects: pass a snapshot if it must outlive the edit.
 *
 * The Original ('identity') side is not an encoder, but it still needs a
 * signature that tracks rotation and processors the way every other side
 * does, so it rides through as a raster output whose encoder type is
 * 'identity'. Nothing runs an ImageRecipe from an identity side.
 */
export function recipeFromSide(
  side: SideState,
  preprocessorState: PreprocessorState,
): ImageRecipe {
  const options = side.optionsByFormat[side.format] ?? {};
  return {
    rotate: preprocessorState.rotate.rotate,
    processors: side.processorState,
    output:
      side.format === 'svg'
        ? { kind: 'svg', options: options as SvgOutputOptions }
        : {
            kind: 'raster',
            encoder: { type: side.format, options } as unknown as EncoderState,
          },
  };
}

/**
 * Write a recipe onto a side (format, that format's options, processors) and
 * return the preprocessor state carrying its rotation, which is session-wide
 * and so the caller's to set. Copies, so the side never aliases the recipe;
 * the recipe must be plain data (snapshot reactive state first).
 */
export function applyRecipeToSide(
  recipe: ImageRecipe,
  side: SideState,
): PreprocessorState {
  const { output } = recipe;
  if (output.kind === 'svg') {
    side.format = 'svg';
    side.optionsByFormat.svg = structuredClone(output.options);
  } else {
    side.format = output.encoder.type;
    side.optionsByFormat[output.encoder.type] = structuredClone(
      output.encoder.options,
    ) as Record<string, unknown>;
  }
  side.processorState = structuredClone(recipe.processors);
  return { rotate: { rotate: recipe.rotate } };
}
