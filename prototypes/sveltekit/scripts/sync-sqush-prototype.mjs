import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
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
const encoderOutputPath = join(outputDir, 'encoders.ts');
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
const avifCodecAssetOutputPath = join(codecAssetOutputDir, 'avif.ts');
const webpCodecAssetOutputPath = join(codecAssetOutputDir, 'webp.ts');
const wp2CodecAssetOutputPath = join(codecAssetOutputDir, 'wp2.ts');
const qoiCodecAssetOutputPath = join(codecAssetOutputDir, 'qoi.ts');
const jxlCodecAssetOutputPath = join(codecAssetOutputDir, 'jxl.ts');
const mozjpegCodecAssetOutputPath = join(codecAssetOutputDir, 'mozjpeg.ts');
const oxipngCodecAssetOutputPath = join(codecAssetOutputDir, 'oxipng.ts');
const imagequantCodecAssetOutputPath = join(
  codecAssetOutputDir,
  'imagequant.ts',
);
const resizeCodecAssetOutputPath = join(codecAssetOutputDir, 'resize.ts');
const rotateCodecAssetOutputPath = join(codecAssetOutputDir, 'rotate.ts');
const codecAssetManifestOutputPath = join(codecAssetOutputDir, 'manifest.ts');
const codecAssetPrecacheOutputPath = join(codecAssetOutputDir, 'precache.ts');
const patchedWebpEncoderWrapperOutputDir = join(
  prototypeRoot,
  '.svelte-kit',
  'sqush-generated',
  'codecs',
  'webp',
  'enc',
);
const patchedWebpEncoderOutputPath = join(
  patchedWebpEncoderWrapperOutputDir,
  'webp_enc.js',
);
const patchedWebpEncoderShimOutputPath = join(
  patchedWebpEncoderWrapperOutputDir,
  'webp_enc.d.ts',
);
const stalePatchedWebpEncoderTsOutputPath = join(
  patchedWebpEncoderWrapperOutputDir,
  'webp_enc.ts',
);
const patchedWebpEncoderSimdOutputPath = join(
  patchedWebpEncoderWrapperOutputDir,
  'webp_enc_simd.js',
);
const patchedWebpEncoderSimdShimOutputPath = join(
  patchedWebpEncoderWrapperOutputDir,
  'webp_enc_simd.d.ts',
);
const stalePatchedWebpEncoderSimdTsOutputPath = join(
  patchedWebpEncoderWrapperOutputDir,
  'webp_enc_simd.ts',
);
const patchedAvifEncoderWrapperOutputDir = join(
  prototypeRoot,
  '.svelte-kit',
  'sqush-generated',
  'codecs',
  'avif',
  'enc',
);
const patchedAvifEncoderOutputPath = join(
  patchedAvifEncoderWrapperOutputDir,
  'avif_enc.js',
);
const patchedAvifEncoderShimOutputPath = join(
  patchedAvifEncoderWrapperOutputDir,
  'avif_enc.d.ts',
);
const patchedJxlEncoderWrapperOutputDir = join(
  prototypeRoot,
  '.svelte-kit',
  'sqush-generated',
  'codecs',
  'jxl',
  'enc',
);
const patchedJxlEncoderOutputPath = join(
  patchedJxlEncoderWrapperOutputDir,
  'jxl_enc.js',
);
const patchedJxlEncoderShimOutputPath = join(
  patchedJxlEncoderWrapperOutputDir,
  'jxl_enc.d.ts',
);
const patchedWebpDecoderWrapperOutputDir = join(
  prototypeRoot,
  '.svelte-kit',
  'sqush-generated',
  'codecs',
  'webp',
  'dec',
);
const patchedWebpDecoderOutputPath = join(
  patchedWebpDecoderWrapperOutputDir,
  'webp_dec.js',
);
const patchedWebpDecoderShimOutputPath = join(
  patchedWebpDecoderWrapperOutputDir,
  'webp_dec.d.ts',
);
const stalePatchedWebpDecoderTsOutputPath = join(
  patchedWebpDecoderWrapperOutputDir,
  'webp_dec.ts',
);
const patchedWp2EncoderWrapperOutputDir = join(
  prototypeRoot,
  '.svelte-kit',
  'sqush-generated',
  'codecs',
  'wp2',
  'enc',
);
const patchedWp2EncoderOutputPath = join(
  patchedWp2EncoderWrapperOutputDir,
  'wp2_enc.js',
);
const patchedWp2EncoderShimOutputPath = join(
  patchedWp2EncoderWrapperOutputDir,
  'wp2_enc.d.ts',
);
const patchedWp2DecoderWrapperOutputDir = join(
  prototypeRoot,
  '.svelte-kit',
  'sqush-generated',
  'codecs',
  'wp2',
  'dec',
);
const patchedWp2DecoderOutputPath = join(
  patchedWp2DecoderWrapperOutputDir,
  'wp2_dec.js',
);
const patchedWp2DecoderShimOutputPath = join(
  patchedWp2DecoderWrapperOutputDir,
  'wp2_dec.d.ts',
);
const patchedAvifDecoderWrapperOutputDir = join(
  prototypeRoot,
  '.svelte-kit',
  'sqush-generated',
  'codecs',
  'avif',
  'dec',
);
const patchedAvifDecoderOutputPath = join(
  patchedAvifDecoderWrapperOutputDir,
  'avif_dec.js',
);
const patchedAvifDecoderShimOutputPath = join(
  patchedAvifDecoderWrapperOutputDir,
  'avif_dec.d.ts',
);
const patchedJxlDecoderWrapperOutputDir = join(
  prototypeRoot,
  '.svelte-kit',
  'sqush-generated',
  'codecs',
  'jxl',
  'dec',
);
const patchedJxlDecoderOutputPath = join(
  patchedJxlDecoderWrapperOutputDir,
  'jxl_dec.js',
);
const patchedJxlDecoderShimOutputPath = join(
  patchedJxlDecoderWrapperOutputDir,
  'jxl_dec.d.ts',
);
const patchedQoiEncoderWrapperOutputDir = join(
  prototypeRoot,
  '.svelte-kit',
  'sqush-generated',
  'codecs',
  'qoi',
  'enc',
);
const patchedQoiEncoderOutputPath = join(
  patchedQoiEncoderWrapperOutputDir,
  'qoi_enc.js',
);
const patchedQoiEncoderShimOutputPath = join(
  patchedQoiEncoderWrapperOutputDir,
  'qoi_enc.d.ts',
);
const stalePatchedQoiEncoderTsOutputPath = join(
  patchedQoiEncoderWrapperOutputDir,
  'qoi_enc.ts',
);
const patchedQoiDecoderWrapperOutputDir = join(
  prototypeRoot,
  '.svelte-kit',
  'sqush-generated',
  'codecs',
  'qoi',
  'dec',
);
const patchedQoiDecoderOutputPath = join(
  patchedQoiDecoderWrapperOutputDir,
  'qoi_dec.js',
);
const patchedQoiDecoderShimOutputPath = join(
  patchedQoiDecoderWrapperOutputDir,
  'qoi_dec.d.ts',
);
const stalePatchedQoiDecoderTsOutputPath = join(
  patchedQoiDecoderWrapperOutputDir,
  'qoi_dec.ts',
);
const patchedMozjpegEncoderWrapperOutputDir = join(
  prototypeRoot,
  '.svelte-kit',
  'sqush-generated',
  'codecs',
  'mozjpeg',
  'enc',
);
const patchedMozjpegEncoderOutputPath = join(
  patchedMozjpegEncoderWrapperOutputDir,
  'mozjpeg_enc.js',
);
const patchedMozjpegEncoderShimOutputPath = join(
  patchedMozjpegEncoderWrapperOutputDir,
  'mozjpeg_enc.d.ts',
);
const stalePatchedMozjpegEncoderTsOutputPath = join(
  patchedMozjpegEncoderWrapperOutputDir,
  'mozjpeg_enc.ts',
);
const patchedImagequantWrapperOutputDir = join(
  prototypeRoot,
  '.svelte-kit',
  'sqush-generated',
  'codecs',
  'imagequant',
);
const patchedImagequantOutputPath = join(
  patchedImagequantWrapperOutputDir,
  'imagequant.js',
);
const patchedImagequantShimOutputPath = join(
  patchedImagequantWrapperOutputDir,
  'imagequant.d.ts',
);
const stalePatchedImagequantTsOutputPath = join(
  patchedImagequantWrapperOutputDir,
  'imagequant.ts',
);
const patchedResizeWrapperOutputDir = join(
  prototypeRoot,
  '.svelte-kit',
  'sqush-generated',
  'codecs',
  'resize',
  'pkg',
);
const patchedResizeOutputPath = join(
  patchedResizeWrapperOutputDir,
  'squoosh_resize.js',
);
const patchedResizeShimOutputPath = join(
  patchedResizeWrapperOutputDir,
  'squoosh_resize.d.ts',
);
const patchedHqxWrapperOutputDir = join(
  prototypeRoot,
  '.svelte-kit',
  'sqush-generated',
  'codecs',
  'hqx',
  'pkg',
);
const patchedHqxOutputPath = join(patchedHqxWrapperOutputDir, 'squooshhqx.js');
const patchedHqxShimOutputPath = join(
  patchedHqxWrapperOutputDir,
  'squooshhqx.d.ts',
);
const patchedOxipngWrapperOutputDir = join(
  prototypeRoot,
  '.svelte-kit',
  'sqush-generated',
  'codecs',
  'oxipng',
  'pkg',
);
const patchedOxipngOutputPath = join(
  patchedOxipngWrapperOutputDir,
  'squoosh_oxipng.js',
);
const patchedOxipngShimOutputPath = join(
  patchedOxipngWrapperOutputDir,
  'squoosh_oxipng.d.ts',
);
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
// Active encoder surface for the SvelteKit prototype. The generated feature-meta
// (EncoderState/encoderMap) and encode-only runtime map are built from this list,
// so single-image and bulk share one imagePipeline.compressImage path.
const prototypeEncoderNames = [
  'avif',
  'browserGIF',
  'browserJPEG',
  'browserPNG',
  'jxl',
  'mozJPEG',
  'oxiPNG',
  'qoi',
  'webP',
  'wp2',
];
const svelteKitReadyWorkerMethods = [
  {
    name: 'avifDecode',
    source: 'features/decoders/avif/worker/avifDecode',
    reason:
      'AVIF decode runs with generated Vite worker and generated AVIF decoder WASM URL injection.',
  },
  {
    name: 'avifEncode',
    source: 'features/encoders/avif/worker/avifEncode',
    reason:
      'AVIF single-thread encode runs with generated Vite worker and generated AVIF encoder WASM URL injection.',
  },
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
    name: 'qoiDecode',
    source: 'features/decoders/qoi/worker/qoiDecode',
    reason:
      'QOI decode runs with generated Vite worker and generated QOI WASM URL injection.',
  },
  {
    name: 'jxlDecode',
    source: 'features/decoders/jxl/worker/jxlDecode',
    reason:
      'JPEG XL decode runs with generated Vite worker and generated JXL decoder WASM URL injection.',
  },
  {
    name: 'webpDecode',
    source: 'features/decoders/webP/worker/webpDecode',
    reason:
      'WebP decode runs with generated Vite worker and generated WebP decoder WASM URL injection.',
  },
  {
    name: 'wp2Decode',
    source: 'features/decoders/wp2/worker/wp2Decode',
    reason:
      'WebP 2 decode runs with generated Vite worker and generated WebP 2 decoder WASM URL injection.',
  },
  {
    name: 'qoiEncode',
    source: 'features/encoders/qoi/worker/qoiEncode',
    reason:
      'QOI encode runs with generated Vite worker and generated QOI WASM URL injection.',
  },
  {
    name: 'wp2Encode',
    source: 'features/encoders/wp2/worker/wp2Encode',
    reason:
      'WebP 2 single-thread encode runs with generated Vite worker and generated WebP 2 encoder WASM URL injection.',
  },
  {
    name: 'jxlEncode',
    source: 'features/encoders/jxl/worker/jxlEncode',
    reason:
      'JPEG XL single-thread encode runs with generated Vite worker and generated JXL encoder WASM URL injection.',
  },
  {
    name: 'mozjpegEncode',
    source: 'features/encoders/mozJPEG/worker/mozjpegEncode',
    reason:
      'MozJPEG encode runs with generated Vite worker and generated MozJPEG WASM URL injection.',
  },
  {
    name: 'quantize',
    source: 'features/processors/quantize/worker/quantize',
    reason:
      'Quantize runs with generated Vite worker and generated ImageQuant WASM URL injection.',
  },
  {
    name: 'resize',
    source: 'features/processors/resize/worker/resize',
    reason:
      'Resize runs with generated Vite worker and generated resize/HQX WASM URL injection.',
  },
  {
    name: 'oxipngEncode',
    source: 'features/encoders/oxiPNG/worker/oxipngEncode',
    reason:
      'OxiPNG single-thread encode runs with generated Vite worker, generated WASM URL injection, and worker-shared alias resolution.',
  },
];
const blockedWorkerMethods = [];

