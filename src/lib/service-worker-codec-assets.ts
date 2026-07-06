// The service worker's only bridge into codec-asset URL imports. It must
// stay free of `?worker` / `?worker&url` imports (those make the
// service-worker Vite build re-emit duplicate worker chunks the page never
// fetches) and of sub-inline-limit assets (the SW build ignores the app
// build's assetsInlineLimit and would inline them as data: URLs). The
// module below is curated for exactly those constraints.
import {
  serviceWorkerCodecAssetRecords,
  type CodecAssetRecord,
} from 'shared/codec-assets/service-worker';

export { serviceWorkerCodecAssetRecords, type CodecAssetRecord };
