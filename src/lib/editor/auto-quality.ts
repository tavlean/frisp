// Auto quality: find the lowest encoder quality whose output still meets a
// perceptual target, scored with SSIMULACRA2 against the processed image the
// encoder received. Pure on purpose (no runes, no worker): EditorSession
// supplies the probe, which encodes and scores one quality, and this module
// owns only the search, so the bisection, the probe cap, the latency budget,
// and the abort rules are all testable with a stubbed probe.
//
// The score is treated as non-decreasing in quality. Near a mode boundary it
// can wobble; bisection keeps the best PASSING probe, so the worst case is a
// slightly higher quality than optimal, never a result below the target.

export type AutoQualityTarget =
  | 'visually-lossless'
  | 'high'
  | 'balanced'
  | 'compact';

/** SSIMULACRA2 anchors from the reference README: 90 is visually lossless,
 *  70 high ("artifacts perceptible but not annoying"). The four presets are
 *  shared verbatim with the planned CLI. */
export const AUTO_QUALITY_TARGETS: Record<AutoQualityTarget, number> = {
  'visually-lossless': 90,
  high: 80,
  balanced: 70,
  compact: 60,
};

export const AUTO_QUALITY_LABELS: Record<AutoQualityTarget, string> = {
  'visually-lossless': 'Visually lossless',
  high: 'High',
  balanced: 'Balanced',
  compact: 'Compact',
};

/** Quality range the search may probe, per encoder. A format absent here has
 *  no Auto action. `hi` must stay below any value that flips the encoder into
 *  a lossless mode (AVIF and JXL at 100), since that is a different encoder
 *  with different semantics, not a higher quality. WebP proves the feature
 *  first; adding a codec is one entry. */
export const AUTO_QUALITY_BOUNDS: Readonly<
  Record<string, { lo: number; hi: number }>
> = {
  webP: { lo: 0, hi: 100 },
};

/** Stop starting new probes once a search has run this long. The default;
 *  the editor scales it with image size (autoQualityBudgetMs). */
export const AUTO_QUALITY_BUDGET_MS = 8000;
const BUDGET_MS_PER_EXTRA_MEGAPIXEL = 1000;
const BUDGET_FREE_MEGAPIXELS = 2;
const MAX_BUDGET_MS = 20000;

/** The search budget for a frame of this size: 8 s, plus 1 s per megapixel
 *  above 2, capped at 20 s. Every probe encodes the full frame, so a larger
 *  image needs longer to fit the same number of probes. An unknown size (0)
 *  gets the base budget. */
export function autoQualityBudgetMs(width: number, height: number): number {
  const megapixels = (width * height) / 1_000_000;
  const extra = Math.max(0, megapixels - BUDGET_FREE_MEGAPIXELS);
  return Math.min(
    MAX_BUDGET_MS,
    AUTO_QUALITY_BUDGET_MS + extra * BUDGET_MS_PER_EXTRA_MEGAPIXEL,
  );
}

/** True when a search result is only a guess: the budget stopped it before
 *  any probe below the ceiling passed, so the ceiling quality was never
 *  chosen by the target. The editor commits nothing in that case. A ceiling
 *  that FAILED within budget is not a guess: it is the honest best. */
export function isBudgetGuess(
  result: Pick<SearchQualityResult<QualityProbe>, 'timedOut' | 'quality'>,
  hi: number,
): boolean {
  return result.timedOut && result.quality === hi;
}

/** 1 ceiling probe plus at most 7 bisection steps. */
const MAX_BISECTION_STEPS = 7;

export interface QualityProbe {
  /** SSIMULACRA2 score of this quality's output. */
  score: number;
}

export interface SearchQualityOptions<P extends QualityProbe> {
  /** Encode and score one integer quality. */
  probe: (quality: number) => Promise<P>;
  lo: number;
  hi: number;
  /** Minimum passing score. */
  target: number;
  signal?: AbortSignal;
  budgetMs?: number;
  /** Clock in ms; injectable for tests. */
  now?: () => number;
  /** Called once for every probe result the search will not return, as soon
   *  as that is known, so the caller can release what it holds (object URLs). */
  discard?: (result: P) => void;
}

export interface SearchQualityResult<P extends QualityProbe> {
  quality: number;
  score: number;
  /** The returned quality meets the target. */
  met: boolean;
  /** Encodes issued (never more than 8). */
  probes: number;
  /** The budget ran out before the search finished. */
  timedOut: boolean;
  /** The probe result for `quality`, handed over to the caller. */
  result: P;
}

function abortError(): DOMException {
  return new DOMException('AbortError', 'AbortError');
}

/**
 * The lowest quality in [lo, hi] whose score meets `target`. Probes `hi`
 * first: if even that misses, the search returns it as the honest best
 * (`met` false) instead of looping. Otherwise it bisects with the invariant
 * "hi passes, lo fails", where lo starts one below the range so `lo` itself
 * can win. An abort at any await rejects with an AbortError and discards
 * every result held, so an aborted search hands nothing back to commit.
 */
export async function searchQuality<P extends QualityProbe>({
  probe,
  lo: minQ,
  hi: maxQ,
  target,
  signal,
  budgetMs = AUTO_QUALITY_BUDGET_MS,
  now = () => performance.now(),
  discard,
}: SearchQualityOptions<P>): Promise<SearchQualityResult<P>> {
  const start = now();
  const overBudget = () => now() - start > budgetMs;
  let probes = 0;
  // Every result the search still holds, released together on abort.
  const held = new Set<P>();
  const release = (result: P) => {
    held.delete(result);
    discard?.(result);
  };
  const run = async (quality: number): Promise<P> => {
    if (signal?.aborted) throw abortError();
    probes += 1;
    const result = await probe(quality);
    held.add(result);
    if (signal?.aborted) throw abortError();
    return result;
  };
  const finish = (
    quality: number,
    result: P,
    timedOut: boolean,
  ): SearchQualityResult<P> => ({
    quality,
    score: result.score,
    met: result.score >= target,
    probes,
    timedOut,
    result,
  });

  try {
    const ceiling = await run(maxQ);
    if (ceiling.score < target) return finish(maxQ, ceiling, overBudget());

    let best = { quality: maxQ, result: ceiling };
    let lo = minQ - 1;
    let hi = maxQ;
    for (let step = 0; step < MAX_BISECTION_STEPS && hi - lo > 1; step++) {
      if (overBudget()) return finish(best.quality, best.result, true);
      const mid = Math.round((lo + hi) / 2);
      if (mid <= lo || mid >= hi) break;
      const result = await run(mid);
      if (result.score >= target) {
        release(best.result);
        best = { quality: mid, result };
        hi = mid;
      } else {
        release(result);
        lo = mid;
      }
    }
    return finish(best.quality, best.result, false);
  } catch (error) {
    for (const result of [...held]) release(result);
    throw error;
  }
}

/** What an encoder panel needs to offer the Auto action for its side. Hosts
 *  without an auto-quality session (bulk, the labs) pass none, and the panel
 *  shows no Auto row. */
export interface AutoQualityControl {
  running: boolean;
  run: (target: AutoQualityTarget) => void;
  cancel: () => void;
}