// Single source of truth for the logical codec asset records. Both the canonical
// manifest and the service-worker precache manifest are generated from this list,
// so they cannot drift. `module`/`urlBinding` describe where each record's Vite
// `?url` import binding lives (one per physical WASM, owned by the per-codec
// asset module), and the CodecAssetRecord fields mirror src/shared/codec-assets.ts.
// Order is canonical: it must match audit-static-output.mjs's expected record set.
const codecAssetRecords = [
  {
    logicalKey: 'avif:decoder:default',
    codec: 'avif',
    role: 'decoder',
    variant: 'default',
    cache: 'precache',
    module: './avif',
    urlBinding: 'avifDecoderWasmUrl',
  },
  {
    logicalKey: 'avif:encoder:single-thread',
    codec: 'avif',
    role: 'encoder',
    variant: 'single-thread',
    cache: 'precache',
    module: './avif',
    urlBinding: 'avifEncoderWasmUrl',
  },
  {
    logicalKey: 'webp:decoder:default',
    codec: 'webp',
    role: 'decoder',
    variant: 'default',
    cache: 'precache',
    module: './webp',
    urlBinding: 'webpDecoderWasmUrl',
  },
  {
    logicalKey: 'webp:encoder:baseline',
    codec: 'webp',
    role: 'encoder',
    variant: 'baseline',
    cache: 'precache',
    module: './webp',
    urlBinding: 'webpEncoderWasmUrl',
  },
  {
    logicalKey: 'webp:encoder:simd',
    codec: 'webp',
    role: 'encoder',
    variant: 'simd',
    cache: 'precache',
    module: './webp',
    urlBinding: 'webpEncoderSimdWasmUrl',
  },
  {
    logicalKey: 'wp2:decoder:default',
    codec: 'wp2',
    role: 'decoder',
    variant: 'default',
    cache: 'precache',
    module: './wp2',
    urlBinding: 'wp2DecoderWasmUrl',
  },
  {
    logicalKey: 'wp2:encoder:baseline',
    codec: 'wp2',
    role: 'encoder',
    variant: 'baseline',
    cache: 'precache',
    module: './wp2',
    urlBinding: 'wp2EncoderWasmUrl',
  },
  {
    logicalKey: 'qoi:decoder:default',
    codec: 'qoi',
    role: 'decoder',
    variant: 'default',
    cache: 'precache',
    module: './qoi',
    urlBinding: 'qoiDecoderWasmUrl',
  },
  {
    logicalKey: 'qoi:encoder:default',
    codec: 'qoi',
    role: 'encoder',
    variant: 'default',
    cache: 'precache',
    module: './qoi',
    urlBinding: 'qoiEncoderWasmUrl',
  },
  {
    logicalKey: 'jxl:decoder:default',
    codec: 'jxl',
    role: 'decoder',
    variant: 'default',
    cache: 'precache',
    module: './jxl',
    urlBinding: 'jxlDecoderWasmUrl',
  },
  {
    logicalKey: 'jxl:encoder:single-thread',
    codec: 'jxl',
    role: 'encoder',
    variant: 'single-thread',
    cache: 'precache',
    module: './jxl',
    urlBinding: 'jxlEncoderWasmUrl',
  },
  {
    logicalKey: 'mozjpeg:encoder:default',
    codec: 'mozjpeg',
    role: 'encoder',
    variant: 'default',
    cache: 'precache',
    module: './mozjpeg',
    urlBinding: 'mozjpegEncoderWasmUrl',
  },
  {
    logicalKey: 'oxipng:encoder:single-thread',
    codec: 'oxipng',
    role: 'encoder',
    variant: 'single-thread',
    cache: 'precache',
    module: './oxipng',
    urlBinding: 'oxipngWasmUrl',
  },
  {
    logicalKey: 'imagequant:processor:default',
    codec: 'imagequant',
    role: 'processor',
    variant: 'default',
    cache: 'precache',
    module: './imagequant',
    urlBinding: 'imagequantWasmUrl',
  },
  {
    logicalKey: 'resize:processor:default',
    codec: 'resize',
    role: 'processor',
    variant: 'default',
    cache: 'precache',
    module: './resize',
    urlBinding: 'resizeWasmUrl',
  },
  {
    logicalKey: 'hqx:processor:hqx',
    codec: 'hqx',
    role: 'processor',
    variant: 'hqx',
    cache: 'precache',
    module: './resize',
    urlBinding: 'hqxWasmUrl',
  },
  {
    logicalKey: 'rotate:preprocessor:default',
    codec: 'rotate',
    role: 'preprocessor',
    variant: 'default',
    cache: 'runtime',
    module: './rotate',
    urlBinding: 'rotateWasmUrl',
  },
];

