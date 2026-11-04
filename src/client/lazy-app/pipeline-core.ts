// The pixel steps between a decoded source and encoded bytes, as one
// framework-neutral function pair. The codec worker runs them over its WASM
// runtimes; the Node proof (tests/node/) runs them over the `*_node_*` codec
// artifacts. Each host supplies only the steps that need a codec; the order,
// the skip rules, and grain (pure JS) live here so the two can never drift.
//
// No DOM, no $lib, no Svelte: `ImageData` is the only host type, and Node
// supplies a polyfill for it.

import {
  grainIsReal,
  type EncoderState,
  type ProcessorState,
} from 'client/lazy-app/feature-meta/shared';
import { applyGrain } from 'features/processors/grain/shared/apply';
import type { Options as QuantizeOptions } from 'features/processors/quantize/shared/meta';
import type {
  BrowserResizeOptions,
  WorkerResizeOptions,
} from 'features/processors/resize/shared/meta';
import type { Rotation } from './recipe';

/** The resize methods a pipeline host runs. 'vector' is not one: it redraws
 *  an SVG element, so it stays on the main thread (see optimize-image.ts). */
export type FrameResizeOptions = BrowserResizeOptions | WorkerResizeOptions;

/** The codec-backed steps a host provides. Every step returns a NEW frame and
 *  must never write to its input: the input may be the host's cached source. */
export interface PipelineSteps {
  rotate(image: ImageData, rotate: Exclude<Rotation, 0>): Promise<ImageData>;
  resize(image: ImageData, options: FrameResizeOptions): Promise<ImageData>;
  quantize(image: ImageData, options: QuantizeOptions): Promise<ImageData>;
  encode(image: ImageData, encoder: EncoderState): Promise<ArrayBuffer>;
}

/** The rotated frame. Rotation 0 returns `decoded` itself, not a copy. */
export function prepareFrame(
  decoded: ImageData,
  rotate: Rotation,
  steps: Pick<PipelineSteps, 'rotate'>,
): Promise<ImageData> {
  return rotate === 0
    ? Promise.resolve(decoded)
    : steps.rotate(decoded, rotate);
}

/** Resize, grain, then quantize one prepared frame: the exact pixels the
 *  encoder receives, and so the reference an auto-quality score compares the
 *  decoded output against. Returns `prepared` itself when no step runs.
 *
 *  Resize runs only when it targets a size other than the frame's own: at the
 *  same size the interpolating filters are an identity, and a smoothing one
 *  like Mitchell would soften the image for nothing. Grain runs after resize,
 *  so its particle scale is stable at the output size, and before quantize,
 *  so a reduced palette still has exactly that many colors (the quantizer
 *  dithers the grain in). */
export async function processFrame(
  prepared: ImageData,
  processors: ProcessorState,
  steps: Pick<PipelineSteps, 'resize' | 'quantize'>,
): Promise<ImageData> {
  const { resize, grain, quantize } = processors;
  let frame = prepared;
  if (
    resize.enabled &&
    (resize.width !== prepared.width || resize.height !== prepared.height)
  ) {
    if (resize.method === 'vector') {
      throw Error('Vector resize redraws an SVG and runs on the main thread.');
    }
    frame = await steps.resize(frame, resize);
  }
  if (grainIsReal(grain)) frame = applyGrain(frame, grain);
  if (quantize.enabled) frame = await steps.quantize(frame, quantize);
  return frame;
}

/** processFrame, then encode. */
export async function encodeFrame(
  prepared: ImageData,
  processors: ProcessorState,
  encoder: EncoderState,
  steps: PipelineSteps,
): Promise<ArrayBuffer> {
  return steps.encode(await processFrame(prepared, processors, steps), encoder);
}
