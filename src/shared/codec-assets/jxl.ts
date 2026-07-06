import jxlDecoderWasmUrl from 'codecs/jxl/dec/jxl_dec.wasm?url';
import jxlEncoderWasmUrl from 'codecs/jxl/enc/jxl_enc.wasm?url';
import jxlEncoderMtWasmUrl from 'codecs/jxl/enc/jxl_enc_mt.wasm?url';
import jxlEncoderMtWorkerUrl from 'codecs/jxl/enc/jxl_enc_mt.worker.js?url';
import jxlEncoderMtScriptUrl from 'codecs/jxl/enc/jxl_enc_mt.js?url';
import jxlEncoderMtSimdWasmUrl from 'codecs/jxl/enc/jxl_enc_mt_simd.wasm?url';
import jxlEncoderMtSimdWorkerUrl from 'codecs/jxl/enc/jxl_enc_mt_simd.worker.js?url';
import jxlEncoderMtSimdScriptUrl from 'codecs/jxl/enc/jxl_enc_mt_simd.js?url';

export {
  jxlDecoderWasmUrl,
  jxlEncoderWasmUrl,
  jxlEncoderMtWasmUrl,
  jxlEncoderMtWorkerUrl,
  jxlEncoderMtScriptUrl,
  jxlEncoderMtSimdWasmUrl,
  jxlEncoderMtSimdWorkerUrl,
  jxlEncoderMtSimdScriptUrl,
};

export const jxlCodecAssetUrls = [
  jxlDecoderWasmUrl,
  jxlEncoderWasmUrl,
  jxlEncoderMtWasmUrl,
  jxlEncoderMtWorkerUrl,
  jxlEncoderMtScriptUrl,
  jxlEncoderMtSimdWasmUrl,
  jxlEncoderMtSimdWorkerUrl,
  jxlEncoderMtSimdScriptUrl,
] as const;