// Group records into `import { ...bindings } from 'module';` lines, sorted the
// same way the previous hand-written manifests were (bindings sorted within each
// module, modules sorted by their first binding) so generated output is stable.
function generateCodecAssetImports(records) {
  const bindingsByModule = new Map();

  for (const record of records) {
    if (!bindingsByModule.has(record.module)) {
      bindingsByModule.set(record.module, new Set());
    }
    bindingsByModule.get(record.module).add(record.urlBinding);
  }

  const groups = [...bindingsByModule.entries()]
    .map(([module, bindings]) => ({
      module,
      bindings: [...bindings].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.bindings[0].localeCompare(b.bindings[0]));

  return groups.map(
    ({ module, bindings }) =>
      `import { ${bindings.join(', ')} } from '${module}';`,
  );
}

// Emit one `satisfies CodecAssetRecord` object literal per record. The `module`
// and `urlBinding` source-of-truth fields are intentionally dropped here: the
// emitted record matches the shared CodecAssetRecord contract exactly.
function generateCodecAssetRecordLiterals(records) {
  return records.map(
    (record) =>
      `  { logicalKey: '${record.logicalKey}', codec: '${record.codec}', role: '${record.role}', variant: '${record.variant}', url: ${record.urlBinding}, cache: '${record.cache}' },`,
  );
}

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

function generateEncoderRuntimeMeta({ encoderNames }) {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It mirrors the production encode-only feature-meta map without importing Preact option components.',
    '',
    "import { encoderMap as sharedEncoderMap } from './shared';",
    ...encoderNames.map(
      (name) =>
        `import * as ${identifier(
          name,
          'EncoderRuntime',
        )} from 'features/encoders/${name}/client/runtime';`,
    ),
    '',
    "export type { EncoderOptions, EncoderState, EncoderType } from './shared';",
    "export { encoderMap as encoderMetaMap } from './shared';",
    '',
    'export const encoderMap = {',
    ...encoderNames.map(
      (name) =>
        `  ${name}: { ...sharedEncoderMap.${name}, ...${identifier(
          name,
          'EncoderRuntime',
        )} },`,
    ),
    '} as const;',
    '',
  ].join('\n');
}

function generateWebpWorkerEntry() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It intentionally stays a narrow generated worker until the remaining codec asset seams are resolved.',
    '',
    "import { expose } from 'comlink';",
    "import { blobToArrayBuffer, initEmscriptenModule } from 'features/worker-utils';",
    "import { createAvifDecoderRuntime } from 'features/decoders/avif/worker/runtime';",
    "import avifDecoder from 'sqush-generated/codecs/avif/dec/avif_dec';",
    "import { createAvifEncoderRuntime } from 'features/encoders/avif/worker/runtime';",
    "import avifEncoder from 'sqush-generated/codecs/avif/enc/avif_enc';",
    "import type { EncodeOptions as AvifEncodeOptions } from 'features/encoders/avif/shared/meta';",
    "import { createWebpDecoderRuntime } from 'features/decoders/webP/worker/runtime';",
    "import webpDecoder from 'sqush-generated/codecs/webp/dec/webp_dec';",
    "import { createWebpEncoderRuntime } from 'features/encoders/webP/worker/runtime';",
    "import type { EncodeOptions } from 'features/encoders/webP/shared/meta';",
    "import webpEncoder from 'sqush-generated/codecs/webp/enc/webp_enc';",
    "import webpEncoderSimd from 'sqush-generated/codecs/webp/enc/webp_enc_simd';",
    "import wp2Decoder, { type WP2Module as Wp2DecoderModule } from 'sqush-generated/codecs/wp2/dec/wp2_dec';",
    "import wp2Encoder, { type WP2Module as Wp2EncoderModule } from 'sqush-generated/codecs/wp2/enc/wp2_enc';",
    "import type { EncodeOptions as Wp2EncodeOptions } from 'features/encoders/wp2/shared/meta';",
    "import { createQoiDecoderRuntime } from 'features/decoders/qoi/worker/runtime';",
    "import qoiDecoder from 'sqush-generated/codecs/qoi/dec/qoi_dec';",
    "import { createJxlDecoderRuntime } from 'features/decoders/jxl/worker/runtime';",
    "import jxlDecoder from 'sqush-generated/codecs/jxl/dec/jxl_dec';",
    "import { createQoiEncoderRuntime } from 'features/encoders/qoi/worker/runtime';",
    "import type { EncodeOptions as QoiEncodeOptions } from 'features/encoders/qoi/shared/meta';",
    "import qoiEncoder from 'sqush-generated/codecs/qoi/enc/qoi_enc';",
    "import { createJxlEncoderRuntime } from 'features/encoders/jxl/worker/runtime';",
    "import type { EncodeOptions as JxlEncodeOptions } from 'features/encoders/jxl/shared/meta';",
    "import jxlEncoder from 'sqush-generated/codecs/jxl/enc/jxl_enc';",
    "import { createMozjpegEncoderRuntime } from 'features/encoders/mozJPEG/worker/runtime';",
    "import type { EncodeOptions as MozjpegEncodeOptions } from 'features/encoders/mozJPEG/shared/meta';",
    "import mozjpegEncoder from 'sqush-generated/codecs/mozjpeg/enc/mozjpeg_enc';",
    "import { createOxiPngEncoderRuntime } from 'features/encoders/oxiPNG/worker/runtime';",
    "import type { EncodeOptions as OxipngEncodeOptions } from 'features/encoders/oxiPNG/shared/meta';",
    "import initOxipngWasm, { optimise as optimiseOxipng } from 'sqush-generated/codecs/oxipng/pkg/squoosh_oxipng';",
    "import { createQuantizeRuntime } from 'features/processors/quantize/worker/runtime';",
    "import type { Options as QuantizeOptions } from 'features/processors/quantize/shared/meta';",
    "import imagequant from 'sqush-generated/codecs/imagequant/imagequant';",
    "import { createResize } from 'features/processors/resize/worker/runtime';",
    "import type { WorkerResizeOptions } from 'features/processors/resize/shared/meta';",
    "import initResizeWasm, { resize as wasmResize } from 'sqush-generated/codecs/resize/pkg/squoosh_resize';",
    "import initHqxWasm, { resize as wasmHqx } from 'sqush-generated/codecs/hqx/pkg/squooshhqx';",
    "import { createRotate } from 'features/preprocessors/rotate/worker/runtime';",
    "import type { Options as RotateOptions } from 'features/preprocessors/rotate/shared/meta';",
    '',
    'export interface AvifWasmUrls {',
    '  decoder: string;',
    '  encoder: string;',
    '}',
    '',
    'export interface WebpWasmUrls {',
    '  baseline: string;',
    '  decoder: string;',
    '  simd: string;',
    '}',
    '',
    'export interface Wp2WasmUrls {',
    '  decoder: string;',
    '  encoder: string;',
    '}',
    '',
    'export interface QoiWasmUrls {',
    '  decoder: string;',
    '  encoder: string;',
    '}',
    '',
    'export interface JxlWasmUrls {',
    '  decoder: string;',
    '  encoder: string;',
    '}',
    '',
    'export interface MozjpegWasmUrls {',
    '  encoder: string;',
    '}',
    '',
    'export interface OxipngWasmUrls {',
    '  singleThread: string;',
    '}',
    '',
    'export interface ImagequantWasmUrls {',
    '  processor: string;',
    '}',
    '',
    'export interface ResizeWasmUrls {',
    '  hqx: string;',
    '  resize: string;',
    '}',
    '',
    'export interface RotateWasmUrls {',
    '  preprocessor: string;',
    '}',
    '',
    'function locateCodecWasm({',
    '  avif,',
    '  imagequant,',
    '  jxl,',
    '  mozjpeg,',
    '  qoi,',
    '  webp,',
    '  wp2,',
    '}: {',
    '  avif?: AvifWasmUrls;',
    '  imagequant?: ImagequantWasmUrls;',
    '  jxl?: JxlWasmUrls;',
    '  mozjpeg?: MozjpegWasmUrls;',
    '  qoi?: QoiWasmUrls;',
    '  webp?: WebpWasmUrls;',
    '  wp2?: Wp2WasmUrls;',
    '}): void {',
    '  globalThis.__squshEmscriptenLocateFile = (path) => {',
    "    if (path === 'avif_dec.wasm') return avif?.decoder ?? path;",
    "    if (path === 'avif_enc.wasm') return avif?.encoder ?? path;",
    "    if (path === 'webp_enc.wasm') return webp?.baseline ?? path;",
    "    if (path === 'webp_dec.wasm') return webp?.decoder ?? path;",
    "    if (path === 'webp_enc_simd.wasm') return webp?.simd ?? path;",
    "    if (path === 'wp2_dec.wasm') return wp2?.decoder ?? path;",
    "    if (path === 'wp2_enc.wasm') return wp2?.encoder ?? path;",
    "    if (path === 'qoi_enc.wasm') return qoi?.encoder ?? path;",
    "    if (path === 'qoi_dec.wasm') return qoi?.decoder ?? path;",
    "    if (path === 'jxl_enc.wasm') return jxl?.encoder ?? path;",
    "    if (path === 'jxl_dec.wasm') return jxl?.decoder ?? path;",
    "    if (path === 'mozjpeg_enc.wasm') return mozjpeg?.encoder ?? path;",
    "    if (path === 'imagequant.wasm') return imagequant?.processor ?? path;",
    '    return path;',
    '  };',
    '}',
    '',
    'const decodeAvif = createAvifDecoderRuntime({',
    '  loadDecoder: async () => avifDecoder,',
    '});',
    'const encodeAvif = createAvifEncoderRuntime({',
    '  supportsThreads: async () => false,',
    '  loadSingleThread: async () => avifEncoder,',
    '});',
    'const decodeWebp = createWebpDecoderRuntime({',
    '  loadDecoder: async () => webpDecoder,',
    '});',
    'const encodeWebp = createWebpEncoderRuntime({',
    '  detectSimd: async () => true,',
    '  loadBaseline: async () => webpEncoder,',
    '  loadSimd: async () => webpEncoderSimd,',
    '});',
    'let wp2DecoderModule: Promise<Wp2DecoderModule> | undefined;',
    'let wp2EncoderModule: Promise<Wp2EncoderModule> | undefined;',
    'const decodeQoi = createQoiDecoderRuntime({',
    '  loadDecoder: async () => qoiDecoder,',
    '});',
    'const encodeQoi = createQoiEncoderRuntime({',
    '  loadEncoder: async () => qoiEncoder,',
    '});',
    'const decodeJxl = createJxlDecoderRuntime({',
    '  loadDecoder: async () => jxlDecoder,',
    '});',
    'const encodeJxl = createJxlEncoderRuntime({',
    '  supportsThreads: async () => false,',
    '  supportsSimd: async () => false,',
    '  loadSingleThread: async () => jxlEncoder,',
    '  async loadMultiThread() {',
    "    throw new Error('JPEG XL multithread runtime is unavailable in the SvelteKit prototype.');",
    '  },',
    '  async loadMultiThreadSimd() {',
    "    throw new Error('JPEG XL multithread SIMD runtime is unavailable in the SvelteKit prototype.');",
    '  },',
    '});',
    'const encodeMozjpeg = createMozjpegEncoderRuntime({',
    '  loadEncoder: async () => mozjpegEncoder,',
    '});',
    'const encodeOxipng = createOxiPngEncoderRuntime({',
    '  supportsThreads: async () => false,',
    '  async loadSingleThread(wasmUrl) {',
    '    await initOxipngWasm(wasmUrl);',
    '    return optimiseOxipng;',
    '  },',
    '});',
    'const quantize = createQuantizeRuntime({',
    '  loadQuantizer: async () => imagequant,',
    '});',
    'const resize = createResize({',
    '  initHqxWasm,',
    '  initResizeWasm,',
    '  wasmHqx,',
    '  wasmResize,',
    '});',
    'let rotate: ReturnType<typeof createRotate> | undefined;',
    '',
    'function rotateWith(wasmUrls: RotateWasmUrls): ReturnType<typeof createRotate> {',
    '  rotate ??= createRotate(wasmUrls.preprocessor);',
    '  return rotate;',
    '}',
    '',
    'const workerApi = {',
    '  avifDecode(blob: Blob, wasmUrls: AvifWasmUrls): Promise<ImageData> {',
    '    locateCodecWasm({ avif: wasmUrls });',
    '    return decodeAvif(blob);',
    '  },',
    '  avifEncode(',
    '    imageData: ImageData,',
    '    options: AvifEncodeOptions,',
    '    wasmUrls: AvifWasmUrls,',
    '  ): Promise<ArrayBuffer> {',
    '    locateCodecWasm({ avif: wasmUrls });',
    '    return encodeAvif(imageData, options, {',
    '      supportsThreads: async () => false,',
    '    });',
    '  },',
    '  webpEncode(',
    '    imageData: ImageData,',
    '    options: EncodeOptions,',
    '    wasmUrls: WebpWasmUrls,',
    '  ): Promise<ArrayBuffer> {',
    '    locateCodecWasm({ webp: wasmUrls });',
    '    return encodeWebp(imageData, options);',
    '  },',
    '  webpDecode(blob: Blob, wasmUrls: WebpWasmUrls): Promise<ImageData> {',
    '    locateCodecWasm({ webp: wasmUrls });',
    '    return decodeWebp(blob);',
    '  },',
    '  async wp2Decode(blob: Blob, wasmUrls: Wp2WasmUrls): Promise<ImageData> {',
    '    locateCodecWasm({ wp2: wasmUrls });',
    '    wp2DecoderModule ??= initEmscriptenModule(wp2Decoder);',
    '    const [module, data] = await Promise.all([',
    '      wp2DecoderModule,',
    '      blobToArrayBuffer(blob),',
    '    ]);',
    '    const result = module.decode(data);',
    "    if (!result) throw new Error('Decoding error');",
    '    return result;',
    '  },',
    '  async wp2Encode(',
    '    imageData: ImageData,',
    '    options: Wp2EncodeOptions,',
    '    wasmUrls: Wp2WasmUrls,',
    '  ): Promise<ArrayBuffer> {',
    '    locateCodecWasm({ wp2: wasmUrls });',
    '    wp2EncoderModule ??= initEmscriptenModule(wp2Encoder);',
    '    const module = await wp2EncoderModule;',
    '    const result = module.encode(',
    '      imageData.data,',
    '      imageData.width,',
    '      imageData.height,',
    '      options,',
    '    );',
    "    if (!result) throw new Error('Encoding error.');",
    '    return new Uint8Array(result).buffer;',
    '  },',
    '  qoiDecode(blob: Blob, wasmUrls: QoiWasmUrls): Promise<ImageData> {',
    '    locateCodecWasm({ qoi: wasmUrls });',
    '    return decodeQoi(blob);',
    '  },',
    '  qoiEncode(',
    '    imageData: ImageData,',
    '    options: QoiEncodeOptions,',
    '    wasmUrls: QoiWasmUrls,',
    '  ): Promise<ArrayBuffer> {',
    '    locateCodecWasm({ qoi: wasmUrls });',
    '    return encodeQoi(imageData, options);',
    '  },',
    '  jxlDecode(blob: Blob, wasmUrls: JxlWasmUrls): Promise<ImageData> {',
    '    locateCodecWasm({ jxl: wasmUrls });',
    '    return decodeJxl(blob);',
    '  },',
    '  jxlEncode(',
    '    imageData: ImageData,',
    '    options: JxlEncodeOptions,',
    '    wasmUrls: JxlWasmUrls,',
    '  ): Promise<ArrayBuffer> {',
    '    locateCodecWasm({ jxl: wasmUrls });',
    '    return encodeJxl(imageData, options, {',
    '      supportsThreads: async () => false,',
    '    });',
    '  },',
    '  mozjpegEncode(',
    '    imageData: ImageData,',
    '    options: MozjpegEncodeOptions,',
    '    wasmUrls: MozjpegWasmUrls,',
    '  ): Promise<ArrayBuffer> {',
    '    locateCodecWasm({ mozjpeg: wasmUrls });',
    '    return encodeMozjpeg(imageData, options);',
    '  },',
    '  oxipngEncode(',
    '    imageData: ImageData,',
    '    options: OxipngEncodeOptions,',
    '    wasmUrls: OxipngWasmUrls,',
    '  ): Promise<ArrayBuffer> {',
    '    return encodeOxipng(imageData, options, {',
    '      supportsThreads: async () => false,',
    '      wasmUrls,',
    '    });',
    '  },',
    '  quantize(',
    '    imageData: ImageData,',
    '    options: QuantizeOptions,',
    '    wasmUrls: ImagequantWasmUrls,',
    '  ): Promise<ImageData> {',
    '    locateCodecWasm({ imagequant: wasmUrls });',
    '    return quantize(imageData, options);',
    '  },',
    '  resize(',
    '    imageData: ImageData,',
    '    options: WorkerResizeOptions,',
    '    wasmUrls: ResizeWasmUrls,',
    '  ): Promise<ImageData> {',
    '    return resize(imageData, options, wasmUrls);',
    '  },',
    '  rotate(',
    '    data: ImageData,',
    '    options: RotateOptions,',
    '    wasmUrls: RotateWasmUrls,',
    '  ): Promise<ImageData> {',
    '    return rotateWith(wasmUrls)(data, options);',
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

function generateAvifCodecAssets() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It is the prototype canonical asset manifest for AVIF codec WASM URLs.',
    '',
    "import avifDecoderWasmUrl from 'codecs/avif/dec/avif_dec.wasm?url';",
    "import avifEncoderWasmUrl from 'codecs/avif/enc/avif_enc.wasm?url';",
    '',
    'export { avifDecoderWasmUrl, avifEncoderWasmUrl };',
    '',
    'export const avifCodecAssetUrls = [',
    '  avifDecoderWasmUrl,',
    '  avifEncoderWasmUrl,',
    '] as const;',
    '',
  ].join('\n');
}

