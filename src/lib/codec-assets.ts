import svelteKitFeaturesWorkerUrl from '../worker/codec-worker.ts?worker&url';
import {
  avifCodecAssetUrls,
  avifDecoderWasmUrl,
  avifEncoderWasmUrl,
} from 'shared/codec-assets/avif';
import {
  webpCodecAssetUrls,
  webpDecoderWasmUrl,
  webpEncoderSimdWasmUrl,
  webpEncoderWasmUrl,
} from 'shared/codec-assets/webp';
import {
  rotateCodecAssetUrls,
  rotateWasmUrl,
} from 'shared/codec-assets/rotate';
import {
  qoiCodecAssetUrls,
  qoiDecoderWasmUrl,
  qoiEncoderWasmUrl,
} from 'shared/codec-assets/qoi';
import {
  jxlCodecAssetUrls,
  jxlDecoderWasmUrl,
  jxlEncoderWasmUrl,
} from 'shared/codec-assets/jxl';
import {
  jpegliCodecAssetUrls,
  jpegliEncoderWasmUrl,
} from 'shared/codec-assets/jpegli';
import {
  mozjpegCodecAssetUrls,
  mozjpegEncoderWasmUrl,
} from 'shared/codec-assets/mozjpeg';
import {
  oxipngCodecAssetUrls,
  oxipngWasmUrl,
} from 'shared/codec-assets/oxipng';
import {
  imagequantCodecAssetUrls,
  imagequantWasmUrl,
} from 'shared/codec-assets/imagequant';
import {
  hqxWasmUrl,
  resizeCodecAssetUrls,
  resizeWasmUrl,
} from 'shared/codec-assets/resize';
import {
  svelteKitCodecAssetRecords,
  type CodecAssetRecord,
} from 'shared/codec-assets/manifest';
import {
  precacheCodecAssetRecords,
  precacheCodecAssetUrls,
} from 'shared/codec-assets/precache';

export {
  avifCodecAssetUrls,
  avifDecoderWasmUrl,
  avifEncoderWasmUrl,
  type CodecAssetRecord,
  hqxWasmUrl,
  imagequantCodecAssetUrls,
  imagequantWasmUrl,
  jpegliCodecAssetUrls,
  jpegliEncoderWasmUrl,
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
  webpEncoderSimdWasmUrl,
  webpEncoderWasmUrl,
};
