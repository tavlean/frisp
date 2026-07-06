import codecAssetRecordSources from '../codec-asset-records.json';
import type {
  CodecAssetRecord,
  CodecAssetRecordSource,
} from 'shared/codec-assets';
import {
  avifDecoderWasmUrl,
  avifEncoderMtScriptUrl,
  avifEncoderMtWasmUrl,
  avifEncoderWasmUrl,
} from './avif';
import { hqxWasmUrl, resizeWasmUrl } from './resize';
import { imagequantWasmUrl } from './imagequant';
import {
  jxlDecoderWasmUrl,
  jxlEncoderMtScriptUrl,
  jxlEncoderMtSimdScriptUrl,
  jxlEncoderMtSimdWasmUrl,
  jxlEncoderMtWasmUrl,
  jxlEncoderWasmUrl,
} from './jxl';
import { mozjpegEncoderWasmUrl } from './mozjpeg';
import { oxipngMtWasmUrl, oxipngWasmUrl } from './oxipng';
import { qoiDecoderWasmUrl, qoiEncoderWasmUrl } from './qoi';
import {
  webpDecoderWasmUrl,
  webpEncoderSimdWasmUrl,
  webpEncoderWasmUrl,
} from './webp';

export type { CodecAssetRecord };

const serviceWorkerAssetUrlEntries = [
  ['codecs/avif/dec/avif_dec.wasm', avifDecoderWasmUrl],
  ['codecs/avif/enc/avif_enc.wasm', avifEncoderWasmUrl],
  ['codecs/avif/enc/avif_enc_mt.wasm', avifEncoderMtWasmUrl],
  ['codecs/avif/enc/avif_enc_mt.js', avifEncoderMtScriptUrl],
  ['codecs/hqx/pkg/squooshhqx_bg.wasm', hqxWasmUrl],
  ['codecs/imagequant/imagequant.wasm', imagequantWasmUrl],
  ['codecs/jxl/dec/jxl_dec.wasm', jxlDecoderWasmUrl],
  ['codecs/jxl/enc/jxl_enc.wasm', jxlEncoderWasmUrl],
  ['codecs/jxl/enc/jxl_enc_mt.wasm', jxlEncoderMtWasmUrl],
  ['codecs/jxl/enc/jxl_enc_mt.js', jxlEncoderMtScriptUrl],
  ['codecs/jxl/enc/jxl_enc_mt_simd.wasm', jxlEncoderMtSimdWasmUrl],
  ['codecs/jxl/enc/jxl_enc_mt_simd.js', jxlEncoderMtSimdScriptUrl],
  ['codecs/mozjpeg/enc/mozjpeg_enc.wasm', mozjpegEncoderWasmUrl],
  ['codecs/oxipng/pkg/squoosh_oxipng_bg.wasm', oxipngWasmUrl],
  ['codecs/oxipng/pkg-parallel/squoosh_oxipng_bg.wasm', oxipngMtWasmUrl],
  ['codecs/qoi/dec/qoi_dec.wasm', qoiDecoderWasmUrl],
  ['codecs/qoi/enc/qoi_enc.wasm', qoiEncoderWasmUrl],
  ['codecs/resize/pkg/squoosh_resize_bg.wasm', resizeWasmUrl],
  ['codecs/webp/dec/webp_dec.wasm', webpDecoderWasmUrl],
  ['codecs/webp/enc/webp_enc.wasm', webpEncoderWasmUrl],
  ['codecs/webp/enc/webp_enc_simd.wasm', webpEncoderSimdWasmUrl],
] as const;

const recordSources =
  codecAssetRecordSources as readonly CodecAssetRecordSource[];
const urlsByPath = new Map<string, string>(serviceWorkerAssetUrlEntries);

export const serviceWorkerCodecAssetRecords = recordSources
  .filter((record) => urlsByPath.has(record.path))
  .map(({ path, ...record }) => ({
    ...record,
    url: urlsByPath.get(path)!,
  })) satisfies readonly CodecAssetRecord[];
