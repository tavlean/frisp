// Runs one ImageRecipe on one prepared source. The single dispatch point for
// the three lanes (SVG optimize, JPEG-to-JXL transcode, pixel encode), so the
// editor and bulk cannot disagree about which lane a recipe takes.
//
// Lives in $lib rather than the engine because the SVG lane does, and that
// lane is reached only through a dynamic import: a static one would pull SVGO
// and fflate into the main bundle (audit:static-output trips on it).

import {
  compressPreprocessed,
  transcodeJpegToJxl,
  TranscodeUnsupportedError,
  type CompressOutcome,
  type EncodedOutcome,
} from './compress';
import type SvelteKitWorkerBridge from './sveltekit-worker-bridge';
import type { SvgOptimizeOptions } from './svg/optimize-options';
import { isSvgSource } from './svg/detect';
import type { SourceImage } from 'client/lazy-app/image-pipeline';
import {
  recipeChangesPixels,
  type ImageRecipe,
  type SourceDimensions,
} from 'client/lazy-app/recipe';

export type Lane = 'svg' | 'transcode' | 'pixels';

/**
 * Which lane a recipe takes for this file. The transcode reuses the JPEG's own
 * DCT coefficients, so it is only honest while nothing changes a pixel; the UI
 * blocks the combination, but this decides for itself rather than trust it.
 * `source` is the unrotated decoded size. `file.type` is the only "is this a
 * JPEG" test on purpose: a file that lies about its type fails in the wrapper
 * and falls back, and two sniffers would be two answers.
 */
export function chooseLane(
  file: File,
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

export interface OptimizeOptions {
  signal: AbortSignal;
  bridge: SvelteKitWorkerBridge;
  /** Decode the output back to ImageData for an on-screen preview. Bulk
   *  passes false: it never shows full-size output pixels. */
  preview: boolean;
  /** The SVG source text, when the caller already holds it; read from the
   *  file otherwise. */
  svgText?: Promise<string>;
}

type FellBack = { transcodeFellBack?: true };

/** Run one recipe on one source. The single dispatch point for the three
 *  lanes: SVG optimize when output.kind is 'svg' (source must be SVG), the
 *  JPEG to JXL transcode when the JXL flag is set, the source is a JPEG, and
 *  recipeChangesPixels is false (TranscodeUnsupportedError falls back to a
 *  pixel encode and is reported in the result), else the pixel pipeline.
 *  `source` is decoded and rotated, as EditorSession's #preparedSource returns
 *  it. Caller owns `outputUrl` and must revoke it when done. */
export function optimizeImage(
  source: SourceImage,
  recipe: ImageRecipe,
  options: OptimizeOptions & { preview: true },
): Promise<CompressOutcome & FellBack>;
export function optimizeImage(
  source: SourceImage,
  recipe: ImageRecipe,
  options: OptimizeOptions,
): Promise<EncodedOutcome & FellBack>;
export async function optimizeImage(
  source: SourceImage,
  recipe: ImageRecipe,
  { signal, bridge, preview, svgText }: OptimizeOptions,
): Promise<EncodedOutcome & FellBack> {
  const { file, decoded, preprocessed } = source;
  const lane = chooseLane(file, recipe, {
    width: decoded.width,
    height: decoded.height,
  });
  const { output } = recipe;

  if (output.kind === 'svg') {
    const [{ optimizeSvgSide }, text] = await Promise.all([
      import('$lib/svg/optimize'),
      svgText ?? file.text(),
    ]);
    // The vector lane renders at the prepared (rasterized) size; it always
    // renders its previews, since auto mode needs them for the visual gate.
    return optimizeSvgSide(
      text,
      file.name,
      output.options as unknown as SvgOptimizeOptions,
      preprocessed.width,
      preprocessed.height,
      signal,
    );
  }

  const encodePixels = () =>
    compressPreprocessed(
      source,
      {
        format: output.encoder.type,
        options: output.encoder.options,
        processorState: recipe.processors,
        preprocessorState: { rotate: { rotate: recipe.rotate } },
      },
      signal,
      bridge,
      preview,
    );

  if (lane === 'transcode') {
    try {
      return await transcodeJpegToJxl(source, signal, bridge, preview);
    } catch (error) {
      // Only "libjxl won't take this JPEG" falls through; a real failure (or
      // an abort) still propagates. The flag stays in the signature, so this
      // input deterministically lands on the same pixel-encoded result.
      if (!(error instanceof TranscodeUnsupportedError)) throw error;
      return { ...(await encodePixels()), transcodeFellBack: true };
    }
  }
  return encodePixels();
}
