import hqxWasmUrl from 'codecs/hqx/pkg/squooshhqx_bg.wasm?url';
import resizeWasmUrl from 'codecs/resize/pkg/squoosh_resize_bg.wasm?url';

export { hqxWasmUrl, resizeWasmUrl };

export const resizeCodecAssetUrls = [hqxWasmUrl, resizeWasmUrl] as const;
