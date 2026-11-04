// Shrinks a large reference/output pair before SSIMULACRA2 scores it. The
// metric is a multiscale pass over the full frame and costs about 3 s at
// 12 MP in the worker, more than the WebP encode it judges, so an
// auto-quality search on a large photo ran out of budget after two probes.
// Above SCORE_DOWNSCALE_PIXELS both frames are box-filtered by the same whole
// factor until the long edge is at most SCORE_MAX_EDGE. The two frames get
// identical treatment, so the comparison stays fair; what changes is that
// artifacts finer than the factor are averaged away before the metric sees
// them, which a viewer at fit-to-screen would not resolve either.
//
// Pure (ImageData is the only host type), so the unit tests run it directly.

export const SCORE_DOWNSCALE_PIXELS = 4_000_000;
export const SCORE_MAX_EDGE = 2048;

/** The whole box factor for a frame, 1 when it is scored at full size. */
export function scoreScaleFactor(width: number, height: number): number {
  if (width * height <= SCORE_DOWNSCALE_PIXELS) return 1;
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

/** The pair the metric should score: both frames as they are, or both
 *  shrunk by the same factor. Expects equal sizes (the caller checks). */
export function scorePair(
  ref: ImageData,
  dist: ImageData,
): [ImageData, ImageData] {
  const factor = scoreScaleFactor(ref.width, ref.height);
  return [boxDownscale(ref, factor), boxDownscale(dist, factor)];
}
