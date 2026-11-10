// How bulk turns the shared recipe into each image's recipe. Bulk stores ONE
// shared recipe plus, per image, either nothing or a full own copy (no
// per-field inheritance), so the only per-source step left is the resize
// preset: a shared 25, 50 or 100 percent resize means that fraction of EACH
// source, not the reference image's pixel size.

import { stableStringify } from '#shared/stable-stringify.ts';
import type { ImageRecipe } from '../recipe';

export interface BulkSourceDimensions {
  width?: number;
  height?: number;
}

const resizePresets = [0.25, 0.5, 1] as const;

export function hasPositiveDimensions(
  dimensions: BulkSourceDimensions | undefined,
): dimensions is Required<BulkSourceDimensions> {
  if (!dimensions) return false;
  const { width, height } = dimensions;
  return Boolean(
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width !== undefined &&
    height !== undefined &&
    width > 0 &&
    height > 0,
  );
}

function getMatchingResizePreset(
  width: number,
  height: number,
  inputWidth: number,
  inputHeight: number,
): number | 'custom' {
  for (const preset of resizePresets) {
    if (
      width === Math.round(inputWidth * preset) &&
      height === Math.round(inputHeight * preset)
    ) {
      return preset;
    }
  }
  return 'custom';
}

/**
 * The shared recipe for one source: a resize that matches a preset of the
 * reference size is rescaled to the same preset of this source. Custom sizes
 * apply as given. Returns the input untouched when nothing needs resolving.
 */
export function resolveRecipeForSource(
  recipe: ImageRecipe,
  resizeReference: BulkSourceDimensions | undefined,
  sourceDimensions: BulkSourceDimensions | undefined,
): ImageRecipe {
  const resize = recipe.processors.resize;
  if (
    !resize.enabled ||
    !hasPositiveDimensions(resizeReference) ||
    !hasPositiveDimensions(sourceDimensions)
  ) {
    return recipe;
  }

  const preset = getMatchingResizePreset(
    resize.width,
    resize.height,
    resizeReference.width,
    resizeReference.height,
  );
  if (preset === 'custom') return recipe;

  return {
    ...recipe,
    processors: {
      ...recipe.processors,
      resize: {
        ...resize,
        width: Math.round(sourceDimensions.width * preset),
        height: Math.round(sourceDimensions.height * preset),
      },
    },
  };
}

const sameValue = (a: unknown, b: unknown) =>
  stableStringify(a) === stableStringify(b);

/**
 * Carry what changed between two versions of one image's recipe onto another
 * recipe, part by part (rotation, output, each processor), keeping everything
 * else of the target. This is how one edit lands on several selected images
 * without flattening their other differences, and how an edit lands on the
 * shared recipe when every image is selected.
 */
export function applyRecipeChanges(
  target: ImageRecipe,
  before: ImageRecipe,
  after: ImageRecipe,
): ImageRecipe {
  const pick = <T>(was: T, now: T, kept: T): T =>
    sameValue(was, now) ? kept : now;
  return {
    rotate: pick(before.rotate, after.rotate, target.rotate),
    output: pick(before.output, after.output, target.output),
    processors: {
      grain: pick(
        before.processors.grain,
        after.processors.grain,
        target.processors.grain,
      ),
      quantize: pick(
        before.processors.quantize,
        after.processors.quantize,
        target.processors.quantize,
      ),
      resize: pick(
        before.processors.resize,
        after.processors.resize,
        target.processors.resize,
      ),
    },
  };
}
