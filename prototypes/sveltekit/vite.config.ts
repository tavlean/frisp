import { sveltekit } from '@sveltejs/kit/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      'client/lazy-app/feature-meta': fileURLToPath(
        new URL('./src/lib/sqush-feature-meta-stub.ts', import.meta.url),
      ),
      client: fileURLToPath(new URL('../../src/client', import.meta.url)),
      features: fileURLToPath(new URL('../../src/features', import.meta.url)),
      shared: fileURLToPath(new URL('../../src/shared', import.meta.url)),
    },
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
