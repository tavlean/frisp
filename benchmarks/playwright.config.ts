import { defineConfig, devices } from '@playwright/test';

// Codec BENCHMARK harness — separate from the e2e regression suite so the
// (slow, data-producing) benchmark is opt-in via `npm run bench`. Same
// production-preview server as the e2e config. Single worker, no retries, so
// the timing numbers are clean and comparable.
const PORT = 4318;

export default defineConfig({
  testDir: 'benchmarks',
  testMatch: '**/*.bench.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 600_000,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
      },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
