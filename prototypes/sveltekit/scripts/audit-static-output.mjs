import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const buildDir = join(root, 'build');

async function listFiles(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listFiles(join(dir, entry.name), relativePath)));
    } else {
      files.push(relativePath);
    }
  }

  return files;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const files = await listFiles(buildDir);
const serviceWorker = await readFile(
  join(buildDir, 'service-worker.js'),
  'utf8',
);

const appEntryAsset = files.find(
  (file) => file.includes('_app/immutable/entry/app.') && file.endsWith('.js'),
);
const startEntryAsset = files.find(
  (file) =>
    file.includes('_app/immutable/entry/start.') && file.endsWith('.js'),
);
const routeNodeAssets = files.filter(
  (file) => file.includes('_app/immutable/nodes/') && file.endsWith('.js'),
);
const pageCssAsset = files.find(
  (file) =>
    file.includes('_app/immutable/assets/') &&
    file.endsWith('.css') &&
    !file.includes('/webp_'),
);
const baselineWasmAssets = files
  .filter(
    (file) =>
      file.includes('webp_enc') &&
      !file.includes('webp_enc_simd') &&
      file.endsWith('.wasm'),
  )
  .sort();
const simdWasmAssets = files
  .filter((file) => file.includes('webp_enc_simd') && file.endsWith('.wasm'))
  .sort();
const webpDecoderWasmAssets = files
  .filter((file) => file.includes('webp_dec') && file.endsWith('.wasm'))
  .sort();
const rotateWasmAssets = files
  .filter((file) => file.includes('rotate') && file.endsWith('.wasm'))
  .sort();
const qoiEncoderWasmAssets = files
  .filter((file) => file.includes('qoi_enc') && file.endsWith('.wasm'))
  .sort();
const qoiDecoderWasmAssets = files
  .filter((file) => file.includes('qoi_dec') && file.endsWith('.wasm'))
  .sort();
const mozjpegEncoderWasmAssets = files
  .filter((file) => file.includes('mozjpeg_enc') && file.endsWith('.wasm'))
  .sort();
const oxipngWasmAssets = files
  .filter(
    (file) => file.includes('squoosh_oxipng_bg') && file.endsWith('.wasm'),
  )
  .sort();
const imagequantWasmAssets = files
  .filter((file) => file.includes('imagequant') && file.endsWith('.wasm'))
  .sort();
const resizeWasmAssets = files
  .filter(
    (file) => file.includes('squoosh_resize_bg') && file.endsWith('.wasm'),
  )
  .sort();
const hqxWasmAssets = files
  .filter((file) => file.includes('squooshhqx_bg') && file.endsWith('.wasm'))
  .sort();
const wasmAsset = files.find(
  (file) =>
    file.includes('/webp_enc.') &&
    !file.includes('webp_enc_simd') &&
    file.endsWith('.wasm'),
);
const simdWasmAsset = files.find(
  (file) => file.includes('webp_enc_simd') && file.endsWith('.wasm'),
);
const webpDecoderWasmAsset = files.find(
  (file) => file.includes('/webp_dec.') && file.endsWith('.wasm'),
);
const rotateWasmAsset = files.find(
  (file) =>
    file.includes('/rotate.') &&
    !file.includes('/workers/assets/') &&
    file.endsWith('.wasm'),
);
const qoiEncoderWasmAsset = files.find(
  (file) => file.includes('/qoi_enc.') && file.endsWith('.wasm'),
);
const qoiDecoderWasmAsset = files.find(
  (file) => file.includes('/qoi_dec.') && file.endsWith('.wasm'),
);
const mozjpegEncoderWasmAsset = files.find(
  (file) => file.includes('/mozjpeg_enc.') && file.endsWith('.wasm'),
);
const oxipngWasmAsset = files.find(
  (file) => file.includes('/squoosh_oxipng_bg.') && file.endsWith('.wasm'),
);
const imagequantWasmAsset = files.find(
  (file) => file.includes('/imagequant.') && file.endsWith('.wasm'),
);
const resizeWasmAsset = files.find(
  (file) => file.includes('/squoosh_resize_bg.') && file.endsWith('.wasm'),
);
const hqxWasmAsset = files.find(
  (file) => file.includes('/squooshhqx_bg.') && file.endsWith('.wasm'),
);
const workerRotateWasmAsset = files.find(
  (file) => file.includes('/workers/assets/rotate-') && file.endsWith('.wasm'),
);
const serviceWorkerImportedWorkerAsset = files.find(
  (file) =>
    file.includes('assets/codec-asset-probe.worker') && file.endsWith('.js'),
);
const serviceWorkerImportedEncodeWorkerAsset = files.find(
  (file) =>
    file.includes('assets/webp-encode-probe.worker') && file.endsWith('.js'),
);
const serviceWorkerImportedFeaturesWorkerAsset = files.find(
  (file) =>
    /^assets\/webp-[A-Za-z0-9_-]+\.js$/.test(file) && file.endsWith('.js'),
);
const workerHelperAssets = files
  .filter((file) => file.includes('workerHelpers') && file.endsWith('.js'))
  .sort();
