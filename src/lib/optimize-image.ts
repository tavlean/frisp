// Runs one ImageRecipe on one source file. The single dispatch point for the
// lanes (SVG optimize, JPEG-to-JXL transcode, pixel encode), so the editor and
// bulk cannot disagree about which lane a recipe takes.
//
// The transcode and pixel lanes are one call into the codec worker, which
// decodes the file itself, keeps it hot for the next call, runs every step,
// and transfers back the bytes and the preview (src/worker/pipeline-op.ts).
// What stays here is what needs the main thread: the SVG lane, rasterizing an
// SVG source, and the Original side's untouched frame.
//
// Lives in $lib rather than the engine because the SVG lane does, and that
// lane is reached only through a dynamic import: a static one would pull SVGO
// and fflate into the main bundle (audit:static-output trips on it).

import {
  IDENTITY,
  type CompressOutcome,
  type EncodedOutcome,
} from './compress';
import type SvelteKitWorkerBridge from './sveltekit-worker-bridge';
import type { SvgOptimizeOptions } from './svg/optimize-options';
import { rasterizeSvg, vectorResize, type SvgRaster } from './svg/raster';
import { sourceKey } from './source-key';
import { abortable } from 'client/lazy-app/abort';
import { getPercentChange } from 'client/lazy-app/bulk/size';
import { encoderMap } from 'client/lazy-app/feature-meta/shared';
import { getOutputFileName } from 'client/lazy-app/output-filename';
import type { ImageRecipe, Rotation } from 'client/lazy-app/recipe';
import { isSvgSource } from 'client/lazy-app/svg-source';
import type { OptimizeReply, OptimizeRequest } from '../worker/pipeline-op';

export { chooseLane, type Lane } from 'client/lazy-app/lane';

/** One source file, plus what only the caller's main thread can supply. */
export interface OptimizeSource {
  file: File;
  /** The rotated source frame, for the Original ('identity') output. The
   *  editor supplies it; nothing else encodes identity. */
  prepared?: (rotate: Rotation) => Promise<ImageData>;
  /** An SVG source's raster, when the caller already holds it; rasterized
   *  here otherwise. */
  svg?: () => Promise<SvgRaster>;
}

export interface OptimizeOptions {
  signal: AbortSignal;
  bridge: SvelteKitWorkerBridge;
  /** Decode the output back to ImageData for an on-screen preview. Bulk
   *  passes false: it never shows full-size output pixels. */
  preview: boolean;
  /** The SVG source text, when the caller already holds it; read from the
   *  file otherwise. */
  svgText?: Promise<string>;
}

type FellBack = { transcodeFellBack?: true };

/** Run one recipe on one source. SVG optimize when output.kind is 'svg'
 *  (source must be SVG); otherwise the worker picks the JPEG to JXL
 *  transcode (JXL flag set, JPEG source, nothing changes a pixel) or the
 *  pixel pipeline, falling back from a refused transcode to pixels and
 *  saying so in the result. Caller owns `outputUrl` and must revoke it. */
