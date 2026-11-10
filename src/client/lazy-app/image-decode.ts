import { blobToArrayBuffer } from '#shared/blob.ts';

async function decodeImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(Error('Image loading error'));
  });

  if (img.decode) {
    // Nice off-thread way supported in Safari/Chrome.
    // Safari throws on decode if the source is SVG.
    // https://bugs.webkit.org/show_bug.cgi?id=188347
    await img.decode().catch(() => null);
  }

  // Always await loaded, as we may have bailed due to the Safari bug above.
  await loaded;
  return img;
}

export function blobToText(blob: Blob): Promise<string> {
  return new Response(blob).text();
}

const magicNumberMapInput = [
  [/^%PDF-/, 'application/pdf'],
  [/^GIF87a/, 'image/gif'],
  [/^GIF89a/, 'image/gif'],
  [/^\x89PNG\x0D\x0A\x1A\x0A/, 'image/png'],
  [/^\xFF\xD8\xFF/, 'image/jpeg'],
  [/^BM/, 'image/bmp'],
  [/^II\x2A\x00/, 'image/tiff'],
  [/^MM\x00\x2A/, 'image/tiff'],
  [/^RIFF....WEBPVP8[LX ]/s, 'image/webp'],
  [/^.{4}ftypavif/s, 'image/avif'],
  [/^\xff\x0a/, 'image/jxl'],
  [/^\x00\x00\x00\x0cJXL \x0d\x0a\x87\x0a/, 'image/jxl'],
  [/^qoif/, 'image/qoi'],
] as const;

export type ImageMimeTypes = (typeof magicNumberMapInput)[number][1];

const magicNumberToMimeType = new Map<RegExp, ImageMimeTypes>(
  magicNumberMapInput,
);

export async function sniffMimeType(blob: Blob): Promise<ImageMimeTypes | ''> {
  const firstChunk = await blobToArrayBuffer(blob.slice(0, 16));
  const firstChunkString = Array.from(new Uint8Array(firstChunk))
    .map((v) => String.fromCodePoint(v))
    .join('');
  for (const [detector, mimeType] of magicNumberToMimeType) {
    if (detector.test(firstChunkString)) {
      return mimeType;
    }
  }
  return '';
}

export async function blobToImg(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);

  try {
    return await decodeImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
