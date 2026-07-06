import { defineConfig } from 'vitest/config';
import { appAliases } from './vite.config';

export default defineConfig({
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
