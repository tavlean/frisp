// Type-checked by its own project (tsconfig.service-worker.json) so it gets
// WebWorker types instead of the app's DOM ones.

import { version } from '$app/env';
import {
  assets as staticAssets,
  immutable,
  prerendered as pages,
} from '$app/manifest';
import { asset, resolve } from '$app/paths';
import { self as worker } from '$app/service-worker';
import { simd, threads } from 'wasm-feature-detect';
import { serviceWorkerCodecAssetRecords } from '$lib/service-worker-codec-assets';
import {
  dedupeUrls,
  selectCodecPrecacheUrls,
  type CodecPrecacheSupport,
} from 'sw/cache-plan';

const cacheName = `app-${version}`;

// `$app/manifest` paths are base-relative; turn them into the root-relative
// URLs the rest of this file matches against. `resolve('/')` is the base path
// plus a trailing slash; it only accepts typed app paths, and the Vite output
// paths in `immutable` are plain strings.
const basePrefix = resolve('/');
const build = immutable.map(({ path }) => basePrefix + path);
// `static/_headers` is a host-side config file (Cloudflare reads it to set the
// COOP/COEP cross-origin-isolation headers), not a fetchable asset, so it must
// stay out of the precache or `cache.addAll` rejects on its 404. SvelteKit 3
// dropped the `serviceWorker.files` config filter that used to do this.
const isHostOnlyFile = (path: string) =>
  path === '_headers' || path.endsWith('.DS_Store');
const files = staticAssets
  .filter(({ path }) => !isHostOnlyFile(path))
  .map(({ path }) => asset(path));
const prerendered = pages.map(({ path }) => resolve(path));

const codecAssetUrls = dedupeUrls(
  serviceWorkerCodecAssetRecords.map((record) => record.url),
);
const codecAssetUrlSet = new Set(codecAssetUrls);

// Diagnostics-only probe workers: runtime-cacheable on use, not worth
// shipping to every visitor up front.
const isProbeWorkerUrl = (url: string) => /probe\.worker[^/]*\.js$/.test(url);

// Files that exist only for crawlers. The app never requests them, and the
// social card alone is ~42 kB, so precaching them would put dead weight in every
// visitor's install for the benefit of robots that bypass the service worker
// entirely. Excluded from the shell only; they stay in `assets` so a direct hit
// still resolves.
const CRAWLER_FILES = ['/robots.txt', '/sitemap.xml', '/social-card.png'];
const isCrawlerFileUrl = (url: string) =>
  CRAWLER_FILES.some((name) => url.endsWith(name));

// Manifest install icons are in the same category: the browser fetches them
// only when the user installs the app, the app itself never does. The
// manifest stays in the shell; it is a few hundred bytes and is what keeps
// the installed app's identity resolvable offline.
const INSTALL_ICON_FILES = ['/icon-192.png', '/icon-512.png'];
const isInstallIconUrl = (url: string) =>
  INSTALL_ICON_FILES.some((name) => url.endsWith(name));

// The app shell: everything needed to boot offline, minus the
// variant-selected codec assets (`build` lists every emitted file, including
// all mutually-exclusive codec variants). Tiny codec files not in the records
// (rotate WASM, pthread worker stubs) deliberately stay in the shell. The
// worker chunks are not in `build` at all; see emittedWorkerUrls below.
const appShellUrls = [
  ...build.filter(
    (url) => !codecAssetUrlSet.has(url) && !isProbeWorkerUrl(url),
  ),
  ...files.filter((url) => !isCrawlerFileUrl(url) && !isInstallIconUrl(url)),
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

// The worker chunks `build` leaves out, listed at build time by the
// app-worker-precache-manifest plugin in vite.config.ts. Without them the
// codec WASM is cached but no worker can load it offline. A missing list (a
// dev or partial build) degrades to runtime caching, never a failed install.
async function emittedWorkerUrls(): Promise<string[]> {
  try {
    const response = await fetch('/_app/worker-precache.json', {
      cache: 'no-cache',
    });
    return response.ok ? ((await response.json()) as string[]) : [];
  } catch {
    return [];
  }
}

worker.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const [support, workerUrls] = await Promise.all([
        detectCodecSupport(),
        emittedWorkerUrls(),
      ]);
      const precacheUrls = dedupeUrls([
        ...appShellUrls,
        ...workerUrls,
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