function generateWebpCodecAssets() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It is the prototype canonical asset manifest for WebP codec WASM URLs.',
    '',
    "import webpDecoderWasmUrl from 'codecs/webp/dec/webp_dec.wasm?url';",
    "import webpEncoderWasmUrl from 'codecs/webp/enc/webp_enc.wasm?url';",
    "import webpEncoderSimdWasmUrl from 'codecs/webp/enc/webp_enc_simd.wasm?url';",
    '',
    'export { webpDecoderWasmUrl, webpEncoderSimdWasmUrl, webpEncoderWasmUrl };',
    '',
    'export const webpCodecAssetUrls = [',
    '  webpDecoderWasmUrl,',
    '  webpEncoderWasmUrl,',
    '  webpEncoderSimdWasmUrl,',
    '] as const;',
    '',
  ].join('\n');
}

function generateWp2CodecAssets() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It is the prototype canonical asset manifest for WebP 2 codec WASM URLs.',
    '',
    "import wp2DecoderWasmUrl from 'codecs/wp2/dec/wp2_dec.wasm?url';",
    "import wp2EncoderWasmUrl from 'codecs/wp2/enc/wp2_enc.wasm?url';",
    '',
    'export { wp2DecoderWasmUrl, wp2EncoderWasmUrl };',
    '',
    'export const wp2CodecAssetUrls = [',
    '  wp2DecoderWasmUrl,',
    '  wp2EncoderWasmUrl,',
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
    '// It is the prototype canonical asset manifest for QOI decoder and encoder WASM URLs.',
    '',
    "import qoiDecoderWasmUrl from 'codecs/qoi/dec/qoi_dec.wasm?url';",
    "import qoiEncoderWasmUrl from 'codecs/qoi/enc/qoi_enc.wasm?url';",
    '',
    'export { qoiDecoderWasmUrl, qoiEncoderWasmUrl };',
    '',
    'export const qoiCodecAssetUrls = [',
    '  qoiDecoderWasmUrl,',
    '  qoiEncoderWasmUrl,',
    '] as const;',
    '',
  ].join('\n');
}

