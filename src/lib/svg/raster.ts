// The main-thread half of an SVG source on a raster lane. Rasterizing an SVG
// needs the DOM (an <img> element), so it cannot move into the codec worker
// with the rest of the pipeline: the worker receives these pixels instead.

import { abortable } from 'client/lazy-app/abort';
import { processSvg } from 'client/lazy-app/image-pipeline-shared';
import { drawableToImageData } from 'client/lazy-app/util/canvas';
import { getContainOffsets } from 'features/processors/resize/shared/util';
import type { VectorResizeOptions } from 'features/processors/resize/shared/meta';
import type { Rotation } from 'client/lazy-app/recipe';

export interface SvgRaster {
  /** Drawn again at another size for a vector resize. */
  image: HTMLImageElement;
  /** The SVG at its natural size. */
  raster: ImageData;
}

export async function rasterizeSvg(
  signal: AbortSignal,
  file: File,
): Promise<SvgRaster> {
  const image = await abortable(signal, processSvg(signal, file));
  return { image, raster: drawableToImageData(image) };
}

/** The SVG drawn at a resize target, in the source's own orientation: the
 *  worker rotates it afterwards, so a quarter turn swaps the target back. */
export function vectorResize(
  image: HTMLImageElement,
  options: VectorResizeOptions,
  rotate: Rotation,
): ImageData {
  const quarter = rotate % 180 !== 0;
  const width = quarter ? options.height : options.width;
  const height = quarter ? options.width : options.height;
  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;
  if (options.fitMethod === 'contain') {
    ({ sx, sy, sw, sh } = getContainOffsets(sw, sh, width, height));
  }
  return drawableToImageData(image, { sx, sy, sw, sh, width, height });
}
