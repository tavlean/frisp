// The browser's own pixel work, done in a worker through OffscreenCanvas:
// decoding a file the browser understands, and the nearest-neighbour resize.
// Every supported browser has both in workers (Chrome 121, Firefox 115,
// Safari 17; see docs/browser-support.md).

import { getContainOffsets } from '#features/processors/resize/shared/util.ts';
import type { BrowserResizeOptions } from '#features/processors/resize/shared/meta.ts';

function context2d(
  width: number,
  height: number,
): OffscreenCanvasRenderingContext2D {
  if (typeof OffscreenCanvas === 'undefined') {
    throw Error('This browser cannot draw images in a worker.');
  }
  const ctx = new OffscreenCanvas(width, height).getContext('2d');
  if (!ctx) throw Error('Could not create a canvas context.');
  return ctx;
}

/** Decode with the browser, honoring EXIF orientation as an <img> would
 *  (createImageBitmap's default), the same pixels the main thread got.
 *
 *  WebKit draws through its GPU process, and when that process dies during
 *  a decode the readback is all zero bytes with no error: a blank frame the
 *  encoder turns into a fully transparent file the user can save (measured
 *  2026-11-19 by killing the process mid-decode). So an all-zero frame is
 *  decoded once more. A source that really is transparent black decodes the
 *  same twice and is kept. */
export async function nativeDecode(blob: Blob): Promise<ImageData> {
  const image = await drawDecoded(blob);
  return isAllZero(image) ? drawDecoded(blob) : image;
}

/** Stops at the first nonzero pixel, so a normal frame costs a few reads. */
function isAllZero(image: ImageData): boolean {
  return new Uint32Array(image.data.buffer).every((word) => word === 0);
}

async function drawDecoded(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  try {
    const ctx = context2d(bitmap.width, bitmap.height);
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

/** Nearest-neighbour: hard, blocky pixels with no smoothing. */
export function pixelatedResize(
  data: ImageData,
  options: BrowserResizeOptions,
): ImageData {
  let sx = 0;
  let sy = 0;
  let sw = data.width;
  let sh = data.height;
  if (options.fitMethod === 'contain') {
    ({ sx, sy, sw, sh } = getContainOffsets(
      sw,
      sh,
      options.width,
      options.height,
    ));
  }
  const source = context2d(data.width, data.height);
  source.putImageData(data, 0, 0);
  const dest = context2d(options.width, options.height);
  dest.imageSmoothingEnabled = false;
  dest.drawImage(
    source.canvas,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    options.width,
    options.height,
  );
  return dest.getImageData(0, 0, options.width, options.height);
}