export function optimizeImage(
  source: OptimizeSource,
  recipe: ImageRecipe,
  options: OptimizeOptions & { preview: true },
): Promise<CompressOutcome & FellBack>;
export function optimizeImage(
  source: OptimizeSource,
  recipe: ImageRecipe,
  options: OptimizeOptions,
): Promise<EncodedOutcome & FellBack>;
export async function optimizeImage(
  source: OptimizeSource,
  recipe: ImageRecipe,
  { signal, bridge, preview, svgText }: OptimizeOptions,
): Promise<EncodedOutcome & FellBack> {
  const { file } = source;
  const { output } = recipe;
  const svg = isSvgSource(file)
    ? (source.svg ?? (() => rasterizeSvg(signal, file)))
    : undefined;

  if (output.kind === 'svg') {
    if (!svg) throw Error('Only an SVG source can stay vector.');
    const [{ optimizeSvgSide }, text, { raster }] = await Promise.all([
      import('$lib/svg/optimize'),
      svgText ?? file.text(),
      abortable(signal, svg()),
    ]);
    // The vector lane renders at the rasterized size; it always renders its
    // preview, since auto mode needs renders for the visual gate anyway.
    return optimizeSvgSide(
      text,
      file.name,
      output.options as unknown as SvgOptimizeOptions,
      raster.width,
      raster.height,
      signal,
    );
  }

  // The Original side shows the source untouched and saves the file as is.
  if ((output.encoder.type as string) === IDENTITY) {
    if (!source.prepared) throw Error('The Original needs the source frame.');
    const frame = await abortable(signal, source.prepared(recipe.rotate));
    return {
      outputFile: file,
      outputUrl: URL.createObjectURL(file),
      outputSize: file.size,
      originalSize: file.size,
      percentChange: 0,
      outputImageData: frame,
      isOriginal: true,
      preprocessedWidth: frame.width,
      preprocessedHeight: frame.height,
    };
  }

  const reply = await (svg
    ? encodeSvgPixels(svg, recipe, file, { signal, bridge, preview })
    : bridge.optimize(signal, {
        key: sourceKey(file),
        file: { type: file.type, name: file.name },
        source: { kind: 'file', file },
        recipe,
        preview,
      }));
  if (reply.kind !== 'encoded')
    throw Error('The codec worker lost its source.');

  const { extension, mimeType } = encoderMap[output.encoder.type].meta;
  const outputFile = new File(
    [reply.bytes],
    getOutputFileName(file.name, extension),
    { type: mimeType },
  );
  return {
    outputFile,
    outputUrl: URL.createObjectURL(outputFile),
    outputSize: outputFile.size,
    originalSize: file.size,
    percentChange:
      Math.round(getPercentChange(file.size, outputFile.size) * 10) / 10,
    outputImageData: reply.preview,
    isOriginal: false,
    preprocessedWidth: reply.preparedWidth,
    preprocessedHeight: reply.preparedHeight,
    ...(reply.transcodeFellBack ? { transcodeFellBack: true } : {}),
  };
}

/**
 * An SVG source on a raster lane. The worker cannot rasterize an SVG, so it
 * gets pixels: asked for first without them (a live worker already holds
 * them), then sent a copy when it answers `needs-source`. A vector resize
 * redraws the SVG at the target size here and turns the worker's resize
 * off; the size goes into the key, since those are different pixels.
 */
async function encodeSvgPixels(
  svg: () => Promise<SvgRaster>,
  recipe: ImageRecipe,
  file: File,
  { signal, bridge, preview }: Omit<OptimizeOptions, 'svgText'>,
): Promise<OptimizeReply> {
  const { image, raster } = await abortable(signal, svg());
  const { resize } = recipe.processors;
  const quarter = recipe.rotate % 180 !== 0;
  const vector =
    resize.enabled &&
    resize.method === 'vector' &&
    (resize.width !== (quarter ? raster.height : raster.width) ||
      resize.height !== (quarter ? raster.width : raster.height));

  const request: OptimizeRequest = {
    key: vector
      ? `${sourceKey(file)}@vector:${resize.width}x${resize.height}:${resize.fitMethod}`
      : sourceKey(file),
    file: { type: file.type, name: file.name },
    recipe: vector
      ? {
          ...recipe,
          processors: {
            ...recipe.processors,
            resize: { ...resize, enabled: false },
          },
        }
      : recipe,
    preview,
  };
  const first = await bridge.optimize(signal, request);
  if (first.kind === 'encoded') return first;
  // A copy the worker owns: the caller keeps `raster` for its own views.
  const pixels =
    vector && resize.method === 'vector'
      ? vectorResize(image, resize, recipe.rotate)
      : new ImageData(
          new Uint8ClampedArray(raster.data),
          raster.width,
          raster.height,
        );
  return bridge.optimize(signal, {
    ...request,
    source: { kind: 'pixels', image: pixels },
  });
}
