// Which lane a recipe takes for one source: the SVG optimizer, the lossless
// JPEG to JXL transcode, or a pixel encode. Framework-neutral so the main
// thread (SVG lane) and the codec worker (transcode or pixels, once it knows
// the decoded size) answer the question with the same code.

import { isSvgSource } from './svg-source';
import {
  recipeChangesPixels,
  type ImageRecipe,
  type SourceDimensions,
} from './recipe';

export type Lane = 'svg' | 'transcode' | 'pixels';

/** What lane choice reads from a file. A structured-cloned File in a worker
 *  keeps both fields. */
export type LaneFile = Pick<File, 'type' | 'name'>;

/**
 * Which lane a recipe takes for this file. The transcode reuses the JPEG's own
 * DCT coefficients, so it is only honest while nothing changes a pixel; the UI
 * blocks the combination, but this decides for itself rather than trust it.
 * `source` is the unrotated decoded size. `file.type` is the only "is this a
 * JPEG" test on purpose: a file that lies about its type fails in the wrapper
 * and falls back, and two sniffers would be two answers.
 */
export function chooseLane(
  file: LaneFile,
  recipe: ImageRecipe,
  source: SourceDimensions,
): Lane {
  const { output } = recipe;
  if (output.kind === 'svg') {
    if (!isSvgSource(file)) throw Error('Only an SVG source can stay vector.');
    return 'svg';
  }
  const { encoder } = output;
  if (
    encoder.type === 'jxl' &&
    encoder.options.jpegTranscode === true &&
    file.type === 'image/jpeg' &&
    !recipeChangesPixels(recipe, source)
  ) {
    return 'transcode';
  }
  return 'pixels';
}
