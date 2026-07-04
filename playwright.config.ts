import { defineConfig, devices } from '@playwright/test';

// E2E regression suite. Runs against the PRODUCTION static build served by
// `vite preview`, so it exercises the real emitted codec assets, the generated
// service worker, and the COOP/COEP cross-origin-isolation headers (which the
// `presk-cross-origin-isolation` plugin injects into preview too). This is the
// automated safety net for codec changes — run it after any codec/build change.
const PORT = 4317;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: true,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
      },
    },
    // WebKit = the engine Safari ships. The codecs are emscripten/wasm-bindgen
    // WASM, and Safari's JS/WASM engine (JavaScriptCore) differs from V8, so this
    // is the cross-engine guard for codec rebuilds. Run with `--project=webkit`.
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
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
