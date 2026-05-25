import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
  preprocess: vitePreprocess(),
  kit: {
    alias: {
      'client/lazy-app/feature-meta': './src/lib/sqush-feature-meta-stub.ts',
      client: '../../src/client',
      features: '../../src/features',
      shared: '../../src/shared',
    },
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: '200.html',
      strict: false,
    }),
  },
};

export default config;
