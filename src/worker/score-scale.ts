// Picks what SSIMULACRA2 scores when the frame is large. The metric is a
// multiscale pass over the full frame and costs about 3 s at 12 MP in the
// worker, more than the encode it judges, so an auto-quality search on a
// large photo ran out of budget after two probes. Above SCORE_SAMPLE_PIXELS
// the metric scores four full-resolution tiles instead, one centred in each
// quadrant, and the worst tile counts.
//
// Why tiles and not a shrunk frame: box-shrinking both frames alike (the
// first approach, 2026-11-04) averaged codec artifacts away before the
// metric saw them. On the 12 MP fixture, jpegli at quality 24 scored 70.4
// shrunk 2x and 55.3 at full size, so Auto settled on visibly blocky JPEGs.
// The worst of four tiles stayed within 1.6 points of the full-size score
// from quality 20 to 75, usually just under it, at the same cost as the
// shrunk frame: the four tiles together hold as many pixels as the frame
// shrunk to a long edge of 2048 px. Four tiles rather than one centre crop
// (within 3 points there) so a flat centre cannot vouch for a detailed edge.
// Separate calls rather than one mosaic of the tiles: the mosaic pools them
// into roughly their average (up to 4.5 points over full size measured), so
// a clean region would offset a damaged one, the same reason transparency
// is judged on two backgrounds with the worse score kept.
//
// A frame too thin for useful tiles (a side under SCORE_MIN_TILE_SIDE) falls
// back to the shrunk pair. Pure (ImageData is the only host type), so the
// unit tests run it directly.

export const SCORE_SAMPLE_PIXELS = 4_000_000;
export const SCORE_MAX_EDGE = 2048;
export const SCORE_MIN_TILE_SIDE = 64;

/** The whole factor that brings the long edge to at most SCORE_MAX_EDGE, 1
 *  when the frame is scored whole. Sizes the tiles (and the fallback
 *  shrink) so a large frame costs about what a 2048 px frame does. */
export function scoreScaleFactor(width: number, height: number): number {
  if (width * height <= SCORE_SAMPLE_PIXELS) return 1;
  return Math.ceil(Math.max(width, height) / SCORE_MAX_EDGE);
}

/** Average each `factor` x `factor` block of RGBA into one pixel. A partial
 *  block at the right or bottom edge is dropped, so every output pixel is a
 *  full block. Never writes to `image`. */
export function boxDownscale(image: ImageData, factor: number): ImageData {
  if (factor <= 1) return image;
  const { width, height, data } = image;
  const outWidth = Math.floor(width / factor);
  const outHeight = Math.floor(height / factor);
  const out = new Uint8ClampedArray(outWidth * outHeight * 4);
  const area = factor * factor;
  const sums = new Float64Array(outWidth * 4);
  for (let oy = 0; oy < outHeight; oy++) {
    sums.fill(0);
    for (let dy = 0; dy < factor; dy++) {
      let i = (oy * factor + dy) * width * 4;
      for (let ox = 0; ox < outWidth; ox++) {
        const s = ox * 4;
        for (let dx = 0; dx < factor; dx++, i += 4) {
          sums[s] += data[i];
          sums[s + 1] += data[i + 1];
          sums[s + 2] += data[i + 2];
          sums[s + 3] += data[i + 3];
        }
      }
    }
    const row = oy * outWidth * 4;
    for (let k = 0; k < outWidth * 4; k++) {
      out[row + k] = Math.round(sums[k] / area);
    }
  }
  return new ImageData(out, outWidth, outHeight);
}

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Copy one rectangle out of `image` at full resolution. The caller keeps
 *  the rectangle inside the frame. Never writes to `image`. */
export function cropRegion(image: ImageData, region: Region): ImageData {
  const { x, y, width, height } = region;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row++) {
    const start = ((y + row) * image.width + x) * 4;
    out.set(image.data.subarray(start, start + width * 4), row * width * 4);
  }
  return new ImageData(out, width, height);
}

/** The four tiles a large frame is scored on, one centred in each quadrant,
 *  or null when the frame is scored whole or is too thin for tiles. */
export function scoreTiles(width: number, height: number): Region[] | null {
  const factor = scoreScaleFactor(width, height);
  if (factor === 1) return null;
  // Four tiles of a quarter of the shrunk frame each.
  const tileWidth = Math.floor(width / factor / 2);
  const tileHeight = Math.floor(height / factor / 2);
  if (Math.min(tileWidth, tileHeight) < SCORE_MIN_TILE_SIDE) return null;
  const tiles: Region[] = [];
  for (const row of [0, 1]) {
    for (const column of [0, 1]) {
      tiles.push({
        x: Math.floor(((column + 0.5) * width) / 2 - tileWidth / 2),
        y: Math.floor(((row + 0.5) * height) / 2 - tileHeight / 2),
        width: tileWidth,
        height: tileHeight,
      });
    }
  }
  return tiles;
}

/** The pairs the metric should score; the caller keeps the worst score.
 *  Up to 4 MP: the frames themselves. Larger: four matching full-resolution
 *  tiles, or both frames shrunk alike when the frame is too thin for tiles.
 *  Expects equal sizes (the caller checks). */
export function scorePairs(
  ref: ImageData,
  dist: ImageData,
): [ImageData, ImageData][] {
  const factor = scoreScaleFactor(ref.width, ref.height);
  if (factor === 1) return [[ref, dist]];
  const tiles = scoreTiles(ref.width, ref.height);
  if (!tiles) return [[boxDownscale(ref, factor), boxDownscale(dist, factor)]];
  return tiles.map((tile) => [cropRegion(ref, tile), cropRegion(dist, tile)]);
}
