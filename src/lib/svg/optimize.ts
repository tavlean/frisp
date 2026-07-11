// The vector lane's whole pipeline: SVG text in, CompressOutcome out. Loaded
// ONLY via dynamic import (editor-session's svg dispatch) so svgo/fflate stay
// out of the main bundle — importing this module statically from app code
// would silently undo the lazy-chunk and service-worker cache design.

import { gzipSync, strToU8 } from 'fflate';
import type { CompressOutcome } from '$lib/compress';
import { getPercentChange } from 'client/lazy-app/bulk/size';
import type { SvgOptimizeOptions } from './optimize-options';
import { optimizeSvg } from './optimizer-client';
import { renderSvgToImageData } from './render';
import { buildSvgoConfig, type SvgCandidate } from './svgo-config';

const MAX_SVG_BYTES = 5 * 1024 * 1024;

export interface SvgTextStats {
  text: string;
  rawBytes: number;
  gzipBytes: number;
}

/**
 * Never ship a larger "optimized" file: below the threshold the optimizer's
 * output wins, at or above it the outcome silently reverts to the original
 * text (the size panel then shows 0% rather than a regression).
 */
export function keepOriginalSvg(source: SvgTextStats, optimized: SvgTextStats) {
  return optimized.rawBytes >= source.rawBytes
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

  const wrappedSignal = AbortSignal.any([signal, AbortSignal.timeout(10_000)]);
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
  // Stage S2 runs auto mode through the same manual path; search lands in S5.
  const optimized = await optimizeSvg(sourceText, config, wrappedSignal);
  const final = keepOriginalSvg(source, {
    text: optimized.svg,
    rawBytes: optimized.rawBytes,
    gzipBytes: optimized.gzipBytes,
  });
  const [sourceImageData, outputImageData] = await Promise.all([
    renderSvgToImageData(
      sourceText,
      naturalWidth,
      naturalHeight,
      null,
      wrappedSignal,
    ),
    renderSvgToImageData(
      final.text,
      naturalWidth,
      naturalHeight,
      null,
      wrappedSignal,
    ),
  ]);
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
    sourceImageData,
    outputImageData,
    isOriginal: false,
    preprocessedWidth: naturalWidth,
    preprocessedHeight: naturalHeight,
    svg: {
      optimizedText: final.text,
      rawBytes: final.rawBytes,
      gzipBytes: final.gzipBytes,
      originalGzipBytes: source.gzipBytes,
      winner: undefined,
    },
  };
}