const immutableWorkerAsset = files.find(
  (file) =>
    file.includes('_app/immutable/workers/codec-asset-probe.worker') &&
    file.endsWith('.js'),
);
const immutableEncodeWorkerAsset = files.find(
  (file) =>
    file.includes('_app/immutable/workers/webp-encode-probe.worker') &&
    file.endsWith('.js'),
);
const immutableFeaturesWorkerAsset = files.find(
  (file) =>
    /^_app\/immutable\/workers\/webp-[A-Za-z0-9_-]+\.js$/.test(file) &&
    file.endsWith('.js'),
);

assert(files.includes('index.html'), 'Missing static index.html output.');
assert(files.includes('200.html'), 'Missing static fallback output.');
assert(
  files.includes('service-worker.js'),
  'Missing SvelteKit service-worker output.',
);
assert(appEntryAsset, 'Missing emitted SvelteKit app entry asset.');
assert(startEntryAsset, 'Missing emitted SvelteKit start entry asset.');
assert(
  routeNodeAssets.length > 0,
  'Missing emitted SvelteKit route node assets.',
);
assert(pageCssAsset, 'Missing emitted SvelteKit page CSS asset.');
assert(wasmAsset, 'Missing emitted WebP WASM asset from the worker probe.');
assert(simdWasmAsset, 'Missing emitted SIMD WebP WASM asset.');
assert(webpDecoderWasmAsset, 'Missing emitted WebP decoder WASM asset.');
assert(rotateWasmAsset, 'Missing emitted rotate WASM asset.');
assert(qoiEncoderWasmAsset, 'Missing emitted QOI encoder WASM asset.');
assert(qoiDecoderWasmAsset, 'Missing emitted QOI decoder WASM asset.');
assert(mozjpegEncoderWasmAsset, 'Missing emitted MozJPEG encoder WASM asset.');
assert(oxipngWasmAsset, 'Missing emitted OxiPNG WASM asset.');
assert(imagequantWasmAsset, 'Missing emitted ImageQuant WASM asset.');
assert(resizeWasmAsset, 'Missing emitted resize WASM asset.');
assert(hqxWasmAsset, 'Missing emitted HQX WASM asset.');
assert(
  workerRotateWasmAsset,
  'Missing generated worker-local rotate WASM asset.',
);
assert(
  baselineWasmAssets.length >= 2,
  'Expected duplicate baseline WebP WASM assets to remain visible for migration analysis.',
);
assert(
  simdWasmAssets.length >= 2,
  'Expected duplicate SIMD WebP WASM assets to remain visible for migration analysis.',
);
assert(
  webpDecoderWasmAssets.length >= 1,
  'Expected emitted WebP decoder WASM asset.',
);
assert(
  rotateWasmAssets.length >= 2,
  'Expected duplicate rotate WASM assets to remain visible for migration analysis.',
);
assert(
  qoiEncoderWasmAssets.length >= 1,
  'Expected emitted QOI encoder WASM asset.',
);
assert(
  qoiDecoderWasmAssets.length >= 1,
  'Expected emitted QOI decoder WASM asset.',
);
assert(
  mozjpegEncoderWasmAssets.length >= 1,
  'Expected emitted MozJPEG encoder WASM asset.',
);
assert(oxipngWasmAssets.length >= 1, 'Expected emitted OxiPNG WASM asset.');
assert(
  imagequantWasmAssets.length >= 1,
  'Expected emitted ImageQuant WASM asset.',
);
assert(resizeWasmAssets.length >= 1, 'Expected emitted resize WASM asset.');
assert(hqxWasmAssets.length >= 1, 'Expected emitted HQX WASM asset.');
assert(
  serviceWorkerImportedWorkerAsset,
  'Missing emitted module worker asset from the worker probe.',
);
assert(
  serviceWorkerImportedEncodeWorkerAsset,
  'Missing emitted module worker asset from the WebP encode probe.',
);
assert(
  serviceWorkerImportedFeaturesWorkerAsset,
  'Missing emitted generated WebP features-worker asset.',
);
assert(
  workerHelperAssets.length >= 1,
  'Expected emitted OxiPNG parallel worker helper asset to remain visible for threaded-runtime migration analysis.',
);
assert(
  immutableWorkerAsset,
  'Missing app-emitted immutable module worker asset from the worker probe.',
);
assert(
  immutableEncodeWorkerAsset,
  'Missing app-emitted immutable module worker asset from the WebP encode probe.',
);
assert(
  immutableFeaturesWorkerAsset,
  'Missing app-emitted immutable generated WebP features-worker asset.',
);
assert(
  serviceWorker.includes(wasmAsset),
  `Service-worker build manifest does not include ${wasmAsset}.`,
);
assert(
  serviceWorker.includes(simdWasmAsset),
  `Service-worker build manifest does not include ${simdWasmAsset}.`,
);
assert(
  serviceWorker.includes(webpDecoderWasmAsset),
  `Service-worker build manifest does not include ${webpDecoderWasmAsset}.`,
);
assert(
  serviceWorker.includes(rotateWasmAsset),
  `Service-worker build manifest does not include ${rotateWasmAsset}.`,
);
assert(
  serviceWorker.includes(qoiEncoderWasmAsset),
  `Service-worker build manifest does not include ${qoiEncoderWasmAsset}.`,
);
assert(
  serviceWorker.includes(qoiDecoderWasmAsset),
  `Service-worker build manifest does not include ${qoiDecoderWasmAsset}.`,
);
assert(
  serviceWorker.includes(mozjpegEncoderWasmAsset),
  `Service-worker build manifest does not include ${mozjpegEncoderWasmAsset}.`,
);
assert(
  serviceWorker.includes(oxipngWasmAsset),
  `Service-worker build manifest does not include ${oxipngWasmAsset}.`,
);
assert(
  serviceWorker.includes(imagequantWasmAsset),
  `Service-worker build manifest does not include ${imagequantWasmAsset}.`,
);
assert(
  serviceWorker.includes(resizeWasmAsset),
  `Service-worker build manifest does not include ${resizeWasmAsset}.`,
);
assert(
  serviceWorker.includes(hqxWasmAsset),
  `Service-worker build manifest does not include ${hqxWasmAsset}.`,
);
assert(
  serviceWorker.includes(serviceWorkerImportedWorkerAsset),
  `Service-worker build manifest does not include ${serviceWorkerImportedWorkerAsset}.`,
);
assert(
  serviceWorker.includes(serviceWorkerImportedEncodeWorkerAsset),
  `Service-worker build manifest does not include ${serviceWorkerImportedEncodeWorkerAsset}.`,
);
assert(
  serviceWorker.includes(serviceWorkerImportedFeaturesWorkerAsset),
  `Service-worker build manifest does not include ${serviceWorkerImportedFeaturesWorkerAsset}.`,
);
assert(
  serviceWorker.includes(appEntryAsset),
  `Service-worker build manifest does not include ${appEntryAsset}.`,
);
assert(
  serviceWorker.includes(startEntryAsset),
  `Service-worker build manifest does not include ${startEntryAsset}.`,
);
for (const routeNodeAsset of routeNodeAssets) {
  assert(
    serviceWorker.includes(routeNodeAsset),
    `Service-worker build manifest does not include ${routeNodeAsset}.`,
  );
}
assert(
  serviceWorker.includes(pageCssAsset),
  `Service-worker build manifest does not include ${pageCssAsset}.`,
);
assert(
  /\.addAll\(/.test(serviceWorker),
  'Service worker does not pre-cache its build manifest.',
);
assert(
  serviceWorker.includes('caches.match'),
  'Service worker does not read from Cache Storage for GET requests.',
);
assert(
  /\.put\(/.test(serviceWorker),
  'Service worker does not runtime-cache fetched GET assets.',
);
assert(
  !serviceWorker.includes('data:application/wasm'),
  'Service worker should not pre-cache inlined WASM data URLs.',
);

console.log(
  [
    'Static output audit passed.',
    `App entry asset: ${appEntryAsset}`,
    `Start entry asset: ${startEntryAsset}`,
    `Route node assets: ${routeNodeAssets.length}`,
    `Page CSS asset: ${pageCssAsset}`,
    `WASM asset: ${wasmAsset}`,
    `SIMD WASM asset: ${simdWasmAsset}`,
    `WebP decoder WASM asset: ${webpDecoderWasmAsset}`,
    `Rotate WASM asset: ${rotateWasmAsset}`,
    `QOI encoder WASM asset: ${qoiEncoderWasmAsset}`,
    `QOI decoder WASM asset: ${qoiDecoderWasmAsset}`,
    `MozJPEG encoder WASM asset: ${mozjpegEncoderWasmAsset}`,
    `OxiPNG WASM asset: ${oxipngWasmAsset}`,
    `ImageQuant WASM asset: ${imagequantWasmAsset}`,
    `Resize WASM asset: ${resizeWasmAsset}`,
    `HQX WASM asset: ${hqxWasmAsset}`,
    `Worker rotate WASM asset: ${workerRotateWasmAsset}`,
    `Baseline WebP WASM copies: ${baselineWasmAssets.length}`,
    ...baselineWasmAssets.map((asset) => `  - ${asset}`),
    `SIMD WebP WASM copies: ${simdWasmAssets.length}`,
    ...simdWasmAssets.map((asset) => `  - ${asset}`),
    `WebP decoder WASM copies: ${webpDecoderWasmAssets.length}`,
    ...webpDecoderWasmAssets.map((asset) => `  - ${asset}`),
    `Rotate WASM copies: ${rotateWasmAssets.length}`,
    ...rotateWasmAssets.map((asset) => `  - ${asset}`),
    `QOI encoder WASM copies: ${qoiEncoderWasmAssets.length}`,
    ...qoiEncoderWasmAssets.map((asset) => `  - ${asset}`),
    `QOI decoder WASM copies: ${qoiDecoderWasmAssets.length}`,
    ...qoiDecoderWasmAssets.map((asset) => `  - ${asset}`),
    `MozJPEG encoder WASM copies: ${mozjpegEncoderWasmAssets.length}`,
    ...mozjpegEncoderWasmAssets.map((asset) => `  - ${asset}`),
    `OxiPNG WASM copies: ${oxipngWasmAssets.length}`,
    ...oxipngWasmAssets.map((asset) => `  - ${asset}`),
    `ImageQuant WASM copies: ${imagequantWasmAssets.length}`,
    ...imagequantWasmAssets.map((asset) => `  - ${asset}`),
    `Resize WASM copies: ${resizeWasmAssets.length}`,
    ...resizeWasmAssets.map((asset) => `  - ${asset}`),
    `HQX WASM copies: ${hqxWasmAssets.length}`,
    ...hqxWasmAssets.map((asset) => `  - ${asset}`),
    `Worker asset: ${serviceWorkerImportedWorkerAsset}`,
    `Encode worker asset: ${serviceWorkerImportedEncodeWorkerAsset}`,
    `Generated WebP features-worker asset: ${serviceWorkerImportedFeaturesWorkerAsset}`,
    `OxiPNG parallel worker helper assets: ${workerHelperAssets.length}`,
    ...workerHelperAssets.map((asset) => `  - ${asset}`),
    `App worker asset: ${immutableWorkerAsset}`,
    `App encode worker asset: ${immutableEncodeWorkerAsset}`,
    `App generated WebP features-worker asset: ${immutableFeaturesWorkerAsset}`,
  ].join('\n'),
);
