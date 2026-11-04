import type { CodecAssetRecord } from '../shared/codec-assets';

/**
 * What this browser's codec runtime will actually use. Detected by the
 * service worker at install time; drives which mutually-exclusive codec
 * variants are worth precaching.
 */
export interface CodecPrecacheSupport {
  /** WASM threads (SharedArrayBuffer + atomics) are usable. */
  threads: boolean;
  /** WASM SIMD is usable. */
  simd: boolean;
  /** The browser decodes AVIF natively, so the WASM decoder is never used. */
  avifDecode: boolean;
  /** The browser decodes WebP natively, so the WASM decoder is never used. */
  webpDecode: boolean;
}

export function dedupeUrls(urls: readonly string[]): string[] {
  return [...new Set(urls)];
}

/**
 * Picks the codec assets this browser will actually run, mirroring the
 * runtime's own variant selection (worker-bridge + Emscripten/rayon glue):
 *
 * - encoders with threaded builds (AVIF, JXL, OxiPNG) use the `_mt` variant
 *   (+ its glue script) when threads are supported, else single-thread;
 * - JXL additionally prefers the SIMD threaded build when SIMD is supported;
 * - WebP encodes through the SIMD build when supported, else baseline;
 * - the AVIF/WebP WASM decoders are fallbacks for browsers without native
 *   decode support — natively-supported browsers never fetch them;
 * - the JXL/QOI decoders, the jpegli encoder, the processors, and the
 *   SSIMULACRA2 metric (auto-quality's scorer, so it must work offline) each
 *   have a single variant used everywhere.
 *
 * The QOI and MozJPEG ENCODERS are deliberately NOT precached: neither is a
 * user-selectable output (QOI left the picker 2026-06-27, MozJPEG 2026-11-04
 * when jpegli became the one JPEG), so only the dev-only diagnostics probe
 * ever runs QOI encode. The QOI DECODER stays (it decodes `.qoi` inputs
 * offline).
 *
 * Assets left out stay reachable: the service worker runtime-caches any known
 * asset on first fetch, so a mis-detection (or the excluded QOI encoder, if the
 * probe ever runs) only costs a network trip while online — it never breaks the
 * codec.
 */
export function selectCodecPrecacheUrls(
  records: readonly CodecAssetRecord[],
  support: CodecPrecacheSupport,
): string[] {
  const wanted = new Set<string>([
    'qoi:decoder:default',
    'jxl:decoder:default',
    'jpegli:encoder:default',
    'imagequant:processor:default',
    'resize:processor:default',
    'hqx:processor:hqx',
    'ssimulacra2:metric:default',
  ]);

  if (!support.avifDecode) wanted.add('avif:decoder:default');
  if (!support.webpDecode) wanted.add('webp:decoder:default');

  // AVIF. The tiny `*_mt.worker.js` pthread stubs are not variant-selected:
  // they ride along with the always-precached app shell (see the generated
  // service-worker codec-asset records).
  if (support.threads) {
    wanted.add('avif:encoder:multi-thread');
    wanted.add('avif:encoder:multi-thread-script');
  } else {
    wanted.add('avif:encoder:single-thread');
  }

  // JXL
  if (support.threads && support.simd) {
    wanted.add('jxl:encoder:multi-thread-simd');
    wanted.add('jxl:encoder:multi-thread-simd-script');
  } else if (support.threads) {
    wanted.add('jxl:encoder:multi-thread');
    wanted.add('jxl:encoder:multi-thread-script');
  } else {
    wanted.add('jxl:encoder:single-thread');
  }

  // OxiPNG (the rayon worker helpers ship in the app build's workers dir,
  // which is precached as part of the app shell).
  if (support.threads) {
    wanted.add('oxipng:encoder:multi-thread');
  } else {
    wanted.add('oxipng:encoder:single-thread');
  }

  // WebP
  if (support.simd) {
    wanted.add('webp:encoder:simd');
  } else {
    wanted.add('webp:encoder:baseline');
  }

  return dedupeUrls(
    records
      .filter((record) => wanted.has(record.logicalKey))
      .map((record) => record.url),
  );
}
