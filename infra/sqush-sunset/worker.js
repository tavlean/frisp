// Sunset Worker for the old sqush.app domain (app renamed to Presk / presk.app
// on 2026-07-05).
//
// Two jobs:
// 1. `/service-worker.js` → a self-destructing service worker. The old app was
//    an offline-first PWA whose service worker serves the app shell
//    cache-first, so a plain 301 on the zone can never reach returning
//    visitors: navigations are answered from cache, and the browser's SW
//    update check fails on a redirected script fetch, pinning the old worker
//    forever. Browsers still run that update check against this URL on every
//    navigation, so serving a byte-different worker here is the one doorway
//    left. It installs, deletes all caches, unregisters, and re-navigates open
//    tabs — which then hit the network and follow the redirect below.
// 2. Every other request → 301 to the same path + query on presk.app.
//
// Requires the zone's Single Redirect Rule to be OFF (redirect rules run
// before Workers in Cloudflare's traffic sequence, so while the rule is on
// this Worker never sees a request). Keep this Worker deployed for at least a
// year; after that, remaining old installs are a lost cause anyway.

const KILL_SWITCH_SW = `// The app moved to https://presk.app — this worker dismantles the old one.
self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        // Re-navigating releases the page from this registration; the request
        // then reaches the network and the 301 carries it to presk.app.
        client.navigate(client.url).catch(() => {});
      }
    })(),
  );
});
`;

export default {
  fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/service-worker.js') {
      return new Response(KILL_SWITCH_SW, {
        headers: {
          'content-type': 'application/javascript; charset=utf-8',
          // The browser must re-check this URL freely so the kill switch can
          // never itself get pinned.
          'cache-control': 'no-cache',
        },
      });
    }
    const target = new URL(url.pathname + url.search, 'https://presk.app');
    return Response.redirect(target.toString(), 301);
  },
};
