/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, prerendered, version } from '$service-worker';
import { serviceWorkerCodecAssetUrls } from '$lib/service-worker-codec-assets';

const worker = self as unknown as ServiceWorkerGlobalScope;
const cacheName = `sqush-sveltekit-prototype-${version}`;
const assets = Array.from(
  new Set([...build, ...files, ...prerendered, ...serviceWorkerCodecAssetUrls]),
);
const assetUrls = assets.map((asset) => new URL(asset, worker.location.origin));
const assetPathnames = new Set(assetUrls.map((url) => url.pathname));

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
    caches
      .open(cacheName)
      .then((cache) => cache.addAll(assetUrls.map((url) => url.toString()))),
  );
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

  event.respondWith(
    (async () => {
      const url = new URL(event.request.url);
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
