import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
  preprocess: vitePreprocess(),
  kit: {
    alias: {
      'client/lazy-app/feature-meta/shared':
        './.svelte-kit/presk-generated/feature-meta/shared.ts',
      'client/lazy-app/feature-meta/encoders':
        './.svelte-kit/presk-generated/feature-meta/encoders.ts',
      'client/lazy-app/feature-meta':
        './.svelte-kit/presk-generated/feature-meta/index.ts',
      'presk-generated': './.svelte-kit/presk-generated',
      client: './src/client',
      codecs: './codecs',
      features: './src/features',
      shared: './src/shared',
      sw: './src/sw',
      'worker-shared': './src/worker-shared',
    },
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: '200.html',
      strict: false,
    }),
    serviceWorker: {
      register: false,
      // `static/_headers` is a host-side config file (Netlify/Cloudflare consume
      // it to set the COOP/COEP cross-origin-isolation headers); it is not a
      // fetchable asset, so keep it out of the service-worker precache manifest
      // or `cache.addAll` would reject on its 404. Mirrors the SvelteKit default
      // that drops `.DS_Store`.
      files: (filename) =>
        !/\.DS_Store/.test(filename) && filename !== '_headers',
    },
  },
};

export default config;