function generateJxlCodecAssets() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It is the prototype canonical asset manifest for JPEG XL codec WASM URLs.',
    '',
    "import jxlDecoderWasmUrl from 'codecs/jxl/dec/jxl_dec.wasm?url';",
    "import jxlEncoderWasmUrl from 'codecs/jxl/enc/jxl_enc.wasm?url';",
    '',
    'export { jxlDecoderWasmUrl, jxlEncoderWasmUrl };',
    '',
    'export const jxlCodecAssetUrls = [',
    '  jxlDecoderWasmUrl,',
    '  jxlEncoderWasmUrl,',
    '] as const;',
    '',
  ].join('\n');
}

function generateMozjpegCodecAssets() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It is the prototype canonical asset manifest for MozJPEG encoder WASM URLs.',
    '',
    "import mozjpegEncoderWasmUrl from 'codecs/mozjpeg/enc/mozjpeg_enc.wasm?url';",
    '',
    'export { mozjpegEncoderWasmUrl };',
    '',
    'export const mozjpegCodecAssetUrls = [mozjpegEncoderWasmUrl] as const;',
    '',
  ].join('\n');
}

function generateOxipngCodecAssets() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It is the prototype canonical asset manifest for OxiPNG encoder WASM URLs.',
    '',
    "import oxipngWasmUrl from 'codecs/oxipng/pkg/squoosh_oxipng_bg.wasm?url';",
    '',
    'export { oxipngWasmUrl };',
    '',
    'export const oxipngCodecAssetUrls = [oxipngWasmUrl] as const;',
    '',
  ].join('\n');
}

