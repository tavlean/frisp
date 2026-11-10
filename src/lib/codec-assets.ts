import svelteKitFeaturesWorkerUrl from '../worker/codec-worker.ts?worker&url';
import {
  avifCodecAssetUrls,
  avifDecoderWasmUrl,
  avifEncoderWasmUrl,
} from '#shared/codec-assets/avif.ts';
import {
  webpCodecAssetUrls,
  webpDecoderWasmUrl,
  webpEncoderSimdWasmUrl,
  webpEncoderWasmUrl,
} from '#shared/codec-assets/webp.ts';
import {
  rotateCodecAssetUrls,
  rotateWasmUrl,
} from '#shared/codec-assets/rotate.ts';
import {
  qoiCodecAssetUrls,
  qoiDecoderWasmUrl,
  qoiEncoderWasmUrl,
} from '#shared/codec-assets/qoi.ts';
import {
  jxlCodecAssetUrls,
  jxlDecoderWasmUrl,
  jxlEncoderWasmUrl,
} from '#shared/codec-assets/jxl.ts';
import {
  jpegliCodecAssetUrls,
  jpegliEncoderWasmUrl,
} from '#shared/codec-assets/jpegli.ts';
import {
  mozjpegCodecAssetUrls,
  mozjpegEncoderWasmUrl,
} from '#shared/codec-assets/mozjpeg.ts';
import {
  oxipngCodecAssetUrls,
  oxipngWasmUrl,
} from '#shared/codec-assets/oxipng.ts';
import {
  imagequantCodecAssetUrls,
  imagequantWasmUrl,
} from '#shared/codec-assets/imagequant.ts';
import {
  ssimulacra2CodecAssetUrls,
  ssimulacra2WasmUrl,
} from '#shared/codec-assets/ssimulacra2.ts';
import {
  hqxWasmUrl,
  resizeCodecAssetUrls,
  resizeWasmUrl,
} from '#shared/codec-assets/resize.ts';
import {
  svelteKitCodecAssetRecords,
  type CodecAssetRecord,
} from '#shared/codec-assets/manifest.ts';
import {
  precacheCodecAssetRecords,
  precacheCodecAssetUrls,
} from '#shared/codec-assets/precache.ts';

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
  ssimulacra2CodecAssetUrls,
  ssimulacra2WasmUrl,
  svelteKitFeaturesWorkerUrl,
  svelteKitCodecAssetRecords,
  webpCodecAssetUrls,
  webpDecoderWasmUrl,
  webpEncoderSimdWasmUrl,
  webpEncoderWasmUrl,
};
