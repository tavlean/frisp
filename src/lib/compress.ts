// The editor's output vocabulary: which formats it offers, each encoder's
// default options, and the shape of a finished result. The encode itself is
// optimizeImage (optimize-image.ts), which runs in the codec worker.

import {
  encoderMap,
  type EncoderType,
} from '#client/lazy-app/feature-meta/index.ts';
import { DEFAULT_SVG_OPTIONS } from './svg/optimize-options';

/** Any encoder the generated SvelteKit surface supports. */
export type OutputFormat = EncoderType;

/**
 * A side's chosen output. `'identity'` is Squoosh's "Original" pseudo-encoder:
 * the side shows the (preprocessed) source pixels unchanged and downloads the
 * original file. Every other value is a real encoder.
 */
export type SideFormat = OutputFormat | 'identity' | 'svg';

export const IDENTITY: 'identity' = 'identity';

/**
 * Formats surfaced in the editor. Every entry is a WASM encoder that's always
 * available, so the list is static — no runtime feature detection needed.
 */
export const OUTPUT_FORMATS: {
  id: OutputFormat;
  /** User-facing format name (what the output file actually is). */
  label: string;
  /** Underlying encoder/engine, surfaced as a tooltip — not in the label. */
  tooltip: string;
  ext: string;
}[] = [
  {
    id: 'webP',
    label: 'WebP',
    tooltip: 'libwebp',
    ext: encoderMap.webP.meta.extension,
  },
  {
    id: 'avif',
    label: 'AVIF',
    tooltip: 'libaom',
    ext: encoderMap.avif.meta.extension,
  },
  // JXL's format name matches its codec label, so pull it from meta (kept in
  // sync there). jpegli/OxiPNG below are overridden to the plain format name
  // since the encoder brand isn't what the user gets: a standard JPEG/PNG is.
  // The encoder brand lives in the tooltip instead. jpegli is the one JPEG
  // encoder offered: faster than MozJPEG on every bench fixture and about 7%
  // smaller on photos at the shipped defaults (MozJPEG left the picker
  // 2026-11-04; old saves migrate in settings-storage).
  {
    id: 'jxl',
    label: encoderMap.jxl.meta.label,
    tooltip: 'libjxl',
    ext: encoderMap.jxl.meta.extension,
  },
  {
    id: 'jpegli',
    label: 'JPEG',
    tooltip: 'jpegli',
    ext: encoderMap.jpegli.meta.extension,
  },
  {
    id: 'oxiPNG',
    label: 'PNG',
    tooltip: 'OxiPNG',
    ext: encoderMap.oxiPNG.meta.extension,
  },
  // QOI is intentionally not offered as an output: it's a fast/simple lossless
  // format with effectively no support outside specialised tools, so it isn't a
  // useful target for a compression tool. The QOI *decoder* stays wired up, so
  // importing .qoi files still works.
];

/** A fresh, mutable copy of an encoder's default options (for the UI to bind). */
export function getDefaultOptions(format: SideFormat): Record<string, unknown> {
  // The Original/identity side has no encoder options.
  if (format === IDENTITY) return {};
  if (format === 'svg')
    return structuredClone(DEFAULT_SVG_OPTIONS) as unknown as Record<
      string,
      unknown
    >;
  return structuredClone(
    encoderMap[format].meta.defaultOptions as Record<string, unknown>,
  );
}

export interface CompressOutcome {
  outputFile: File;
  outputUrl: string;
  outputSize: number;
  originalSize: number;
  percentChange: number;
  /** The encoded output decoded back to pixels (right/"after" preview). */
  outputImageData: ImageData;
  /** True for the Original/identity side (no encoding happened). */
  isOriginal: boolean;
  /**
   * Dimensions of the preprocessed (rotated, pre-resize) source, so the UI
   * can seed resize inputs / compute aspect ratio correctly even after a rotate.
   */
  preprocessedWidth: number;
  preprocessedHeight: number;
  /** Present only on vector-lane results (format 'svg'): the text +
   *  transfer-size facts the raster fields can't express. The identity side
   *  carries no svg field — the UI reads originalGzipBytes from here. */
  svg?: {
    optimizedText: string;
    rawBytes: number;
    gzipBytes: number;
    originalGzipBytes: number;
    /** Auto mode's winning candidate id (e.g. 'p2+reusePaths'); undefined in
     *  manual mode. */
    winner?: string;
  };
}

/**
 * An outcome whose decoded output pixels may be absent: what a caller that
 * never shows the full-size result (bulk) gets when it passes
 * `preview = false`, sparing one full decode of every output.
 */
export type EncodedOutcome = Omit<CompressOutcome, 'outputImageData'> & {
  outputImageData?: ImageData;
};
