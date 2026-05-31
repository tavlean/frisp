import { registerServiceWorkerUrl } from 'client/lazy-app/sw-bridge/runtime';
import { base } from '$app/paths';
import { browser, dev } from '$app/environment';

/** localStorage flag set by the `?sw` opt-in (see `localhostSwForced`). */
const FORCE_LOCALHOST_SW_KEY = 'sqush:force-localhost-sw';

/**
 * Loopback / localhost-style origins. A registered service worker lives in the
 * browser tied to the origin, so it outlives the dev-server process — and
 * because localhost ports get reused across unrelated projects, a leftover
 * cache-first worker hijacks whatever app is served on that port next, answering
 * with stale cross-app content. So we never leave a worker on these origins.
 */
function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') || // portless-style names
    hostname === '127.0.0.1' ||
    hostname.startsWith('127.') || // 127.0.0.0/8
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname === '0.0.0.0'
  );
}

/**
 * Opt-in for deliberately testing the production service worker on a loopback
 * origin (e.g. `vite preview` offline QA): visit `?sw` (or `?sw=1`) to enable,
 * `?sw=0` (or `?sw=off`) to disable. The choice is persisted because the SW
 * lifecycle spans reloads.
 */
function localhostSwForced(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const value = new URLSearchParams(location.search).get('sw');
    if (value !== null) {
      const enable = ['', '1', 'true', 'on', 'force'].includes(value);
      if (enable) localStorage.setItem(FORCE_LOCALHOST_SW_KEY, '1');
      else localStorage.removeItem(FORCE_LOCALHOST_SW_KEY);
    }
    return localStorage.getItem(FORCE_LOCALHOST_SW_KEY) === '1';
  } catch {
    // localStorage can throw in private-browsing modes.
    return false;
  }
}

/** Unregister any existing worker and clear Cache Storage for this origin. */
async function teardownServiceWorkers(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
  }
  if (typeof caches !== 'undefined') {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

/**
 * Register the SvelteKit-native service worker on the real deployed origin only.
 * In dev — and on any loopback/localhost origin running a production build — do
 * the opposite: proactively unregister any leftover worker and clear Cache
 * Storage, then skip registration. This keeps full offline PWA behavior on the
 * deployed domain while guaranteeing a locally-run build never leaves a worker
 * that can hijack another app sharing the port, and self-heals a
 * previously-polluted localhost origin on the next load. Use `?sw` to opt back
 * in for deliberate local SW/offline testing.
 */
export async function registerSqushServiceWorker(): Promise<
  ServiceWorkerRegistration | undefined
> {
  if (!browser) return undefined;

  const skipRegistration =
    dev || (isLoopbackHost(location.hostname) && !localhostSwForced());

  if (skipRegistration) {
    await teardownServiceWorkers();
    return undefined;
  }

  return registerServiceWorkerUrl(`${base}/service-worker.js`, {
    isProduction: true,
  });
}
