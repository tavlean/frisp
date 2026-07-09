/**
 * A short, uppercase format label from a file's MIME type or extension —
 * "JPEG", "WebP", "SVG"… — for the image-info rows and batch summaries.
 * Unrecognized-but-present types fall back to the raw token uppercased;
 * a file with neither readable MIME nor extension reads as "Image".
 */
const LABELS: Record<string, string> = {
  jpeg: 'JPEG',
  jpg: 'JPEG',
  jfif: 'JPEG',
  png: 'PNG',
  webp: 'WebP',
  avif: 'AVIF',
  gif: 'GIF',
  'svg+xml': 'SVG',
  svg: 'SVG',
  jxl: 'JPEG XL',
  qoi: 'QOI',
  bmp: 'BMP',
  tiff: 'TIFF',
  tif: 'TIFF',
};

export function formatLabel(source: File): string {
  const fromMime = source.type.split('/')[1]?.toLowerCase() ?? '';
  const fromExt = source.name.includes('.')
    ? source.name.split('.').pop()!.toLowerCase()
    : '';
  const raw = fromMime || fromExt;
  return LABELS[raw] ?? (raw ? raw.toUpperCase() : 'Image');
}
