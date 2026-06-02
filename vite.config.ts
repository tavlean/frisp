import { sveltekit } from '@sveltejs/kit/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

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

export default defineConfig({
  plugins: [sveltekit()],
  build: {
    assetsInlineLimit: (filePath) =>
      filePath.endsWith('.wasm') ? false : undefined,
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
