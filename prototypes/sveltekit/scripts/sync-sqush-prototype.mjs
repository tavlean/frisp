import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const prototypeRoot = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const outputDir = join(
  prototypeRoot,
  '.svelte-kit',
  'sqush-generated',
  'feature-meta',
);
const sharedOutputPath = join(outputDir, 'shared.ts');
const indexOutputPath = join(outputDir, 'index.ts');
const workerOutputDir = join(
  prototypeRoot,
  '.svelte-kit',
  'sqush-generated',
  'features-worker',
);
const workerOutputPath = join(workerOutputDir, 'webp.ts');
const workerBridgeOutputDir = join(
  prototypeRoot,
  '.svelte-kit',
  'sqush-generated',
  'worker-bridge',
);
const workerBridgeMetaOutputPath = join(workerBridgeOutputDir, 'meta.ts');
const workerSurfaceOutputDir = join(
  prototypeRoot,
  '.svelte-kit',
  'sqush-generated',
  'worker-surface',
);
const workerSurfaceReadyOutputPath = join(workerSurfaceOutputDir, 'ready.ts');
const codecAssetOutputDir = join(
  prototypeRoot,
  '.svelte-kit',
  'sqush-generated',
  'codec-assets',
);
const webpCodecAssetOutputPath = join(codecAssetOutputDir, 'webp.ts');
const qoiCodecAssetOutputPath = join(codecAssetOutputDir, 'qoi.ts');
const rotateCodecAssetOutputPath = join(codecAssetOutputDir, 'rotate.ts');
const serviceWorkerOutputDir = join(
  prototypeRoot,
  '.svelte-kit',
  'sqush-generated',
  'service-worker',
);
const serviceWorkerCachePlanOutputPath = join(
  serviceWorkerOutputDir,
  'cache-plan.ts',
);
const prototypeEncoderNames = ['webP'];
const svelteKitReadyWorkerMethods = [
  {
    name: 'webpEncode',
    source: 'features/encoders/webP/worker/webpEncode',
    reason:
      'WebP encode runs with generated Vite worker and generated WebP WASM URL injection.',
  },
  {
    name: 'rotate',
    source: 'features/preprocessors/rotate/worker/runtime',
    reason:
      'Rotate runs through shared runtime with generated Vite rotate WASM URL injection.',
  },
  {
    name: 'qoiEncode',
    source: 'features/encoders/qoi/worker/qoiEncode',
    reason:
      'QOI encode runs with generated Vite worker and generated QOI WASM URL injection.',
  },
];
const blockedWorkerMethods = [
  {
    name: 'avifDecode',
    blocker: 'Full decoder surface is not part of the WebP-first prototype.',
  },
  {
    name: 'jxlDecode',
    blocker: 'Full decoder surface is not part of the WebP-first prototype.',
  },
  {
    name: 'qoiDecode',
    blocker: 'Full decoder surface is not part of the WebP-first prototype.',
  },
  {
    name: 'webpDecode',
    blocker: 'Browser decode path is enough for the current WebP proof.',
  },
  {
    name: 'wp2Decode',
    blocker: 'Full decoder surface is not part of the WebP-first prototype.',
  },
  {
    name: 'avifEncode',
    blocker:
      'Needs worker-shared/supports-wasm-threads alias and AVIF asset URL strategy.',
  },
  {
    name: 'jxlEncode',
    blocker:
      'Needs worker-shared/supports-wasm-threads alias and JPEG XL asset URL strategy.',
  },
  {
    name: 'mozjpegEncode',
    blocker: 'Needs MozJPEG asset URL strategy before joining this worker.',
  },
  {
    name: 'oxipngEncode',
    blocker:
      'Needs worker-shared/supports-wasm-threads alias and OxiPNG asset URL strategy.',
  },
  {
    name: 'wp2Encode',
    blocker:
      'Needs worker-shared/supports-wasm-threads alias and WebP 2 asset URL strategy.',
  },
  {
    name: 'quantize',
    blocker: 'Needs stricter ImageDataArray/ArrayBufferLike type pass.',
  },
  {
    name: 'resize',
    blocker:
      'Browser-resize runtime is already proven; worker resize needs stricter type pass.',
  },
];

