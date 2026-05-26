import codecAssetProbeWorkerUrl from './codec-asset-probe.worker.ts?worker&url';
import webpEncodeProbeWorkerUrl from './webp-encode-probe.worker.ts?worker&url';
import svelteKitFeaturesWorkerUrl from 'sqush-generated/features-worker/webp.ts?worker&url';
import {
  avifCodecAssetUrls,
  avifDecoderWasmUrl,
  avifEncoderWasmUrl,
} from 'sqush-generated/codec-assets/avif';
import {
  webpCodecAssetUrls,
  webpDecoderWasmUrl,
  webpEncoderSimdWasmUrl,
  webpEncoderWasmUrl,
} from 'sqush-generated/codec-assets/webp';
import {
  rotateCodecAssetUrls,
  rotateWasmUrl,
} from 'sqush-generated/codec-assets/rotate';
import {
  qoiCodecAssetUrls,
  qoiDecoderWasmUrl,
  qoiEncoderWasmUrl,
} from 'sqush-generated/codec-assets/qoi';
import {
  jxlCodecAssetUrls,
  jxlDecoderWasmUrl,
  jxlEncoderWasmUrl,
} from 'sqush-generated/codec-assets/jxl';
import {
  mozjpegCodecAssetUrls,
  mozjpegEncoderWasmUrl,
} from 'sqush-generated/codec-assets/mozjpeg';
import {
  oxipngCodecAssetUrls,
  oxipngWasmUrl,
} from 'sqush-generated/codec-assets/oxipng';
import {
  imagequantCodecAssetUrls,
  imagequantWasmUrl,
} from 'sqush-generated/codec-assets/imagequant';
import {
  hqxWasmUrl,
  resizeCodecAssetUrls,
  resizeWasmUrl,
} from 'sqush-generated/codec-assets/resize';

export {
  avifCodecAssetUrls,
  avifDecoderWasmUrl,
  avifEncoderWasmUrl,
  codecAssetProbeWorkerUrl,
  hqxWasmUrl,
  imagequantCodecAssetUrls,
  imagequantWasmUrl,
  jxlCodecAssetUrls,
  jxlDecoderWasmUrl,
  jxlEncoderWasmUrl,
  mozjpegCodecAssetUrls,
  mozjpegEncoderWasmUrl,
  oxipngCodecAssetUrls,
  oxipngWasmUrl,
  qoiCodecAssetUrls,
  qoiDecoderWasmUrl,
  qoiEncoderWasmUrl,
  resizeCodecAssetUrls,
  resizeWasmUrl,
  rotateCodecAssetUrls,
  rotateWasmUrl,
  svelteKitFeaturesWorkerUrl,
  webpCodecAssetUrls,
  webpDecoderWasmUrl,
  webpEncodeProbeWorkerUrl,
  webpEncoderSimdWasmUrl,
  webpEncoderWasmUrl,
};

export const codecAssetUrls = [
  codecAssetProbeWorkerUrl,
  webpEncodeProbeWorkerUrl,
  svelteKitFeaturesWorkerUrl,
  ...avifCodecAssetUrls,
  ...webpCodecAssetUrls,
  ...qoiCodecAssetUrls,
  ...jxlCodecAssetUrls,
  ...mozjpegCodecAssetUrls,
  ...oxipngCodecAssetUrls,
  ...imagequantCodecAssetUrls,
  ...resizeCodecAssetUrls,
  ...rotateCodecAssetUrls,
];
