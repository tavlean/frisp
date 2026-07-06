import avifDecoderWasmUrl from 'codecs/avif/dec/avif_dec.wasm?url';
import avifEncoderWasmUrl from 'codecs/avif/enc/avif_enc.wasm?url';
import avifEncoderMtWasmUrl from 'codecs/avif/enc/avif_enc_mt.wasm?url';
import avifEncoderMtWorkerUrl from 'codecs/avif/enc/avif_enc_mt.worker.js?url';
import avifEncoderMtScriptUrl from 'codecs/avif/enc/avif_enc_mt.js?url';

export {
  avifDecoderWasmUrl,
  avifEncoderWasmUrl,
  avifEncoderMtWasmUrl,
  avifEncoderMtWorkerUrl,
  avifEncoderMtScriptUrl,
};

export const avifCodecAssetUrls = [
  avifDecoderWasmUrl,
  avifEncoderWasmUrl,
  avifEncoderMtWasmUrl,
  avifEncoderMtWorkerUrl,
  avifEncoderMtScriptUrl,
] as const;
