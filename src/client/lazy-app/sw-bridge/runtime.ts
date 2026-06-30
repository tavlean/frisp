// Service-worker registration helper, the surviving piece of Squoosh's
// sw-bridge. The rest of the bridge (getSharedImage/offliner/mainAppLoaded and
// their 'share-ready' / 'skip-waiting' / 'cache-all' messages) was deleted as
// dead surface: nothing called it, and the SvelteKit service worker has no
// message handlers — its install is self-contained (variant-aware precache,
// see src/service-worker.ts).

function getServiceWorkerContainer(
  serviceWorker?: ServiceWorkerContainer,
): ServiceWorkerContainer | undefined {
  if (serviceWorker) return serviceWorker;
  if (typeof navigator === 'undefined') return undefined;
  return navigator.serviceWorker;
}

let autoReloadBound = false;
let waitingWorker: ServiceWorker | null = null;

/**
 * Reload the page once when a freshly-deployed worker takes over an
 * already-controlled tab (it activates via skipWaiting + clients.claim). Without
 * this the running document keeps referencing the previous build's hashed
 * chunks, which the just-activated worker has already purged from the cache.
 *
 * Bound only when a controller already exists: on a first visit there is no
 * controller yet, so the initial clients.claim() must not trigger a refresh for
 * every new visitor. Those visitors pick up auto-updates from their next load on.
 */
function bindControllerReload(container: ServiceWorkerContainer): void {
  if (autoReloadBound || !container.controller) return;
  autoReloadBound = true;
  let reloading = false;
  container.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

/**
 * Surface a worker sitting in the waiting state — a deploy that's downloaded but
 * not yet in control — via onUpdateReady, so the UI can offer a "refresh now"
 * prompt instead of swapping the page out from under the user. Catches both a
 * worker that finishes installing during this visit and one already waiting from
 * a previous visit. Only fires when a controller is active: with none, the
 * worker is the first install and activates on its own, replacing nothing.
 */
function trackWaitingWorker(
  container: ServiceWorkerContainer,
  registration: ServiceWorkerRegistration,
  onUpdateReady?: () => void,
): void {
  const surface = (worker: ServiceWorker | null) => {
    if (!worker || !container.controller) return;
    waitingWorker = worker;
    onUpdateReady?.();
  };

  surface(registration.waiting);

  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed') surface(installing);
    });
  });
}

/**
 * Ask the waiting worker to take over (it calls skipWaiting on this message).
 * activate's clients.claim() then swaps the controller and the controllerchange
 * listener reloads the tab onto the new build. No-op if nothing is waiting.
 */
export function applyServiceWorkerUpdate(): void {
  waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
}

export async function registerServiceWorkerUrl(
  serviceWorkerUrl: string,
  {
    isProduction,
    serviceWorker,
    onUpdateReady,
  }: {
    isProduction: boolean;
    serviceWorker?: ServiceWorkerContainer;
    onUpdateReady?: () => void;
  },
): Promise<ServiceWorkerRegistration | undefined> {
  const container = getServiceWorkerContainer(serviceWorker);
  if (!isProduction || !container) return undefined;
  bindControllerReload(container);
  // `updateViaCache: 'none'` forces the browser to revalidate service-worker.js
  // against the network on every check, so a stale copy in the HTTP/edge cache
  // can't hide a new deploy.
  const registration = await container.register(serviceWorkerUrl, {
    updateViaCache: 'none',
  });
  trackWaitingWorker(container, registration, onUpdateReady);
  return registration;
}
