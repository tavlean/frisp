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

// Activating an update reloads EVERY controlled tab (controllerchange above),
// and the activated worker purges the old build's cache, so a tab cannot
// safely stay on the old build. Before activating, the tab that accepted the
// update asks the others over this channel whether any holds open images.
const TAB_CHANNEL = 'app:tabs';
const THIS_TAB = Math.random().toString(36).slice(2);

type TabMessage =
  | { type: 'busy?'; from: string; query: string }
  | { type: 'busy'; query: string };

interface TabOptions {
  /** Overridable so tests can stand up several "tabs" in one process. */
  tabId?: string;
  channelName?: string;
}

/** Answer other tabs' busy queries while `isBusy()` holds. Returns a disposer. */
export function answerBusyQueries(
  isBusy: () => boolean,
  { tabId = THIS_TAB, channelName = TAB_CHANNEL }: TabOptions = {},
): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const channel = new BroadcastChannel(channelName);
  channel.onmessage = (event: MessageEvent<TabMessage>) => {
    const message = event.data;
    if (message?.type !== 'busy?' || message.from === tabId) return;
    if (isBusy()) channel.postMessage({ type: 'busy', query: message.query });
  };
  return () => channel.close();
}

/**
 * Whether any OTHER open tab reports open images. Resolves false when nobody
 * answers within `waitMs`, which is also the answer where BroadcastChannel is
 * missing: the update then behaves as it always did.
 */
export function anotherTabIsBusy({
  tabId = THIS_TAB,
  channelName = TAB_CHANNEL,
  waitMs = 250,
}: TabOptions & { waitMs?: number } = {}): Promise<boolean> {
  if (typeof BroadcastChannel === 'undefined') return Promise.resolve(false);
  return new Promise((resolve) => {
    const channel = new BroadcastChannel(channelName);
    const query = Math.random().toString(36).slice(2);
    const finish = (busy: boolean) => {
      clearTimeout(timer);
      channel.close();
      resolve(busy);
    };
    const timer = setTimeout(() => finish(false), waitMs);
    channel.onmessage = (event: MessageEvent<TabMessage>) => {
      const message = event.data;
      if (message?.type === 'busy' && message.query === query) finish(true);
    };
    channel.postMessage({ type: 'busy?', from: tabId, query });
  });
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