async function featureNames(kind) {
  const root = join(repoRoot, 'src', 'features', kind);
  const entries = await readdir(root, { withFileTypes: true });
  const names = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      await readdir(join(root, entry.name, 'shared'));
      names.push(entry.name);
    } catch {
      // Feature has no shared metadata; ignore it for this prototype proof.
    }
  }

  return names.sort((a, b) => a.localeCompare(b));
}

function identifier(name, suffix) {
  return `${name.replace(/[^A-Za-z0-9_$]/g, '_')}${suffix}`;
}

function importPath(kind, name) {
  return `features/${kind}/${name}/shared/meta`;
}

function generateFeatureMeta({
  encoderNames,
  processorNames,
  preprocessorNames,
}) {
  const encoderImports = encoderNames.map(
    (name) =>
      `import * as ${identifier(name, 'EncoderMeta')} from '${importPath(
        'encoders',
        name,
      )}';`,
  );
  const processorImports = processorNames.map(
    (name) =>
      `import * as ${identifier(name, 'ProcessorMeta')} from '${importPath(
        'processors',
        name,
      )}';`,
  );
  const preprocessorImports = preprocessorNames.map(
    (name) =>
      `import * as ${identifier(name, 'PreprocessorMeta')} from '${importPath(
        'preprocessors',
        name,
      )}';`,
  );

  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It intentionally imports shared metadata only, not Preact option components.',
    '',
    ...encoderImports,
    ...processorImports,
    ...preprocessorImports,
    '',
    'export type EncoderState =',
    ...encoderNames.map(
      (name) =>
        `  | { type: "${name}", options: ${identifier(
          name,
          'EncoderMeta',
        )}.EncodeOptions }`,
    ),
    ';',
    '',
    'export type EncoderOptions =',
    ...encoderNames.map(
      (name) => `  | ${identifier(name, 'EncoderMeta')}.EncodeOptions`,
    ),
    ';',
    '',
    'export const encoderMap = {',
    ...encoderNames.map(
      (name) => `  ${name}: { meta: ${identifier(name, 'EncoderMeta')} },`,
    ),
    '} as const;',
    '',
    'export type EncoderType = keyof typeof encoderMap;',
    '',
    'interface Enableable { enabled: boolean; }',
    '',
    'export interface ProcessorOptions {',
    ...processorNames.map(
      (name) => `  ${name}: ${identifier(name, 'ProcessorMeta')}.Options;`,
    ),
    '}',
    '',
    'export interface ProcessorState {',
    ...processorNames.map(
      (name) =>
        `  ${name}: Enableable & ${identifier(name, 'ProcessorMeta')}.Options;`,
    ),
    '}',
    '',
    'export const defaultProcessorState: ProcessorState = {',
    ...processorNames.map(
      (name) =>
        `  ${name}: { enabled: false, ...${identifier(
          name,
          'ProcessorMeta',
        )}.defaultOptions },`,
    ),
    '};',
    '',
    'export interface PreprocessorState {',
    ...preprocessorNames.map(
      (name) => `  ${name}: ${identifier(name, 'PreprocessorMeta')}.Options;`,
    ),
    '}',
    '',
    'export const defaultPreprocessorState: PreprocessorState = {',
    ...preprocessorNames.map(
      (name) =>
        `  ${name}: ${identifier(name, 'PreprocessorMeta')}.defaultOptions,`,
    ),
    '};',
    '',
  ].join('\n');
}

