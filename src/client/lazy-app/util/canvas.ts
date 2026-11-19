import { readPixels } from '#shared/canvas-readback.ts';

/** Replace the contents of a canvas with the given data */
export function drawDataToCanvas(canvas: HTMLCanvasElement, data: ImageData) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('Canvas not initialized');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.putImageData(data, 0, 0);
}

interface DrawableToImageDataOptions {
  width?: number;
  height?: number;
  sx?: number;
  sy?: number;
  sw?: number;
  sh?: number;
}

/** The drawable's pixels through a fresh canvas, protected by readPixels
 *  (src/shared/canvas-readback.ts). */
export function drawableToImageData(
  drawable: ImageBitmap | HTMLImageElement,
  opts: DrawableToImageDataOptions = {},
): Promise<ImageData> {
  return readPixels(() => drawToImageData(drawable, opts));
}

function drawToImageData(
  drawable: ImageBitmap | HTMLImageElement,
  opts: DrawableToImageDataOptions,
): ImageData {
  const {
    width = drawable.width,
    height = drawable.height,
    sx = 0,
    sy = 0,
    sw = drawable.width,
    sh = drawable.height,
  } = opts;

  // Make canvas same size as image
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  // Draw image onto canvas
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context');
  ctx.drawImage(drawable, sx, sy, sw, sh, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}
