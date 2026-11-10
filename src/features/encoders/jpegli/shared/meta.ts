import type { EncodeOptions } from '#codecs/jpegli/enc/jpegli_enc.js';

export type { EncodeOptions };

/** Values for `EncodeOptions.chromaSubsample`. */
export const JpegliChromaSubsample = {
  /** Leave the sampling factors as jpegli set them, which is 4:2:0. */
  AUTO: 0,
  FULL: 1,
  HALF: 2,
} as const;

export type JpegliChromaSubsample =
  (typeof JpegliChromaSubsample)[keyof typeof JpegliChromaSubsample];

export const label = 'JPEG (jpegli)';
export const mimeType = 'image/jpeg';
export const extension = 'jpg';
// Deliberately short. jpegli's whole proposition is that its defaults are
// already tuned, so the encoder exposes three knobs rather than MozJPEG's
// sixteen.
export const defaultOptions: EncodeOptions = {
  quality: 75,
  progressive: true,
  chromaSubsample: JpegliChromaSubsample.AUTO,
};
