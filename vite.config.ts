import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Connect, type Plugin } from 'vite';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));

// Cross-origin isolation headers. WASM threads need SharedArrayBuffer, which is
// only available when the page is cross-origin isolated. These restore the
// COOP/COEP pair that upstream Squoosh shipped (dropped when the app moved to
// root), so the existing multithreaded codec builds (_mt / _mt_simd / parallel)
// can light up. Production hosts get the same pair via static/_headers.
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

// Vite's `server.headers` / `preview.headers` are NOT applied to SvelteKit's own
// page (document) responses, so the top-level document never became cross-origin
// isolated and SharedArrayBuffer stayed unavailable. This plugin injects the
// COOP/COEP pair via middleware on EVERY dev/preview response, including the
// SvelteKit-rendered page, which is what actually flips `crossOriginIsolated`.
const setIsolationHeaders = (
  _req: Connect.IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction,
) => {
  for (const [k, v] of Object.entries(crossOriginIsolationHeaders))
    res.setHeader(k, v);
  next();
};

const crossOriginIsolation: Plugin = {
  name: 'app-cross-origin-isolation',
  configureServer(server) {
    server.middlewares.use(setIsolationHeaders);
  },
  configurePreviewServer(server) {
    server.middlewares.use(setIsolationHeaders);
  },
};

// The prebuilt Emscripten pthread worker scripts (`*_mt(.worker).js`) are CLASSIC
// workers and must reach the browser byte-for-byte. Under `vite dev`, a direct
// request for one of these `.js` files is run through Vite's JS transform, which
// prepends an ESM `import { … } from "/@vite/client"` preamble — illegal in a
// classic worker, so it throws on load. The Emscripten glue then spawns its
// PTHREAD_POOL_SIZE workers, none come online, and the main thread waits: threaded
// codecs (AVIF, JXL) stall and an encode that takes <0.5s in a production build
// takes 20-40s in dev. A `vite build` emits these as raw hashed assets, so the bug
// is dev-only — which is why it never showed in the deployed app and only bites
// contributors running the dev server. This middleware serves the worker files
// from disk untransformed, matching prod, so `npm run dev` "just works" with no
// per-developer setup. The `?url` / `?worker` *module* forms (which must return the
// JS that exports the asset URL, not the raw bytes) are left to Vite.
const RAW_CODEC_WORKER_RE = /^\/codecs\/.+_mt(_simd)?\.worker\.js$/;
const codecsRoot = join(repoRoot, 'codecs') + sep;
const serveRawCodecWorker = (
  req: Connect.IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction,
) => {
  const url = req.url ?? '';
  const pathname = url.split('?')[0];
  const hasModuleQuery = /[?&](url|import|worker|raw)\b/.test(url);
  if (hasModuleQuery || !RAW_CODEC_WORKER_RE.test(pathname)) return next();
  let body: Buffer;
  try {
    const filePath = join(repoRoot, decodeURIComponent(pathname));
    // Path-traversal guard: only ever serve real files inside codecs/.
    if (!filePath.startsWith(codecsRoot)) return next();
    body = readFileSync(filePath);
  } catch {
    return next();
  }
  res.setHeader('Content-Type', 'text/javascript');
  for (const [k, v] of Object.entries(crossOriginIsolationHeaders))
    res.setHeader(k, v);
  res.end(body);
};

const rawThreadedCodecWorkers: Plugin = {
  name: 'app-raw-threaded-codec-workers',
  // Registered in the configureServer body (not a returned post-hook) so it runs
  // BEFORE Vite's internal transform middleware and can short-circuit the request.
  configureServer(server) {
    server.middlewares.use(serveRawCodecWorker);
  },
};

// The /lab, /bench-svg, and /diagnostics routes are dev-only tools. Their +page.svelte files
// guard on `dev` and render "Not found" in production — but that is a RUNTIME
// check, so the route component and its heavy `$lib/lab` deps are still emitted
// as client chunks and precached by the service worker (build.filter in
// service-worker.ts caches every emitted asset). That is ~200 KB of dead
// experimental UI installed on every visit, contradicting the invariant those
// routes assert ("must NEVER be emitted into a production build").
//
// This enforces it: in production builds ONLY, replace each dev-only +page.svelte
// with a tiny "Not found" stub, so none of the lab/bench UI (or its $lib/lab
// code, which nothing else imports) is bundled, emitted, or precached. `vite dev`
// is untouched, so the lab stays fully usable while developing.
const DEV_ONLY_PAGE_RE =
  /\/src\/routes\/(?:lab|bench-svg|diagnostics)\/.*\+page\.svelte$/;
// Layouts under those trees (the lab tab bar) become bare pass-throughs: a
// layout must still render its children or every stubbed page under it would
// disappear from the build output.
const DEV_ONLY_LAYOUT_RE =
  /\/src\/routes\/(?:lab|bench-svg)\/.*\+layout\.svelte$/;
