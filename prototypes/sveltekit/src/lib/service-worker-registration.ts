import { registerServiceWorkerUrl } from '../../../../src/client/lazy-app/sw-bridge/runtime';
import { base } from '$app/paths';

/**
 * In production, register the SvelteKit-native service worker. In dev, do the
 * opposite: actively unregister any leftover service worker and clear Cache
 * Storage. A cache-first SW left behind by an earlier production preview on the
 * same port would otherwise keep serving stale app code on the dev server,
 * masking edits even across reloads.
 */
export async function registerPrototypeServiceWorker(): Promise<
  ServiceWorkerRegistration | undefined
> {
  if (import.meta.env.DEV) {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    return undefined;
  }

  return registerServiceWorkerUrl(`${base}/service-worker.js`, {
    isProduction: true,
  });
}