function generateWebpWorkerEntry() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It is intentionally WebP-only until the remaining codec worker asset seams are resolved.',
    '',
    "import { expose } from 'comlink';",
    "import encodeWebp from 'features/encoders/webP/worker/webpEncode';",
    "import type { EncodeOptions } from 'features/encoders/webP/shared/meta';",
    "import encodeQoi from 'features/encoders/qoi/worker/qoiEncode';",
    "import type { EncodeOptions as QoiEncodeOptions } from 'features/encoders/qoi/shared/meta';",
    "import { createRotate } from 'features/preprocessors/rotate/worker/runtime';",
    "import type { Options as RotateOptions } from 'features/preprocessors/rotate/shared/meta';",
    "import { rotateWasmUrl } from '../codec-assets/rotate';",
    '',
    'export interface WebpWasmUrls {',
    '  baseline: string;',
    '  simd: string;',
    '}',
    '',
    'export interface QoiWasmUrls {',
    '  encoder: string;',
    '}',
    '',
    'function locateCodecWasm({',
    '  qoi,',
    '  webp,',
    '}: {',
    '  qoi?: QoiWasmUrls;',
    '  webp?: WebpWasmUrls;',
    '}): void {',
    '  globalThis.__squshEmscriptenLocateFile = (path) => {',
    "    if (path === 'webp_enc.wasm') return webp?.baseline ?? path;",
    "    if (path === 'webp_enc_simd.wasm') return webp?.simd ?? path;",
    "    if (path === 'qoi_enc.wasm') return qoi?.encoder ?? path;",
    '    return path;',
    '  };',
    '}',
    '',
    'const rotate = createRotate(rotateWasmUrl);',
    '',
    'const workerApi = {',
    '  webpEncode(',
    '    imageData: ImageData,',
    '    options: EncodeOptions,',
    '    wasmUrls: WebpWasmUrls,',
    '  ): Promise<ArrayBuffer> {',
    '    locateCodecWasm({ webp: wasmUrls });',
    '    return encodeWebp(imageData, options);',
    '  },',
    '  qoiEncode(',
    '    imageData: ImageData,',
    '    options: QoiEncodeOptions,',
    '    wasmUrls: QoiWasmUrls,',
    '  ): Promise<ArrayBuffer> {',
    '    locateCodecWasm({ qoi: wasmUrls });',
    '    return encodeQoi(imageData, options);',
    '  },',
    '  rotate(',
    '    data: ImageData,',
    '    options: RotateOptions,',
    '  ): ReturnType<typeof rotate> {',
    '    return rotate(data, options);',
    '  },',
    '};',
    '',
    'export type SvelteKitProcessorWorkerApi = typeof workerApi;',
    '',
    'expose(workerApi);',
    '',
  ].join('\n');
}

function generateWorkerBridgeMeta() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It mirrors the production worker-bridge metadata shape for SvelteKit-ready methods.',
    '',
    "import type { SvelteKitProcessorWorkerApi } from '../features-worker/webp';",
    "import { svelteKitReadyWorkerMethodNames } from '../worker-surface/ready';",
    '',
    'export const methodNames = svelteKitReadyWorkerMethodNames;',
    '',
    'export type BridgeMethods = SvelteKitProcessorWorkerApi;',
    '',
  ].join('\n');
}

function generateWorkerSurfaceReady() {
  const readyWorkerMethodNames = svelteKitReadyWorkerMethods.map(
    ({ name }) => name,
  );

  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It records the generated SvelteKit worker surface and the methods intentionally filtered out.',
    '',
    `export const svelteKitReadyWorkerMethods = ${JSON.stringify(
      svelteKitReadyWorkerMethods,
      null,
      '  ',
    )} as const;`,
    '',
    `export const svelteKitReadyWorkerMethodNames = ${JSON.stringify(
      readyWorkerMethodNames,
      null,
      '  ',
    )} as const;`,
    '',
    `export const svelteKitBlockedWorkerMethods = ${JSON.stringify(
      blockedWorkerMethods,
      null,
      '  ',
    )} as const;`,
    '',
  ].join('\n');
}

function generateWebpCodecAssets() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It is the prototype canonical asset manifest for WebP encoder WASM URLs.',
    '',
    "import webpEncoderWasmUrl from 'codecs/webp/enc/webp_enc.wasm?url';",
    "import webpEncoderSimdWasmUrl from 'codecs/webp/enc/webp_enc_simd.wasm?url';",
    '',
    'export { webpEncoderSimdWasmUrl, webpEncoderWasmUrl };',
    '',
    'export const webpCodecAssetUrls = [',
    '  webpEncoderWasmUrl,',
    '  webpEncoderSimdWasmUrl,',
    '] as const;',
    '',
  ].join('\n');
}