const stripDevOnlyRoutesInProd: Plugin = {
  name: 'app-strip-dev-only-routes',
  apply: 'build',
  enforce: 'pre',
  load(id) {
    const path = id.split('?')[0].split('\\').join('/');
    if (DEV_ONLY_PAGE_RE.test(path)) return '<p>Not found.</p>\n';
    if (DEV_ONLY_LAYOUT_RE.test(path))
      return '<script>let { children } = $props();</script>{@render children()}\n';
    return null;
  },
};

// The service worker's precache list comes from SvelteKit's `build`, which
// leaves out the worker chunks Vite emits for `new Worker(new URL(...))`: the
// codec worker, the SVG optimizer, and OxiPNG's thread helper. Without them the
// WASM was cached but nothing could load it, so a first offline encode failed
// until an online visit had fetched each worker once. This records the emitted
// workers in `_app/worker-precache.json`, which the service worker reads at
// install. Diagnostics probe workers stay out (see service-worker.ts).
export const WORKER_PRECACHE_MANIFEST = '_app/worker-precache.json';
const workerPrecacheManifest: Plugin = {
  name: 'app-worker-precache-manifest',
  apply: 'build',
  generateBundle(_options, bundle) {
    const files = Object.keys(bundle);
    // Only the SvelteKit client build carries its start entry; the SSR,
    // service-worker, and nested worker builds pass through untouched.
    if (!files.some((file) => /\/entry\/start\.[^/]+\.js$/.test(file))) return;
    const workers = files
      .filter((file) => /\/workers\/[^/]+\.js$/.test(file))
      .filter((file) => !/probe\.worker[^/]*\.js$/.test(file))
      .map((file) => `/${file}`)
      .sort();
    this.emitFile({
      type: 'asset',
      fileName: WORKER_PRECACHE_MANIFEST,
      source: JSON.stringify(workers),
    });
  },
};

// The service worker names its cache after SvelteKit's version, so the
// default (a build timestamp) made every rebuild of identical code look like a
// new release and re-download the whole precache on every install. A clean
// tree names the build after its commit instead. A dirty or non-git tree
// returns undefined so SvelteKit falls back to the timestamp: reusing a commit
// name for different code would leave users on a stale cache.
function commitVersionName(): string | undefined {
  try {
    const run = (command: string) =>
      execSync(command, {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    if (run('git status --porcelain') !== '') return undefined;
    return run('git rev-parse --short=12 HEAD');
  } catch {
    return undefined;
  }
}

export default defineConfig({
  plugins: [
    rawThreadedCodecWorkers,
    crossOriginIsolation,
    stripDevOnlyRoutesInProd,
    workerPrecacheManifest,
    // SvelteKit 3 reads its config here; svelte.config.js is gone.
    sveltekit({
      // The host serves 404.html for unknown paths (wrangler.jsonc). With a
      // fallback set, the adapter never runs its `strict` check; if the
      // fallback is ever removed, set `strict: false`, because the lab and
      // bench routes are not prerendered.
      adapter: adapter({ fallback: '404.html' }),
      compilerOptions: { discloseVersion: false },
      serviceWorker: { register: false },
      // SvelteKit 3 polls `_app/version.json` hourly by default. Updates
      // here come through the service worker's waiting-worker prompt, so
      // keep SvelteKit 2's behavior of not polling.
      version: { name: commitVersionName(), pollInterval: 0 },
    }),
  ],
  optimizeDeps: {
    // Only imported inside lazily-spawned codec workers (and the SW), so Vite's
    // start-up scan never sees it; it gets discovered mid-session on the first
    // encode ("✨ new dependencies optimized"), which can force a dev-server
    // page reload. Pre-bundle it up front instead. Dev-only; builds are
    // unaffected.
    include: ['wasm-feature-detect'],
  },
  build: {
    // Never inline WASM, nor the threaded (pthread / rayon) codec glue + worker
    // scripts. A `*_mt(.worker).js` is ~2 kB — below the default inline limit —
    // so Vite would emit it as a `data:` URI, but pthread workers must be real,
    // fetchable files (a `data:` worker breaks under COEP and in WebKit), and the
    // audit + service-worker manifest expect emitted files, not inlined URIs.
    assetsInlineLimit: (filePath) => {
      if (filePath.endsWith('.wasm')) return false;
      if (/_mt(_simd)?(\.worker)?\.js$/.test(filePath)) return false;
      return undefined;
    },
  },
  server: {
    headers: crossOriginIsolationHeaders,
    fs: {
      allow: [repoRoot],
    },
  },
  preview: {
    headers: crossOriginIsolationHeaders,
  },
});