function generateImagequantCodecAssets() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It is the prototype canonical asset manifest for ImageQuant processor WASM URLs.',
    '',
    "import imagequantWasmUrl from 'codecs/imagequant/imagequant.wasm?url';",
    '',
    'export { imagequantWasmUrl };',
    '',
    'export const imagequantCodecAssetUrls = [imagequantWasmUrl] as const;',
    '',
  ].join('\n');
}

function generateResizeCodecAssets() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It is the prototype canonical asset manifest for resize processor WASM URLs.',
    '',
    "import hqxWasmUrl from 'codecs/hqx/pkg/squooshhqx_bg.wasm?url';",
    "import resizeWasmUrl from 'codecs/resize/pkg/squoosh_resize_bg.wasm?url';",
    '',
    'export { hqxWasmUrl, resizeWasmUrl };',
    '',
    'export const resizeCodecAssetUrls = [hqxWasmUrl, resizeWasmUrl] as const;',
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
    "import { precacheCodecAssetUrls } from '../codec-assets/precache';",
    '',
    'export const generatedCodecCacheEntries = [',
    '  {',
    '    main: svelteKitFeaturesWorkerUrl,',
    '    deps: precacheCodecAssetUrls,',
    '  },',
    '] satisfies readonly ServiceWorkerCacheEntry[];',
    '',
    'export const generatedCodecCacheUrls = collectEntryUrls(',
    '  generatedCodecCacheEntries,',
    ');',
    '',
  ].join('\n');
}

function generateCodecAssetManifest() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It records logical codec assets so app, worker, and service-worker code can share one URL owner.',
    '',
    ...generateCodecAssetImports(codecAssetRecords),
    "import { getPrecacheCodecAssetRecords, getPrecacheCodecAssetUrls, type CodecAssetRecord } from 'shared/codec-assets';",
    '',
    'export type { CodecAssetRecord };',
    '',
    'export const svelteKitCodecAssetRecords = [',
    ...generateCodecAssetRecordLiterals(codecAssetRecords),
    '] satisfies readonly CodecAssetRecord[];',
    '',
    'export const precacheCodecAssetRecords = getPrecacheCodecAssetRecords(',
    '  svelteKitCodecAssetRecords,',
    ');',
    '',
    'export const precacheCodecAssetUrls = getPrecacheCodecAssetUrls(',
    '  svelteKitCodecAssetRecords,',
    ');',
    '',
  ].join('\n');
}

function generateCodecAssetPrecacheManifest() {
  const precacheRecords = codecAssetRecords.filter(
    (record) => record.cache === 'precache',
  );

  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It imports only service-worker precacheable codec assets; runtime-only assets stay out of the service-worker graph.',
    '',
    ...generateCodecAssetImports(precacheRecords),
    "import type { CodecAssetRecord } from 'shared/codec-assets';",
    '',
    'export const precacheCodecAssetRecords = [',
    ...generateCodecAssetRecordLiterals(precacheRecords),
    '] satisfies readonly CodecAssetRecord[];',
    '',
    'export const precacheCodecAssetUrls = precacheCodecAssetRecords.map(',
    '  (record) => record.url,',
    ');',
    '',
  ].join('\n');
}

async function patchEmscriptenWrapperFallbackUrl({
  sourcePath,
  assetName,
  codecName,
}) {
  const source = await readFile(sourcePath, 'utf8');
  const replacements = [
    {
      pattern: `var wasmBinaryFile=new URL("${assetName}",import.meta.url).toString()`,
      replacement: `var wasmBinaryFile="${assetName}"`,
    },
    {
      pattern: `wasmBinaryFile=new URL("${assetName}",import.meta.url).toString()`,
      replacement: `wasmBinaryFile="${assetName}"`,
    },
  ];
  const matchedReplacement = replacements.find(({ pattern }) =>
    source.includes(pattern),
  );

  if (!matchedReplacement) {
    throw new Error(
      `Expected ${codecName} wrapper fallback URL pattern for ${assetName}.`,
    );
  }

  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It patches the Emscripten fallback WASM URL so Vite does not emit a worker-local duplicate.',
    source.replace(matchedReplacement.pattern, matchedReplacement.replacement),
  ].join('\n');
}

async function patchWasmBindgenWrapperFallbackUrl({ sourcePath, assetName }) {
  const source = await readFile(sourcePath, 'utf8');
  const pattern = `input = new URL('${assetName}', import.meta.url);`;
  const replacement = `input = '${assetName}';`;

  if (!source.includes(pattern)) {
    throw new Error(
      `Expected wasm-bindgen wrapper fallback URL pattern for ${assetName}.`,
    );
  }

  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It patches the wasm-bindgen fallback WASM URL so Vite does not emit a worker-local duplicate.',
    source.replace(pattern, replacement),
  ].join('\n');
}

function generatePatchedWebpWrapperShim({ typeImportPath }) {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It describes the patched local wrapper while preserving the original codec types.',
    '',
    `import type { WebPModule } from '${typeImportPath}';`,
    '',
    'declare const moduleFactory: EmscriptenWasm.ModuleFactory<WebPModule>;',
    `export type { WebPModule } from '${typeImportPath}';`,
    'export default moduleFactory;',
    '',
  ].join('\n');
}

function generatePatchedWp2EncoderWrapperShim() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It describes the patched local wrapper while preserving the original codec types.',
    '',
    "import type { WP2Module } from '../../../../../../../codecs/wp2/enc/wp2_enc';",
    '',
    'declare const moduleFactory: EmscriptenWasm.ModuleFactory<WP2Module>;',
    "export type { EncodeOptions, WP2Module } from '../../../../../../../codecs/wp2/enc/wp2_enc';",
    'export default moduleFactory;',
    '',
  ].join('\n');
}

function generatePatchedWp2DecoderWrapperShim() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It describes the patched local wrapper while preserving the original codec types.',
    '',
    "import type { WP2Module } from '../../../../../../../codecs/wp2/dec/wp2_dec';",
    '',
    'declare const moduleFactory: EmscriptenWasm.ModuleFactory<WP2Module>;',
    "export type { WP2Module } from '../../../../../../../codecs/wp2/dec/wp2_dec';",
    'export default moduleFactory;',
    '',
  ].join('\n');
}

function generatePatchedAvifEncoderWrapperShim() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It describes the patched local wrapper while preserving the original codec types.',
    '',
    "import type { AVIFModule } from '../../../../../../../codecs/avif/enc/avif_enc';",
    '',
    'declare const moduleFactory: EmscriptenWasm.ModuleFactory<AVIFModule>;',
    "export type { AVIFModule, EncodeOptions } from '../../../../../../../codecs/avif/enc/avif_enc';",
    'export default moduleFactory;',
    '',
  ].join('\n');
}

