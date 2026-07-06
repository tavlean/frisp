import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = appRoot;
const appGeneratedDir = join(appRoot, '.svelte-kit', 'app-generated');

const patchedWebpEncoderWrapperOutputDir = join(
  appGeneratedDir,
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
  appGeneratedDir,
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
  appGeneratedDir,
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
  appGeneratedDir,
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
const patchedAvifDecoderWrapperOutputDir = join(
  appGeneratedDir,
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
  appGeneratedDir,
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
  appGeneratedDir,
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
  appGeneratedDir,
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
  appGeneratedDir,
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
  appGeneratedDir,
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
  appGeneratedDir,
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
  appGeneratedDir,
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
  appGeneratedDir,
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
const patchedOxipngMtWrapperOutputDir = join(
  appGeneratedDir,
  'codecs',
  'oxipng',
  'pkg-parallel',
);
const patchedOxipngMtOutputPath = join(
  patchedOxipngMtWrapperOutputDir,
  'squoosh_oxipng.js',
);
const patchedOxipngMtShimOutputPath = join(
  patchedOxipngMtWrapperOutputDir,
  'squoosh_oxipng.d.ts',
);
const oxipngMtSnippetsSourceDir = join(
  repoRoot,
  'codecs',
  'oxipng',
  'pkg-parallel',
  'snippets',
);
const oxipngMtSnippetsOutputDir = join(
  patchedOxipngMtWrapperOutputDir,
  'snippets',
);

async function patchEmscriptenWrapperFallbackUrl({
  sourcePath,
  assetName,
  codecName,
}) {
  const source = await readFile(sourcePath, 'utf8');
  // Emscripten resolves its .wasm via `new URL("<asset>.wasm", import.meta.url)`.
  // The suffix varies by toolchain (`.toString()` on emsdk 2.0.x, `.href` on
  // newer releases, or bare). Replace that whole expression with the bare asset
  // name so Vite does not statically emit a duplicate worker-local copy — the
  // real URL is injected at runtime via Module.locateFile (see locateCodecWasm).
  // Toolchain-agnostic so codecs can be rebuilt with a current Emscripten.
  const escaped = assetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fallbackUrlExpression = new RegExp(
    `new URL\\("${escaped}",\\s*import\\.meta\\.url\\)(?:\\.href|\\.toString\\(\\))?`,
    'g',
  );

  if (!fallbackUrlExpression.test(source)) {
    throw new Error(
      `Expected ${codecName} wrapper fallback URL pattern for ${assetName}.`,
    );
  }

  return [
    '// This file is autogenerated by scripts/sync-sveltekit-app.mjs',
    '// It patches the Emscripten fallback WASM URL so Vite does not emit a worker-local duplicate.',
    source.replace(fallbackUrlExpression, `"${assetName}"`),
  ].join('\n');
}

async function patchWasmBindgenWrapperFallbackUrl({ sourcePath, assetName }) {
  const source = await readFile(sourcePath, 'utf8');
  // wasm-bindgen resolves its .wasm via `<var> = new URL('<asset>', import.meta.url);`
  // where <var> was `input` on older wasm-bindgen and `module_or_path` on newer
  // releases (>= ~0.2.9x). Match the `new URL(...)` expression itself
  // (variable-name-agnostic) and replace it with the bare asset name so Vite does
  // not statically emit a worker-local duplicate — the real URL is injected at
  // runtime. Toolchain-agnostic so Rust codecs can be rebuilt with current wasm-pack.
  const escaped = assetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fallbackUrlExpression = new RegExp(
    `new URL\\('${escaped}',\\s*import\\.meta\\.url\\)`,
    'g',
  );

  if (!fallbackUrlExpression.test(source)) {
    throw new Error(
      `Expected wasm-bindgen wrapper fallback URL pattern for ${assetName}.`,
    );
  }

  return [
    '// This file is autogenerated by scripts/sync-sveltekit-app.mjs',
    '// It patches the wasm-bindgen fallback WASM URL so Vite does not emit a worker-local duplicate.',
    source.replace(fallbackUrlExpression, `'${assetName}'`),
  ].join('\n');
}

function generatePatchedWebpWrapperShim({ typeImportPath }) {
  return [
    '// This file is autogenerated by scripts/sync-sveltekit-app.mjs',
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

function generatePatchedAvifEncoderWrapperShim() {
  return [
    '// This file is autogenerated by scripts/sync-sveltekit-app.mjs',
    '// It describes the patched local wrapper while preserving the original codec types.',
    '',
    "import type { AVIFModule } from 'codecs/avif/enc/avif_enc';",
    '',
    'declare const moduleFactory: EmscriptenWasm.ModuleFactory<AVIFModule>;',
    "export type { AVIFModule, EncodeOptions } from 'codecs/avif/enc/avif_enc';",
    'export default moduleFactory;',
    '',
  ].join('\n');
}

function generatePatchedAvifDecoderWrapperShim() {
  return [
    '// This file is autogenerated by scripts/sync-sveltekit-app.mjs',
    '// It describes the patched local wrapper while preserving the original codec types.',
    '',
    "import type { AVIFModule } from 'codecs/avif/dec/avif_dec';",
    '',
    'declare const moduleFactory: EmscriptenWasm.ModuleFactory<AVIFModule>;',
    "export type { AVIFModule } from 'codecs/avif/dec/avif_dec';",
    'export default moduleFactory;',
    '',
  ].join('\n');
}

function generatePatchedJxlEncoderWrapperShim() {
  return [
    '// This file is autogenerated by scripts/sync-sveltekit-app.mjs',
    '// It describes the patched local wrapper while preserving the original codec types.',
    '',
    "import type { JXLModule } from 'codecs/jxl/enc/jxl_enc';",
    '',
    'declare const moduleFactory: EmscriptenWasm.ModuleFactory<JXLModule>;',
    "export type { EncodeOptions, JXLModule } from 'codecs/jxl/enc/jxl_enc';",
    'export default moduleFactory;',
    '',
  ].join('\n');
}

function generatePatchedJxlDecoderWrapperShim() {
  return [
    '// This file is autogenerated by scripts/sync-sveltekit-app.mjs',
    '// It describes the patched local wrapper while preserving the original codec types.',
    '',
    "import type { JXLModule } from 'codecs/jxl/dec/jxl_dec';",
    '',
    'declare const moduleFactory: EmscriptenWasm.ModuleFactory<JXLModule>;',
    "export type { JXLModule } from 'codecs/jxl/dec/jxl_dec';",
    'export default moduleFactory;',
    '',
  ].join('\n');
}

function generatePatchedQoiEncoderWrapperShim() {
  return [
    '// This file is autogenerated by scripts/sync-sveltekit-app.mjs',
    '// It describes the patched local wrapper while preserving the original codec types.',
    '',
    "import type { QoiModule } from 'codecs/qoi/enc/qoi_enc';",
    '',
    'declare const moduleFactory: EmscriptenWasm.ModuleFactory<QoiModule>;',
    "export type { EncodeOptions, QoiModule } from 'codecs/qoi/enc/qoi_enc';",
    'export default moduleFactory;',
    '',
  ].join('\n');
}

function generatePatchedQoiDecoderWrapperShim() {
  return [
    '// This file is autogenerated by scripts/sync-sveltekit-app.mjs',
    '// It describes the patched local wrapper while preserving the original codec types.',
    '',
    "import type { QOIModule } from 'codecs/qoi/dec/qoi_dec';",
    '',
    'declare const moduleFactory: EmscriptenWasm.ModuleFactory<QOIModule>;',
    "export type { QOIModule } from 'codecs/qoi/dec/qoi_dec';",
    'export default moduleFactory;',
    '',
  ].join('\n');
}

function generatePatchedMozjpegEncoderWrapperShim() {
  return [
    '// This file is autogenerated by scripts/sync-sveltekit-app.mjs',
    '// It describes the patched local wrapper while preserving the original codec types.',
    '',
    "import type { MozJPEGModule } from 'codecs/mozjpeg/enc/mozjpeg_enc';",
    '',
    'declare const moduleFactory: EmscriptenWasm.ModuleFactory<MozJPEGModule>;',
    "export type { EncodeOptions, MozJPEGModule } from 'codecs/mozjpeg/enc/mozjpeg_enc';",
    'export default moduleFactory;',
    '',
  ].join('\n');
}

function generatePatchedImagequantWrapperShim() {
  return [
    '// This file is autogenerated by scripts/sync-sveltekit-app.mjs',
    '// It describes the patched local wrapper while preserving the original codec types.',
    '',
    "import type { QuantizerModule } from 'codecs/imagequant/imagequant';",
    '',
    'declare const moduleFactory: EmscriptenWasm.ModuleFactory<QuantizerModule>;',
    "export type { QuantizerModule } from 'codecs/imagequant/imagequant';",
    'export default moduleFactory;',
    '',
  ].join('\n');
}

async function generatePatchedWasmBindgenWrapperShim({ sourcePath }) {
  return [
    '// This file is autogenerated by scripts/sync-sveltekit-app.mjs',
    '// It describes the patched local wasm-bindgen wrapper while preserving the original types.',
    await readFile(sourcePath, 'utf8'),
  ].join('\n');
}

await Promise.all([
  rm(join(appGeneratedDir, 'feature-meta'), { recursive: true, force: true }),
  rm(join(appGeneratedDir, 'features-worker'), {
    recursive: true,
    force: true,
  }),
  rm(join(appGeneratedDir, 'worker-bridge'), { recursive: true, force: true }),
  rm(join(appGeneratedDir, 'worker-surface'), { recursive: true, force: true }),
  rm(join(appGeneratedDir, 'codec-assets'), { recursive: true, force: true }),
  rm(join(appGeneratedDir, 'service-worker'), { recursive: true, force: true }),
  mkdir(patchedWebpEncoderWrapperOutputDir, { recursive: true }),
  mkdir(patchedAvifEncoderWrapperOutputDir, { recursive: true }),
  mkdir(patchedJxlEncoderWrapperOutputDir, { recursive: true }),
  mkdir(patchedWebpDecoderWrapperOutputDir, { recursive: true }),
  mkdir(patchedAvifDecoderWrapperOutputDir, { recursive: true }),
  mkdir(patchedJxlDecoderWrapperOutputDir, { recursive: true }),
  mkdir(patchedQoiEncoderWrapperOutputDir, { recursive: true }),
  mkdir(patchedQoiDecoderWrapperOutputDir, { recursive: true }),
  mkdir(patchedMozjpegEncoderWrapperOutputDir, { recursive: true }),
  mkdir(patchedImagequantWrapperOutputDir, { recursive: true }),
  mkdir(patchedResizeWrapperOutputDir, { recursive: true }),
  mkdir(patchedHqxWrapperOutputDir, { recursive: true }),
  mkdir(patchedOxipngWrapperOutputDir, { recursive: true }),
  mkdir(patchedOxipngMtWrapperOutputDir, { recursive: true }),
]);

await Promise.all([
  rm(stalePatchedWebpEncoderTsOutputPath, { force: true }),
  rm(stalePatchedWebpEncoderSimdTsOutputPath, { force: true }),
  rm(stalePatchedWebpDecoderTsOutputPath, { force: true }),
  rm(stalePatchedQoiEncoderTsOutputPath, { force: true }),
  rm(stalePatchedQoiDecoderTsOutputPath, { force: true }),
  rm(stalePatchedMozjpegEncoderTsOutputPath, { force: true }),
  rm(stalePatchedImagequantTsOutputPath, { force: true }),
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
      typeImportPath: 'codecs/webp/enc/webp_enc',
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
      typeImportPath: 'codecs/webp/enc/webp_enc',
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
      typeImportPath: 'codecs/webp/dec/webp_dec',
    }),
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
  writeFile(
    patchedOxipngMtOutputPath,
    await patchWasmBindgenWrapperFallbackUrl({
      sourcePath: join(
        repoRoot,
        'codecs',
        'oxipng',
        'pkg-parallel',
        'squoosh_oxipng.js',
      ),
      assetName: 'squoosh_oxipng_bg.wasm',
    }),
  ),
  writeFile(
    patchedOxipngMtShimOutputPath,
    await generatePatchedWasmBindgenWrapperShim({
      sourcePath: join(
        repoRoot,
        'codecs',
        'oxipng',
        'pkg-parallel',
        'squoosh_oxipng.d.ts',
      ),
    }),
  ),
  cp(oxipngMtSnippetsSourceDir, oxipngMtSnippetsOutputDir, { recursive: true }),
  cp(
    join(repoRoot, 'codecs', 'oxipng', 'pkg-parallel', 'package.json'),
    join(patchedOxipngMtWrapperOutputDir, 'package.json'),
  ),
]);
