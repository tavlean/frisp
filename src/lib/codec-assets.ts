import codecAssetProbeWorkerUrl from './codec-asset-probe.worker.ts?worker&url';
import webpEncodeProbeWorkerUrl from './webp-encode-probe.worker.ts?worker&url';
import svelteKitFeaturesWorkerUrl from 'app-generated/features-worker/webp.ts?worker&url';
import {
  avifCodecAssetUrls,
  avifDecoderWasmUrl,
  avifEncoderWasmUrl,
} from 'app-generated/codec-assets/avif';
import {
  webpCodecAssetUrls,
  webpDecoderWasmUrl,
  webpEncoderSimdWasmUrl,
  webpEncoderWasmUrl,
} from 'app-generated/codec-assets/webp';
import {
  rotateCodecAssetUrls,
  rotateWasmUrl,
} from 'app-generated/codec-assets/rotate';
import {
  qoiCodecAssetUrls,
  qoiDecoderWasmUrl,
  qoiEncoderWasmUrl,
} from 'app-generated/codec-assets/qoi';
import {
  jxlCodecAssetUrls,
  jxlDecoderWasmUrl,
  jxlEncoderWasmUrl,
} from 'app-generated/codec-assets/jxl';
import {
  mozjpegCodecAssetUrls,
  mozjpegEncoderWasmUrl,
} from 'app-generated/codec-assets/mozjpeg';
import {
  oxipngCodecAssetUrls,
  oxipngWasmUrl,
} from 'app-generated/codec-assets/oxipng';
import {
  imagequantCodecAssetUrls,
  imagequantWasmUrl,
} from 'app-generated/codec-assets/imagequant';
import {
  hqxWasmUrl,
  resizeCodecAssetUrls,
  resizeWasmUrl,
} from 'app-generated/codec-assets/resize';
import {
  svelteKitCodecAssetRecords,
  type CodecAssetRecord,
} from 'app-generated/codec-assets/manifest';
import {
  precacheCodecAssetRecords,
  precacheCodecAssetUrls,
} from 'app-generated/codec-assets/precache';

export {
  avifCodecAssetUrls,
  avifDecoderWasmUrl,
  avifEncoderWasmUrl,
  type CodecAssetRecord,
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
  precacheCodecAssetRecords,
  precacheCodecAssetUrls,
  svelteKitFeaturesWorkerUrl,
  svelteKitCodecAssetRecords,
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
  ...precacheCodecAssetUrls,
];
