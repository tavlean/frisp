import webpDecoderWasmUrl from 'codecs/webp/dec/webp_dec.wasm?url';
import webpEncoderWasmUrl from 'codecs/webp/enc/webp_enc.wasm?url';
import webpEncoderSimdWasmUrl from 'codecs/webp/enc/webp_enc_simd.wasm?url';

export { webpDecoderWasmUrl, webpEncoderSimdWasmUrl, webpEncoderWasmUrl };

export const webpCodecAssetUrls = [
  webpDecoderWasmUrl,
  webpEncoderWasmUrl,
  webpEncoderSimdWasmUrl,
] as const;
