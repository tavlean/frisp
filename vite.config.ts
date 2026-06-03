import { readFileSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  name: 'sqush-cross-origin-isolation',
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
  const filePath = join(repoRoot, decodeURIComponent(pathname));
  // Path-traversal guard: only ever serve real files inside codecs/.
  if (!filePath.startsWith(codecsRoot)) return next();
  let body: Buffer;
  try {
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
  name: 'sqush-raw-threaded-codec-workers',
  // Registered in the configureServer body (not a returned post-hook) so it runs
  // BEFORE Vite's internal transform middleware and can short-circuit the request.
  configureServer(server) {
    server.middlewares.use(serveRawCodecWorker);
  },
};

export default defineConfig({
  plugins: [rawThreadedCodecWorkers, crossOriginIsolation, sveltekit()],
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
  resolve: {
    alias: {
      'client/lazy-app/feature-meta/shared': fileURLToPath(
        new URL(
          './.svelte-kit/sqush-generated/feature-meta/shared.ts',
          import.meta.url,
        ),
      ),
      'client/lazy-app/feature-meta/encoders': fileURLToPath(
        new URL(
          './.svelte-kit/sqush-generated/feature-meta/encoders.ts',
          import.meta.url,
        ),
      ),
      'client/lazy-app/feature-meta': fileURLToPath(
        new URL(
          './.svelte-kit/sqush-generated/feature-meta/index.ts',
          import.meta.url,
        ),
      ),
      'sqush-generated': fileURLToPath(
        new URL('./.svelte-kit/sqush-generated', import.meta.url),
      ),
      codecs: fileURLToPath(new URL('./codecs', import.meta.url)),
      client: fileURLToPath(new URL('./src/client', import.meta.url)),
      features: fileURLToPath(new URL('./src/features', import.meta.url)),
      shared: fileURLToPath(new URL('./src/shared', import.meta.url)),
      sw: fileURLToPath(new URL('./src/sw', import.meta.url)),
      'worker-shared': fileURLToPath(
        new URL('./src/worker-shared', import.meta.url),
      ),
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