function generateRotateCodecAssets() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It is the prototype canonical asset manifest for rotate preprocessor WASM URLs.',
    '',
    "import rotateWasmUrl from 'codecs/rotate/rotate.wasm?url';",
    '',
    'export { rotateWasmUrl };',
    '',
    'export const rotateCodecAssetUrls = [rotateWasmUrl] as const;',
    '',
  ].join('\n');
}

function generateQoiCodecAssets() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It is the prototype canonical asset manifest for QOI encoder WASM URLs.',
    '',
    "import qoiEncoderWasmUrl from 'codecs/qoi/enc/qoi_enc.wasm?url';",
    '',
    'export { qoiEncoderWasmUrl };',
    '',
    'export const qoiCodecAssetUrls = [qoiEncoderWasmUrl] as const;',
    '',
  ].join('\n');
}

function generateServiceWorkerCachePlan() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It mirrors the production entry-data { main, deps } cache-plan shape with SvelteKit/Vite asset URLs.',
    '',
    "import { collectEntryUrls, type ServiceWorkerCacheEntry } from 'sw/cache-plan';",
    "import svelteKitFeaturesWorkerUrl from '../features-worker/webp.ts?worker&url';",
    "import { webpCodecAssetUrls } from '../codec-assets/webp';",
    "import { qoiCodecAssetUrls } from '../codec-assets/qoi';",
    '',
    'export const generatedCodecCacheEntries = [',
    '  {',
    '    main: svelteKitFeaturesWorkerUrl,',
    '    deps: [...webpCodecAssetUrls, ...qoiCodecAssetUrls],',
    '  },',
    '] satisfies readonly ServiceWorkerCacheEntry[];',
    '',
    'export const generatedCodecCacheUrls = collectEntryUrls(',
    '  generatedCodecCacheEntries,',
    ');',
    '',
  ].join('\n');
}

const availableEncoderNames = await featureNames('encoders');
const missingPrototypeEncoders = prototypeEncoderNames.filter(
  (name) => !availableEncoderNames.includes(name),
);

if (missingPrototypeEncoders.length) {
  throw new Error(
    `Missing prototype encoder metadata: ${missingPrototypeEncoders.join(
      ', ',
    )}`,
  );
}

const metadata = generateFeatureMeta({
  encoderNames: prototypeEncoderNames,
  processorNames: await featureNames('processors'),
  preprocessorNames: await featureNames('preprocessors'),
});

await Promise.all([
  mkdir(outputDir, { recursive: true }),
  mkdir(workerOutputDir, { recursive: true }),
  mkdir(workerBridgeOutputDir, { recursive: true }),
  mkdir(workerSurfaceOutputDir, { recursive: true }),
  mkdir(codecAssetOutputDir, { recursive: true }),
  mkdir(serviceWorkerOutputDir, { recursive: true }),
]);
await Promise.all([
  writeFile(sharedOutputPath, metadata),
  writeFile(
    indexOutputPath,
    [
      '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
      '// It mirrors the production feature-meta index shape without importing Preact option components.',
      '',
      "export * from './shared';",
      '',
    ].join('\n'),
  ),
  writeFile(workerOutputPath, generateWebpWorkerEntry()),
  writeFile(workerBridgeMetaOutputPath, generateWorkerBridgeMeta()),
  writeFile(workerSurfaceReadyOutputPath, generateWorkerSurfaceReady()),
  writeFile(webpCodecAssetOutputPath, generateWebpCodecAssets()),
  writeFile(qoiCodecAssetOutputPath, generateQoiCodecAssets()),
  writeFile(rotateCodecAssetOutputPath, generateRotateCodecAssets()),
  writeFile(serviceWorkerCachePlanOutputPath, generateServiceWorkerCachePlan()),
]);
