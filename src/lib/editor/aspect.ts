// Nearest-aspect inference for the contextual image-info panel (design doc §4).
//
// Given natural pixel dimensions, pick the closest common photographic aspect
// ratio (and its portrait inverse). Comparison is in LOG space — |log(ratio /
// candidate)| — so a given proportional error reads the same whether the image
// is wider or taller than the candidate (2:1 vs 1:2 are symmetric). We mark the
// label "approximate" (≈) when the image's true ratio deviates from the winning
// candidate by more than a small relative tolerance, so "16:9" means "actually
// 16:9" and "≈ 16:9" means "close enough to read as 16:9".

export interface InferredAspect {
  /** e.g. "16:9" (exact-ish) or "≈ 21:9" (approximate). */
  label: string;
  /** True when the relative error exceeds APPROX_TOLERANCE. */
  approx: boolean;
}

/** Landscape candidates; each is also tried as its portrait inverse (h:w). */
const CANDIDATES: readonly [w: number, h: number][] = [
  [1, 1],
  [5, 4],
  [4, 3],
  [3, 2],
  [16, 10],
  [16, 9],
  [21, 9],
  [2, 1],
  [3, 1],
];

// Above this relative error the label is prefixed "≈". 1.5% is tight enough
// that a true 3:2 photo (1.5000) never reads as "≈ 3:2", but a 1920×1280 crop
// that is a hair off still snaps to the intended ratio with the ≈ hint.
const APPROX_TOLERANCE = 0.015;

function formatRatio(w: number, h: number): string {
  return `${w}:${h}`;
}

/**
 * Nearest common aspect ratio for the given pixel dimensions. Square inputs
 * short-circuit to "1:1". Zero/invalid dimensions fall back to "1:1" (approx),
 * which never happens for a real decoded image but keeps the return total.
 */
export function inferAspect(w: number, h: number): InferredAspect {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return { label: '1:1', approx: true };
  }

  const ratio = w / h;
  const logRatio = Math.log(ratio);

  let bestLabel = '1:1';
  let bestDistance = Infinity;

  for (const [cw, ch] of CANDIDATES) {
    // Portrait images want the inverse candidate (e.g. 9:16 not 16:9).
    const portrait = h > w;
    const [aw, ah] = portrait ? [ch, cw] : [cw, ch];
    const candidateRatio = aw / ah;
    const distance = Math.abs(logRatio - Math.log(candidateRatio));

    if (distance < bestDistance) {
      bestDistance = distance;
      bestLabel = formatRatio(aw, ah);
    }
  }

  // Relative error of the true ratio vs the exponentiated best log-distance.
  // exp(distance) - 1 is the proportional gap between the image and the winner.
  const relativeError = Math.exp(bestDistance) - 1;
  const approx = relativeError > APPROX_TOLERANCE;

  return {
    label: approx ? `≈ ${bestLabel}` : bestLabel,
    approx,
  };
}
