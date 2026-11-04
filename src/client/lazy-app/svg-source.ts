import { abortable, assertSignal } from './abort';
import { blobToImg, blobToText } from './image-decode';
import { parseSvgViewBoxSize } from './util/svg';

/** Whether a file is an SVG source. The one sniffer the editor, bulk, and the
 *  SVG lane share: two would be two answers. */
export function isSvgSource(file: Pick<File, 'type' | 'name'>): boolean {
  return file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
}

/**
 * Load an SVG file as an <img> the canvas can rasterize. An SVG with only a
 * viewBox gets width and height from it, so it has an intrinsic size; one
 * with neither is rejected.
 */
export async function processSvg(
  signal: AbortSignal,
  blob: Blob,
): Promise<HTMLImageElement> {
  assertSignal(signal);
  const parser = new DOMParser();
  const text = await abortable(signal, blobToText(blob));
  const document = parser.parseFromString(text, 'image/svg+xml');
  const svg = document.documentElement!;

  if (svg.hasAttribute('width') && svg.hasAttribute('height')) {
    return blobToImg(blob);
  }

  const viewBox = svg.getAttribute('viewBox');
  if (viewBox === null) throw Error('SVG must have width/height or viewBox');

  const viewBoxSize = parseSvgViewBoxSize(viewBox);
  if (!viewBoxSize) throw Error('Invalid SVG viewBox');
  svg.setAttribute('width', viewBoxSize.width);
  svg.setAttribute('height', viewBoxSize.height);

  const serializer = new XMLSerializer();
  const newSource = serializer.serializeToString(document);
  return abortable(
    signal,
    blobToImg(new Blob([newSource], { type: 'image/svg+xml' })),
  );
}
