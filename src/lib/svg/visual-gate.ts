// The auto optimizer needs a scale-independent visual verdict: mismatches are
// normalized by painted content, not by transparent canvas area, so sparse
// icons cannot hide meaningful changes inside a large viewport.

import pixelmatch from 'pixelmatch';

export function paintedUnion(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
): number {
  let painted = 0;
  for (let i = 3; i < a.length; i += 4) {
    if (a[i] > 0 || b[i] > 0) painted++;
  }
  return painted;
}

export function gatePasses(
  original: ImageData,
  candidate: ImageData,
  painted: number,
): boolean {
  const mismatched = pixelmatch(
    original.data,
    candidate.data,
    null as unknown as Uint8Array,
    original.width,
    original.height,
    { threshold: 0.1 },
  );
  return mismatched / Math.max(painted, 1) <= 5e-4;
}
