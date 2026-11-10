// The vector lane's whole pipeline: SVG text in, CompressOutcome out. Loaded
// ONLY via dynamic import (editor-session's svg dispatch) so svgo/fflate stay
// out of the main bundle — importing this module statically from app code
// would silently undo the lazy-chunk and service-worker cache design.

import { gzipSync, strToU8 } from 'fflate';
import type { CompressOutcome } from '#lib/compress.ts';
import { getPercentChange } from '#client/lazy-app/bulk/size.ts';
import type { SvgOptimizeOptions } from './optimize-options';
import { autoSearch } from './auto-search';
import { optimizeSvg } from './optimizer-client';
import { renderSvgToImageData } from './render';
import {
  buildSvgoConfig,
  UNVERIFIED_WINNER,
  type SvgCandidate,
} from './svgo-config';

const MAX_SVG_BYTES = 5 * 1024 * 1024;

export interface SvgTextStats {
  text: string;
  rawBytes: number;
  gzipBytes: number;
}

/**
 * Never ship a larger "optimized" file, nor one that failed Auto's own visual
 * gate: in either case the outcome reverts to the original text (the size
 * panel then shows 0% rather than a regression or an unchecked change).
 * Accepting visual changes for size is what Manual mode is for.
 */
export function keepOriginalSvg(
  source: SvgTextStats,
  optimized: SvgTextStats,
  verified = true,
) {
  return !verified || optimized.rawBytes >= source.rawBytes
    ? { ...source, keptOriginal: true }
    : { ...optimized, keptOriginal: false };
}

export async function optimizeSvgSide(
  sourceText: string,
  fileName: string,
  options: SvgOptimizeOptions,
  naturalWidth: number,
  naturalHeight: number,
  signal: AbortSignal,
): Promise<CompressOutcome> {
  const sourceBytes = strToU8(sourceText);
  if (sourceBytes.length > MAX_SVG_BYTES) {
    throw Error('SVG files larger than 5 MB cannot be optimized.');
  }
  const source: SvgTextStats = {
    text: sourceText,
    rawBytes: sourceBytes.length,
    gzipBytes: gzipSync(sourceBytes, { level: 9 }).length,
  };

  let winner: string | undefined;
  let optimized: SvgTextStats;
  let verified = true;
  if (options.mode === 'auto') {
    const searched = await autoSearch(
      sourceText,
      options,
      naturalWidth,
      naturalHeight,
      signal,
    );
    optimized = searched;
    winner = searched.winner;
    verified = searched.verified;
  } else {
    const addons: SvgCandidate['addons'] = [];
    if (options.reusePaths) addons.push('reusePaths');
    if (options.convertStyleToAttrs) addons.push('convertStyleToAttrs');
    if (options.removeOffCanvasPaths) addons.push('removeOffCanvasPaths');
    const config = buildSvgoConfig({
      precision: options.precision,
      multipass: options.multipass,
      keepTitleDesc: options.keepTitleDesc,
      addons,
      removeDimensions: options.removeDimensions,
    });
    const result = await optimizeSvg(
      sourceText,
      config,
      AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    );
    optimized = { text: result.svg, ...result };
  }
  const final = keepOriginalSvg(source, { ...optimized }, verified);
  // The badge must describe the file the user gets: when the original wins,
  // no candidate id applies, except to say the visual gate turned them down.
  if (final.keptOriginal) winner = verified ? undefined : UNVERIFIED_WINNER;
  const outputImageData = await renderSvgToImageData(
    final.text,
    naturalWidth,
    naturalHeight,
    null,
    signal,
  );
  const outputName = fileName.replace(/(?:\.[^.]+)?$/, '.svg');
  const outputFile = new File([final.text], outputName, {
    type: 'image/svg+xml',
  });

  return {
    outputFile,
    outputUrl: URL.createObjectURL(outputFile),
    outputSize: final.rawBytes,
    originalSize: source.rawBytes,
    percentChange: final.keptOriginal
      ? 0
      : Math.round(getPercentChange(source.rawBytes, final.rawBytes) * 10) / 10,
    outputImageData,
    isOriginal: false,
    preprocessedWidth: naturalWidth,
    preprocessedHeight: naturalHeight,
    svg: {
      optimizedText: final.text,
      rawBytes: final.rawBytes,
      gzipBytes: final.gzipBytes,
      originalGzipBytes: source.gzipBytes,
      winner,
    },
  };
}
