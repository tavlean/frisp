import codecAssetRecordSources from '../codec-asset-records.json';
import {
  getPrecacheCodecAssetRecords,
  getPrecacheCodecAssetUrls,
  type CodecAssetRecord,
  type CodecAssetRecordSource,
} from 'shared/codec-assets';
import {
  avifDecoderWasmUrl,
  avifEncoderMtScriptUrl,
  avifEncoderMtWasmUrl,
  avifEncoderMtWorkerUrl,
  avifEncoderWasmUrl,
} from './avif';
import { hqxWasmUrl, resizeWasmUrl } from './resize';
import { imagequantWasmUrl } from './imagequant';
import {
  jxlDecoderWasmUrl,
  jxlEncoderMtScriptUrl,
  jxlEncoderMtSimdScriptUrl,
  jxlEncoderMtSimdWasmUrl,
  jxlEncoderMtSimdWorkerUrl,
  jxlEncoderMtWasmUrl,
  jxlEncoderMtWorkerUrl,
  jxlEncoderWasmUrl,
} from './jxl';
import { mozjpegEncoderWasmUrl } from './mozjpeg';
import { oxipngMtWasmUrl, oxipngWasmUrl } from './oxipng';
import { qoiDecoderWasmUrl, qoiEncoderWasmUrl } from './qoi';
import { rotateWasmUrl } from './rotate';
import {
  webpDecoderWasmUrl,
  webpEncoderSimdWasmUrl,
  webpEncoderWasmUrl,
} from './webp';

export type { CodecAssetRecord };

const assetUrlEntries = [
  ['codecs/avif/dec/avif_dec.wasm', avifDecoderWasmUrl],
  ['codecs/avif/enc/avif_enc.wasm', avifEncoderWasmUrl],
  ['codecs/avif/enc/avif_enc_mt.wasm', avifEncoderMtWasmUrl],
  ['codecs/avif/enc/avif_enc_mt.worker.js', avifEncoderMtWorkerUrl],
  ['codecs/avif/enc/avif_enc_mt.js', avifEncoderMtScriptUrl],
  ['codecs/hqx/pkg/squooshhqx_bg.wasm', hqxWasmUrl],
  ['codecs/imagequant/imagequant.wasm', imagequantWasmUrl],
  ['codecs/jxl/dec/jxl_dec.wasm', jxlDecoderWasmUrl],
  ['codecs/jxl/enc/jxl_enc.wasm', jxlEncoderWasmUrl],
  ['codecs/jxl/enc/jxl_enc_mt.wasm', jxlEncoderMtWasmUrl],
  ['codecs/jxl/enc/jxl_enc_mt.worker.js', jxlEncoderMtWorkerUrl],
  ['codecs/jxl/enc/jxl_enc_mt.js', jxlEncoderMtScriptUrl],
  ['codecs/jxl/enc/jxl_enc_mt_simd.wasm', jxlEncoderMtSimdWasmUrl],
  ['codecs/jxl/enc/jxl_enc_mt_simd.worker.js', jxlEncoderMtSimdWorkerUrl],
  ['codecs/jxl/enc/jxl_enc_mt_simd.js', jxlEncoderMtSimdScriptUrl],
  ['codecs/mozjpeg/enc/mozjpeg_enc.wasm', mozjpegEncoderWasmUrl],
  ['codecs/oxipng/pkg/squoosh_oxipng_bg.wasm', oxipngWasmUrl],
  ['codecs/oxipng/pkg-parallel/squoosh_oxipng_bg.wasm', oxipngMtWasmUrl],
  ['codecs/qoi/dec/qoi_dec.wasm', qoiDecoderWasmUrl],
  ['codecs/qoi/enc/qoi_enc.wasm', qoiEncoderWasmUrl],
  ['codecs/rotate/rotate.wasm', rotateWasmUrl],
  ['codecs/resize/pkg/squoosh_resize_bg.wasm', resizeWasmUrl],
  ['codecs/webp/dec/webp_dec.wasm', webpDecoderWasmUrl],
  ['codecs/webp/enc/webp_enc.wasm', webpEncoderWasmUrl],
  ['codecs/webp/enc/webp_enc_simd.wasm', webpEncoderSimdWasmUrl],
] as const;

const recordSources =
  codecAssetRecordSources as readonly CodecAssetRecordSource[];

function createCodecAssetRecords({
  recordSources,
  entries,
}: {
  recordSources: readonly CodecAssetRecordSource[];
  entries: readonly (readonly [string, string])[];
}): CodecAssetRecord[] {
  const urlsByPath = new Map<string, string>(entries);
  const recordPaths = new Set(recordSources.map((record) => record.path));
  const missingImports = recordSources
    .filter((record) => !urlsByPath.has(record.path))
    .map((record) => record.path);
  const unusedImports = entries
    .map(([path]) => path)
    .filter((path) => !recordPaths.has(path));

  if (missingImports.length > 0 || unusedImports.length > 0) {
    throw new Error(
      [
        'Codec asset record/import mismatch.',
        `Missing imports: ${missingImports.join(', ') || '(none)'}`,
        `Unused imports: ${unusedImports.join(', ') || '(none)'}`,
      ].join('\n'),
    );
  }

  return recordSources.map(({ path, ...record }) => ({
    ...record,
    url: urlsByPath.get(path)!,
  }));
}

export const svelteKitCodecAssetRecords = createCodecAssetRecords({
  recordSources,
  entries: assetUrlEntries,
});

export const precacheCodecAssetRecords = getPrecacheCodecAssetRecords(
  svelteKitCodecAssetRecords,
);

export const precacheCodecAssetUrls = getPrecacheCodecAssetUrls(
  svelteKitCodecAssetRecords,
);
