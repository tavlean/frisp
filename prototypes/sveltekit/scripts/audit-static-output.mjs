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
const wasmAsset = files.find(
  (file) =>
    file.includes('/webp_enc.') &&
    !file.includes('webp_enc_simd') &&
    file.endsWith('.wasm'),
);
const simdWasmAsset = files.find(
  (file) => file.includes('webp_enc_simd') && file.endsWith('.wasm'),
);
const serviceWorkerImportedWorkerAsset = files.find(
  (file) =>
    file.includes('assets/codec-asset-probe.worker') && file.endsWith('.js'),
);
const serviceWorkerImportedEncodeWorkerAsset = files.find(
  (file) =>
    file.includes('assets/webp-encode-probe.worker') && file.endsWith('.js'),
);
const serviceWorkerImportedPipelineWorkerAsset = files.find(
  (file) =>
    file.includes('assets/webp-pipeline-probe.worker') && file.endsWith('.js'),
);
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
const immutablePipelineWorkerAsset = files.find(
  (file) =>
    file.includes('_app/immutable/workers/webp-pipeline-probe.worker') &&
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
assert(
  serviceWorkerImportedWorkerAsset,
  'Missing emitted module worker asset from the worker probe.',
);
assert(
  serviceWorkerImportedEncodeWorkerAsset,
  'Missing emitted module worker asset from the WebP encode probe.',
);
assert(
  serviceWorkerImportedPipelineWorkerAsset,
  'Missing emitted module worker asset from the WebP pipeline probe.',
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
  immutablePipelineWorkerAsset,
  'Missing app-emitted immutable module worker asset from the WebP pipeline probe.',
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
  serviceWorker.includes(serviceWorkerImportedWorkerAsset),
  `Service-worker build manifest does not include ${serviceWorkerImportedWorkerAsset}.`,
);
assert(
  serviceWorker.includes(serviceWorkerImportedEncodeWorkerAsset),
  `Service-worker build manifest does not include ${serviceWorkerImportedEncodeWorkerAsset}.`,
);
assert(
  serviceWorker.includes(serviceWorkerImportedPipelineWorkerAsset),
  `Service-worker build manifest does not include ${serviceWorkerImportedPipelineWorkerAsset}.`,
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

console.log(
  [
    'Static output audit passed.',
    `App entry asset: ${appEntryAsset}`,
    `Start entry asset: ${startEntryAsset}`,
    `Route node assets: ${routeNodeAssets.length}`,
    `Page CSS asset: ${pageCssAsset}`,
    `WASM asset: ${wasmAsset}`,
    `SIMD WASM asset: ${simdWasmAsset}`,
    `Worker asset: ${serviceWorkerImportedWorkerAsset}`,
    `Encode worker asset: ${serviceWorkerImportedEncodeWorkerAsset}`,
    `Pipeline worker asset: ${serviceWorkerImportedPipelineWorkerAsset}`,
    `App worker asset: ${immutableWorkerAsset}`,
    `App encode worker asset: ${immutableEncodeWorkerAsset}`,
    `App pipeline worker asset: ${immutablePipelineWorkerAsset}`,
  ].join('\n'),
);
