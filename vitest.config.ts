import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Compiles `.svelte.ts` rune modules (`$state`, `$derived`) so tests can
  // import them. Vitest's node environment gives the server build: effects
  // never run. `configFile: false` because the Svelte config lives in
  // vite.config.ts now, and the defaults are all a rune module needs.
  plugins: [svelte({ configFile: false })],
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
