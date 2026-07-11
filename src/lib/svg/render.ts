// The visual gate needs deterministic pixel buffers, but SVG decoding must
// remain on the main-thread <img> path for Safari and dimensionless viewBox
// documents. The existing import pipeline owns those compatibility rules.

import { processSvg } from 'client/lazy-app/image-pipeline-shared';

export async function renderSvgToImageData(
  svgText: string,
  width: number,
  height: number,
  background: string | null,
  signal: AbortSignal,
): Promise<ImageData> {
  const image = await processSvg(
    signal,
    new Blob([svgText], { type: 'image/svg+xml' }),
  );
  signal.throwIfAborted();

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  if (background !== null) {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}
