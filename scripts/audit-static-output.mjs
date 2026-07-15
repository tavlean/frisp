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

function assertDeepEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}\nExpected: ${JSON.stringify(
        expected,
      )}\nActual: ${JSON.stringify(actual)}`,
    );
  }
}

function assertUnique(values, label) {
  const duplicates = values.filter(
    (value, index) => values.indexOf(value) !== index,
  );
  assert(
    duplicates.length === 0,
    `Duplicate ${label}: ${duplicates.join(', ')}.`,
  );
}

function parseUrlImportPaths(source) {
  return [...source.matchAll(/from '([^']+)\?url'/g)].map((match) => match[1]);
}

const files = await listFiles(buildDir);
const serviceWorker = await readFile(
  join(buildDir, 'service-worker.js'),
  'utf8',
);
const codecAssetRecordSources = JSON.parse(
  await readFile(
    join(root, 'src', 'shared', 'codec-asset-records.json'),
    'utf8',
  ),
);
const codecAssetManifest = await readFile(
  join(root, 'src', 'shared', 'codec-assets', 'manifest.ts'),
  'utf8',
);
const codecAssetPrecacheManifest = await readFile(
  join(root, 'src', 'shared', 'codec-assets', 'precache.ts'),
  'utf8',
);
const codecAssetUrlImportPaths = (
  await Promise.all(
    [
      'avif.ts',
      'imagequant.ts',
      'jxl.ts',
      'mozjpeg.ts',
      'oxipng.ts',
      'qoi.ts',
      'resize.ts',
      'rotate.ts',
      'webp.ts',
    ].map((file) =>
      readFile(join(root, 'src', 'shared', 'codec-assets', file), 'utf8'),
    ),
  )
).flatMap(parseUrlImportPaths);

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
const avifDecoderWasmAssets = files
  .filter((file) => file.includes('avif_dec') && file.endsWith('.wasm'))
  .sort();
const avifEncoderWasmAssets = files
  .filter((file) => file.includes('avif_enc') && file.endsWith('.wasm'))
  .sort();
const avifThreadedWorkerAssets = files
  .filter((file) => file.includes('avif_enc_mt.worker') && file.endsWith('.js'))
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
const jxlEncoderWasmAssets = files
  .filter((file) => file.includes('jxl_enc') && file.endsWith('.wasm'))
  .sort();
const jxlDecoderWasmAssets = files
  .filter((file) => file.includes('jxl_dec') && file.endsWith('.wasm'))
  .sort();
const jxlThreadedWorkerAssets = files
  .filter(
    (file) =>
      file.includes('jxl_enc_mt') &&
      file.includes('.worker') &&
      file.endsWith('.js'),
  )
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
const avifDecoderWasmAsset = files.find(
  (file) => file.includes('/avif_dec.') && file.endsWith('.wasm'),
);
const avifEncoderWasmAsset = files.find(
  (file) => file.includes('/avif_enc.') && file.endsWith('.wasm'),
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
const jxlEncoderWasmAsset = files.find(
  (file) => file.includes('/jxl_enc.') && file.endsWith('.wasm'),
);
const jxlDecoderWasmAsset = files.find(
  (file) => file.includes('/jxl_dec.') && file.endsWith('.wasm'),
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
// The service-worker build must not re-emit worker chunks of its own (it
// used to import `?worker&url` modules, duplicating the app's worker chunks
// as dead top-level `assets/*.js` files that ended up precached).
const serviceWorkerDuplicateWorkerAssets = files.filter((file) =>
  /^assets\/[^/]+\.js$/.test(file),
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
    /^_app\/immutable\/workers\/codec-worker-[A-Za-z0-9_-]+\.js$/.test(file) &&
    file.endsWith('.js'),
);
const svgOptimizerWorkerAssets = files.filter((file) =>
  /^_app\/immutable\/workers\/svg-optimizer\.worker-[A-Za-z0-9_-]+\.js$/.test(
    file,
  ),
);
const svgOptimizerWorkerSources = await Promise.all(
  svgOptimizerWorkerAssets.map((file) =>
    readFile(join(buildDir, file), 'utf8'),
  ),
);
const otherJavascriptSources = await Promise.all(
  files
    .filter(
      (file) =>
        file.endsWith('.js') && !svgOptimizerWorkerAssets.includes(file),
    )
    .map(async (file) => ({
      file,
      source: await readFile(join(buildDir, file), 'utf8'),
    })),
);
const expectedLogicalAssetRecords = codecAssetRecordSources.map(
  ({ path: _path, ...record }) => record,
);
const expectedLogicalAssetKeys = expectedLogicalAssetRecords.map(
  (record) => record.logicalKey,
);
const expectedPrecacheLogicalAssetKeys = expectedLogicalAssetRecords
  .filter((record) => record.cache === 'precache')
  .map((record) => record.logicalKey);
const physicalWasmGroups = [
  ['webp:encoder:baseline', baselineWasmAssets],
  ['webp:encoder:simd', simdWasmAssets],
  ['webp:decoder:default', webpDecoderWasmAssets],
  ['avif:decoder:default', avifDecoderWasmAssets],
  ['avif:encoder:single-thread', avifEncoderWasmAssets],
  ['avif:encoder:multi-thread', avifEncoderWasmAssets],
  ['rotate:preprocessor:default', rotateWasmAssets],
  ['qoi:encoder:default', qoiEncoderWasmAssets],
  ['qoi:decoder:default', qoiDecoderWasmAssets],
  ['jxl:encoder:single-thread', jxlEncoderWasmAssets],
  ['jxl:encoder:multi-thread', jxlEncoderWasmAssets],
  ['jxl:encoder:multi-thread-simd', jxlEncoderWasmAssets],
  ['jxl:decoder:default', jxlDecoderWasmAssets],
  ['mozjpeg:encoder:default', mozjpegEncoderWasmAssets],
  ['oxipng:encoder:single-thread', oxipngWasmAssets],
  ['oxipng:encoder:multi-thread', oxipngWasmAssets],
  ['imagequant:processor:default', imagequantWasmAssets],
  ['resize:processor:default', resizeWasmAssets],
  ['hqx:processor:hqx', hqxWasmAssets],
];

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
assert(avifDecoderWasmAsset, 'Missing emitted AVIF decoder WASM asset.');
assert(avifEncoderWasmAsset, 'Missing emitted AVIF encoder WASM asset.');
assert(rotateWasmAsset, 'Missing emitted rotate WASM asset.');
assert(qoiEncoderWasmAsset, 'Missing emitted QOI encoder WASM asset.');
assert(qoiDecoderWasmAsset, 'Missing emitted QOI decoder WASM asset.');
assert(jxlEncoderWasmAsset, 'Missing emitted JPEG XL encoder WASM asset.');
assert(jxlDecoderWasmAsset, 'Missing emitted JPEG XL decoder WASM asset.');
assert(mozjpegEncoderWasmAsset, 'Missing emitted MozJPEG encoder WASM asset.');
assert(oxipngWasmAsset, 'Missing emitted OxiPNG WASM asset.');
assert(imagequantWasmAsset, 'Missing emitted ImageQuant WASM asset.');
assert(resizeWasmAsset, 'Missing emitted resize WASM asset.');
assert(hqxWasmAsset, 'Missing emitted HQX WASM asset.');
assert(
  baselineWasmAssets.length === 1,
  `Expected exactly one baseline WebP WASM asset after the generated wrapper patch, found ${baselineWasmAssets.length}.`,
);
assert(
  simdWasmAssets.length === 1,
  `Expected exactly one SIMD WebP WASM asset after the generated wrapper patch, found ${simdWasmAssets.length}.`,
);
assert(
  webpDecoderWasmAssets.length === 1,
  `Expected exactly one WebP decoder WASM asset after the generated wrapper patch, found ${webpDecoderWasmAssets.length}.`,
);
assert(
  avifDecoderWasmAssets.length === 1,
  `Expected exactly one AVIF decoder WASM asset after the generated wrapper patch, found ${avifDecoderWasmAssets.length}.`,
);
assert(
  avifEncoderWasmAssets.length === 2,
  `Expected two AVIF encoder WASM assets (single-thread enc + threaded enc_mt) now that the pthread runtime is wired, found ${avifEncoderWasmAssets.length}.`,
);
assert(
  avifThreadedWorkerAssets.length > 0,
  `Expected AVIF threaded worker helper assets now that the SvelteKit app wires the threaded (Emscripten pthread) runtime, found ${avifThreadedWorkerAssets.length}.`,
);
assert(
  rotateWasmAssets.length === 1,
  `Expected exactly one rotate WASM asset after passing the canonical URL through the worker bridge, found ${rotateWasmAssets.length}.`,
);
assert(
  qoiEncoderWasmAssets.length === 1,
  `Expected exactly one QOI encoder WASM asset after the generated wrapper patch, found ${qoiEncoderWasmAssets.length}.`,
);
assert(
  qoiDecoderWasmAssets.length === 1,
  `Expected exactly one QOI decoder WASM asset after the generated wrapper patch, found ${qoiDecoderWasmAssets.length}.`,
);
assert(
  jxlEncoderWasmAssets.length === 3,
  `Expected three JPEG XL encoder WASM assets (single-thread + threaded enc_mt + enc_mt_simd) now that the pthread runtime is wired, found ${jxlEncoderWasmAssets.length}.`,
);
assert(
  jxlDecoderWasmAssets.length === 1,
  `Expected exactly one JPEG XL decoder WASM asset after the generated wrapper patch, found ${jxlDecoderWasmAssets.length}.`,
);
assert(
  jxlThreadedWorkerAssets.length > 0,
  `Expected JPEG XL threaded worker helper assets now that the SvelteKit app wires the threaded (Emscripten pthread) runtime, found ${jxlThreadedWorkerAssets.length}.`,
);
assert(
  mozjpegEncoderWasmAssets.length === 1,
  `Expected exactly one MozJPEG encoder WASM asset after the generated wrapper patch, found ${mozjpegEncoderWasmAssets.length}.`,
);
assert(
  oxipngWasmAssets.length === 2,
  `Expected two OxiPNG WASM assets (single-thread pkg + threaded pkg-parallel) now that the rayon runtime is wired, found ${oxipngWasmAssets.length}.`,
);
assert(
  imagequantWasmAssets.length === 1,
  `Expected exactly one ImageQuant WASM asset after the generated wrapper patch, found ${imagequantWasmAssets.length}.`,
);
assert(
  resizeWasmAssets.length === 1,
  `Expected exactly one resize WASM asset after the generated wrapper patch, found ${resizeWasmAssets.length}.`,
);
assert(
  hqxWasmAssets.length === 1,
  `Expected exactly one HQX WASM asset after the generated wrapper patch, found ${hqxWasmAssets.length}.`,
);
assert(
  serviceWorkerDuplicateWorkerAssets.length === 0,
  `Service-worker build re-emitted duplicate worker chunks: ${serviceWorkerDuplicateWorkerAssets.join(
    ', ',
  )}.`,
);
assert(
  workerHelperAssets.length > 0,
  `Expected OxiPNG parallel worker helper assets now that the SvelteKit app wires the threaded (wasm-bindgen-rayon) runtime, found ${workerHelperAssets.length}.`,
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
  'Missing app-emitted immutable codec worker asset.',
);
assert(
  svgOptimizerWorkerAssets.length === 1,
  `Expected exactly one app-emitted SVG optimizer worker asset, found ${svgOptimizerWorkerAssets.length}.`,
);
assert(
  svgOptimizerWorkerSources[0]?.includes('preset-default') &&
    svgOptimizerWorkerSources[0]?.includes('removeXMLProcInst'),
  'SVG optimizer worker no longer contains the SVGO preset-default payload.',
);
assert(
  !otherJavascriptSources.some(
    ({ source }) =>
      source.includes('preset-default') && source.includes('removeXMLProcInst'),
  ),
  `SVGO preset-default payload escaped the lazy SVG optimizer worker into: ${otherJavascriptSources
    .filter(
      ({ source }) =>
        source.includes('preset-default') &&
        source.includes('removeXMLProcInst'),
    )
    .map(({ file }) => file)
    .join(', ')}.`,
);
assert(
  codecAssetManifest.includes('codec-asset-records.json'),
  'Codec asset manifest does not derive records from the JSON source.',
);
assert(
  codecAssetManifest.includes("from 'shared/codec-assets'"),
  'Codec asset manifest does not consume the shared codec asset contract.',
);
assert(
  codecAssetManifest.includes('getPrecacheCodecAssetRecords'),
  'Codec asset manifest does not use the shared precache record helper.',
);
assert(
  codecAssetManifest.includes('precacheCodecAssetUrls'),
  'Codec asset manifest does not expose derived precache URLs.',
);
assert(
  codecAssetPrecacheManifest.includes('precacheCodecAssetUrls'),
  'Codec asset precache manifest does not expose precache URLs.',
);
assert(
  !codecAssetPrecacheManifest.includes('rotate:preprocessor:default'),
  'Codec asset precache manifest should not import runtime-only rotate WASM.',
);
assertDeepEqual(
  expectedLogicalAssetRecords.map((record) => record.logicalKey),
  expectedLogicalAssetKeys,
  'Codec asset JSON has an unexpected logical record order or key set.',
);
assertDeepEqual(
  expectedLogicalAssetRecords
    .filter((record) => record.cache === 'precache')
    .map((record) => record.logicalKey),
  expectedPrecacheLogicalAssetKeys,
  'Codec asset JSON has an unexpected precache record order or key set.',
);
assertUnique(
  expectedLogicalAssetRecords.map((record) => record.logicalKey),
  'codec asset logical keys',
);
assertUnique(
  codecAssetRecordSources.map((record) => record.path),
  'codec asset paths',
);
assertDeepEqual(
  [...codecAssetUrlImportPaths].sort(),
  codecAssetRecordSources.map((record) => record.path).sort(),
  'Codec asset JSON records and ?url imports must cover the same paths.',
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
  serviceWorker.includes(avifDecoderWasmAsset),
  `Service-worker build manifest does not include ${avifDecoderWasmAsset}.`,
);
assert(
  serviceWorker.includes(avifEncoderWasmAsset),
  `Service-worker build manifest does not include ${avifEncoderWasmAsset}.`,
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
  serviceWorker.includes(jxlEncoderWasmAsset),
  `Service-worker build manifest does not include ${jxlEncoderWasmAsset}.`,
);
assert(
  serviceWorker.includes(jxlDecoderWasmAsset),
  `Service-worker build manifest does not include ${jxlDecoderWasmAsset}.`,
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
  serviceWorker.includes('avif:encoder:multi-thread'),
  'Service worker does not carry the codec-asset logical records for variant-aware precache.',
);
assert(
  serviceWorker.includes('createImageBitmap'),
  'Service worker does not feature-detect native decoders for variant-aware precache.',
);
assert(
  serviceWorker.includes('/workers/svg-optimizer.worker-'),
  'Service worker is missing the stable SVG optimizer worker precache exclusion.',
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
  serviceWorker.includes('/diagnostics'),
  'Service worker does not pre-cache prerendered route HTML.',
);
assert(
  /\.addAll\(/.test(serviceWorker),
  'Service worker does not pre-cache its build manifest.',
);
assert(
  serviceWorker.includes('.match('),
  'Service worker does not read from Cache Storage for GET requests.',
);
assert(
  /\.put\(/.test(serviceWorker),
  'Service worker does not runtime-cache fetched GET assets.',
);
assert(
  serviceWorker.includes('.claim('),
  'Service worker does not claim uncontrolled clients after activation.',
);
assert(
  !serviceWorker.includes('data:application/wasm'),
  'Service worker should not pre-cache inlined WASM data URLs.',
);

// Dev-only UI must not ship. The /lab and /bench-svg routes are development
// tools; the app-strip-dev-only-routes Vite plugin (vite.config.ts) replaces
// their +page.svelte with a "Not found" stub in production, so none of the lab
// UI or its $lib/lab deps are emitted or precached. Assert that holds: no
// emitted client asset may carry a lab-only marker. (Route PATH strings like
// "/lab/porcelain" legitimately live in the client router manifest, so the
// markers below are UI identifiers — CSS token prefix, component + stub text —
// not route segments.)
const devOnlyUiMarkers = ['--il-', 'AuroraIntro', 'IntroDropDemo', 'Lab stub'];
const clientAssetFiles = files.filter(
  (file) =>
    file.startsWith('_app/immutable/') &&
    (file.endsWith('.js') || file.endsWith('.css')),
);
const leakedDevUi = [];
for (const file of clientAssetFiles) {
  const source = await readFile(join(buildDir, file), 'utf8');
  const marker = devOnlyUiMarkers.find((m) => source.includes(m));
  if (marker) leakedDevUi.push(`${file} (contains "${marker}")`);
}
assert(
  leakedDevUi.length === 0,
  'Dev-only lab/bench UI leaked into the production build — the ' +
    'app-strip-dev-only-routes plugin likely stopped matching a route:\n' +
    leakedDevUi.map((file) => `  - ${file}`).join('\n'),
);

// No OS/editor junk in the deployed output. adapter-static copies static/
// verbatim, so a stray static/.DS_Store ships to the site root (the SW precache
// filter drops it from the manifest, but the file is still served).
const junkFiles = files.filter((file) => /(^|\/)\.DS_Store$/.test(file));
assert(
  junkFiles.length === 0,
  'OS junk files present in the build output (delete them from static/):\n' +
    junkFiles.map((file) => `  - ${file}`).join('\n'),
);

console.log(
  [
    'Static output audit passed.',
    `Dev-only UI markers in client bundle: 0 (${clientAssetFiles.length} assets scanned)`,
    `App entry asset: ${appEntryAsset}`,
    `Start entry asset: ${startEntryAsset}`,
    `Route node assets: ${routeNodeAssets.length}`,
    `Page CSS asset: ${pageCssAsset}`,
    `WASM asset: ${wasmAsset}`,
    `SIMD WASM asset: ${simdWasmAsset}`,
    `WebP decoder WASM asset: ${webpDecoderWasmAsset}`,
    `AVIF decoder WASM asset: ${avifDecoderWasmAsset}`,
    `AVIF encoder WASM asset: ${avifEncoderWasmAsset}`,
    `Rotate WASM asset: ${rotateWasmAsset}`,
    `QOI encoder WASM asset: ${qoiEncoderWasmAsset}`,
    `QOI decoder WASM asset: ${qoiDecoderWasmAsset}`,
    `JPEG XL encoder WASM asset: ${jxlEncoderWasmAsset}`,
    `JPEG XL decoder WASM asset: ${jxlDecoderWasmAsset}`,
    `MozJPEG encoder WASM asset: ${mozjpegEncoderWasmAsset}`,
    `OxiPNG WASM asset: ${oxipngWasmAsset}`,
    `ImageQuant WASM asset: ${imagequantWasmAsset}`,
    `Resize WASM asset: ${resizeWasmAsset}`,
    `HQX WASM asset: ${hqxWasmAsset}`,
    `Codec asset JSON records: ${expectedLogicalAssetKeys.length}`,
    `Physical WASM groups: ${physicalWasmGroups
      .map(([logicalKey, assets]) => `${logicalKey}=${assets.length}`)
      .join(', ')}`,
    `Baseline WebP WASM copies: ${baselineWasmAssets.length}`,
    ...baselineWasmAssets.map((asset) => `  - ${asset}`),
    `SIMD WebP WASM copies: ${simdWasmAssets.length}`,
    ...simdWasmAssets.map((asset) => `  - ${asset}`),
    `WebP decoder WASM copies: ${webpDecoderWasmAssets.length}`,
    ...webpDecoderWasmAssets.map((asset) => `  - ${asset}`),
    `AVIF decoder WASM copies: ${avifDecoderWasmAssets.length}`,
    ...avifDecoderWasmAssets.map((asset) => `  - ${asset}`),
    `AVIF encoder WASM copies: ${avifEncoderWasmAssets.length}`,
    ...avifEncoderWasmAssets.map((asset) => `  - ${asset}`),
    `AVIF threaded worker helper assets: ${avifThreadedWorkerAssets.length}`,
    ...avifThreadedWorkerAssets.map((asset) => `  - ${asset}`),
    `Rotate WASM copies: ${rotateWasmAssets.length}`,
    ...rotateWasmAssets.map((asset) => `  - ${asset}`),
    `QOI encoder WASM copies: ${qoiEncoderWasmAssets.length}`,
    ...qoiEncoderWasmAssets.map((asset) => `  - ${asset}`),
    `QOI decoder WASM copies: ${qoiDecoderWasmAssets.length}`,
    ...qoiDecoderWasmAssets.map((asset) => `  - ${asset}`),
    `JPEG XL encoder WASM copies: ${jxlEncoderWasmAssets.length}`,
    ...jxlEncoderWasmAssets.map((asset) => `  - ${asset}`),
    `JPEG XL decoder WASM copies: ${jxlDecoderWasmAssets.length}`,
    ...jxlDecoderWasmAssets.map((asset) => `  - ${asset}`),
    `JPEG XL threaded worker helper assets: ${jxlThreadedWorkerAssets.length}`,
    ...jxlThreadedWorkerAssets.map((asset) => `  - ${asset}`),
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
    `OxiPNG parallel worker helper assets: ${workerHelperAssets.length}`,
    ...workerHelperAssets.map((asset) => `  - ${asset}`),
    `App worker asset: ${immutableWorkerAsset}`,
    `App encode worker asset: ${immutableEncodeWorkerAsset}`,
    `App codec worker asset: ${immutableFeaturesWorkerAsset}`,
    `App SVG optimizer worker asset: ${svgOptimizerWorkerAssets[0]}`,
  ].join('\n'),
);
