import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
  preprocess: vitePreprocess(),
  kit: {
    alias: {
      'client/lazy-app/feature-meta/shared':
        './.svelte-kit/sqush-generated/feature-meta/shared.ts',
      'client/lazy-app/feature-meta':
        './.svelte-kit/sqush-generated/feature-meta/index.ts',
      'sqush-generated': './.svelte-kit/sqush-generated',
      client: '../../src/client',
      codecs: '../../codecs',
      features: '../../src/features',
      shared: '../../src/shared',
      sw: '../../src/sw',
      'worker-shared': '../../src/worker-shared',
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