function generatePatchedAvifDecoderWrapperShim() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It describes the patched local wrapper while preserving the original codec types.',
    '',
    "import type { AVIFModule } from '../../../../../../../codecs/avif/dec/avif_dec';",
    '',
    'declare const moduleFactory: EmscriptenWasm.ModuleFactory<AVIFModule>;',
    "export type { AVIFModule } from '../../../../../../../codecs/avif/dec/avif_dec';",
    'export default moduleFactory;',
    '',
  ].join('\n');
}

function generatePatchedJxlEncoderWrapperShim() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It describes the patched local wrapper while preserving the original codec types.',
    '',
    "import type { JXLModule } from '../../../../../../../codecs/jxl/enc/jxl_enc';",
    '',
    'declare const moduleFactory: EmscriptenWasm.ModuleFactory<JXLModule>;',
    "export type { EncodeOptions, JXLModule } from '../../../../../../../codecs/jxl/enc/jxl_enc';",
    'export default moduleFactory;',
    '',
  ].join('\n');
}

function generatePatchedJxlDecoderWrapperShim() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It describes the patched local wrapper while preserving the original codec types.',
    '',
    "import type { JXLModule } from '../../../../../../../codecs/jxl/dec/jxl_dec';",
    '',
    'declare const moduleFactory: EmscriptenWasm.ModuleFactory<JXLModule>;',
    "export type { JXLModule } from '../../../../../../../codecs/jxl/dec/jxl_dec';",
    'export default moduleFactory;',
    '',
  ].join('\n');
}

function generatePatchedQoiEncoderWrapperShim() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It describes the patched local wrapper while preserving the original codec types.',
    '',
    "import type { QoiModule } from '../../../../../../../codecs/qoi/enc/qoi_enc';",
    '',
    'declare const moduleFactory: EmscriptenWasm.ModuleFactory<QoiModule>;',
    "export type { EncodeOptions, QoiModule } from '../../../../../../../codecs/qoi/enc/qoi_enc';",
    'export default moduleFactory;',
    '',
  ].join('\n');
}

function generatePatchedQoiDecoderWrapperShim() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It describes the patched local wrapper while preserving the original codec types.',
    '',
    "import type { QOIModule } from '../../../../../../../codecs/qoi/dec/qoi_dec';",
    '',
    'declare const moduleFactory: EmscriptenWasm.ModuleFactory<QOIModule>;',
    "export type { QOIModule } from '../../../../../../../codecs/qoi/dec/qoi_dec';",
    'export default moduleFactory;',
    '',
  ].join('\n');
}

function generatePatchedMozjpegEncoderWrapperShim() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It describes the patched local wrapper while preserving the original codec types.',
    '',
    "import type { MozJPEGModule } from '../../../../../../../codecs/mozjpeg/enc/mozjpeg_enc';",
    '',
    'declare const moduleFactory: EmscriptenWasm.ModuleFactory<MozJPEGModule>;',
    "export type { EncodeOptions, MozJPEGModule } from '../../../../../../../codecs/mozjpeg/enc/mozjpeg_enc';",
    'export default moduleFactory;',
    '',
  ].join('\n');
}

function generatePatchedImagequantWrapperShim() {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It describes the patched local wrapper while preserving the original codec types.',
    '',
    "import type { QuantizerModule } from '../../../../../../codecs/imagequant/imagequant';",
    '',
    'declare const moduleFactory: EmscriptenWasm.ModuleFactory<QuantizerModule>;',
    "export type { QuantizerModule } from '../../../../../../codecs/imagequant/imagequant';",
    'export default moduleFactory;',
    '',
  ].join('\n');
}

