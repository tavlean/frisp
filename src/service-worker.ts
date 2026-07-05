/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, prerendered, version } from '$service-worker';
import { simd, threads } from 'wasm-feature-detect';
import { serviceWorkerCodecAssetRecords } from '$lib/service-worker-codec-assets';
import {
  dedupeUrls,
  selectCodecPrecacheUrls,
  type CodecPrecacheSupport,
} from 'sw/cache-plan';

const worker = self as unknown as ServiceWorkerGlobalScope;
const cacheName = `app-${version}`;

const codecAssetUrls = dedupeUrls(
  serviceWorkerCodecAssetRecords.map((record) => record.url),
);
const codecAssetUrlSet = new Set(codecAssetUrls);

// Diagnostics-only probe workers: runtime-cacheable on use, not worth
// shipping to every visitor up front.
const isProbeWorkerUrl = (url: string) => /probe\.worker[^/]*\.js$/.test(url);

// The app shell: everything needed to boot offline, minus the
// variant-selected codec assets (`build` lists every emitted file, including
// all mutually-exclusive codec variants). Tiny codec files not in the records
// (rotate WASM, pthread worker stubs) deliberately stay in the shell.
const appShellUrls = [
  ...build.filter(
    (url) => !codecAssetUrlSet.has(url) && !isProbeWorkerUrl(url),
  ),
  ...files,
  ...prerendered,
];

// Every URL the app may legitimately fetch — served cache-first and
// runtime-cached on miss, so non-precached codec variants still end up
// cached after first use.
const assets = dedupeUrls([
  ...build,
  ...files,
  ...prerendered,
  ...codecAssetUrls,
]);
const assetPathnames = new Set(
  assets.map((asset) => new URL(asset, worker.location.origin).pathname),
);

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// 1×1 feature-test images (same bytes as src/sw/tiny.avif and the canonical
// lossy-WebP probe). If the browser's native decoder handles them, the
// corresponding WASM decoder is never used and need not be precached.
const TINY_AVIF =
  'AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUEAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAABUAAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgS0AAAAAABNjb2xybmNseAACAAIAAoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAAB1tZGF0EgAKBDgADskyCx/wAABYAAAAAK+w';
const TINY_WEBP =
  'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';

async function canNativelyDecode(
  base64: string,
  type: string,
): Promise<boolean> {
  if (!('createImageBitmap' in worker)) return false;
  try {
    const bitmap = await createImageBitmap(
      new Blob([base64ToBytes(base64).buffer as ArrayBuffer], { type }),
    );
    bitmap.close();
    return true;
  } catch {
    return false;
  }
}

// Detection runs in the service-worker scope, which matches the page's
// engine. One known approximation: nested-worker support (the Safari 16 gap)
// can't be probed from here, so a threads-capable browser without nested
// workers precaches the `_mt` builds it won't use — the single-thread
// fallback still loads on demand and is runtime-cached on first use.
async function detectCodecSupport(): Promise<CodecPrecacheSupport> {
  const detect = (probe: () => Promise<boolean>) => probe().catch(() => false);
  const [threadsSupport, simdSupport, avifDecode, webpDecode] =
    await Promise.all([
      detect(threads),
      detect(simd),
      detect(() => canNativelyDecode(TINY_AVIF, 'image/avif')),
      detect(() => canNativelyDecode(TINY_WEBP, 'image/webp')),
    ]);
  return {
    threads: threadsSupport,
    simd: simdSupport,
    avifDecode,
    webpDecode,
  };
}

async function fetchAndCache(request: Request): Promise<Response> {
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
}

worker.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const support = await detectCodecSupport();
      const precacheUrls = dedupeUrls([
        ...appShellUrls,
        ...selectCodecPrecacheUrls(serviceWorkerCodecAssetRecords, support),
      ]).map((url) => new URL(url, worker.location.origin).toString());
      const cache = await caches.open(cacheName);
      await cache.addAll(precacheUrls);
    })(),
  );
});

// A new build installs into the waiting state (an active controller blocks
// auto-activation) and stays there until the page's "new version available"
// prompt asks it to take over. skipWaiting() promotes this build past waiting;
// activate's clients.claim() then swaps the controller, which the page observes
// via controllerchange and reloads onto the new build.
worker.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') {
    worker.skipWaiting();
  }
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== cacheName)
          .map((key) => caches.delete(key)),
      );
      await worker.clients.claim();
    })(),
  );
});

worker.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Let the browser handle cross-origin GETs natively: never respondWith them,
  // so they can't be runtime-cached and a foreign URL with a colliding pathname
  // can't be served from the app cache (assetPathnames keys on pathname alone).
  const url = new URL(event.request.url);
  if (url.origin !== worker.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(cacheName);

      if (assetPathnames.has(url.pathname)) {
        const cached =
          (await cache.match(event.request)) ??
          (await cache.match(url.pathname)) ??
          (await cache.match(url.href));
        if (cached) return cached;
        return fetchAndCache(event.request);
      }

      try {
        return await fetchAndCache(event.request);
      } catch (error) {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        throw error;
      }
    })(),
  );
});
