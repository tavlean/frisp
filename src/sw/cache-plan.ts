export interface ServiceWorkerCacheEntry {
  main: string;
  deps: readonly string[];
}

export interface InitialCacheEntries {
  initialApp: ServiceWorkerCacheEntry;
  compress: ServiceWorkerCacheEntry;
  swBridge: ServiceWorkerCacheEntry;
  blobAnim: ServiceWorkerCacheEntry;
  featuresWorker: ServiceWorkerCacheEntry;
  serviceWorkerUrl: string;
}

export interface ProcessorSupport {
  threads: boolean;
  simd: boolean;
  webp: boolean;
  avif: boolean;
}

export interface ProcessorCacheEntries {
  featuresWorker: ServiceWorkerCacheEntry;
  avifDec: ServiceWorkerCacheEntry;
  webpDec: ServiceWorkerCacheEntry;
  avifEncMt: ServiceWorkerCacheEntry;
  avifEnc: ServiceWorkerCacheEntry;
  jxlEncMtSimd: ServiceWorkerCacheEntry;
  jxlEncMt: ServiceWorkerCacheEntry;
  jxlEnc: ServiceWorkerCacheEntry;
  oxiMt: ServiceWorkerCacheEntry;
  oxi: ServiceWorkerCacheEntry;
  webpEncSimd: ServiceWorkerCacheEntry;
  webpEnc: ServiceWorkerCacheEntry;
  wp2EncMtSimd: ServiceWorkerCacheEntry;
  wp2EncMt: ServiceWorkerCacheEntry;
  wp2Enc: ServiceWorkerCacheEntry;
}

export type ActiveProcessorCacheEntries = Omit<
  ProcessorCacheEntries,
  'wp2EncMtSimd' | 'wp2EncMt' | 'wp2Enc'
>;

function subtractSets<T>(set1: Set<T>, set2: Set<T>): Set<T> {
  const result = new Set(set1);
  for (const item of set2) result.delete(item);
  return result;
}

export function dedupeUrls(urls: readonly string[]): string[] {
  return [...new Set(urls)];
}

export function collectEntryUrls(
  entries: readonly ServiceWorkerCacheEntry[],
): string[] {
  return dedupeUrls(entries.flatMap((entry) => [entry.main, ...entry.deps]));
}

export function shouldCacheDynamically(url: string): boolean {
  return url.startsWith('/c/demo-');
}

export function buildInitialCacheUrls(entries: InitialCacheEntries): string[] {
  const initialJs = new Set(
    collectEntryUrls([entries.compress, entries.swBridge, entries.blobAnim]),
  );
  const excludedUrls = new Set([
    entries.initialApp.main,
    ...entries.initialApp.deps.filter(
      (item) =>
        // Exclude JS deps that have been inlined:
        item.endsWith('.js') ||
        // As well as large image deps we want to keep dynamic:
        shouldCacheDynamically(item),
    ),
    // Exclude features Worker itself - it's referenced from the main app,
    // but is meant to be cached lazily.
    entries.featuresWorker.main,
    // Also exclude Service Worker itself.
    entries.serviceWorkerUrl,
  ]);

  return ['/', ...subtractSets(initialJs, excludedUrls)];
}

export function buildAdditionalProcessorCacheUrls(
  support: ProcessorSupport,
  entries: ProcessorCacheEntries,
): string[] {
  const items = buildActiveAdditionalProcessorCacheUrls(support, entries);

  function addWithDeps(entry: ServiceWorkerCacheEntry): void {
    items.push(entry.main, ...entry.deps);
  }

  // WP2 remains available to the current production app, but it is excluded
  // from the active migration surface.
  if (support.threads && support.simd) {
    addWithDeps(entries.wp2EncMtSimd);
  } else if (support.threads) {
    addWithDeps(entries.wp2EncMt);
  } else {
    addWithDeps(entries.wp2Enc);
  }

  return dedupeUrls(items);
}

export function buildActiveAdditionalProcessorCacheUrls(
  support: ProcessorSupport,
  entries: ActiveProcessorCacheEntries,
): string[] {
  const items: string[] = [];

  function addWithDeps(entry: ServiceWorkerCacheEntry): void {
    items.push(entry.main, ...entry.deps);
  }

  addWithDeps(entries.featuresWorker);

  if (!support.avif) addWithDeps(entries.avifDec);
  if (!support.webp) addWithDeps(entries.webpDec);

  // AVIF
  if (support.threads) {
    addWithDeps(entries.avifEncMt);
  } else {
    addWithDeps(entries.avifEnc);
  }

  // JXL
  if (support.threads && support.simd) {
    addWithDeps(entries.jxlEncMtSimd);
  } else if (support.threads) {
    addWithDeps(entries.jxlEncMt);
  } else {
    addWithDeps(entries.jxlEnc);
  }

  // OXI
  if (support.threads) {
    addWithDeps(entries.oxiMt);
  } else {
    addWithDeps(entries.oxi);
  }

  // WebP
  if (support.simd) {
    addWithDeps(entries.webpEncSimd);
  } else {
    addWithDeps(entries.webpEnc);
  }

  return dedupeUrls(items);
}
