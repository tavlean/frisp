// Deterministic SVG auto-search: progressively trade numeric precision for
// transfer size, but admit a candidate only after multi-scale visual checks.
// Rendering stays here on the main thread; optimization alone lives in the worker.

import { optimizeSvg } from './optimizer-client';
import { renderSvgToImageData } from './render';
import {
  buildCandidateId,
  buildSvgoConfig,
  type SvgCandidate,
} from './svgo-config';
import { gatePasses, paintedUnion } from './visual-gate';

export interface CandidateStats {
  id: string;
  rawBytes: number;
  gzipBytes: number;
  passed: boolean;
}

interface SearchCandidate extends CandidateStats {
  text: string;
  precision: number;
  addons: SvgCandidate['addons'];
}

export function pickWinner<T extends CandidateStats>(
  candidates: T[],
): T | undefined {
  return candidates
    .filter((candidate) => candidate.passed)
    .toSorted((a, b) => {
      const aParts = a.id.split('+');
      const bParts = b.id.split('+');
      const aPrecision = Number.parseInt(aParts[0].slice(1), 10);
      const bPrecision = Number.parseInt(bParts[0].slice(1), 10);
      return (
        a.gzipBytes - b.gzipBytes ||
        a.rawBytes - b.rawBytes ||
        aParts.length - bParts.length ||
        bPrecision - aPrecision
      );
    })[0];
}

function renderSizes(width: number, height: number): [number, number][] {
  const natural = Math.max(width, height);
  // Small sources are gated at UPSCALED sizes on purpose: precision loss on a
  // 24px icon is invisible at 24px but obvious at 256px — and users zoom.
  // The browser re-rasterizes the vector at the requested size, so upscaled
  // renders are true vector renders, not bitmap enlargements.
  const targets = [64, 256, Math.min(natural, 1024)];
  const seen = new Set<string>();
  return targets.flatMap((target) => {
    const scale = target / natural;
    const size: [number, number] = [
      Math.max(1, Math.round(width * scale)),
      Math.max(1, Math.round(height * scale)),
    ];
    const key = size.join('x');
    if (seen.has(key)) return [];
    seen.add(key);
    return [size];
  });
}

export async function autoSearch(
  sourceText: string,
  opts: { multipass: boolean; keepTitleDesc: boolean },
  naturalWidth: number,
  naturalHeight: number,
  signal: AbortSignal,
): Promise<{
  text: string;
  rawBytes: number;
  gzipBytes: number;
  winner: string;
  verified: boolean;
}> {
  const sizes = renderSizes(naturalWidth, naturalHeight);
  const backgrounds = [null, '#ffffff', '#202124'] as const;
  const originals = await Promise.all(
    sizes.flatMap(([width, height]) =>
      backgrounds.map((background) =>
        renderSvgToImageData(sourceText, width, height, background, signal),
      ),
    ),
  );
  const candidates: SearchCandidate[] = [];
  // The first real failure (parse error, not gate rejection) — surfaced when
  // NO candidate survives, instead of a generic "no viable candidate".
  let firstError: unknown;

  const trial = async (
    precision: number,
    addons: SvgCandidate['addons'] = [],
  ): Promise<SearchCandidate | undefined> => {
    signal.throwIfAborted();
    const candidateSignal = AbortSignal.any([
      signal,
      AbortSignal.timeout(10_000),
    ]);
    let optimized;
    try {
      optimized = await optimizeSvg(
        sourceText,
        buildSvgoConfig({ ...opts, precision, addons }),
        candidateSignal,
      );
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      firstError ??= error;
      return undefined;
    }
    const renders = await Promise.all(
      sizes.flatMap(([width, height]) =>
        backgrounds.map((background) =>
          renderSvgToImageData(
            optimized.svg,
            width,
            height,
            background,
            signal,
          ),
        ),
      ),
    );
    let passed = true;
    for (let i = 0; i < renders.length; i += 3) {
      const painted = paintedUnion(originals[i].data, renders[i].data);
      if (
        !gatePasses(originals[i], renders[i], painted) ||
        !gatePasses(originals[i + 1], renders[i + 1], painted) ||
        !gatePasses(originals[i + 2], renders[i + 2], painted)
      ) {
        passed = false;
        break;
      }
    }
    const result = {
      id: buildCandidateId(precision, addons),
      text: optimized.svg,
      rawBytes: optimized.rawBytes,
      gzipBytes: optimized.gzipBytes,
      precision,
      addons,
      passed,
    };
    candidates.push(result);
    return result;
  };

  let lowest: SearchCandidate | undefined;
  const p3 = await trial(3);
  if (p3?.passed) {
    lowest = p3;
    for (const precision of [2, 1, 0]) {
      const candidate = await trial(precision);
      if (!candidate?.passed) break;
      lowest = candidate;
    }
  } else if (p3) {
    const p4 = await trial(4);
    if (!p4?.passed) {
      return { ...p3, winner: 'p3!', verified: false };
    }
    lowest = p4;
  } else {
    const p4 = await trial(4);
    if (p4?.passed) lowest = p4;
  }

  if (!lowest) {
    throw (
      firstError ?? Error('SVG auto optimization produced no viable candidate.')
    );
  }
  const kept: SearchCandidate[] = [];
  for (const addon of ['reusePaths', 'convertStyleToAttrs'] as const) {
    const candidate = await trial(lowest.precision, [addon]);
    if (candidate?.passed && candidate.gzipBytes < lowest.gzipBytes)
      kept.push(candidate);
  }
  if (kept.length === 2) {
    // The combined trial lands in `candidates`; pickWinner judges it there.
    await trial(lowest.precision, ['reusePaths', 'convertStyleToAttrs']);
  }
  const winner = pickWinner(candidates)!;
  return { ...winner, winner: winner.id, verified: true };
}
