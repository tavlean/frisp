import oxipngWasmUrl from 'codecs/oxipng/pkg/squoosh_oxipng_bg.wasm?url';
import oxipngMtWasmUrl from 'codecs/oxipng/pkg-parallel/squoosh_oxipng_bg.wasm?url';

export { oxipngWasmUrl, oxipngMtWasmUrl };

export const oxipngCodecAssetUrls = [oxipngWasmUrl, oxipngMtWasmUrl] as const;
