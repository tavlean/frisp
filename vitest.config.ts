import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import { appAliases } from './vite.config';

export default defineConfig({
  // Compiles `.svelte.ts` rune modules (`$state`, `$derived`) so tests can
  // import them. Vitest's node environment gives the server build: effects
  // never run. `configFile: false` because the Svelte config lives in
  // vite.config.ts now, and the defaults are all a rune module needs.
  plugins: [svelte({ configFile: false })],
  // Same alias map as the app build (vitest does not inherit vite.config.ts
  // when a standalone vitest config exists) — without it, any test that
  // transitively loads a source module using an aliased import fails at
  // collection, silently shrinking the suite.
  resolve: {
    alias: appAliases,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
