// Final crop render for the porcelain-lab crop tool. This MUST stay in
// lockstep with the stage's preview transform (CropStage draws the same
// world → the stage shows exactly what this produces).

import type { CropBackground, CropState } from './crop-types';
import { outputSize, snapRectToPixels } from './crop-geometry';

const DEG = Math.PI / 180;

/**
 * Render the crop to a canvas of the rect's output size. Empty areas (beyond
 * the image) stay transparent unless a background color is given. When the
 * straighten angle is exactly 0 the rect is snapped to the image pixel grid
 * first so a pure crop is resample-free.
 */
export function renderCrop(
  bitmap: ImageBitmap,
  state: CropState,
  background: CropBackground,
): HTMLCanvasElement {
  const snapped = snapRectToPixels(state, bitmap.width, bitmap.height);
  const { rect } = snapped;
  const { w, h } = outputSize(rect);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create 2d context for crop render');

  if (background.kind === 'color') {
    ctx.fillStyle = background.css;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(w / 2 - rect.cx, h / 2 - rect.cy);
  ctx.rotate((snapped.orientation + snapped.angleDeg) * DEG);
  ctx.scale(snapped.flipH ? -1 : 1, snapped.flipV ? -1 : 1);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  return canvas;
}

/** Render and package as a PNG File (keeps alpha), named `${stem}.png`. */
export async function cropToPngFile(
  bitmap: ImageBitmap,
  state: CropState,
  background: CropBackground,
  originalName: string,
): Promise<File> {
  const canvas = renderCrop(bitmap, state, background);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))),
      'image/png',
    );
  });
  const stem = originalName.includes('.')
    ? originalName.slice(0, originalName.lastIndexOf('.'))
    : originalName;
  return new File([blob], `${stem || 'image'}.png`, { type: 'image/png' });
}

/** Read one image pixel (for background sample-from-image), as a CSS color. */
export function sampleImageColor(
  bitmap: ImageBitmap,
  imageX: number,
  imageY: number,
): string | null {
  const x = Math.floor(imageX);
  const y = Math.floor(imageY);
  if (x < 0 || y < 0 || x >= bitmap.width || y >= bitmap.height) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bitmap, x, y, 1, 1, 0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  const hex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
