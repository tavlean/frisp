import qoiDecoderWasmUrl from 'codecs/qoi/dec/qoi_dec.wasm?url';
import qoiEncoderWasmUrl from 'codecs/qoi/enc/qoi_enc.wasm?url';

export { qoiDecoderWasmUrl, qoiEncoderWasmUrl };

export const qoiCodecAssetUrls = [
  qoiDecoderWasmUrl,
  qoiEncoderWasmUrl,
] as const;