async function generatePatchedWasmBindgenWrapperShim({ sourcePath }) {
  return [
    '// This file is autogenerated by prototypes/sveltekit/scripts/sync-sqush-prototype.mjs',
    '// It describes the patched local wasm-bindgen wrapper while preserving the original types.',
    await readFile(sourcePath, 'utf8'),
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
  mkdir(patchedWebpEncoderWrapperOutputDir, { recursive: true }),
  mkdir(patchedAvifEncoderWrapperOutputDir, { recursive: true }),
  mkdir(patchedJxlEncoderWrapperOutputDir, { recursive: true }),
  mkdir(patchedWebpDecoderWrapperOutputDir, { recursive: true }),
  mkdir(patchedWp2EncoderWrapperOutputDir, { recursive: true }),
  mkdir(patchedWp2DecoderWrapperOutputDir, { recursive: true }),
  mkdir(patchedAvifDecoderWrapperOutputDir, { recursive: true }),
  mkdir(patchedJxlDecoderWrapperOutputDir, { recursive: true }),
  mkdir(patchedQoiEncoderWrapperOutputDir, { recursive: true }),
  mkdir(patchedQoiDecoderWrapperOutputDir, { recursive: true }),
  mkdir(patchedMozjpegEncoderWrapperOutputDir, { recursive: true }),
  mkdir(patchedImagequantWrapperOutputDir, { recursive: true }),
  mkdir(patchedResizeWrapperOutputDir, { recursive: true }),
  mkdir(patchedHqxWrapperOutputDir, { recursive: true }),
  mkdir(patchedOxipngWrapperOutputDir, { recursive: true }),
  mkdir(serviceWorkerOutputDir, { recursive: true }),
]);
await Promise.all([
  rm(stalePatchedWebpEncoderTsOutputPath, { force: true }),
  rm(stalePatchedWebpEncoderSimdTsOutputPath, { force: true }),
  rm(stalePatchedWebpDecoderTsOutputPath, { force: true }),
  rm(stalePatchedQoiEncoderTsOutputPath, { force: true }),
  rm(stalePatchedQoiDecoderTsOutputPath, { force: true }),
  rm(stalePatchedMozjpegEncoderTsOutputPath, { force: true }),
  rm(stalePatchedImagequantTsOutputPath, { force: true }),
  writeFile(sharedOutputPath, metadata),
  writeFile(
    encoderOutputPath,
    generateEncoderRuntimeMeta({ encoderNames: prototypeEncoderNames }),
  ),
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
  writeFile(avifCodecAssetOutputPath, generateAvifCodecAssets()),
  writeFile(webpCodecAssetOutputPath, generateWebpCodecAssets()),
  writeFile(wp2CodecAssetOutputPath, generateWp2CodecAssets()),
  writeFile(qoiCodecAssetOutputPath, generateQoiCodecAssets()),
  writeFile(jxlCodecAssetOutputPath, generateJxlCodecAssets()),
  writeFile(mozjpegCodecAssetOutputPath, generateMozjpegCodecAssets()),
  writeFile(oxipngCodecAssetOutputPath, generateOxipngCodecAssets()),
  writeFile(imagequantCodecAssetOutputPath, generateImagequantCodecAssets()),
  writeFile(resizeCodecAssetOutputPath, generateResizeCodecAssets()),
  writeFile(rotateCodecAssetOutputPath, generateRotateCodecAssets()),
  writeFile(codecAssetManifestOutputPath, generateCodecAssetManifest()),
  writeFile(codecAssetPrecacheOutputPath, generateCodecAssetPrecacheManifest()),
  writeFile(
    patchedWebpEncoderOutputPath,
    await patchEmscriptenWrapperFallbackUrl({
      sourcePath: join(repoRoot, 'codecs', 'webp', 'enc', 'webp_enc.js'),
      assetName: 'webp_enc.wasm',
      codecName: 'WebP',
    }),
  ),
  writeFile(
    patchedWebpEncoderShimOutputPath,
    generatePatchedWebpWrapperShim({
      typeImportPath: '../../../../../../../codecs/webp/enc/webp_enc',
    }),
  ),
  writeFile(
    patchedWebpEncoderSimdOutputPath,
    await patchEmscriptenWrapperFallbackUrl({
      sourcePath: join(repoRoot, 'codecs', 'webp', 'enc', 'webp_enc_simd.js'),
      assetName: 'webp_enc_simd.wasm',
      codecName: 'WebP',
    }),
  ),
  writeFile(
    patchedWebpEncoderSimdShimOutputPath,
    generatePatchedWebpWrapperShim({
      typeImportPath: '../../../../../../../codecs/webp/enc/webp_enc',
    }),
  ),
  writeFile(
    patchedWebpDecoderOutputPath,
    await patchEmscriptenWrapperFallbackUrl({
      sourcePath: join(repoRoot, 'codecs', 'webp', 'dec', 'webp_dec.js'),
      assetName: 'webp_dec.wasm',
      codecName: 'WebP',
    }),
  ),
  writeFile(
    patchedWebpDecoderShimOutputPath,
    generatePatchedWebpWrapperShim({
      typeImportPath: '../../../../../../../codecs/webp/dec/webp_dec',
    }),
  ),
  writeFile(
    patchedWp2EncoderOutputPath,
    await patchEmscriptenWrapperFallbackUrl({
      sourcePath: join(repoRoot, 'codecs', 'wp2', 'enc', 'wp2_enc.js'),
      assetName: 'wp2_enc.wasm',
      codecName: 'WebP 2',
    }),
  ),
  writeFile(
    patchedWp2EncoderShimOutputPath,
    generatePatchedWp2EncoderWrapperShim(),
  ),
  writeFile(
    patchedWp2DecoderOutputPath,
    await patchEmscriptenWrapperFallbackUrl({
      sourcePath: join(repoRoot, 'codecs', 'wp2', 'dec', 'wp2_dec.js'),
      assetName: 'wp2_dec.wasm',
      codecName: 'WebP 2',
    }),
  ),
  writeFile(
    patchedWp2DecoderShimOutputPath,
    generatePatchedWp2DecoderWrapperShim(),
  ),
  writeFile(
    patchedAvifEncoderOutputPath,
    await patchEmscriptenWrapperFallbackUrl({
      sourcePath: join(repoRoot, 'codecs', 'avif', 'enc', 'avif_enc.js'),
      assetName: 'avif_enc.wasm',
      codecName: 'AVIF',
    }),
  ),
  writeFile(
    patchedAvifEncoderShimOutputPath,
    generatePatchedAvifEncoderWrapperShim(),
  ),
  writeFile(
    patchedAvifDecoderOutputPath,
    await patchEmscriptenWrapperFallbackUrl({
      sourcePath: join(repoRoot, 'codecs', 'avif', 'dec', 'avif_dec.js'),
      assetName: 'avif_dec.wasm',
      codecName: 'AVIF',
    }),
  ),
  writeFile(
    patchedAvifDecoderShimOutputPath,
    generatePatchedAvifDecoderWrapperShim(),
  ),
  writeFile(
    patchedJxlEncoderOutputPath,
    await patchEmscriptenWrapperFallbackUrl({
      sourcePath: join(repoRoot, 'codecs', 'jxl', 'enc', 'jxl_enc.js'),
      assetName: 'jxl_enc.wasm',
      codecName: 'JPEG XL',
    }),
  ),
  writeFile(
    patchedJxlEncoderShimOutputPath,
    generatePatchedJxlEncoderWrapperShim(),
  ),
  writeFile(
    patchedJxlDecoderOutputPath,
    await patchEmscriptenWrapperFallbackUrl({
      sourcePath: join(repoRoot, 'codecs', 'jxl', 'dec', 'jxl_dec.js'),
      assetName: 'jxl_dec.wasm',
      codecName: 'JPEG XL',
    }),
  ),
  writeFile(
    patchedJxlDecoderShimOutputPath,
    generatePatchedJxlDecoderWrapperShim(),
  ),
  writeFile(
    patchedQoiEncoderOutputPath,
    await patchEmscriptenWrapperFallbackUrl({
      sourcePath: join(repoRoot, 'codecs', 'qoi', 'enc', 'qoi_enc.js'),
      assetName: 'qoi_enc.wasm',
      codecName: 'QOI',
    }),
  ),
  writeFile(
    patchedQoiEncoderShimOutputPath,
    generatePatchedQoiEncoderWrapperShim(),
  ),
  writeFile(
    patchedQoiDecoderOutputPath,
    await patchEmscriptenWrapperFallbackUrl({
      sourcePath: join(repoRoot, 'codecs', 'qoi', 'dec', 'qoi_dec.js'),
      assetName: 'qoi_dec.wasm',
      codecName: 'QOI',
    }),
  ),
  writeFile(
    patchedQoiDecoderShimOutputPath,
    generatePatchedQoiDecoderWrapperShim(),
  ),
  writeFile(
    patchedMozjpegEncoderOutputPath,
    await patchEmscriptenWrapperFallbackUrl({
      sourcePath: join(repoRoot, 'codecs', 'mozjpeg', 'enc', 'mozjpeg_enc.js'),
      assetName: 'mozjpeg_enc.wasm',
      codecName: 'MozJPEG',
    }),
  ),
  writeFile(
    patchedMozjpegEncoderShimOutputPath,
    generatePatchedMozjpegEncoderWrapperShim(),
  ),
  writeFile(
    patchedImagequantOutputPath,
    await patchEmscriptenWrapperFallbackUrl({
      sourcePath: join(repoRoot, 'codecs', 'imagequant', 'imagequant.js'),
      assetName: 'imagequant.wasm',
      codecName: 'ImageQuant',
    }),
  ),
  writeFile(
    patchedImagequantShimOutputPath,
    generatePatchedImagequantWrapperShim(),
  ),
  writeFile(
    patchedResizeOutputPath,
    await patchWasmBindgenWrapperFallbackUrl({
      sourcePath: join(
        repoRoot,
        'codecs',
        'resize',
        'pkg',
        'squoosh_resize.js',
      ),
      assetName: 'squoosh_resize_bg.wasm',
    }),
  ),
  writeFile(
    patchedResizeShimOutputPath,
    await generatePatchedWasmBindgenWrapperShim({
      sourcePath: join(
        repoRoot,
        'codecs',
        'resize',
        'pkg',
        'squoosh_resize.d.ts',
      ),
    }),
  ),
  writeFile(
    patchedHqxOutputPath,
    await patchWasmBindgenWrapperFallbackUrl({
      sourcePath: join(repoRoot, 'codecs', 'hqx', 'pkg', 'squooshhqx.js'),
      assetName: 'squooshhqx_bg.wasm',
    }),
  ),
  writeFile(
    patchedHqxShimOutputPath,
    await generatePatchedWasmBindgenWrapperShim({
      sourcePath: join(repoRoot, 'codecs', 'hqx', 'pkg', 'squooshhqx.d.ts'),
    }),
  ),
  writeFile(
    patchedOxipngOutputPath,
    await patchWasmBindgenWrapperFallbackUrl({
      sourcePath: join(
        repoRoot,
        'codecs',
        'oxipng',
        'pkg',
        'squoosh_oxipng.js',
      ),
      assetName: 'squoosh_oxipng_bg.wasm',
    }),
  ),
  writeFile(
    patchedOxipngShimOutputPath,
    await generatePatchedWasmBindgenWrapperShim({
      sourcePath: join(
        repoRoot,
        'codecs',
        'oxipng',
        'pkg',
        'squoosh_oxipng.d.ts',
      ),
    }),
  ),
  writeFile(serviceWorkerCachePlanOutputPath, generateServiceWorkerCachePlan()),
]);
